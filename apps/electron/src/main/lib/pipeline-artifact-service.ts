import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type {
  PipelineArtifactFileRef,
  PipelineArtifactManifest,
  PipelineNodeKind,
  PipelineStageArtifactRecord,
  PipelineStageOutput,
} from '@rv-insights/shared'
import { getPipelineArtifactsDir } from './config-paths'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'

const MANIFEST_VERSION = 1

const NODE_LABELS: Record<PipelineNodeKind, string> = {
  explorer: '探索',
  planner: '计划',
  developer: '开发',
  reviewer: '审查',
  tester: '测试',
}

function isSafeSessionId(sessionId: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(sessionId)
}

export function resolvePipelineSessionArtifactsDir(
  sessionId: string,
  options: { create?: boolean } = {},
): string {
  if (!isSafeSessionId(sessionId)) {
    throw new Error(`无效 Pipeline 会话 ID: ${sessionId}`)
  }

  const root = resolve(getPipelineArtifactsDir())
  const target = resolve(root, sessionId)
  const relativeTarget = relative(root, target)
  if (
    relativeTarget === ''
    || relativeTarget === '..'
    || relativeTarget.startsWith(`..${sep}`)
    || isAbsolute(relativeTarget)
  ) {
    throw new Error(`Pipeline 产物目录越界: ${sessionId}`)
  }

  if (options.create !== false && !existsSync(target)) {
    mkdirSync(target, { recursive: true })
  }

  return target
}

function getManifestPath(sessionId: string): string {
  return join(resolvePipelineSessionArtifactsDir(sessionId), 'manifest.json')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isArtifactFileRef(value: unknown): value is PipelineArtifactFileRef {
  if (!isObject(value)) return false
  if (value.kind !== 'markdown' && value.kind !== 'json') return false
  if (typeof value.displayName !== 'string' || !value.displayName.trim()) return false
  if (typeof value.relativePath !== 'string' || !value.relativePath.trim()) return false
  if (value.relativePath.includes('..') || isAbsolute(value.relativePath)) return false
  return true
}

function createEmptyManifest(sessionId: string): PipelineArtifactManifest {
  return {
    version: MANIFEST_VERSION,
    sessionId,
    files: [],
    updatedAt: 0,
  }
}

function normalizeManifest(
  sessionId: string,
  manifest: PipelineArtifactManifest | null,
): PipelineArtifactManifest {
  if (!isObject(manifest)) {
    return createEmptyManifest(sessionId)
  }

  const files = Array.isArray(manifest.files)
    ? manifest.files.filter(isArtifactFileRef)
    : []

  return {
    version: MANIFEST_VERSION,
    sessionId,
    files,
    updatedAt: typeof manifest.updatedAt === 'number' ? manifest.updatedAt : 0,
  }
}

export function readPipelineArtifactManifest(sessionId: string): PipelineArtifactManifest {
  return normalizeManifest(sessionId, readJsonFileSafe<PipelineArtifactManifest>(getManifestPath(sessionId)))
}

function writePipelineArtifactManifest(manifest: PipelineArtifactManifest): void {
  writeJsonFileAtomic(getManifestPath(manifest.sessionId), manifest)
}

function normalizeListItems(items: string[]): string[] {
  return items
    .map((item) => item.trim().replace(/\s+/g, ' '))
    .filter((item) => item.length > 0)
}

function appendListSection(lines: string[], title: string, items: string[]): void {
  const normalized = normalizeListItems(items)
  if (normalized.length === 0) return

  lines.push('', `## ${title}`, '')
  lines.push(...normalized.map((item) => `- ${item}`))
}

function chooseFence(content: string): string {
  return content.includes('```') ? '````' : '```'
}

function appendArtifactSections(lines: string[], artifact: PipelineStageOutput): void {
  switch (artifact.node) {
    case 'explorer':
      appendListSection(lines, '关键发现', artifact.findings)
      appendListSection(lines, '相关文件', artifact.keyFiles)
      appendListSection(lines, '建议下一步', artifact.nextSteps)
      break
    case 'planner':
      appendListSection(lines, '实施步骤', artifact.steps)
      appendListSection(lines, '风险点', artifact.risks)
      appendListSection(lines, '验证方式', artifact.verification)
      break
    case 'developer':
      appendListSection(lines, '代码改动', artifact.changes)
      appendListSection(lines, '测试情况', artifact.tests)
      appendListSection(lines, '风险点', artifact.risks)
      break
    case 'reviewer':
      lines.push('', '## 审查结论', '', artifact.approved ? '通过' : '需要修改')
      appendListSection(lines, '审查问题', artifact.issues)
      break
    case 'tester':
      appendListSection(lines, '执行命令', artifact.commands)
      appendListSection(lines, '验证结果', artifact.results)
      appendListSection(lines, '阻塞问题', artifact.blockers)
      break
  }
}

function buildArtifactMarkdown(record: PipelineStageArtifactRecord): string {
  const nodeLabel = NODE_LABELS[record.node]
  const lines: string[] = [
    `# ${nodeLabel}阶段产物`,
    '',
    `记录 ID：${record.id}`,
    `生成时间：${new Date(record.createdAt).toISOString()}`,
    '',
    '## 摘要',
    '',
    record.artifact.summary,
  ]

  appendArtifactSections(lines, record.artifact)

  if (record.artifact.content.trim()) {
    const fence = chooseFence(record.artifact.content)
    lines.push('', '## 原始内容', '', `${fence}text`, record.artifact.content, fence)
  }

  return lines.join('\n').trimEnd() + '\n'
}

function buildArtifactFiles(record: PipelineStageArtifactRecord): PipelineArtifactFileRef[] {
  const nodeLabel = NODE_LABELS[record.node]
  const baseName = `${record.node}-${record.createdAt}`

  return [
    {
      kind: 'markdown',
      displayName: `${nodeLabel}阶段产物.md`,
      relativePath: `${baseName}.md`,
    },
    {
      kind: 'json',
      displayName: `${nodeLabel}阶段产物.json`,
      relativePath: `${baseName}.json`,
    },
  ]
}

function upsertManifestFiles(
  sessionId: string,
  manifest: PipelineArtifactManifest,
  files: PipelineArtifactFileRef[],
): PipelineArtifactManifest {
  const nextFiles = manifest.files.filter((existing) =>
    !files.some((file) => file.relativePath === existing.relativePath),
  )

  return {
    version: MANIFEST_VERSION,
    sessionId,
    files: [...nextFiles, ...files],
    updatedAt: Date.now(),
  }
}

export function persistPipelineStageArtifactRecord(
  record: PipelineStageArtifactRecord,
): PipelineStageArtifactRecord {
  const artifactDir = resolvePipelineSessionArtifactsDir(record.sessionId)
  const files = buildArtifactFiles(record)
  const markdownFile = files.find((file) => file.kind === 'markdown')
  const jsonFile = files.find((file) => file.kind === 'json')

  if (markdownFile) {
    writeFileSync(join(artifactDir, markdownFile.relativePath), buildArtifactMarkdown(record), 'utf-8')
  }

  if (jsonFile) {
    writeFileSync(join(artifactDir, jsonFile.relativePath), JSON.stringify(record.artifact, null, 2), 'utf-8')
  }

  const manifest = upsertManifestFiles(
    record.sessionId,
    readPipelineArtifactManifest(record.sessionId),
    files,
  )
  writePipelineArtifactManifest(manifest)

  return {
    ...record,
    artifactFiles: files,
  }
}
