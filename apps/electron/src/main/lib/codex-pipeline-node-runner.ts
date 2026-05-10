import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type {
  PipelineNodeKind,
  PipelineStreamEvent,
  ProviderType,
} from '@rv-insights/shared'
import { getEffectiveProxyUrl } from './proxy-settings-service'
import { decryptApiKey, getChannelById } from './channel-manager'
import {
  getAgentWorkspace,
  getWorkspaceAttachedDirectories,
} from './agent-workspace-manager'
import {
  getAgentSessionWorkspacePath,
} from './config-paths'
import {
  buildNodeExecutionResult,
  buildPipelineNodePrompts,
  pipelineNodeJsonSchema,
  type PipelineNodeExecutionContext,
  type PipelineNodeExecutionResult,
  type PipelineNodeRunner,
} from './pipeline-node-runner'

type CodexNodeKind = Extract<PipelineNodeKind, 'developer' | 'reviewer'>
type CodexSandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'
type CodexApprovalPolicy = 'never' | 'on-request' | 'on-failure' | 'untrusted'
export type CodexPipelineBackend = 'sdk' | 'cli'

const CODEX_PLATFORM_PACKAGE_BY_TARGET: Record<string, string> = {
  'x86_64-unknown-linux-musl': '@openai/codex-linux-x64',
  'aarch64-unknown-linux-musl': '@openai/codex-linux-arm64',
  'x86_64-apple-darwin': '@openai/codex-darwin-x64',
  'aarch64-apple-darwin': '@openai/codex-darwin-arm64',
  'x86_64-pc-windows-msvc': '@openai/codex-win32-x64',
  'aarch64-pc-windows-msvc': '@openai/codex-win32-arm64',
}

function createModuleRequire(): NodeJS.Require {
  const filename = typeof __filename === 'string'
    ? __filename
    : join(process.cwd(), 'package.json')
  return createRequire(filename)
}

interface ResolvedCodexWorkspace {
  name?: string
  cwd?: string
  additionalDirectories: string[]
}

interface CodexRuntimeOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
}

export interface CodexCliRunInput {
  sessionId: string
  prompt: string
  schema: Record<string, unknown>
  cwd?: string
  additionalDirectories: string[]
  env: Record<string, string>
  apiKey?: string
  baseUrl?: string
  model?: string
  sandboxMode: CodexSandboxMode
  approvalPolicy: CodexApprovalPolicy
  signal?: AbortSignal
}

export interface CodexCliRunResult {
  finalResponse: string
}

export interface CodexCliExecutor {
  run(input: CodexCliRunInput): Promise<CodexCliRunResult>
  abort(sessionId: string): void
}

export interface CodexSdkOptions {
  codexPathOverride?: string
  baseUrl?: string
  apiKey?: string
  env?: Record<string, string>
}

export interface CodexSdkThreadOptions {
  model?: string
  sandboxMode?: CodexSandboxMode
  workingDirectory?: string
  skipGitRepoCheck?: boolean
  approvalPolicy?: CodexApprovalPolicy
  additionalDirectories?: string[]
}

export interface CodexSdkTurnOptions {
  outputSchema?: unknown
  signal?: AbortSignal
}

export interface CodexSdkTurn {
  finalResponse: string
}

export interface CodexSdkThread {
  run(input: string, options?: CodexSdkTurnOptions): Promise<CodexSdkTurn>
}

export interface CodexSdkClient {
  startThread(options?: CodexSdkThreadOptions): CodexSdkThread
}

export type CreateCodexSdkClient = (
  options: CodexSdkOptions,
) => CodexSdkClient | Promise<CodexSdkClient>

export interface CodexPipelineNodeRunnerOptions {
  channelId?: string
  workspaceId?: string
  onEvent?: (event: PipelineStreamEvent) => void
}

export interface CodexCliPipelineNodeRunnerOptions extends CodexPipelineNodeRunnerOptions {
  executor?: CodexCliExecutor
  codexPath?: string
}

export interface CodexSdkPipelineNodeRunnerOptions extends CodexPipelineNodeRunnerOptions {
  createCodexClient?: CreateCodexSdkClient
  codexPath?: string
}

