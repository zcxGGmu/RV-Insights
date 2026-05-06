import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { normalizeAnthropicBaseUrlForSdk } from '@rv-insights/core'
import type {
  JsonSchemaOutputFormat,
  PipelineNodeKind,
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
  reviewIteration: number
  lastApprovedNode?: PipelineNodeKind
  feedback?: string
  signal?: AbortSignal
}

export interface PipelineNodeExecutionResult {
  output: string
  summary: string
  approved?: boolean
  issues?: string[]
}

export interface PipelineNodeRunner {
  runNode(
    node: PipelineNodeKind,
    context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult>
  abort?(sessionId: string): void
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

function summarizeText(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length > 160 ? compact.slice(0, 160) + '...' : compact
}

function buildRolePrompt(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  workspaceName?: string,
): string {
  const feedbackBlock = context.feedback ? `\n人工反馈：${context.feedback}\n` : ''
  const workspaceBlock = workspaceName ? `\n当前工作区：${workspaceName}\n` : '\n'

  switch (node) {
    case 'explorer':
      return [
        '你是 RV Pipeline 的 Explorer 节点。',
        '目标：基于用户需求快速梳理任务背景、代码入口和可执行方向。',
        '输出要求：给出简洁的探索结论、关键文件/模块、下一步建议。',
        workspaceBlock,
        feedbackBlock,
        `用户需求：${context.userInput}`,
      ].join('\n')
    case 'planner':
      return [
        '你是 RV Pipeline 的 Planner 节点。',
        '目标：输出可执行的开发与验证方案，避免空泛描述。',
        '输出要求：方案步骤、风险点、验证方式。',
        workspaceBlock,
        feedbackBlock,
        `用户需求：${context.userInput}`,
      ].join('\n')
    case 'developer':
      return [
        '你是 RV Pipeline 的 Developer 节点。',
        '目标：按计划直接完成代码实现和必要测试。',
        '输出要求：说明改动、验证结果、遗留风险。',
        workspaceBlock,
        feedbackBlock,
        `用户需求：${context.userInput}`,
        `当前 reviewer 轮次：${context.reviewIteration}`,
      ].join('\n')
    case 'reviewer':
      return [
        '你是 RV Pipeline 的 Reviewer 节点。',
        '目标：审查本轮开发结果，给出明确通过/驳回结论。',
        '请仅围绕正确性、回归风险、测试缺口、实现质量给出判断。',
        workspaceBlock,
        feedbackBlock,
        `用户需求：${context.userInput}`,
        `当前 reviewer 轮次：${context.reviewIteration}`,
      ].join('\n')
    case 'tester':
      return [
        '你是 RV Pipeline 的 Tester 节点。',
        '目标：执行验证并输出测试结论。',
        '输出要求：运行了什么、结果如何、是否还有阻塞项。',
        workspaceBlock,
        feedbackBlock,
        `用户需求：${context.userInput}`,
      ].join('\n')
  }
}

function reviewerOutputFormat(): JsonSchemaOutputFormat {
  return {
    type: 'json_schema',
    name: 'pipeline_reviewer_result',
    description: 'Pipeline reviewer structured result',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['approved', 'summary', 'issues'],
      properties: {
        approved: { type: 'boolean' },
        summary: { type: 'string' },
        issues: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  }
}

function extractAssistantText(message: SDKAssistantMessage): string {
  return message.message.content
    .filter((block): block is SDKContentBlock & { type: 'text'; text: string } =>
      block.type === 'text' && typeof (block as { text?: unknown }).text === 'string')
    .map((block) => block.text)
    .join('\n')
}

function parseReviewerResult(text: string): PipelineNodeExecutionResult {
  try {
    const parsed = JSON.parse(text) as {
      approved?: boolean
      summary?: string
      issues?: string[]
    }

    return {
      output: text,
      summary: parsed.summary ?? summarizeText(text),
      approved: parsed.approved === true,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    }
  } catch {
    return {
      output: text,
      summary: summarizeText(text),
      approved: false,
      issues: ['Reviewer 输出不是合法 JSON，按驳回处理'],
    }
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
    const prompt = buildRolePrompt(node, context, workspace.name)
    const model = resolveModel(channelId)
    const env = await buildSdkEnv(apiKey, channel.baseUrl, channel.provider)
    const mcpServers = buildMcpServers(workspace.slug)
    const additionalDirectories = workspace.slug
      ? getWorkspaceAttachedDirectories(workspace.slug)
      : []

    const queryOptions: ClaudeAgentQueryOptions = {
      sessionId: context.sessionId,
      prompt,
      model,
      cwd: workspace.cwd,
      sdkCliPath: resolveSDKCliPath(),
      env,
      sdkPermissionMode: permissionModeToSdk(permissionMode),
      allowDangerouslySkipPermissions: permissionMode === 'bypassPermissions',
      systemPrompt: buildRolePrompt(node, context, workspace.name),
      persistSession: false,
      forkSession: false,
      mcpServers,
      additionalDirectories,
      ...(workspace.slug && {
        plugins: [{ type: 'local' as const, path: getAgentWorkspacePath(workspace.slug) }],
      }),
      ...(node === 'reviewer' && { outputFormat: reviewerOutputFormat() }),
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
          combinedOutput += (combinedOutput ? '\n' : '') + text
          this.onEvent?.({
            type: 'text_delta',
            node,
            delta: text,
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

    const result = node === 'reviewer'
      ? parseReviewerResult(combinedOutput)
      : {
          output: combinedOutput,
          summary: summarizeText(combinedOutput),
          approved: true,
        }

    this.onEvent?.({
      type: 'node_complete',
      node,
      output: result.output,
      summary: result.summary,
      createdAt: Date.now(),
    })

    return result
  }
}
