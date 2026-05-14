import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { normalizeAnthropicBaseUrlForSdk } from '@rv-insights/core'
import type {
  JsonSchemaOutputFormat,
  PipelineNodeKind,
  PipelineVersion,
  PipelineStageOutput,
  PipelineStageOutputMap,
  PipelineStreamEvent,
  ProviderType,
  RVInsightsPermissionMode,
  SDKAssistantMessage,
  SDKContentBlock,
} from '@rv-insights/shared'
import {
  isAgentCompatibleProvider,
} from '@rv-insights/shared'
import { getEffectiveProxyUrl } from './proxy-settings-service'
import { getChannelById, decryptApiKey } from './channel-manager'
import {
  ensurePluginManifest,
  getAgentWorkspace,
  getWorkspaceAttachedDirectories,
  getWorkspaceMcpConfig,
  getWorkspacePermissionMode,
} from './agent-workspace-manager'
import {
  getAgentSessionWorkspacePath,
  getAgentWorkspacePath,
  getSdkConfigDir,
} from './config-paths'
import {
  ClaudeAgentAdapter,
  type ClaudeAgentQueryOptions,
} from './adapters/claude-agent-adapter'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_ANTHROPIC_URL = 'https://api.anthropic.com'

export interface PipelineNodeExecutionContext {
  sessionId: string
  userInput: string
  currentNode: PipelineNodeKind
  version?: PipelineVersion
  reviewIteration: number
  lastApprovedNode?: PipelineNodeKind
  feedback?: string
  stageOutputs?: PipelineStageOutputMap
  signal?: AbortSignal
}

export interface PipelineNodeExecutionResult {
  output: string
  summary: string
  approved?: boolean
  issues?: string[]
  stageOutput?: PipelineStageOutput
}

export interface PipelineNodeRunner {
  runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult>
  abort?(sessionId: string): void
}

export interface PipelineNodePrompts {
  systemPrompt: string
  userPrompt: string
}

export class PipelineStructuredOutputError extends Error {
  readonly code = 'PIPELINE_STRUCTURED_OUTPUT_INVALID'
  readonly node: PipelineNodeKind
  readonly issues: string[]
  readonly output: string

  constructor(node: PipelineNodeKind, issues: string[], output: string) {
    super(`Pipeline ${node} 结构化输出解析失败: ${issues.join('；')}`)
    this.name = 'PipelineStructuredOutputError'
    this.node = node
    this.issues = issues
    this.output = output
  }
}

export interface ClaudePipelineNodeRunnerOptions {
  channelId?: string
  workspaceId?: string
  onEvent?: (event: PipelineStreamEvent) => void
}

interface ResolvedWorkspaceContext {
  slug?: string
  name?: string
  cwd?: string
}

function resolveSDKCliPath(): string {
  const subpkg = `claude-agent-sdk-${process.platform}-${process.arch}`
  const binaryName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  let binaryPath: string | null = null

  try {
    const cjsRequire = createRequire(import.meta.url)
    const sdkEntryPath = cjsRequire.resolve('@anthropic-ai/claude-agent-sdk')
    const anthropicDir = dirname(dirname(sdkEntryPath))
    binaryPath = join(anthropicDir, subpkg, binaryName)
  } catch {
    binaryPath = null
  }

  if (!binaryPath) {
    binaryPath = join(process.cwd(), 'node_modules', '@anthropic-ai', subpkg, binaryName)
  }

  try {
    const cjsRequire = createRequire(import.meta.url)
    const electronApp = cjsRequire('electron').app as { isPackaged?: boolean }
    if (electronApp?.isPackaged && binaryPath.includes('.asar')) {
      binaryPath = binaryPath.replace(/\.asar([/\\])/, '.asar.unpacked$1')
    }
  } catch {
    // test / 非 Electron 环境忽略
  }

  return binaryPath
}