export function isCodexPipelineNode(node: PipelineNodeKind): node is CodexNodeKind {
  return node === 'developer' || node === 'reviewer'
}

function resolveCodexTargetTriple(): string {
  if (process.platform === 'linux' || process.platform === 'android') {
    if (process.arch === 'x64') return 'x86_64-unknown-linux-musl'
    if (process.arch === 'arm64') return 'aarch64-unknown-linux-musl'
  }

  if (process.platform === 'darwin') {
    if (process.arch === 'x64') return 'x86_64-apple-darwin'
    if (process.arch === 'arm64') return 'aarch64-apple-darwin'
  }

  if (process.platform === 'win32') {
    if (process.arch === 'x64') return 'x86_64-pc-windows-msvc'
    if (process.arch === 'arm64') return 'aarch64-pc-windows-msvc'
  }

  throw new Error(`不支持的 Codex CLI 平台: ${process.platform} (${process.arch})`)
}

export function resolveCodexCliPath(): string {
  const targetTriple = resolveCodexTargetTriple()
  const platformPackage = CODEX_PLATFORM_PACKAGE_BY_TARGET[targetTriple]
  if (!platformPackage) {
    throw new Error(`不支持的 Codex CLI target: ${targetTriple}`)
  }

  const cjsRequire = createModuleRequire()
  const codexPackageJsonPath = cjsRequire.resolve('@openai/codex/package.json')
  const codexRequire = createRequire(codexPackageJsonPath)
  const platformPackageJsonPath = codexRequire.resolve(`${platformPackage}/package.json`)
  const vendorRoot = join(dirname(platformPackageJsonPath), 'vendor')
  const binaryName = process.platform === 'win32' ? 'codex.exe' : 'codex'
  let binaryPath = join(vendorRoot, targetTriple, 'codex', binaryName)

  try {
    const electronApp = cjsRequire('electron').app as { isPackaged?: boolean }
    if (electronApp?.isPackaged && binaryPath.includes('.asar')) {
      binaryPath = binaryPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
    }
  } catch {
    // test / 非 Electron 环境忽略
  }

  return binaryPath
}

function providerSupportsCodexChannel(provider: ProviderType): boolean {
  return provider === 'openai' || provider === 'custom'
}

function resolveCodexRuntime(channelId?: string): CodexRuntimeOptions {
  if (!channelId) return {}

  const channel = getChannelById(channelId)
  if (!channel) {
    throw new Error(`未找到 Codex 渠道: ${channelId}`)
  }

  if (!providerSupportsCodexChannel(channel.provider)) {
    throw new Error(`Codex 节点需要 OpenAI 或 Custom 渠道，当前为 ${channel.provider}`)
  }

  if (!channel.enabled) {
    throw new Error(`Codex 渠道已禁用: ${channel.name}`)
  }

  const enabledModel = channel.models.find((model) => model.enabled)
  return {
    apiKey: decryptApiKey(channelId),
    baseUrl: channel.baseUrl || undefined,
    model: enabledModel?.id ?? channel.models[0]?.id,
  }
}

async function buildCodexEnv(): Promise<Record<string, string>> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('ANTHROPIC_')) continue
    if (key === 'CODEX_THREAD_ID') continue
    if (value !== undefined) {
      env[key] = value
    }
  }

  const proxyUrl = await getEffectiveProxyUrl()
  if (proxyUrl) {
    env.HTTPS_PROXY = proxyUrl
    env.HTTP_PROXY = proxyUrl
  }

  return env
}

function resolveCodexWorkspace(
  workspaceId: string | undefined,
  sessionId: string,
): ResolvedCodexWorkspace {
  if (!workspaceId) {
    return { additionalDirectories: [] }
  }

  const workspace = getAgentWorkspace(workspaceId)
  if (!workspace) {
    return { additionalDirectories: [] }
  }

  return {
    name: workspace.name,
    cwd: getAgentSessionWorkspacePath(workspace.slug, sessionId),
    additionalDirectories: getWorkspaceAttachedDirectories(workspace.slug),
  }
}

