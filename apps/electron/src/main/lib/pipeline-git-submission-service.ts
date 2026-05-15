import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type {
  PipelinePatchSetFile,
  PipelineTestEvidence,
} from '@rv-insights/shared'

export interface BuildPipelinePatchSetDraftInput {
  repositoryRoot: string
  testEvidence: PipelineTestEvidence[]
}

export interface PipelinePatchSetDraft {
  patch: string
  changedFiles: PipelinePatchSetFile[]
  diffSummaryMarkdown: string
  testEvidence: PipelineTestEvidence[]
  additions: number
  deletions: number
  excludesPatchWork: boolean
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
}

export interface PipelineSubmissionDraftContext {
  changedFiles: PipelinePatchSetFile[]
  statusPorcelain: string
  diffSummaryMarkdown: string
  additions: number
  deletions: number
  excludesPatchWork: boolean
  contributingGuidelines?: string
  contributingGuidelinesPath?: string
  workingBranch?: string
  headCommit?: string
}

export interface ValidateCommitPreconditionsInput {
  repositoryRoot: string
  commitMessage: string
  operationId: string
}

export interface PipelineLocalCommitPlan {
  operationId: string
  commitMessage: string
  canCommit: boolean
  blockers: string[]
  changedFiles: PipelinePatchSetFile[]
  excludedFiles: string[]
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
}

export interface CreateLocalPipelineCommitInput extends ValidateCommitPreconditionsInput {
  confirmed: boolean
}

export interface PipelineLocalCommitResult {
  operationId: string
  commitMessage: string
  status: 'created'
  commitHash: string
  files: PipelinePatchSetFile[]
  excludedFiles: string[]
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
  createdAt: number
}

interface GitStatusEntry {
  path: string
  changeType: PipelinePatchSetFile['changeType']
}

interface GitNumstatEntry {
  path: string
  additions: number
  deletions: number
}

