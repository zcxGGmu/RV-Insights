import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { normalizeAnthropicBaseUrlForSdk } from '@rv-insights/core'
import type {
  JsonSchemaOutputFormat,
  PipelineExplorerReportRef,
  PipelineNodeKind,
  PipelinePlannerStageOutput,
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
  SAFE_TOOLS,
  isAgentCompatibleProvider,
} from '@rv-insights/shared'
import type { CanUseToolOptions, PermissionResult } from './agent-permission-service'
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
import { getContributionTaskByPipelineSessionId } from './contribution-task-service'
import {
  clearPatchWorkFilesByKind,
  listPatchWorkExplorerReports,
  readPatchWorkManifestFile,
  writePatchWorkFile,
} from './pipeline-patch-work-service'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_ANTHROPIC_URL = 'https://api.anthropic.com'
const V2_READ_ONLY_DISALLOWED_TOOLS = [
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
] as const

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

function buildV2SystemPromptAppendix(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
): string | undefined {
  if (context.version !== 2) return undefined

  if (node === 'explorer') {
    return [
      'Pipeline v2 约束：',
      '- 不要修改源码或工作区文件。',
      '- 请输出多个候选 reports，应用会把它们写入 patch-work/explorer/report-*.md。',
      '- 每个 report 至少包含 title、summary、rationale、keyFiles。',
    ].join('\n')
  }

  if (node === 'planner') {
    return [
      'Pipeline v2 约束：',
      '- 不要修改源码或工作区文件。',
      '- 必须基于 selected-task.md 输出 planMarkdown 和 testPlanMarkdown。',
      '- 应用会把 planMarkdown 写入 patch-work/plan.md，把 testPlanMarkdown 写入 patch-work/test-plan.md。',
    ].join('\n')
  }

  return undefined
}

function readSelectedTaskForPrompt(context: PipelineNodeExecutionContext): string | undefined {
  if (context.version !== 2 || context.currentNode !== 'planner') return undefined

  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) {
    throw new Error(`未找到 Pipeline 贡献任务，无法读取 selected-task.md: ${context.sessionId}`)
  }

  return readPatchWorkManifestFile({
    repositoryRoot: task.repositoryRoot,
    relativePath: 'selected-task.md',
  })
}

function buildUserPrompt(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  workspaceName?: string,
): string {
  const selectedTaskContent = node === 'planner'
    ? readSelectedTaskForPrompt(context)
    : undefined
  return [
    workspaceName ? `当前工作区：${workspaceName}` : undefined,
    selectedTaskContent
      ? `已选任务（selected-task.md）：\n${selectedTaskContent}`
      : undefined,
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
    systemPrompt: [
      buildSystemPrompt(node),
      buildV2SystemPromptAppendix(node, context),
    ].filter((line): line is string => Boolean(line)).join('\n\n'),
    userPrompt: buildUserPrompt(node, context, workspaceName),
  }
}

function stringArraySchema(): Record<string, unknown> {
  return {
    type: 'array',
    items: { type: 'string' },
  }
}

function explorerReportDraftSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'summary'],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      rationale: { type: 'string' },
      keyFiles: stringArraySchema(),
    },
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
          reports: {
            type: 'array',
            items: explorerReportDraftSchema(),
          },
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
          planMarkdown: { type: 'string' },
          testPlanMarkdown: { type: 'string' },
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

interface ExplorerReportDraft {
  title: string
  summary: string
  rationale?: string
  keyFiles: string[]
}