function codexSandboxModeForNode(node: CodexNodeKind): CodexSandboxMode {
  return node === 'developer' ? 'workspace-write' : 'read-only'
}

function buildCodexPrompt(
  node: CodexNodeKind,
  context: PipelineNodeExecutionContext,
  workspaceName?: string,
): string {
  const prompts = buildPipelineNodePrompts(node, context, workspaceName)
  return [
    prompts.systemPrompt,
    '',
    '执行要求：',
    '- 你正在作为 Codex 执行 RV Pipeline 节点。',
    '- 请完成节点职责后，只返回符合 JSON Schema 的最终 JSON 对象。',
    '- 不要在最终响应中添加 Markdown fence、解释文字或 schema 外字段。',
    '',
    prompts.userPrompt,
  ].join('\n')
}

function emitNodeStart(
  onEvent: ((event: PipelineStreamEvent) => void) | undefined,
  node: CodexNodeKind,
): void {
  onEvent?.({
    type: 'node_start',
    node,
    createdAt: Date.now(),
  })
}

function emitNodeResult(
  onEvent: ((event: PipelineStreamEvent) => void) | undefined,
  node: CodexNodeKind,
  result: PipelineNodeExecutionResult,
): void {
  if (result.output) {
    onEvent?.({
      type: 'text_delta',
      node,
      delta: result.output,
      createdAt: Date.now(),
    })
  }

  onEvent?.({
    type: 'node_complete',
    node,
    output: result.output,
    summary: result.summary,
    approved: result.approved,
    issues: result.issues,
    artifact: result.stageOutput,
    createdAt: Date.now(),
  })
}

function ensureCodexNode(node: PipelineNodeKind): asserts node is CodexNodeKind {
  if (!isCodexPipelineNode(node)) {
    throw new Error(`Codex Pipeline runner 不支持节点: ${node}`)
  }
}

function formatTomlString(value: string): string {
  return JSON.stringify(value)
}

export interface CodexCliCommandInput {
  schemaPath: string
  outputPath: string
  cwd?: string
  additionalDirectories: string[]
  baseUrl?: string
  model?: string
  sandboxMode: CodexSandboxMode
  approvalPolicy: CodexApprovalPolicy
}

export function buildCodexCliArgs(input: CodexCliCommandInput): string[] {
  const args = [
    'exec',
    '--json',
    '--sandbox',
    input.sandboxMode,
    '--output-schema',
    input.schemaPath,
    '--output-last-message',
    input.outputPath,
    '--config',
    `approval_policy=${formatTomlString(input.approvalPolicy)}`,
    '--skip-git-repo-check',
  ]

  if (input.baseUrl) {
    args.push('--config', `openai_base_url=${formatTomlString(input.baseUrl)}`)
  }

  if (input.model) {
    args.push('--model', input.model)
  }

  if (input.cwd) {
    args.push('--cd', input.cwd)
  }

  for (const directory of input.additionalDirectories) {
    args.push('--add-dir', directory)
  }

  return args
}

function extractAgentMessageText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const event = value as { type?: unknown; item?: unknown }
  if (event.type !== 'item.completed' || !event.item || typeof event.item !== 'object') {
    return null
  }

  const item = event.item as { type?: unknown; text?: unknown }
  if (item.type !== 'agent_message' || typeof item.text !== 'string') {
    return null
  }

  return item.text
}

export interface CodexCliProcessTreeKillOptions {
  platform?: NodeJS.Platform
  runTaskkill?: (pid: number) => void
  killProcessGroup?: (pid: number) => void
}

export function buildWindowsTaskkillArgs(pid: number): string[] {
  return ['/F', '/T', '/PID', String(pid)]
}

function runWindowsTaskkill(pid: number): void {
  execFileSync('taskkill', buildWindowsTaskkillArgs(pid), {
    stdio: 'ignore',
    timeout: 3_000,
  })
}

function killPosixProcessGroup(pid: number): void {
  process.kill(-pid, 'SIGKILL')
}