async function buildSdkEnv(
  apiKey: string,
  baseUrl: string | undefined,
  provider: ProviderType,
): Promise<Record<string, string | undefined>> {
  const cleanEnv: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('ANTHROPIC_')) {
      cleanEnv[key] = value
    }
  }

  const sdkEnv: Record<string, string | undefined> = {
    ...cleanEnv,
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: '64000',
    CLAUDE_CODE_ENABLE_TASKS: 'true',
    CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
    CLAUDE_CONFIG_DIR: getSdkConfigDir(),
  }

  if (provider === 'kimi-coding') {
    sdkEnv.ANTHROPIC_AUTH_TOKEN = apiKey
    sdkEnv.ANTHROPIC_CUSTOM_HEADERS = 'User-Agent: KimiCLI/1.3'
  } else {
    sdkEnv.ANTHROPIC_API_KEY = apiKey
  }

  if (baseUrl && baseUrl !== DEFAULT_ANTHROPIC_URL) {
    sdkEnv.ANTHROPIC_BASE_URL = normalizeAnthropicBaseUrlForSdk(baseUrl)
  }

  const proxyUrl = await getEffectiveProxyUrl()
  if (proxyUrl) {
    sdkEnv.HTTPS_PROXY = proxyUrl
    sdkEnv.HTTP_PROXY = proxyUrl
  }

  if (process.platform === 'win32') {
    try {
      const runtimeModule = await import('./runtime-init')
      const runtimeStatus = runtimeModule.getRuntimeStatus()
      const shellStatus = runtimeStatus?.shell
      if (shellStatus?.gitBash?.available && shellStatus.gitBash.path) {
        sdkEnv.CLAUDE_CODE_SHELL = shellStatus.gitBash.path
        sdkEnv.CLAUDE_BASH_NO_LOGIN = '1'
      } else if (shellStatus?.wsl?.available) {
        sdkEnv.CLAUDE_CODE_SHELL = 'wsl'
        sdkEnv.CLAUDE_BASH_NO_LOGIN = '1'
      }
    } catch {
      // 非 Electron / test 环境不要求 Shell 检测
    }
  }

  return sdkEnv
}

function buildMcpServers(workspaceSlug?: string): Record<string, Record<string, unknown>> {
  if (!workspaceSlug) return {}

  const mcpConfig = getWorkspaceMcpConfig(workspaceSlug)
  const mcpServers: Record<string, Record<string, unknown>> = {}

  for (const [name, entry] of Object.entries(mcpConfig.servers ?? {})) {
    if (!entry.enabled || name === 'memos-cloud') continue

    if (entry.type === 'stdio' && entry.command) {
      mcpServers[name] = {
        type: 'stdio',
        command: entry.command,
        ...(entry.args?.length ? { args: entry.args } : {}),
        ...(entry.env ? { env: entry.env } : {}),
      }
      continue
    }

    if ((entry.type === 'http' || entry.type === 'sse') && entry.url) {
      mcpServers[name] = {
        type: entry.type,
        url: entry.url,
      }
    }
  }

  return mcpServers
}

function resolveWorkspaceContext(
  workspaceId: string | undefined,
  sessionId: string,
): ResolvedWorkspaceContext {
  if (!workspaceId) return {}

  const workspace = getAgentWorkspace(workspaceId)
  if (!workspace) return {}

  ensurePluginManifest(workspace.slug, workspace.name)

  return {
    slug: workspace.slug,
    name: workspace.name,
    cwd: getAgentSessionWorkspacePath(workspace.slug, sessionId),
  }
}

function resolveModel(channelId?: string): string {
  if (!channelId) return DEFAULT_MODEL
  const channel = getChannelById(channelId)
  const enabled = channel?.models.find((model) => model.enabled)
  return enabled?.id ?? channel?.models[0]?.id ?? DEFAULT_MODEL
}

function compactStageOutputsForPrompt(stageOutputs: PipelineStageOutputMap | undefined): string {
  const entries = Object.values(stageOutputs ?? {})
    .filter((output): output is PipelineStageOutput => Boolean(output))
    .map((output) => {
      const { content: _content, ...compactOutput } = output
      return compactOutput
    })

  if (entries.length === 0) return ''

  return [
    '',
    '上游阶段产物（JSON，仅用于保持上下文连续）：',
    JSON.stringify(entries, null, 2),
    '',
  ].join('\n')
}