function readOptionalString(parsed: Record<string, unknown>, field: string): string | undefined {
  const value = parsed[field]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function readExplorerReportDrafts(
  parsed: Record<string, unknown>,
  fallback: Extract<PipelineStageOutput, { node: 'explorer' }>,
): ExplorerReportDraft[] {
  const reports = parsed.reports
  if (Array.isArray(reports)) {
    const drafts = reports
      .filter((item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null)
      .map((item): ExplorerReportDraft | null => {
        const title = typeof item.title === 'string' ? item.title.trim() : ''
        const summary = typeof item.summary === 'string' ? item.summary.trim() : ''
        const rationale = typeof item.rationale === 'string' ? item.rationale.trim() : undefined
        const keyFiles = Array.isArray(item.keyFiles)
          ? item.keyFiles.filter((file): file is string => typeof file === 'string' && file.trim().length > 0)
          : fallback.keyFiles
        return title && summary
          ? {
              title,
              summary,
              ...(rationale ? { rationale } : {}),
              keyFiles,
            }
          : null
      })
      .filter((item): item is ExplorerReportDraft => item !== null)

    if (drafts.length > 0) return drafts
  }

  return [{
    title: fallback.summary,
    summary: fallback.findings[0] ?? fallback.summary,
    rationale: fallback.nextSteps[0],
    keyFiles: fallback.keyFiles,
  }]
}

function buildExplorerReportMarkdown(
  draft: ExplorerReportDraft,
  index: number,
): string {
  return [
    `# 探索报告：${draft.title}`,
    '',
    '## 贡献点概述',
    draft.summary,
    '',
    '## 为什么值得做',
    draft.rationale ?? '该方向来自 Explorer 对仓库和任务的结构化分析。',
    '',
    '## 相关文件',
    ...(draft.keyFiles.length > 0 ? draft.keyFiles.map((file) => `- \`${file}\``) : ['- 待 planner 进一步确认']),
    '',
    '## 可能修改范围',
    '由 planner 在选定任务后收敛为具体实施步骤。',
    '',
    '## 风险与不确定性',
    '需要在 planner 阶段继续验证边界和测试策略。',
    '',
    '## 建议验证方式',
    '补充相关单元测试，并运行阶段指定验证命令。',
    '',
    '## 适合作为 task 的原因',
    `这是 Explorer 生成的第 ${index + 1} 个候选贡献点，适合在人工选择后进入 planner。`,
    '',
  ].join('\n')
}

function toPatchWorkDocumentRef(ref: {
  displayName: string
  relativePath: string
  checksum: string
  revision: number
}) {
  return {
    displayName: ref.displayName,
    relativePath: ref.relativePath,
    checksum: ref.checksum,
    revision: ref.revision,
  }
}

function enrichExplorerPatchWorkArtifacts(
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (result.stageOutput?.node !== 'explorer') return result
  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) return result

  const parsed = parseStructuredOutput('explorer', result.output)
  const drafts = readExplorerReportDrafts(parsed, result.stageOutput)
  clearPatchWorkFilesByKind({
    repositoryRoot: task.repositoryRoot,
    kind: 'explorer_report',
  })
  drafts.forEach((draft, index) => {
    writePatchWorkFile({
      contributionTaskId: task.id,
      pipelineSessionId: context.sessionId,
      repositoryRoot: task.repositoryRoot,
      kind: 'explorer_report',
      relativePath: `explorer/report-${String(index + 1).padStart(3, '0')}.md`,
      displayName: `探索报告 ${String(index + 1).padStart(3, '0')}.md`,
      createdByNode: 'explorer',
      content: buildExplorerReportMarkdown(draft, index),
    })
  })

  const reports: PipelineExplorerReportRef[] = listPatchWorkExplorerReports({
    repositoryRoot: task.repositoryRoot,
  })

  return {
    ...result,
    stageOutput: {
      ...result.stageOutput,
      reports,
    },
  }
}

function buildFallbackPlanMarkdown(output: PipelinePlannerStageOutput): string {
  return [
    '# 开发方案',
    '',
    '## 任务来源',
    '来自 selected-task.md。',
    '',
    '## 目标行为',
    output.summary,
    '',
    '## 非目标',
    '- 不在 planner 阶段修改源码。',
    '',
    '## 相关文件和模块',
    '- 待 developer 根据方案确认。',
    '',
    '## 实施步骤',
    ...output.steps.map((step) => `- ${step}`),
    '',
    '## 数据/类型/API 变更',
    '- 按实施步骤确认。',
    '',
    '## UI/交互变更',
    '- 按实施步骤确认。',
    '',
    '## 风险',
    ...(output.risks.length > 0 ? output.risks.map((risk) => `- ${risk}`) : ['- 暂无明确风险。']),
    '',
    '## 回滚策略',
    '- 回滚本阶段代码改动，并保留 patch-work 文档用于复盘。',
    '',
  ].join('\n')
}

function buildFallbackTestPlanMarkdown(output: PipelinePlannerStageOutput): string {
  return [
    '# 测试方案',
    '',
    '## 验证目标',
    output.summary,
    '',
    '## 单元测试',
    ...output.verification.map((item) => `- ${item}`),
    '',
    '## 集成测试',
    '- 根据涉及的 IPC / 服务边界补充。',
    '',
    '## UI/端到端验证',
    '- 验证关键用户路径。',
    '',
    '## 手动验证步骤',
    '- 按阶段 checklist 执行。',
    '',
    '## 可接受的跳过项',
    '- 无。',
    '',
    '## 失败时处理路径',
    '- 回到 planner 或 developer 修订。',
    '',
  ].join('\n')
}

function enrichPlannerPatchWorkArtifacts(
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (result.stageOutput?.node !== 'planner') return result
  const task = getContributionTaskByPipelineSessionId(context.sessionId)
  if (!task) return result

  const parsed = parseStructuredOutput('planner', result.output)
  const planMarkdown = readOptionalString(parsed, 'planMarkdown')
    ?? buildFallbackPlanMarkdown(result.stageOutput)
  const testPlanMarkdown = readOptionalString(parsed, 'testPlanMarkdown')
    ?? buildFallbackTestPlanMarkdown(result.stageOutput)
  const planRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'implementation_plan',
    createdByNode: 'planner',
    content: planMarkdown,
  })
  const testPlanRef = writePatchWorkFile({
    contributionTaskId: task.id,
    pipelineSessionId: context.sessionId,
    repositoryRoot: task.repositoryRoot,
    kind: 'test_plan',
    createdByNode: 'planner',
    content: testPlanMarkdown,
  })

  return {
    ...result,
    stageOutput: {
      ...result.stageOutput,
      planRef: toPatchWorkDocumentRef(planRef),
      testPlanRef: toPatchWorkDocumentRef(testPlanRef),
      documentRefs: [
        toPatchWorkDocumentRef(planRef),
        toPatchWorkDocumentRef(testPlanRef),
      ],
    },
  }
}

