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

function parseChangeType(status: string): PipelinePatchSetFile['changeType'] {
  if (status.includes('D')) return 'deleted'
  if (status.includes('R')) return 'renamed'
  if (status.includes('A') || status === '??') return 'added'
  return 'modified'
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
    if (!line.trim()) continue
    const status = line.slice(0, 2)
    const rawPath = line.slice(3)
    const path = status.includes('R') && rawPath.includes(' -> ')
      ? rawPath.split(' -> ').at(-1) ?? rawPath
      : rawPath
    const normalized = normalizeGitPath(repositoryRoot, path)
    if (normalized === 'patch-work' || normalized.startsWith('patch-work/')) continue
    entries.push({
      path: normalized,
      changeType: parseChangeType(status),
    })
  }

  return entries
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
