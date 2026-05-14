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
const {
  acceptPatchWorkDocuments,
  readPatchWorkManifest,
  writePatchWorkFile,
} = await import('./pipeline-patch-work-service')

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

  test('v2 developer 必须读取已接受 plan.md / test-plan.md 并写入 dev.md', () => {
    createContributionTask({
      id: 'task-runner-developer',
      pipelineSessionId: 'session-runner-developer',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedReportId: 'report-001',
      status: 'developing',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-developer',
      pipelineSessionId: 'session-runner-developer',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n\n## 实施步骤\n- 补 developer gate\n',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-developer',
      pipelineSessionId: 'session-runner-developer',
      repositoryRoot: repoRoot,
      kind: 'test_plan',
      createdByNode: 'planner',
      content: '# 测试方案\n\n## 单元测试\n- 覆盖 developer gate\n',
    })
    acceptPatchWorkDocuments({
      repositoryRoot: repoRoot,
      gateId: 'gate-plan',
      kinds: ['implementation_plan', 'test_plan'],
    })

    const prompts = buildPipelineNodePrompts('developer', {
      sessionId: 'session-runner-developer',
      userInput: '实现 Phase 4',
      currentNode: 'developer',
      version: 2,
      reviewIteration: 0,
    })
    const result = buildNodeExecutionResult('developer', JSON.stringify({
      summary: '完成 developer gate',
      changes: ['新增 developer 文档审核'],
      changedFiles: [
        {
          path: 'apps/electron/src/main/lib/pipeline-graph.ts',
          changeType: 'modified',
          summary: 'developer 后进入 document gate',
        },
      ],
      tests: ['bun test apps/electron/src/main/lib/pipeline-graph.test.ts'],
      testsRun: [
        {
          command: 'bun test apps/electron/src/main/lib/pipeline-graph.test.ts',
          status: 'passed',
          summary: 'Phase 4 graph 场景通过',
        },
      ],
      risks: ['reviewer loop 仍需人工接管上限'],
      devMarkdown: '# 开发文档\n\n## 需求复述\n实现 Phase 4。\n',
    }))
    const enriched = enrichPipelineV2PatchWorkArtifacts('developer', {
      sessionId: 'session-runner-developer',
      userInput: '实现 Phase 4',
      currentNode: 'developer',
      version: 2,
      reviewIteration: 0,
    }, result)

    expect(prompts.userPrompt).toContain('已接受开发方案（plan.md）')
    expect(prompts.userPrompt).toContain('补 developer gate')
    expect(prompts.userPrompt).toContain('已接受测试方案（test-plan.md）')
    expect(enriched.stageOutput).toMatchObject({
      node: 'developer',
      changedFiles: [
        {
          path: 'apps/electron/src/main/lib/pipeline-graph.ts',
          changeType: 'modified',
        },
      ],
      testsRun: [
        {
          status: 'passed',
        },
      ],
      devDoc: {
        relativePath: 'dev.md',
        revision: 1,
      },
      devDocRef: {
        relativePath: 'dev.md',
        revision: 1,
      },
    })
    expect(readFileSync(join(repoRoot, 'patch-work', 'dev.md'), 'utf-8')).toContain('实现 Phase 4')
  })

  test('v2 developer 缺少已接受方案文档时会中止', () => {
    createContributionTask({
      id: 'task-runner-developer-unaccepted',
      pipelineSessionId: 'session-runner-developer-unaccepted',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'developing',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-developer-unaccepted',
      pipelineSessionId: 'session-runner-developer-unaccepted',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-developer-unaccepted',
      pipelineSessionId: 'session-runner-developer-unaccepted',
      repositoryRoot: repoRoot,
      kind: 'test_plan',
      createdByNode: 'planner',
      content: '# 测试方案\n',
    })

    expect(() => buildPipelineNodePrompts('developer', {
      sessionId: 'session-runner-developer-unaccepted',
      userInput: '实现 Phase 4',
      currentNode: 'developer',
      version: 2,
      reviewIteration: 0,
    })).toThrow('尚未通过人工审核')
    expect(existsSync(join(repoRoot, 'patch-work', 'dev.md'))).toBe(false)
  })

  test('v2 developer fallback dev.md 对缺失 testsRun 保持保守说明', () => {
    createContributionTask({
      id: 'task-runner-developer-fallback',
      pipelineSessionId: 'session-runner-developer-fallback',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedReportId: 'report-001',
      status: 'developing',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-developer-fallback',
      pipelineSessionId: 'session-runner-developer-fallback',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-developer-fallback',
      pipelineSessionId: 'session-runner-developer-fallback',
      repositoryRoot: repoRoot,
      kind: 'test_plan',
      createdByNode: 'planner',
      content: '# 测试方案\n',
    })
    acceptPatchWorkDocuments({
      repositoryRoot: repoRoot,
      gateId: 'gate-plan',
      kinds: ['implementation_plan', 'test_plan'],
    })

    const result = buildNodeExecutionResult('developer', JSON.stringify({
      summary: '完成 developer 文档',
      changes: ['新增 dev.md fallback'],
      tests: ['bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts'],
      risks: [],
    }))
    enrichPipelineV2PatchWorkArtifacts('developer', {
      sessionId: 'session-runner-developer-fallback',
      userInput: '实现 Phase 4',
      currentNode: 'developer',
      version: 2,
      reviewIteration: 0,
    }, result)

    const devMarkdown = readFileSync(join(repoRoot, 'patch-work', 'dev.md'), 'utf-8')
    expect(devMarkdown).toContain('developer 未提供结构化 testsRun')
    expect(devMarkdown).not.toContain('## 未执行验证及原因\n- 无。')
  })

  test('v2 developer fallback dev.md 在空 testsRun 时也保持保守说明', () => {
    createContributionTask({
      id: 'task-runner-developer-empty-tests',
      pipelineSessionId: 'session-runner-developer-empty-tests',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      selectedReportId: 'report-001',
      status: 'developing',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-developer-empty-tests',
      pipelineSessionId: 'session-runner-developer-empty-tests',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-developer-empty-tests',
      pipelineSessionId: 'session-runner-developer-empty-tests',
      repositoryRoot: repoRoot,
      kind: 'test_plan',
      createdByNode: 'planner',
      content: '# 测试方案\n',
    })
    acceptPatchWorkDocuments({
      repositoryRoot: repoRoot,
      gateId: 'gate-plan',
      kinds: ['implementation_plan', 'test_plan'],
    })

    const result = buildNodeExecutionResult('developer', JSON.stringify({
      summary: '完成 developer 文档',
      changes: ['新增 dev.md fallback'],
      tests: ['bun test apps/electron/src/main/lib/pipeline-node-runner.test.ts'],
      testsRun: [],
      risks: [],
    }))
    enrichPipelineV2PatchWorkArtifacts('developer', {
      sessionId: 'session-runner-developer-empty-tests',
      userInput: '实现 Phase 4',
      currentNode: 'developer',
      version: 2,
      reviewIteration: 0,
    }, result)

    const devMarkdown = readFileSync(join(repoRoot, 'patch-work', 'dev.md'), 'utf-8')
    expect(devMarkdown).toContain('developer 未提供结构化 testsRun')
  })

  test('v2 reviewer 读取 dev.md 并写入 review.md 和稳定 issue ids', () => {
    createContributionTask({
      id: 'task-runner-reviewer',
      pipelineSessionId: 'session-runner-reviewer',
      repositoryRoot: repoRoot,
      patchWorkDir: join(repoRoot, 'patch-work'),
      contributionMode: 'local_patch',
      allowRemoteWrites: false,
      status: 'reviewing',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-reviewer',
      pipelineSessionId: 'session-runner-reviewer',
      repositoryRoot: repoRoot,
      kind: 'implementation_plan',
      createdByNode: 'planner',
      content: '# 开发方案\n',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-reviewer',
      pipelineSessionId: 'session-runner-reviewer',
      repositoryRoot: repoRoot,
      kind: 'test_plan',
      createdByNode: 'planner',
      content: '# 测试方案\n',
    })
    writePatchWorkFile({
      contributionTaskId: 'task-runner-reviewer',
      pipelineSessionId: 'session-runner-reviewer',
      repositoryRoot: repoRoot,
      kind: 'dev_doc',
      createdByNode: 'developer',
      content: '# 开发文档\n\n## 已执行验证\n未执行。\n',
    })
    acceptPatchWorkDocuments({
      repositoryRoot: repoRoot,
      gateId: 'gate-plan',
      kinds: ['implementation_plan', 'test_plan'],
    })
    acceptPatchWorkDocuments({
      repositoryRoot: repoRoot,
      gateId: 'gate-dev',
      kinds: ['dev_doc'],
    })

    const prompts = buildPipelineNodePrompts('reviewer', {
      sessionId: 'session-runner-reviewer',
      userInput: '实现 Phase 4',
      currentNode: 'reviewer',
      version: 2,
      reviewIteration: 1,
    })
    const result = buildNodeExecutionResult('reviewer', JSON.stringify({
      approved: false,
      summary: '缺少验证',
      issues: ['缺少 Developer UI 状态测试'],
      structuredIssues: [
        {
          severity: 'major',
          category: 'test_gap',
          title: '缺少 Developer UI 状态测试',
          detail: '需要覆盖 dev.md 文档审核状态。',
          status: 'open',
        },
      ],
      reviewMarkdown: '# 审查报告\n\n## 结论\n不通过。\n',
    }))
    const enriched = enrichPipelineV2PatchWorkArtifacts('reviewer', {
      sessionId: 'session-runner-reviewer',
      userInput: '实现 Phase 4',
      currentNode: 'reviewer',
      version: 2,
      reviewIteration: 1,
    }, result)
    const manifest = readPatchWorkManifest(repoRoot)

    expect(prompts.userPrompt).toContain('已接受开发文档（dev.md）')
    expect(prompts.userPrompt).toContain('git diff -- .')
    expect(enriched.stageOutput).toMatchObject({
      node: 'reviewer',
      approved: false,
      structuredIssues: [
        {
          id: 'RV-REV-001',
          severity: 'major',
          status: 'open',
        },
      ],
      reviewDoc: {
        relativePath: 'review.md',
      },
      reviewDocRef: {
        relativePath: 'review.md',
      },
    })
    expect(manifest.files.find((file) => file.relativePath === 'review.md')).toMatchObject({
      kind: 'review_doc',
      createdByNode: 'reviewer',
    })
    expect(readFileSync(join(repoRoot, 'patch-work', 'review.md'), 'utf-8')).toContain('不通过')
  })
})