function buildSystemPrompt(node: PipelineNodeKind): string {
  switch (node) {
    case 'explorer':
      return [
        '你是 RV Pipeline 的 Explorer 节点。',
        '目标：基于用户需求快速梳理任务背景、代码入口和可执行方向。',
        '输出要求：给出简洁的探索结论、关键文件/模块、下一步建议。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
      ].join('\n')
    case 'planner':
      return [
        '你是 RV Pipeline 的 Planner 节点。',
        '目标：输出可执行的开发与验证方案，避免空泛描述。',
        '输出要求：方案步骤、风险点、验证方式。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
      ].join('\n')
    case 'developer':
      return [
        '你是 RV Pipeline 的 Developer 节点。',
        '目标：按计划直接完成代码实现和必要测试。',
        '输出要求：说明改动、验证结果、遗留风险。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
      ].join('\n')
    case 'reviewer':
      return [
        '你是 RV Pipeline 的 Reviewer 节点。',
        '目标：审查本轮开发结果，给出明确通过/驳回结论。',
        '请仅围绕正确性、回归风险、测试缺口、实现质量给出判断。',
        '必须严格遵守结构化输出 schema，approved 字段必须是 boolean。',
      ].join('\n')
    case 'tester':
      return [
        '你是 RV Pipeline 的 Tester 节点。',
        '目标：执行验证并输出测试结论。',
        '输出要求：运行了什么、结果如何、是否还有阻塞项。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
      ].join('\n')
    case 'committer':
      return [
        '你是 RV Pipeline 的 Committer 节点。',
        '目标：生成可审核的提交信息和 PR 草稿，不执行真实 commit、push 或创建 PR。',
        '输出要求：commit message、PR 标题、PR 正文、提交状态和风险说明。',
        '必须严格遵守结构化输出 schema，不要返回 schema 之外的字段。',
      ].join('\n')
  }
}

function buildUserPrompt(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  workspaceName?: string,
): string {
  return [
    workspaceName ? `当前工作区：${workspaceName}` : undefined,
    compactStageOutputsForPrompt(context.stageOutputs).trim() || undefined,
    context.feedback ? `人工反馈：${context.feedback}` : undefined,
    `用户需求：${context.userInput}`,
    node === 'developer' || node === 'reviewer'
      ? `当前 reviewer 轮次：${context.reviewIteration}`
      : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
}

export function buildPipelineNodePrompts(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  workspaceName?: string,
): PipelineNodePrompts {
  return {
    systemPrompt: buildSystemPrompt(node),
    userPrompt: buildUserPrompt(node, context, workspaceName),
  }
}

function stringArraySchema(): Record<string, unknown> {
  return {
    type: 'array',
    items: { type: 'string' },
  }
}

export function pipelineNodeJsonSchema(node: PipelineNodeKind): Record<string, unknown> {
  switch (node) {
    case 'explorer':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'findings', 'keyFiles', 'nextSteps'],
        properties: {
          summary: { type: 'string' },
          findings: stringArraySchema(),
          keyFiles: stringArraySchema(),
          nextSteps: stringArraySchema(),
        },
      }
    case 'planner':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'steps', 'risks', 'verification'],
        properties: {
          summary: { type: 'string' },
          steps: stringArraySchema(),
          risks: stringArraySchema(),
          verification: stringArraySchema(),
        },
      }
    case 'developer':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'changes', 'tests', 'risks'],
        properties: {
          summary: { type: 'string' },
          changes: stringArraySchema(),
          tests: stringArraySchema(),
          risks: stringArraySchema(),
        },
      }
    case 'reviewer':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['approved', 'summary', 'issues'],
        properties: {
          approved: { type: 'boolean' },
          summary: { type: 'string' },
          issues: stringArraySchema(),
        },
      }
    case 'tester':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'commands', 'results', 'blockers'],
        properties: {
          summary: { type: 'string' },
          commands: stringArraySchema(),
          results: stringArraySchema(),
          blockers: stringArraySchema(),
        },
      }
    case 'committer':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'commitMessage', 'prTitle', 'prBody', 'submissionStatus', 'risks'],
        properties: {
          summary: { type: 'string' },
          commitMessage: { type: 'string' },
          prTitle: { type: 'string' },
          prBody: { type: 'string' },
          submissionStatus: {
            type: 'string',
            enum: [
              'draft_only',
              'local_commit_ready',
              'local_commit_created',
              'remote_pr_ready',
              'remote_pr_created',
              'blocked',
            ],
          },
          risks: stringArraySchema(),
        },
      }
  }
}

function pipelineNodeOutputFormat(node: PipelineNodeKind): JsonSchemaOutputFormat {
  return {
    type: 'json_schema',
    name: `pipeline_${node}_artifact`,
    description: `Pipeline ${node} structured artifact`,
    schema: pipelineNodeJsonSchema(node),
  }
}

function extractAssistantText(message: SDKAssistantMessage): string {
  return message.message.content
    .filter((block): block is SDKContentBlock & { type: 'text'; text: string } =>
      block.type === 'text' && typeof (block as { text?: unknown }).text === 'string')
    .map((block) => block.text)
    .join('\n')
}