function runGit(
  repositoryRoot: string,
  args: string[],
  options: { allowDiffExit?: boolean } = {},
): string {
  try {
    return execFileSync('git', ['-C', repositoryRoot, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    if (
      options.allowDiffExit
      && typeof error === 'object'
      && error !== null
      && 'status' in error
      && (error as { status?: number }).status === 1
      && 'stdout' in error
      && typeof (error as { stdout?: unknown }).stdout === 'string'
    ) {
      return (error as { stdout: string }).stdout
    }
    throw error
  }
}

function ensureGitRepository(repositoryRoot: string): string {
  const root = resolve(repositoryRoot)
  if (!existsSync(root)) {
    throw new Error(`仓库目录不存在: ${repositoryRoot}`)
  }

  try {
    const topLevel = runGit(root, ['rev-parse', '--show-toplevel']).trim()
    if (realpathSync(resolve(topLevel)) !== realpathSync(root)) {
      throw new Error(`不是 Git 仓库根目录: ${repositoryRoot}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('不是 Git 仓库根目录')) {
      throw error
    }
    throw new Error(`不是 Git 仓库: ${repositoryRoot}`)
  }

  return root
}

function isInsideOrEqual(root: string, target: string): boolean {
  const relativeTarget = relative(root, target)
  return (
    relativeTarget === ''
    || (
      relativeTarget !== '..'
      && !relativeTarget.startsWith(`..${sep}`)
      && !isAbsolute(relativeTarget)
    )
  )
}

function normalizeGitPath(repositoryRoot: string, gitPath: string): string {
  const normalized = gitPath.trim().replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('../') || normalized === '..' || normalized.startsWith('/')) {
    throw new Error(`Git 路径越界: ${gitPath}`)
  }

  const absolutePath = resolve(repositoryRoot, normalized)
  if (!isInsideOrEqual(repositoryRoot, absolutePath)) {
    throw new Error(`Git 路径越界: ${gitPath}`)
  }

  return normalized
}

function toLiteralPathspec(path: string): string {
  return `:(literal)${path}`
}

function parseChangeType(status: string): PipelinePatchSetFile['changeType'] {
  if (status.includes('D')) return 'deleted'
  if (status.includes('R')) return 'renamed'
  if (status.includes('A') || status === '??') return 'added'
  return 'modified'
}

function parseStatusLine(repositoryRoot: string, line: string): GitStatusEntry | null {
  if (!line.trim()) return null
  const status = line.slice(0, 2)
  const rawPath = line.slice(3)
  const path = status.includes('R') && rawPath.includes(' -> ')
    ? rawPath.split(' -> ').at(-1) ?? rawPath
    : rawPath
  return {
    path: normalizeGitPath(repositoryRoot, path),
    changeType: parseChangeType(status),
  }
}

function parseStatusEntries(repositoryRoot: string): GitStatusEntry[] {
  const output = runGit(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    '.',
    ':(exclude)patch-work',
    ':(exclude)patch-work/**',
  ])
  const entries: GitStatusEntry[] = []

  for (const line of output.split('\n')) {
    const entry = parseStatusLine(repositoryRoot, line)
    if (!entry) continue
    const normalized = entry.path
    if (normalized === 'patch-work' || normalized.startsWith('patch-work/')) continue
    entries.push({
      path: normalized,
      changeType: entry.changeType,
    })
  }

  return entries
}

function parseAllStatusEntries(repositoryRoot: string): GitStatusEntry[] {
  const output = runGit(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ])
  return output
    .split('\n')
    .map((line) => parseStatusLine(repositoryRoot, line))
    .filter((entry): entry is GitStatusEntry => Boolean(entry))
}

function parseNumstat(repositoryRoot: string): Map<string, GitNumstatEntry> {
  const output = runGit(repositoryRoot, [
    'diff',
    'HEAD',
    '--numstat',
    '--',
    '.',
    ':(exclude)patch-work',
    ':(exclude)patch-work/**',
  ])
  const result = new Map<string, GitNumstatEntry>()

  for (const line of output.split('\n')) {
    if (!line.trim()) continue
    const [additionsRaw, deletionsRaw, ...pathParts] = line.split('\t')
    const path = normalizeGitPath(repositoryRoot, pathParts.join('\t'))
    result.set(path, {
      path,
      additions: additionsRaw === '-' ? 0 : Number(additionsRaw) || 0,
      deletions: deletionsRaw === '-' ? 0 : Number(deletionsRaw) || 0,
    })
  }

  return result
}

function countFileLines(repositoryRoot: string, path: string): number {
  const content = readFileSync(resolve(repositoryRoot, path), 'utf-8')
  if (!content) return 0
  return content.endsWith('\n')
    ? content.split('\n').length - 1
    : content.split('\n').length
}

function buildUntrackedPatch(repositoryRoot: string, path: string): string {
  return runGit(repositoryRoot, ['diff', '--no-index', '--', '/dev/null', path], {
    allowDiffExit: true,
  })
}

function buildTrackedPatch(repositoryRoot: string): string {
  return runGit(repositoryRoot, [
    'diff',
    'HEAD',
    '--',
    '.',
    ':(exclude)patch-work',
    ':(exclude)patch-work/**',
  ], { allowDiffExit: true })
}

function buildChangedFiles(repositoryRoot: string): PipelinePatchSetFile[] {
  const statusEntries = parseStatusEntries(repositoryRoot)
  const numstatByPath = parseNumstat(repositoryRoot)

  return statusEntries
    .filter((entry, index, entries) =>
      entries.findIndex((item) => item.path === entry.path) === index)
    .map((entry) => {
      const numstat = numstatByPath.get(entry.path)
      const additions = numstat?.additions
        ?? (entry.changeType === 'added' ? countFileLines(repositoryRoot, entry.path) : 0)
      const deletions = numstat?.deletions ?? 0
      return {
        path: entry.path,
        changeType: entry.changeType,
        additions,
        deletions,
        summary: `${entry.changeType}: ${entry.path}`,
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
}

function buildPatch(repositoryRoot: string, changedFiles: PipelinePatchSetFile[]): string {
  const trackedPatch = buildTrackedPatch(repositoryRoot).trimEnd()
  const untrackedPatches = changedFiles
    .filter((file) => file.changeType === 'added')
    .filter((file) => !trackedPatch.includes(`diff --git a/${file.path} b/${file.path}`))
    .map((file) => buildUntrackedPatch(repositoryRoot, file.path).trimEnd())
    .filter(Boolean)

  return [trackedPatch, ...untrackedPatches]
    .filter(Boolean)
    .join('\n\n')
}

function patchHasPatchWorkFileHeader(patch: string): boolean {
  return patch.split('\n').some((line) =>
    line.startsWith('diff --git a/patch-work ')
    || line.startsWith('diff --git a/patch-work/')
    || line.includes(' b/patch-work/')
    || line.endsWith(' b/patch-work'))
}

function resolveBranchName(repositoryRoot: string): string | undefined {
  const branch = runGit(repositoryRoot, ['branch', '--show-current']).trim()
  return branch || undefined
}

function readStatusPorcelain(repositoryRoot: string): string {
  return runGit(repositoryRoot, [
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
    '--',
    '.',
    ':(exclude)patch-work',
    ':(exclude)patch-work/**',
  ]).trimEnd()
}

function readExcludedPatchWorkFiles(repositoryRoot: string): string[] {
  return parseAllStatusEntries(repositoryRoot)
    .map((entry) => entry.path)
    .filter((path) => path === 'patch-work' || path.startsWith('patch-work/'))
    .filter((path, index, paths) => paths.indexOf(path) === index)
    .sort((a, b) => a.localeCompare(b))
}

function readStagedPatchWorkFiles(repositoryRoot: string): string[] {
  return runGit(repositoryRoot, [
    'diff',
    '--cached',
    '--name-only',
    '--',
    'patch-work',
    'patch-work/**',
  ])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

function readUnmergedFiles(repositoryRoot: string): string[] {
  return runGit(repositoryRoot, ['diff', '--name-only', '--diff-filter=U'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

function readContributingGuidelines(repositoryRoot: string): {
  content?: string
  relativePath?: string
} {
  const realRepositoryRoot = realpathSync(repositoryRoot)
  for (const relativePath of [
    'CONTRIBUTING.md',
    'CONTRIBUTING',
    '.github/CONTRIBUTING.md',
    'docs/CONTRIBUTING.md',
  ]) {
    const candidatePath = resolve(repositoryRoot, relativePath)
    if (!existsSync(candidatePath)) continue
    const stat = lstatSync(candidatePath)
    if (stat.isSymbolicLink() || !stat.isFile()) continue
    const realCandidatePath = realpathSync(candidatePath)
    if (!isInsideOrEqual(realRepositoryRoot, realCandidatePath)) continue
    return {
      content: readFileSync(candidatePath, 'utf-8'),
      relativePath,
    }
  }

  return {}
}

function buildDiffSummaryMarkdown(input: {
  changedFiles: PipelinePatchSetFile[]
  additions: number
  deletions: number
  baseBranch?: string
  workingBranch?: string
  headCommit?: string
  testEvidence: PipelineTestEvidence[]
}): string {
  return [
    '# Diff 摘要',
    '',
    '## 分支',
    `- Base branch: ${input.baseBranch ?? 'unknown'}`,
    `- Working branch: ${input.workingBranch ?? 'unknown'}`,
    `- HEAD: ${input.headCommit ?? 'unknown'}`,
    '',
    '## 统计',
    `- 文件数：${input.changedFiles.length}`,
    `- 新增：${input.additions}`,
    `- 删除：${input.deletions}`,
    '',
    '## 文件',
    ...(input.changedFiles.length
      ? input.changedFiles.map((file) =>
        `- \`${file.path}\` (${file.changeType}, +${file.additions ?? 0} / -${file.deletions ?? 0})`)
      : ['- 无源码变更。']),
    '',
    '## 测试证据',
    ...(input.testEvidence.length
      ? input.testEvidence.map((item) => `- ${item.status}: \`${item.command}\` - ${item.summary}`)
      : ['- 未记录测试证据。']),
    '',
    '## 排除项',
    '- patch-work/** 已从 patch-set 中排除。',
    '',
  ].join('\n')
}

function buildSubmissionDiffSummaryMarkdown(input: {
  changedFiles: PipelinePatchSetFile[]
  additions: number
  deletions: number
  workingBranch?: string
  headCommit?: string
  contributingGuidelinesPath?: string
}): string {
  return [
    '# 提交候选摘要',
    '',
    '## 分支',
    `- Working branch: ${input.workingBranch ?? 'unknown'}`,
    `- HEAD: ${input.headCommit ?? 'unknown'}`,
    '',
    '## 贡献规范',
    `- ${input.contributingGuidelinesPath ?? '未发现 CONTRIBUTING 文件。'}`,
    '',
    '## 统计',
    `- 文件数：${input.changedFiles.length}`,
    `- 新增：${input.additions}`,
    `- 删除：${input.deletions}`,
    '',
    '## 文件',
    ...(input.changedFiles.length
      ? input.changedFiles.map((file) =>
        `- \`${file.path}\` (${file.changeType}, +${file.additions ?? 0} / -${file.deletions ?? 0})`)
      : ['- 无源码变更。']),
    '',
    '## 排除项',
    '- patch-work/** 已从提交候选中排除。',
    '',
  ].join('\n')
}

export function buildPipelinePatchSetDraft(
  input: BuildPipelinePatchSetDraftInput,
): PipelinePatchSetDraft {
  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const changedFiles = buildChangedFiles(repositoryRoot)
  const additions = changedFiles.reduce((sum, file) => sum + (file.additions ?? 0), 0)
  const deletions = changedFiles.reduce((sum, file) => sum + (file.deletions ?? 0), 0)
  const workingBranch = resolveBranchName(repositoryRoot)
  const headCommit = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()
  const patch = buildPatch(repositoryRoot, changedFiles)
  const excludesPatchWork = !patchHasPatchWorkFileHeader(patch)
    && changedFiles.every((file) => file.path !== 'patch-work' && !file.path.startsWith('patch-work/'))

  return {
    patch,
    changedFiles,
    diffSummaryMarkdown: buildDiffSummaryMarkdown({
      changedFiles,
      additions,
      deletions,
      workingBranch,
      headCommit,
      testEvidence: input.testEvidence,
    }),
    testEvidence: input.testEvidence,
    additions,
    deletions,
    excludesPatchWork,
    workingBranch,
    headCommit,
  }
}

export function readPipelineSubmissionDraftContext(input: {
  repositoryRoot: string
}): PipelineSubmissionDraftContext {
  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const changedFiles = buildChangedFiles(repositoryRoot)
  const additions = changedFiles.reduce((sum, file) => sum + (file.additions ?? 0), 0)
  const deletions = changedFiles.reduce((sum, file) => sum + (file.deletions ?? 0), 0)
  const workingBranch = resolveBranchName(repositoryRoot)
  const headCommit = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()
  const statusPorcelain = readStatusPorcelain(repositoryRoot)
  const contributing = readContributingGuidelines(repositoryRoot)
  const excludesPatchWork = changedFiles.every((file) =>
    file.path !== 'patch-work' && !file.path.startsWith('patch-work/'))

  return {
    changedFiles,
    statusPorcelain,
    diffSummaryMarkdown: buildSubmissionDiffSummaryMarkdown({
      changedFiles,
      additions,
      deletions,
      workingBranch,
      headCommit,
      contributingGuidelinesPath: contributing.relativePath,
    }),
    additions,
    deletions,
    excludesPatchWork,
    contributingGuidelines: contributing.content,
    contributingGuidelinesPath: contributing.relativePath,
    workingBranch,
    headCommit,
  }
}

export function validateCommitPreconditions(
  input: ValidateCommitPreconditionsInput,
): PipelineLocalCommitPlan {
  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const commitMessage = input.commitMessage.trim()
  const changedFiles = buildChangedFiles(repositoryRoot)
  const excludedFiles = readExcludedPatchWorkFiles(repositoryRoot)
  const stagedPatchWorkFiles = readStagedPatchWorkFiles(repositoryRoot)
  const unmergedFiles = readUnmergedFiles(repositoryRoot)
  const workingBranch = resolveBranchName(repositoryRoot)
  const headCommit = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()
  const blockers: string[] = []

  if (!input.operationId.trim()) {
    blockers.push('缺少本地 commit operation id')
  }
  if (!commitMessage) {
    blockers.push('缺少 commit message')
  }
  if (!workingBranch) {
    blockers.push('当前不在具名分支，禁止自动本地 commit')
  }
  if (changedFiles.length === 0) {
    blockers.push('没有可提交的源码变更')
  }
  if (unmergedFiles.length > 0) {
    blockers.push(`存在未解决冲突文件: ${unmergedFiles.join(', ')}`)
  }
  if (stagedPatchWorkFiles.length > 0) {
    blockers.push(`patch-work/** 已进入 Git index，禁止本地 commit: ${stagedPatchWorkFiles.join(', ')}`)
  }

  return {
    operationId: input.operationId,
    commitMessage,
    canCommit: blockers.length === 0,
    blockers,
    changedFiles,
    excludedFiles,
    workingBranch,
    headCommit,
  }
}

export function createLocalPipelineCommit(
  input: CreateLocalPipelineCommitInput,
): PipelineLocalCommitResult {
  if (!input.confirmed) {
    throw new Error('用户未确认本地 commit，禁止执行 git commit')
  }

  const repositoryRoot = ensureGitRepository(input.repositoryRoot)
  const plan = validateCommitPreconditions({
    repositoryRoot,
    commitMessage: input.commitMessage,
    operationId: input.operationId,
  })
  if (!plan.canCommit) {
    throw new Error(`本地 commit 前置条件未满足: ${plan.blockers.join('；')}`)
  }

  runGit(repositoryRoot, ['add', '--', ...plan.changedFiles.map((file) => toLiteralPathspec(file.path))])
  const stagedPatchWorkFiles = readStagedPatchWorkFiles(repositoryRoot)
  if (stagedPatchWorkFiles.length > 0) {
    throw new Error(`patch-work/** 已进入 Git index，禁止本地 commit: ${stagedPatchWorkFiles.join(', ')}`)
  }
  runGit(repositoryRoot, ['commit', '-m', plan.commitMessage])
  const commitHash = runGit(repositoryRoot, ['rev-parse', 'HEAD']).trim()

  return {
    operationId: plan.operationId,
    commitMessage: plan.commitMessage,
    status: 'created',
    commitHash,
    files: plan.changedFiles,
    excludedFiles: plan.excludedFiles,
    baseBranch: plan.baseBranch,
    workingBranch: plan.workingBranch,
    headCommit: plan.headCommit,
    createdAt: Date.now(),
  }
}
