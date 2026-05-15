import { describe, expect, test } from 'bun:test'
import type {
  PipelineCommitterStageOutput,
  PipelinePatchWorkDocumentRef,
  PipelineTesterStageOutput,
} from '@rv-insights/shared'
import {
  buildCommitterPanelViewModel,
  collectCommitterPatchWorkRefs,
} from './CommitterPanel'

function makeDocument(
  patch: Partial<PipelinePatchWorkDocumentRef> & { displayName: string; relativePath: string },
): PipelinePatchWorkDocumentRef {
  return {
    displayName: patch.displayName,
    relativePath: patch.relativePath,
    checksum: patch.checksum ?? 'c'.repeat(64),
    revision: patch.revision ?? 1,
  }
}

function makeCommitterOutput(patch: Partial<PipelineCommitterStageOutput> = {}): PipelineCommitterStageOutput {
  return {
    node: 'committer',
    summary: '提交材料已生成',
    commitMessage: 'feat(pipeline): add draft submission',
    prTitle: 'Add draft submission materials',
    prBody: '## Summary\n- Add draft submission\n\n## Tests\n- bun test',
    submissionStatus: 'draft_only',
    blockers: [],
    risks: ['未执行真实 commit'],
    commitDocRef: makeDocument({
      displayName: 'Commit 准备.md',
      relativePath: 'commit.md',
      checksum: '1'.repeat(64),
      revision: 2,
    }),
    prDocRef: makeDocument({
      displayName: 'PR 草稿.md',
      relativePath: 'pr.md',
      checksum: '2'.repeat(64),
      revision: 2,
    }),
    localCommit: {
      attempted: false,
      status: 'not_requested',
    },
    remoteSubmission: {
      attempted: false,
      status: 'not_requested',
    },
    content: '{}',
    ...patch,
  }
}

function makeTesterOutput(): PipelineTesterStageOutput {
  return {
    node: 'tester',
    summary: '测试通过',
    commands: ['bun test'],
    results: ['通过'],
    blockers: [],
    passed: true,
    testEvidence: [
      {
        command: 'bun test',
        status: 'passed',
        summary: '通过',
      },
    ],
    patchSet: {
      files: [
        {
          path: 'src/index.ts',
          changeType: 'modified',
          summary: '更新实现',
          additions: 4,
          deletions: 1,
        },
      ],
      additions: 4,
      deletions: 1,
      testEvidence: [
        {
          command: 'bun test',
          status: 'passed',
          summary: '通过',
        },
      ],
      excludesPatchWork: true,
    },
    content: '{}',
  }
}

describe('CommitterPanel', () => {
  test('从 committer stage output 收集 commit.md 和 pr.md 文件引用', () => {
    const refs = collectCommitterPatchWorkRefs(makeCommitterOutput())

    expect(refs.map((ref) => ref.relativePath)).toEqual([
      'commit.md',
      'pr.md',
    ])
  })

  test('构建 draft-only 提交材料视图并展示测试证据', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput(),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备\n\n## 建议 Commit Message\nfeat(pipeline): add draft submission'],
        ['pr.md', '# PR 草稿\n\n## Title\nAdd draft submission materials'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.statusLabel).toBe('草稿待确认')
    expect(viewModel.approveLabel).toBe('仅保存提交材料并完成')
    expect(viewModel.approveDisabled).toBe(false)
    expect(viewModel.commitMessage).toBe('feat(pipeline): add draft submission')
    expect(viewModel.prTitle).toBe('Add draft submission materials')
    expect(viewModel.patchSetSummary).toBe('1 个文件，+4 / -1')
    expect(viewModel.evidenceItems).toEqual([
      expect.objectContaining({
        command: 'bun test',
        statusLabel: '通过',
      }),
    ])
    expect(viewModel.documents.map((document) => document.relativePath)).toEqual(['commit.md', 'pr.md'])
  })

  test('缺少提交材料正文时禁止完成 submission review', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput(),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.warning).toContain('提交材料')

    const missingRefsViewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        commitDocRef: undefined,
        prDocRef: undefined,
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map(),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(missingRefsViewModel.approveDisabled).toBe(true)
    expect(missingRefsViewModel.warning).toContain('commit.md')
  })

  test('存在 blocker 时展示阻塞并禁止完成', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        submissionStatus: 'blocked',
        blockers: ['缺少上游 CONTRIBUTING'],
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.statusLabel).toBe('提交材料阻塞')
    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.blockers).toEqual(['缺少上游 CONTRIBUTING'])
  })

  test('Phase 6 遇到本地 commit 或远端 PR 状态时禁止完成', () => {
    const viewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        submissionStatus: 'local_commit_created',
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(viewModel.approveDisabled).toBe(true)
    expect(viewModel.warning).toContain('Phase 6')

    const attemptedViewModel = buildCommitterPanelViewModel({
      output: makeCommitterOutput({
        localCommit: {
          attempted: true,
          status: 'created',
          commitHash: 'abc123',
        },
      }),
      testerOutput: makeTesterOutput(),
      contents: new Map([
        ['commit.md', '# Commit 准备'],
        ['pr.md', '# PR 草稿'],
      ]),
      loadingPaths: new Set(),
      readErrors: new Map(),
      submitting: false,
    })

    expect(attemptedViewModel.approveDisabled).toBe(true)
    expect(attemptedViewModel.warning).toContain('Phase 6')
  })
})
