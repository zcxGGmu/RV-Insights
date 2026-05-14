import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

mock.module('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
  app: {
    isPackaged: false,
    getPath: () => '',
  },
}))

const {
  PipelineStructuredOutputError,
  buildNodeExecutionResult,
  buildPipelineNodeToolPermissionOptions,
  buildPipelineNodePrompts,
  enrichPipelineV2PatchWorkArtifacts,
} = await import('./pipeline-node-runner')
const { createContributionTask } = await import('./contribution-task-service')
const { writePatchWorkFile } = await import('./pipeline-patch-work-service')

describe('pipeline-node-runner', () => {
  const originalConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
  let tempConfigDir = ''
  let repoRoot = ''

  beforeEach(() => {
    tempConfigDir = mkdtempSync(join(tmpdir(), 'rv-pipeline-node-runner-config-'))
    repoRoot = mkdtempSync(join(tmpdir(), 'rv-pipeline-node-runner-repo-'))
    process.env.RV_INSIGHTS_CONFIG_DIR = tempConfigDir
  })

  afterEach(() => {
    if (originalConfigDir == null) {
      delete process.env.RV_INSIGHTS_CONFIG_DIR
    } else {
      process.env.RV_INSIGHTS_CONFIG_DIR = originalConfigDir
    }
    rmSync(tempConfigDir, { recursive: true, force: true })
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test('buildPipelineNodePrompts 拆分 system prompt 与 user prompt', () => {
    const prompts = buildPipelineNodePrompts('developer', {
      sessionId: 'session-1',
      userInput: '实现搜索分页',
      currentNode: 'developer',
      reviewIteration: 2,
      feedback: '请补充回归测试',
      stageOutputs: {
        planner: {
          node: 'planner',
          summary: '按三步实现',
          steps: ['补测试', '改实现', '跑验证'],
          risks: ['IPC 契约变化'],
          verification: ['bun test'],
          content: '完整计划正文不应进入 compact prompt',
        },
      },
    }, '默认工作区')

    expect(prompts.systemPrompt).toContain('你是 RV Pipeline 的 Developer 节点。')
    expect(prompts.systemPrompt).toContain('输出要求')
    expect(prompts.systemPrompt).not.toContain('实现搜索分页')
    expect(prompts.userPrompt).toContain('用户需求：实现搜索分页')
    expect(prompts.userPrompt).toContain('当前工作区：默认工作区')
    expect(prompts.userPrompt).toContain('当前 reviewer 轮次：2')
    expect(prompts.userPrompt).toContain('请补充回归测试')
    expect(prompts.userPrompt).toContain('按三步实现')
    expect(prompts.userPrompt).not.toContain('完整计划正文不应进入 compact prompt')
  })

  test('reviewer 非 JSON 输出会抛出结构化输出错误', () => {
    expect(() => buildNodeExecutionResult('reviewer', '这不是 JSON')).toThrow(PipelineStructuredOutputError)
  })

  test('explorer 支持解析 Markdown fenced JSON 输出', () => {
    const result = buildNodeExecutionResult('explorer', [
      '```json',
      JSON.stringify({
        summary: '已定位入口',
        findings: ['Pipeline 启动失败发生在 explorer'],
        keyFiles: ['apps/electron/src/main/lib/pipeline-node-runner.ts'],
        nextSteps: ['增强结构化输出解析容错'],
      }, null, 2),
      '```',
    ].join('\n'))

    expect(result.summary).toBe('已定位入口')
    expect(result.stageOutput).toMatchObject({
      node: 'explorer',
      findings: ['Pipeline 启动失败发生在 explorer'],
      keyFiles: ['apps/electron/src/main/lib/pipeline-node-runner.ts'],
      nextSteps: ['增强结构化输出解析容错'],
    })
  })

  test('explorer 自然语言输出会生成可选择的 fallback 报告', () => {
    createContributionTask({
      id: 'task-runner-explorer-fallback',
      pipelineSessionId: 'session-runner-explorer-fallback',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'exploring',
    })

    const rawOutput = [
      'Let me explore the Linux RISC-V memory management landscape systematically.',
      "I'll start by understanding the codebase structure and then dive into memory-related subsystems.",
      'This is a fresh workspace with no kernel checkout yet, so the first actionable task is to select a concrete repository entry point.',
    ].join('\n\n')
    const result = buildNodeExecutionResult('explorer', rawOutput)
    const enriched = enrichPipelineV2PatchWorkArtifacts('explorer', {
      sessionId: 'session-runner-explorer-fallback',
      userInput: '探索 Linux RISC-V 内存管理贡献方向',
      currentNode: 'explorer',
      version: 2,
      reviewIteration: 0,
    }, result)

    expect(enriched.summary).toContain('Let me explore')
    expect(enriched.stageOutput).toMatchObject({
      node: 'explorer',
      findings: [
        'Let me explore the Linux RISC-V memory management landscape systematically.',
        "I'll start by understanding the codebase structure and then dive into memory-related subsystems.",
        'This is a fresh workspace with no kernel checkout yet, so the first actionable task is to select a concrete repository entry point.',
      ],
      reports: [
        {
          reportId: 'report-001',
          relativePath: 'explorer/report-001.md',
        },
      ],
    })
    expect(readFileSync(join(repoRoot, 'patch-work', 'explorer', 'report-001.md'), 'utf-8')).toContain('Linux RISC-V memory management')
  })

  test('planner 支持解析前后带说明文字的 JSON 输出', () => {
    const result = buildNodeExecutionResult('planner', [
      '下面是结构化结果：',
      JSON.stringify({
        summary: '按三步修复',
        steps: ['补测试', '修解析', '跑验证'],
        risks: ['不能放宽字段校验'],
        verification: ['bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts'],
      }, null, 2),
      '以上为本阶段产物。',
    ].join('\n'))

    expect(result.summary).toBe('按三步修复')
    expect(result.stageOutput).toMatchObject({
      node: 'planner',
      steps: ['补测试', '修解析', '跑验证'],
      risks: ['不能放宽字段校验'],
      verification: ['bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts'],
    })
  })

  test('reviewer 缺少 approved 时不会被误判为驳回', () => {
    expect(() => buildNodeExecutionResult('reviewer', JSON.stringify({
      summary: '格式缺少 approved',
      issues: ['缺少字段'],
    }))).toThrow(/缺少或非法字段: approved/)
  })

  test('合法 reviewer JSON 会保留 approved 结论', () => {
    const result = buildNodeExecutionResult('reviewer', JSON.stringify({
      approved: true,
      summary: '审查通过',
      issues: [],
    }))

    expect(result.approved).toBe(true)
    expect(result.stageOutput).toMatchObject({
      node: 'reviewer',
      approved: true,
      summary: '审查通过',
      issues: [],
    })
  })

  test('committer 支持解析提交材料草稿结构化输出', () => {
    const result = buildNodeExecutionResult('committer', JSON.stringify({
      summary: '提交材料已生成',
      commitMessage: 'feat: add pipeline v2 skeleton',
      prTitle: 'Add Pipeline v2 skeleton',
      prBody: 'This PR adds the v2 skeleton.',
      submissionStatus: 'draft_only',
      risks: ['未执行真实 commit'],
    }))

    expect(result.approved).toBe(true)
    expect(result.stageOutput).toMatchObject({
      node: 'committer',
      summary: '提交材料已生成',
      commitMessage: 'feat: add pipeline v2 skeleton',
      prTitle: 'Add Pipeline v2 skeleton',
      submissionStatus: 'draft_only',
      risks: ['未执行真实 commit'],
    })
  })

  test('v2 explorer 会把结构化候选写入 patch-work/explorer 并回填 report refs', () => {
    createContributionTask({
      id: 'task-runner-explorer',
      pipelineSessionId: 'session-runner-explorer',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'exploring',
    })

    const result = buildNodeExecutionResult('explorer', JSON.stringify({
      summary: '找到两个贡献方向',
      findings: ['Pipeline 缺少选择态', 'Planner 文档不可审核'],
      keyFiles: ['PipelineView.tsx'],
      nextSteps: ['让用户选择任务'],
      reports: [
        {
          title: '任务选择闭环',
          summary: '用户必须选择报告后进入 planner。',
          keyFiles: ['PipelineView.tsx'],
          rationale: '避免 planner 处理模糊任务。',
        },
        {
          title: '方案文档审核',
          summary: '展示 plan.md 和 test-plan.md。',
          keyFiles: ['pipeline-patch-work-service.ts'],
          rationale: '让用户审核 checksum 后继续。',
        },
      ],
    }))

    const enriched = enrichPipelineV2PatchWorkArtifacts('explorer', {
      sessionId: 'session-runner-explorer',
      userInput: '实现 Phase 3',
      currentNode: 'explorer',
      version: 2,
      reviewIteration: 0,
    }, result)

    expect(enriched.stageOutput).toMatchObject({
      node: 'explorer',
      reports: [
        {
          reportId: 'report-001',
          title: '任务选择闭环',
          relativePath: 'explorer/report-001.md',
        },
        {
          reportId: 'report-002',
          title: '方案文档审核',
          relativePath: 'explorer/report-002.md',
        },
      ],
    })
    expect(readFileSync(join(repoRoot, 'patch-work', 'explorer', 'report-001.md'), 'utf-8')).toContain('用户必须选择报告后进入 planner')
  })

  test('v2 explorer 重跑时不会继续暴露上一轮多余报告', () => {
    createContributionTask({
      id: 'task-runner-explorer-rerun',
      pipelineSessionId: 'session-runner-explorer-rerun',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'exploring',
    })

    const firstResult = buildNodeExecutionResult('explorer', JSON.stringify({
      summary: '第一次生成三个方向',
      findings: ['方向一', '方向二', '方向三'],
      keyFiles: ['PipelineView.tsx'],
      nextSteps: ['选择任务'],
      reports: [
        { title: '方向一', summary: '第一份报告。' },
        { title: '方向二', summary: '第二份报告。' },
        { title: '方向三', summary: '第三份报告。' },
      ],
    }))

    enrichPipelineV2PatchWorkArtifacts('explorer', {
      sessionId: 'session-runner-explorer-rerun',
      userInput: '实现 Phase 3',
      currentNode: 'explorer',
      version: 2,
      reviewIteration: 0,
    }, firstResult)

    const secondResult = buildNodeExecutionResult('explorer', JSON.stringify({
      summary: '重跑后只保留一个方向',
      findings: ['方向一'],
      keyFiles: ['PipelineView.tsx'],
      nextSteps: ['选择任务'],
      reports: [
        { title: '方向一修订版', summary: '重跑后的唯一报告。' },
      ],
    }))

    const enriched = enrichPipelineV2PatchWorkArtifacts('explorer', {
      sessionId: 'session-runner-explorer-rerun',
      userInput: '实现 Phase 3',
      currentNode: 'explorer',
      version: 2,
      reviewIteration: 0,
    }, secondResult)

    expect(enriched.stageOutput).toMatchObject({
      node: 'explorer',
      reports: [
        {
          reportId: 'report-001',
          title: '方向一修订版',
          summary: '重跑后的唯一报告。',
        },
      ],
    })
  })

  test('v2 explorer 和 planner 强制使用只读工具权限', async () => {
    const explorerOptions = buildPipelineNodeToolPermissionOptions('explorer', {
      sessionId: 'session-readonly',
      userInput: '探索任务',
      currentNode: 'explorer',
      version: 2,
      reviewIteration: 0,
    }, 'bypassPermissions')

    expect(explorerOptions.allowDangerouslySkipPermissions).toBe(false)
    expect(explorerOptions.sdkPermissionMode).toBe('auto')
    expect(explorerOptions.allowedTools).toContain('Read')
    expect(explorerOptions.disallowedTools).toContain('Write')
    expect(await explorerOptions.canUseTool?.('Bash', { command: 'git status --short' }, {
      signal: new AbortController().signal,
      toolUseID: 'tool-safe-bash',
    })).toMatchObject({ behavior: 'allow' })
    expect(await explorerOptions.canUseTool?.('Bash', { command: 'git diff --output=src/a.ts' }, {
      signal: new AbortController().signal,
      toolUseID: 'tool-git-diff-output',
    })).toMatchObject({ behavior: 'deny' })
    expect(await explorerOptions.canUseTool?.('Bash', { command: 'git branch tmp' }, {
      signal: new AbortController().signal,
      toolUseID: 'tool-git-branch-create',
    })).toMatchObject({ behavior: 'deny' })
    expect(await explorerOptions.canUseTool?.('Bash', { command: 'git tag tmp' }, {
      signal: new AbortController().signal,
      toolUseID: 'tool-git-tag-create',
    })).toMatchObject({ behavior: 'deny' })
    expect(await explorerOptions.canUseTool?.('Bash', { command: 'git remote set-url origin git@example.com:repo.git' }, {
      signal: new AbortController().signal,
      toolUseID: 'tool-git-remote-set-url',
    })).toMatchObject({ behavior: 'deny' })
    expect(await explorerOptions.canUseTool?.('Bash', { command: 'git commit -m test' }, {
      signal: new AbortController().signal,
      toolUseID: 'tool-unsafe-bash',
    })).toMatchObject({ behavior: 'deny' })
    expect(await explorerOptions.canUseTool?.('Write', { file_path: 'src/index.ts' }, {
      signal: new AbortController().signal,
      toolUseID: 'tool-write',
    })).toMatchObject({ behavior: 'deny' })

    const developerOptions = buildPipelineNodeToolPermissionOptions('developer', {
      sessionId: 'session-developer',
      userInput: '实现任务',
      currentNode: 'developer',
      version: 2,
      reviewIteration: 0,
    }, 'bypassPermissions')
    expect(developerOptions.allowDangerouslySkipPermissions).toBe(true)
    expect(developerOptions.canUseTool).toBeUndefined()
  })

  test('v2 planner 缺少可验证 selected-task.md 时会中止，不生成方案文档', () => {
    createContributionTask({
      id: 'task-runner-planner-invalid-selected',
      pipelineSessionId: 'session-runner-planner-invalid-selected',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedReportId: 'report-001',
      status: 'planning',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-planner-invalid-selected',
      pipelineSessionId: 'session-runner-planner-invalid-selected',
      repositoryRoot: repoRoot,
      kind: 'selected_task',
      createdByNode: 'explorer',
      content: '# 已选任务：任务选择闭环\n\n用户必须选择报告后进入 planner。\n',
    })
    writeFileSync(join(repoRoot, 'patch-work', 'selected-task.md'), '# 已选任务：被篡改\n', 'utf-8')

    expect(() => buildPipelineNodePrompts('planner', {
      sessionId: 'session-runner-planner-invalid-selected',
      userInput: '实现 Phase 3',
      currentNode: 'planner',
      version: 2,
      reviewIteration: 0,
    })).toThrow('selected-task.md')
    expect(existsSync(join(repoRoot, 'patch-work', 'plan.md'))).toBe(false)
  })

  test('v2 planner 读取 selected-task.md 并写入 plan.md / test-plan.md', () => {
    createContributionTask({
      id: 'task-runner-planner',
      pipelineSessionId: 'session-runner-planner',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedReportId: 'report-001',
      status: 'planning',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-planner',
      pipelineSessionId: 'session-runner-planner',
      repositoryRoot: repoRoot,
      kind: 'selected_task',
      createdByNode: 'explorer',
      content: '# 已选任务：任务选择闭环\n\n用户必须选择报告后进入 planner。\n',
    })

    const prompts = buildPipelineNodePrompts('planner', {
      sessionId: 'session-runner-planner',
      userInput: '实现 Phase 3',
      currentNode: 'planner',
      version: 2,
      reviewIteration: 0,
    })
    const result = buildNodeExecutionResult('planner', JSON.stringify({
      summary: '按两步实现',
      steps: ['补 IPC', '补 UI'],
      risks: ['不能依赖 records'],
      verification: ['bun test'],
      planMarkdown: '# 开发方案\n\n## 目标行为\n用户选择任务后进入 planner。\n',
      testPlanMarkdown: '# 测试方案\n\n## 单元测试\n覆盖 patch-work service。\n',
    }))

    const enriched = enrichPipelineV2PatchWorkArtifacts('planner', {
      sessionId: 'session-runner-planner',
      userInput: '实现 Phase 3',
      currentNode: 'planner',
      version: 2,
      reviewIteration: 0,
    }, result)

    expect(prompts.userPrompt).toContain('已选任务')
    expect(enriched.stageOutput).toMatchObject({
      node: 'planner',
      planRef: {
        relativePath: 'plan.md',
        revision: 1,
      },
      testPlanRef: {
        relativePath: 'test-plan.md',
        revision: 1,
      },
    })
    expect(existsSync(join(repoRoot, 'patch-work', 'plan.md'))).toBe(true)
    expect(readFileSync(join(repoRoot, 'patch-work', 'test-plan.md'), 'utf-8')).toContain('覆盖 patch-work service')
  })
})
