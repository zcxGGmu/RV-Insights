import { describe, expect, mock, test } from 'bun:test'

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
  buildPipelineNodePrompts,
} = await import('./pipeline-node-runner')

describe('pipeline-node-runner', () => {
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
})