export function enrichPipelineV2PatchWorkArtifacts(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  result: PipelineNodeExecutionResult,
): PipelineNodeExecutionResult {
  if (context.version !== 2) return result
  if (node === 'explorer') return enrichExplorerPatchWorkArtifacts(context, result)
  if (node === 'planner') return enrichPlannerPatchWorkArtifacts(context, result)
  return result
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

export interface PipelineNodeToolPermissionOptions {
  sdkPermissionMode: ClaudeAgentQueryOptions['sdkPermissionMode']
  allowDangerouslySkipPermissions: boolean
  allowedTools?: string[]
  disallowedTools?: string[]
  canUseTool?: ClaudeAgentQueryOptions['canUseTool']
}

function isV2ReadOnlyNode(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
): boolean {
  return context.version === 2 && (node === 'explorer' || node === 'planner')
}

function hasV2DangerousBashStructure(command: string): boolean {
  if (/[|><;&]/.test(command)) return true
  if (/\$\(/.test(command) || /`/.test(command)) return true
  return false
}

function hasOutputOption(tokens: string[]): boolean {
  return tokens.some((token) => token === '-o' || token === '--output' || token.startsWith('--output='))
}

function isV2ReadOnlyGitCommand(tokens: string[]): boolean {
  const subcommand = tokens[1]
  const args = tokens.slice(2)
  if (!subcommand) return false
  if (hasOutputOption(tokens)) return false

  if (subcommand === 'status' || subcommand === 'log' || subcommand === 'diff' || subcommand === 'show') {
    return true
  }

  if (subcommand === 'branch') {
    if (args.length === 0) return true
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index]
      if (
        arg === '--show-current'
        || arg === '-a'
        || arg === '-r'
        || arg === '-v'
        || arg === '-vv'
        || arg === '--all'
        || arg === '--remotes'
        || arg === '--merged'
        || arg === '--no-merged'
      ) {
        continue
      }
      if (arg === '--list') {
        if (args[index + 1] && !args[index + 1]!.startsWith('-')) index += 1
        continue
      }
      return false
    }
    return true
  }

  if (subcommand === 'tag') {
    if (args.length === 0) return true
    if ((args[0] === '--list' || args[0] === '-l') && args.length <= 2) return true
    return false
  }

  if (subcommand === 'remote') {
    if (args.length === 0) return true
    if (args.length === 1 && args[0] === '-v') return true
    if (args[0] === 'show' && args.length <= 2) return true
    if (args[0] === 'get-url' && args.length <= 2) return true
    return false
  }

  return false
}

function isV2ReadOnlyBashCommand(command: string): boolean {
  const trimmed = command.trim()
  if (!trimmed || hasV2DangerousBashStructure(trimmed)) return false
  const tokens = trimmed.split(/\s+/)
  if (hasOutputOption(tokens)) return false

  if (tokens[0] === 'git') {
    return isV2ReadOnlyGitCommand(tokens)
  }

  if (
    tokens[0] === 'pwd'
    || tokens[0] === 'env'
    || tokens[0] === 'whoami'
    || tokens[0] === 'which'
    || tokens[0] === 'ls'
    || tokens[0] === 'head'
    || tokens[0] === 'tail'
    || tokens[0] === 'grep'
    || tokens[0] === 'rg'
    || tokens[0] === 'uname'
    || tokens[0] === 'tree'
    || tokens[0] === 'wc'
    || tokens[0] === 'file'
    || tokens[0] === 'stat'
    || tokens[0] === 'du'
    || tokens[0] === 'df'
  ) {
    return true
  }

  if (trimmed === 'node --version' || trimmed === 'bun --version') return true
  if (tokens[0] === 'npm' && ['list', 'ls', 'view', 'info', 'outdated'].includes(tokens[1] ?? '')) {
    return true
  }
  if (trimmed === 'bun pm ls') return true
  return false
}

function createV2ReadOnlyCanUseTool(): (
  toolName: string,
  input: Record<string, unknown>,
  options: CanUseToolOptions,
) => Promise<PermissionResult> {
  return async (toolName, input) => {
    if (SAFE_TOOLS.includes(toolName)) {
      return { behavior: 'allow' as const, updatedInput: input }
    }

    if (toolName === 'Bash') {
      const command = typeof input.command === 'string' ? input.command : ''
      if (isV2ReadOnlyBashCommand(command)) {
        return { behavior: 'allow' as const, updatedInput: input }
      }
    }

    return {
      behavior: 'deny' as const,
      message: 'Pipeline v2 Explorer / Planner 阶段只允许读取和安全检查，不能修改源码或工作区文件。',
    }
  }
}

export function buildPipelineNodeToolPermissionOptions(
  node: PipelineNodeKind,
  context: PipelineNodeExecutionContext,
  permissionMode: RVInsightsPermissionMode,
): PipelineNodeToolPermissionOptions {
  if (!isV2ReadOnlyNode(node, context)) {
    return {
      sdkPermissionMode: permissionModeToSdk(permissionMode),
      allowDangerouslySkipPermissions: permissionMode === 'bypassPermissions',
    }
  }

  return {
    sdkPermissionMode: 'auto',
    allowDangerouslySkipPermissions: false,
    allowedTools: [...SAFE_TOOLS],
    disallowedTools: [...V2_READ_ONLY_DISALLOWED_TOOLS],
    canUseTool: createV2ReadOnlyCanUseTool(),
  }
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
    const permissionOptions = buildPipelineNodeToolPermissionOptions(
      node,
      context,
      permissionMode,
    )

    const queryOptions: ClaudeAgentQueryOptions = {
      sessionId: context.sessionId,
      prompt: prompts.userPrompt,
      model,
      cwd: workspace.cwd,
      sdkCliPath: resolveSDKCliPath(),
      env,
      sdkPermissionMode: permissionOptions.sdkPermissionMode,
      allowDangerouslySkipPermissions: permissionOptions.allowDangerouslySkipPermissions,
      systemPrompt: prompts.systemPrompt,
      persistSession: false,
      forkSession: false,
      mcpServers,
      additionalDirectories,
      outputFormat: pipelineNodeOutputFormat(node),
      ...(permissionOptions.canUseTool && { canUseTool: permissionOptions.canUseTool }),
      ...(permissionOptions.allowedTools && { allowedTools: permissionOptions.allowedTools }),
      ...(permissionOptions.disallowedTools && { disallowedTools: permissionOptions.disallowedTools }),
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

    const result = enrichPipelineV2PatchWorkArtifacts(
      node,
      context,
      buildNodeExecutionResult(node, combinedOutput),
    )

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
