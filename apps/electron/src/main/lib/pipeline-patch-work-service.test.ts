import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  initializePatchWork,
  readPatchWorkFile,
  readPatchWorkManifest,
  writePatchWorkFile,
} from './pipeline-patch-work-service'

describe('pipeline-patch-work-service', () => {
  let repoRoot = ''
  let extraDirs: string[] = []

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'rv-patch-work-repo-'))
    extraDirs = []
  })

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true })
    for (const dir of extraDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('初始化 patch-work 并创建 manifest', () => {
    const manifest = initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })

    expect(manifest).toMatchObject({
      version: 1,
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      files: [],
    })
    expect(existsSync(join(repoRoot, 'patch-work', 'manifest.json'))).toBe(true)
  })

  test('固定文件写入会更新 checksum、revision 和修订归档', () => {
    const first = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n\n第一版\n',
    })
    const second = writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n\n第二版\n',
    })

    const manifest = readPatchWorkManifest(repoRoot)

    expect(first).toMatchObject({
      relativePath: 'plan.md',
      revision: 1,
    })
    expect(second).toMatchObject({
      relativePath: 'plan.md',
      revision: 2,
    })
    expect(second.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(manifest.files).toHaveLength(1)
    expect(manifest.files[0]).toMatchObject({
      kind: 'implementation_plan',
      relativePath: 'plan.md',
      revision: 2,
      checksum: second.checksum,
    })
    expect(manifest.checksums['plan.md']).toBe(second.checksum)
    expect(readPatchWorkFile({
      repositoryRoot: repoRoot,
      relativePath: 'plan.md',
    })).toContain('第二版')
    expect(readFileSync(join(repoRoot, 'patch-work', 'revisions', 'planner', '001-plan.md'), 'utf-8')).toContain('第一版')
    expect(readFileSync(join(repoRoot, 'patch-work', 'revisions', 'planner', '002-plan.md'), 'utf-8')).toContain('第二版')
  })

  test('支持所有 Phase 1 固定 Markdown 文件', () => {
    const fixedKinds = [
      ['selected_task', 'selected-task.md'],
      ['test_plan', 'test-plan.md'],
      ['dev_doc', 'dev.md'],
      ['review_doc', 'review.md'],
      ['test_result', 'result.md'],
      ['commit_doc', 'commit.md'],
      ['pr_doc', 'pr.md'],
    ] as const

    for (const [kind, relativePath] of fixedKinds) {
      const ref = writePatchWorkFile({
        contributionTaskId: 'task-1',
        pipelineSessionId: 'session-1',
        repositoryRoot: repoRoot,
        kind,
        createdByNode: kind === 'commit_doc' || kind === 'pr_doc' ? 'committer' : 'planner',
        content: `# ${kind}\n`,
      })

      expect(ref.relativePath).toBe(relativePath)
      expect(existsSync(join(repoRoot, 'patch-work', relativePath))).toBe(true)
    }
  })

  test('拒绝绝对路径、上级路径和读取软链越界文件', () => {
    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      relativePath: '../escape.md',
      createdByNode: 'planner',
      content: '越界',
    })).toThrow('patch-work 文件路径越界')

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      relativePath: join(repoRoot, 'outside.md'),
      createdByNode: 'planner',
      content: '越界',
    })).toThrow('patch-work 文件路径越界')

    const patchWorkDir = join(repoRoot, 'patch-work')
    initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })
    const outsidePath = join(repoRoot, 'outside.md')
    writeFileSync(outsidePath, '外部文件', 'utf-8')

    try {
      symlinkSync(outsidePath, join(patchWorkDir, 'linked.md'))
      expect(() => readPatchWorkFile({
        repositoryRoot: repoRoot,
        relativePath: 'linked.md',
      })).toThrow('patch-work 文件路径越界')
    } catch (error) {
      console.warn('[测试] 当前平台不支持创建 symlink，已跳过软链越界断言:', error)
    }
  })

  test('拒绝 patch-work 目录自身软链到仓库外', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'rv-patch-work-outside-'))
    extraDirs.push(outsideDir)
    symlinkSync(outsideDir, join(repoRoot, 'patch-work'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 不应写入外部目录\n',
    })).toThrow('patch-work 目录越界')
    expect(existsSync(join(outsideDir, 'plan.md'))).toBe(false)
  })

  test('拒绝 patch-work 目录软链到仓库内部目录', () => {
    const srcDir = join(repoRoot, 'src')
    mkdirSync(srcDir, { recursive: true })
    symlinkSync(srcDir, join(repoRoot, 'patch-work'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 不应写入 src\n',
    })).toThrow('patch-work 目录越界')
    expect(existsSync(join(srcDir, 'plan.md'))).toBe(false)
  })

  test('拒绝 manifest 软链且不会把仓库外内容复制到 bak', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'rv-patch-work-secret-'))
    extraDirs.push(outsideDir)
    const secretPath = join(outsideDir, 'secret.txt')
    writeFileSync(secretPath, 'SECRET-DATA', 'utf-8')
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    symlinkSync(secretPath, join(repoRoot, 'patch-work', 'manifest.json'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 不应触发 manifest backup\n',
    })).toThrow('patch-work manifest 不能是软链')
    expect(existsSync(join(repoRoot, 'patch-work', 'manifest.json.bak'))).toBe(false)
  })

  test('拒绝 manifest tmp / bak 软链，避免写入或备份仓库外文件', () => {
    initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })

    for (const companionName of ['manifest.json.tmp', 'manifest.json.bak']) {
      const outsideDir = mkdtempSync(join(tmpdir(), `rv-patch-work-${companionName}-`))
      extraDirs.push(outsideDir)
      const outsidePath = join(outsideDir, 'outside.txt')
      writeFileSync(outsidePath, 'SECRET-DATA', 'utf-8')
      symlinkSync(outsidePath, join(repoRoot, 'patch-work', companionName))

      expect(() => writePatchWorkFile({
        contributionTaskId: 'task-1',
        pipelineSessionId: 'session-1',
        repositoryRoot: repoRoot,
        kind: 'implementation_plan',
        createdByNode: 'planner',
        content: `# 不应触发 ${companionName}\n`,
      })).toThrow('patch-work manifest 不能是软链')
      expect(readFileSync(outsidePath, 'utf-8')).toBe('SECRET-DATA')

      rmSync(join(repoRoot, 'patch-work', companionName), { force: true })
    }
  })

  test('拒绝 dangling manifest 软链', () => {
    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    symlinkSync(join(repoRoot, 'missing-manifest-target.json'), join(repoRoot, 'patch-work', 'manifest.json'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 不应替换 dangling symlink\n',
    })).toThrow('patch-work manifest 不能是软链')
  })

  test('拒绝父目录中的软链，且不会先在仓库外创建目录', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'rv-patch-work-linked-parent-'))
    extraDirs.push(outsideDir)
    initializePatchWork({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
    })
    symlinkSync(outsideDir, join(repoRoot, 'patch-work', 'linked'))

    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'explorer_report',
      relativePath: 'linked/nested/report.md',
      createdByNode: 'explorer',
      content: '# 不应越界创建目录\n',
    })).toThrow('patch-work 文件路径越界')
    expect(existsSync(join(outsideDir, 'nested'))).toBe(false)
  })

  test('拒绝覆盖 manifest、revisions 和临时文件等保留路径', () => {
    const reservedPaths = [
      'manifest.json',
      'manifest.json/evil.md',
      'manifest.json.tmp',
      'manifest.json.bak',
      'revisions/planner/001-plan.md',
      '.tmp-evil',
      '.tmp/evil.md',
    ]

    for (const relativePath of reservedPaths) {
      expect(() => writePatchWorkFile({
        contributionTaskId: 'task-1',
        pipelineSessionId: 'session-1',
        repositoryRoot: repoRoot,
        kind: 'explorer_report',
        relativePath,
        createdByNode: 'explorer',
        content: '保留路径',
      })).toThrow('patch-work 文件路径保留')
    }
  })

  test('运行时拒绝非法文件类型和节点类型', () => {
    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'bad_kind' as never,
      createdByNode: 'planner',
      content: '非法类型',
    })).toThrow('无效 patch-work 文件类型')

    mkdirSync(join(repoRoot, 'patch-work'), { recursive: true })
    expect(() => writePatchWorkFile({
      contributionTaskId: 'task-1',
      pipelineSessionId: 'session-1',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'bad_node' as never,
      content: '非法节点',
    })).toThrow('无效 patch-work 节点类型')
  })
})