export function killCodexCliProcessTree(
  child: ChildProcessWithoutNullStreams,
  options: CodexCliProcessTreeKillOptions = {},
): void {
  const pid = child.pid
  if (!pid) {
    child.kill('SIGKILL')
    return
  }

  try {
    if ((options.platform ?? process.platform) === 'win32') {
      const runTaskkill = options.runTaskkill ?? runWindowsTaskkill
      runTaskkill(pid)
      return
    }

    const killProcessGroup = options.killProcessGroup ?? killPosixProcessGroup
    killProcessGroup(pid)
  } catch {
    try {
      child.kill('SIGKILL')
    } catch {
      // 进程可能已经退出，忽略清理竞态。
    }
  }
}

function assertCodexCliRunNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('Codex CLI 执行已中止')
  }
}

export class SpawnCodexCliExecutor implements CodexCliExecutor {
  private readonly codexPath: string
  private readonly activeChildren = new Map<string, ChildProcessWithoutNullStreams>()

  constructor(codexPath = resolveCodexCliPath()) {
    this.codexPath = codexPath
  }

  abort(sessionId: string): void {
    const child = this.activeChildren.get(sessionId)
    if (!child) return
    killCodexCliProcessTree(child)
  }

  async run(input: CodexCliRunInput): Promise<CodexCliRunResult> {
    assertCodexCliRunNotAborted(input.signal)

    const tempDir = await mkdtemp(join(tmpdir(), 'rv-pipeline-codex-'))
    const schemaPath = join(tempDir, 'schema.json')
    const outputPath = join(tempDir, 'final-response.json')
    let handleAbort: (() => void) | undefined

    try {
      await writeFile(schemaPath, JSON.stringify(input.schema), 'utf8')
      const args = buildCodexCliArgs({
        schemaPath,
        outputPath,
        cwd: input.cwd,
        additionalDirectories: input.additionalDirectories,
        baseUrl: input.baseUrl,
        model: input.model,
        sandboxMode: input.sandboxMode,
        approvalPolicy: input.approvalPolicy,
      })
      const env = { ...input.env }
      if (input.apiKey) {
        env.CODEX_API_KEY = input.apiKey
      }

      const child = spawn(this.codexPath, args, {
        env,
        detached: process.platform !== 'win32',
      })
      this.activeChildren.set(input.sessionId, child)

      let spawnError: Error | null = null
      child.once('error', (error) => {
        spawnError = error
      })
      handleAbort = () => {
        killCodexCliProcessTree(child)
      }
      input.signal?.addEventListener('abort', handleAbort, { once: true })
      if (input.signal?.aborted) {
        killCodexCliProcessTree(child)
        assertCodexCliRunNotAborted(input.signal)
      }
      child.stdin.write(input.prompt)
      child.stdin.end()

      const stderrChunks: Buffer[] = []
      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk)
      })

      const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
        child.once('exit', (code, signal) => {
          resolve({ code, signal })
        })
      })

      let finalResponseFromEvents = ''
      const reader = createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      })

      try {
        for await (const line of reader) {
          if (!line.trim()) continue
          const parsed = JSON.parse(line) as unknown
          const text = extractAgentMessageText(parsed)
          if (text) {
            finalResponseFromEvents = text
          }
        }
      } finally {
        reader.close()
      }

      if (spawnError) {
        throw spawnError
      }

      const exit = await exitPromise
      assertCodexCliRunNotAborted(input.signal)
      if (exit.code !== 0 || exit.signal) {
        const detail = exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? 1}`
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim()
        throw new Error(`Codex CLI 执行失败 (${detail})${stderr ? `: ${stderr}` : ''}`)
      }

      assertCodexCliRunNotAborted(input.signal)
      const finalResponse = await readFile(outputPath, 'utf8')
        .then((content) => content.trim())
        .catch(() => finalResponseFromEvents.trim())
      assertCodexCliRunNotAborted(input.signal)
      if (!finalResponse) {
        throw new Error('Codex CLI 未返回最终响应')
      }

      return { finalResponse }
    } finally {
      this.activeChildren.delete(input.sessionId)
      if (handleAbort) {
        input.signal?.removeEventListener('abort', handleAbort)
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

export class CodexCliPipelineNodeRunner implements PipelineNodeRunner {
  private readonly channelId?: string
  private readonly workspaceId?: string
  private readonly onEvent?: (event: PipelineStreamEvent) => void
  private readonly executor: CodexCliExecutor

  constructor(options: CodexCliPipelineNodeRunnerOptions) {
    this.channelId = options.channelId
    this.workspaceId = options.workspaceId
    this.onEvent = options.onEvent
    this.executor = options.executor ?? new SpawnCodexCliExecutor(options.codexPath)
  }

  abort(sessionId: string): void {
    this.executor.abort(sessionId)
  }

  async runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    ensureCodexNode(node)
    if (context.signal?.aborted) {
      throw new Error('Pipeline 节点执行已中止')
    }

    const workspace = resolveCodexWorkspace(this.workspaceId, context.sessionId)
    const runtime = resolveCodexRuntime(this.channelId)
    const env = await buildCodexEnv()
    const prompt = buildCodexPrompt(node, context, workspace.name)

    emitNodeStart(this.onEvent, node)
    const response = await this.executor.run({
      sessionId: context.sessionId,
      prompt,
      schema: pipelineNodeJsonSchema(node),
      cwd: workspace.cwd,
      additionalDirectories: workspace.additionalDirectories,
      env,
      apiKey: runtime.apiKey,
      baseUrl: runtime.baseUrl,
      model: runtime.model,
      sandboxMode: codexSandboxModeForNode(node),
      approvalPolicy: 'never',
      signal: context.signal,
    })
    if (context.signal?.aborted) {
      throw new Error('Pipeline 节点执行已中止')
    }

    const result = buildNodeExecutionResult(node, response.finalResponse)
    if (context.signal?.aborted) {
      throw new Error('Pipeline 节点执行已中止')
    }
    emitNodeResult(this.onEvent, node, result)
    return result
  }
}

async function createDefaultCodexClient(options: CodexSdkOptions): Promise<CodexSdkClient> {
  const sdk = await import('@openai/codex-sdk')
  return new sdk.Codex(options)
}

export class CodexSdkPipelineNodeRunner implements PipelineNodeRunner {
  private readonly channelId?: string
  private readonly workspaceId?: string
  private readonly onEvent?: (event: PipelineStreamEvent) => void
  private readonly createCodexClient: CreateCodexSdkClient
  private readonly codexPath?: string

  constructor(options: CodexSdkPipelineNodeRunnerOptions) {
    this.channelId = options.channelId
    this.workspaceId = options.workspaceId
    this.onEvent = options.onEvent
    this.createCodexClient = options.createCodexClient ?? createDefaultCodexClient
    this.codexPath = options.codexPath
  }

  async runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    ensureCodexNode(node)
    if (context.signal?.aborted) {
      throw new Error('Pipeline 节点执行已中止')
    }

    const workspace = resolveCodexWorkspace(this.workspaceId, context.sessionId)
    const runtime = resolveCodexRuntime(this.channelId)
    const env = await buildCodexEnv()
    const prompt = buildCodexPrompt(node, context, workspace.name)
    const client = await this.createCodexClient({
      codexPathOverride: this.codexPath ?? resolveCodexCliPath(),
      apiKey: runtime.apiKey,
      baseUrl: runtime.baseUrl,
      env,
    })
    const thread = client.startThread({
      model: runtime.model,
      sandboxMode: codexSandboxModeForNode(node),
      workingDirectory: workspace.cwd,
      skipGitRepoCheck: true,
      approvalPolicy: 'never',
      additionalDirectories: workspace.additionalDirectories,
    })

    emitNodeStart(this.onEvent, node)
    const response = await thread.run(prompt, {
      outputSchema: pipelineNodeJsonSchema(node),
      signal: context.signal,
    })
    const result = buildNodeExecutionResult(node, response.finalResponse)
    emitNodeResult(this.onEvent, node, result)
    return result
  }
}