function parseJsonObjectCandidate(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text.trim()) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function extractFencedJsonCandidates(text: string): string[] {
  const candidates: string[] = []
  const fencePattern = /```(?:json|JSON)?\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(text)) !== null) {
    const candidate = match[1]?.trim()
    if (candidate) {
      candidates.push(candidate)
    }
  }

  return candidates
}

function extractBalancedJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = []
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (start >= 0 && inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      if (start >= 0) {
        inString = true
      }
      continue
    }

    if (char === '{') {
      if (start < 0) {
        start = index
      }
      depth += 1
      continue
    }

    if (char === '}' && start >= 0) {
      depth -= 1
      if (depth === 0) {
        candidates.push(text.slice(start, index + 1))
        start = -1
      }
    }
  }

  return candidates
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const direct = parseJsonObjectCandidate(text)
  if (direct) return direct

  const candidates = [
    ...extractFencedJsonCandidates(text),
    ...extractBalancedJsonObjectCandidates(text),
  ]

  for (const candidate of candidates) {
    const parsed = parseJsonObjectCandidate(candidate)
    if (parsed) return parsed
  }

  return null
}

function readRequiredString(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): string {
  const value = parsed[field]
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  issues.push(`缺少或非法字段: ${field}`)
  return ''
}

function readRequiredStringArray(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): string[] {
  const value = parsed[field]
  if (!Array.isArray(value)) {
    issues.push(`缺少或非法字段: ${field}`)
    return []
  }

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
  if (items.length !== value.length) {
    issues.push(`字段包含非字符串项: ${field}`)
  }
  return items
}

function readRequiredBoolean(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): boolean {
  const value = parsed[field]
  if (typeof value === 'boolean') return value
  issues.push(`缺少或非法字段: ${field}`)
  return false
}

function readSubmissionStatus(
  parsed: Record<string, unknown>,
  field: string,
  issues: string[],
): 'draft_only' | 'local_commit_ready' | 'local_commit_created' | 'remote_pr_ready' | 'remote_pr_created' | 'blocked' {
  const value = parsed[field]
  if (
    value === 'draft_only'
    || value === 'local_commit_ready'
    || value === 'local_commit_created'
    || value === 'remote_pr_ready'
    || value === 'remote_pr_created'
    || value === 'blocked'
  ) {
    return value
  }
  issues.push(`缺少或非法字段: ${field}`)
  return 'blocked'
}

function parseStructuredOutput(node: PipelineNodeKind, text: string): Record<string, unknown> {
  const parsed = parseJsonObject(text)
  if (!parsed) {
    throw new PipelineStructuredOutputError(node, ['输出不是合法 JSON 对象'], text)
  }
  return parsed
}

function throwIfInvalid(node: PipelineNodeKind, issues: string[], text: string): void {
  if (issues.length > 0) {
    throw new PipelineStructuredOutputError(node, issues, text)
  }
}

function buildStageOutput(node: PipelineNodeKind, text: string): PipelineStageOutput {
  const parsed = parseStructuredOutput(node, text)
  const issues: string[] = []
  const summary = readRequiredString(parsed, 'summary', issues)

  switch (node) {
    case 'explorer': {
      const output = {
        node,
        summary,
        findings: readRequiredStringArray(parsed, 'findings', issues),
        keyFiles: readRequiredStringArray(parsed, 'keyFiles', issues),
        nextSteps: readRequiredStringArray(parsed, 'nextSteps', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'planner': {
      const output = {
        node,
        summary,
        steps: readRequiredStringArray(parsed, 'steps', issues),
        risks: readRequiredStringArray(parsed, 'risks', issues),
        verification: readRequiredStringArray(parsed, 'verification', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'developer': {
      const output = {
        node,
        summary,
        changes: readRequiredStringArray(parsed, 'changes', issues),
        tests: readRequiredStringArray(parsed, 'tests', issues),
        risks: readRequiredStringArray(parsed, 'risks', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'reviewer': {
      const output = {
        node,
        summary,
        approved: readRequiredBoolean(parsed, 'approved', issues),
        issues: readRequiredStringArray(parsed, 'issues', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'tester': {
      const output = {
        node,
        summary,
        commands: readRequiredStringArray(parsed, 'commands', issues),
        results: readRequiredStringArray(parsed, 'results', issues),
        blockers: readRequiredStringArray(parsed, 'blockers', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
    case 'committer': {
      const output = {
        node,
        summary,
        commitMessage: readRequiredString(parsed, 'commitMessage', issues),
        prTitle: readRequiredString(parsed, 'prTitle', issues),
        prBody: readRequiredString(parsed, 'prBody', issues),
        submissionStatus: readSubmissionStatus(parsed, 'submissionStatus', issues),
        risks: readRequiredStringArray(parsed, 'risks', issues),
        content: text,
      }
      throwIfInvalid(node, issues, text)
      return output
    }
  }
}

export function buildNodeExecutionResult(node: PipelineNodeKind, text: string): PipelineNodeExecutionResult {
  const stageOutput = buildStageOutput(node, text)

  if (stageOutput.node === 'reviewer') {
    return {
      output: text,
      summary: stageOutput.summary,
      approved: stageOutput.approved,
      issues: stageOutput.issues,
      stageOutput,
    }
  }

  return {
    output: text,
    summary: stageOutput.summary,
    approved: true,
    stageOutput,
  }
}

function permissionModeToSdk(
  mode: RVInsightsPermissionMode,
): ClaudeAgentQueryOptions['sdkPermissionMode'] {
  if (mode === 'plan') return 'auto'
  return mode
}

export class ClaudePipelineNodeRunner implements PipelineNodeRunner {
  private adapter = new ClaudeAgentAdapter()
  private readonly channelId?: string
  private readonly workspaceId?: string
  private readonly onEvent?: (event: PipelineStreamEvent) => void

  constructor(options: ClaudePipelineNodeRunnerOptions) {
    this.channelId = options.channelId
    this.workspaceId = options.workspaceId
    this.onEvent = options.onEvent
  }

  abort(sessionId: string): void {
    this.adapter.abort(sessionId)
  }

  async runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    const channelId = this.channelId
    if (!channelId) {
      throw new Error('Pipeline 缺少 channelId，无法执行 Claude 节点')
    }

    const channel = getChannelById(channelId)
    if (!channel) {
      throw new Error(`未找到渠道: ${channelId}`)
    }

    if (!isAgentCompatibleProvider(channel.provider)) {
      throw new Error(`渠道 ${channel.name} 不是 Agent 兼容供应商`)
    }

    const apiKey = decryptApiKey(channelId)
    const workspace = resolveWorkspaceContext(this.workspaceId, context.sessionId)
    const permissionMode = workspace.slug
      ? getWorkspacePermissionMode(workspace.slug)
      : 'auto'
    const prompts = buildPipelineNodePrompts(node, context, workspace.name)
    const model = resolveModel(channelId)
    const env = await buildSdkEnv(apiKey, channel.baseUrl, channel.provider)
    const mcpServers = buildMcpServers(workspace.slug)
    const additionalDirectories = workspace.slug
      ? getWorkspaceAttachedDirectories(workspace.slug)
      : []

    const queryOptions: ClaudeAgentQueryOptions = {
      sessionId: context.sessionId,
      prompt: prompts.userPrompt,
      model,
      cwd: workspace.cwd,
      sdkCliPath: resolveSDKCliPath(),
      env,
      sdkPermissionMode: permissionModeToSdk(permissionMode),
      allowDangerouslySkipPermissions: permissionMode === 'bypassPermissions',
      systemPrompt: prompts.systemPrompt,
      persistSession: false,
      forkSession: false,
      mcpServers,
      additionalDirectories,
      outputFormat: pipelineNodeOutputFormat(node),
      ...(workspace.slug && {
        plugins: [{ type: 'local' as const, path: getAgentWorkspacePath(workspace.slug) }],
      }),
    }

    const signal = context.signal
    if (signal?.aborted) {
      throw new Error('Pipeline 节点执行已中止')
    }

    const handleAbort = (): void => {
      this.adapter.abort(context.sessionId)
    }
    signal?.addEventListener('abort', handleAbort, { once: true })

    this.onEvent?.({
      type: 'node_start',
      node,
      createdAt: Date.now(),
    })

    let combinedOutput = ''

    try {
      for await (const message of this.adapter.query(queryOptions)) {
        if (message.type === 'assistant') {
          const text = extractAssistantText(message as SDKAssistantMessage)
          if (!text) continue
          const delta = (combinedOutput ? '\n' : '') + text
          combinedOutput += delta
          this.onEvent?.({
            type: 'text_delta',
            node,
            delta,
            createdAt: Date.now(),
          })
          continue
        }

        if (message.type === 'result' && message.subtype !== 'success') {
          const errors = Array.isArray(message.errors)
            ? message.errors.map((item) => String(item))
            : []
          throw new Error(errors.join('\n') || `Claude 节点执行失败: ${message.subtype}`)
        }
      }
    } finally {
      signal?.removeEventListener('abort', handleAbort)
    }

    const result = buildNodeExecutionResult(node, combinedOutput)

    this.onEvent?.({
      type: 'node_complete',
      node,
      output: result.output,
      summary: result.summary,
      approved: result.approved,
      issues: result.issues,
      artifact: result.stageOutput,
      createdAt: Date.now(),
    })

    return result
  }
}
