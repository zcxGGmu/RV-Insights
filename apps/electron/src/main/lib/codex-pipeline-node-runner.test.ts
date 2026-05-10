import { describe, expect, mock, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  PipelineNodeKind,
  PipelineStreamEvent,
} from '@rv-insights/shared'

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
  CodexCliPipelineNodeRunner,
  CodexSdkPipelineNodeRunner,
  buildCodexCliArgs,
} = await import('./codex-pipeline-node-runner')
const { RoutedPipelineNodeRunner } = await import('./pipeline-node-router')
const { createChannel } = await import('./channel-manager')

import type {
  CodexCliExecutor,
  CodexCliRunInput,
  CodexSdkOptions,
  CodexSdkThreadOptions,
  CodexSdkTurnOptions,
  CreateCodexSdkClient,
} from './codex-pipeline-node-runner'
import type {
  PipelineNodeExecutionContext,
  PipelineNodeExecutionResult,
  PipelineNodeRunner,
} from './pipeline-node-runner'

function context(node: PipelineNodeKind): PipelineNodeExecutionContext {
  return {
    sessionId: 'session-1',
    userInput: '修复 Pipeline bug',
    currentNode: node,
    reviewIteration: 0,
  }
}

class FakeCodexCliExecutor implements CodexCliExecutor {
  readonly calls: CodexCliRunInput[] = []

  constructor(private readonly finalResponse: string) {}

  abort(): void {}

  async run(input: CodexCliRunInput) {
    this.calls.push(input)
    return { finalResponse: this.finalResponse }
  }
}

describe('codex-pipeline-node-runner', () => {
  test('buildCodexCliArgs 构造 codex exec 结构化输出参数', () => {
    const args = buildCodexCliArgs({
      schemaPath: '/tmp/schema.json',
      outputPath: '/tmp/final.json',
      cwd: '/repo',
      additionalDirectories: ['/extra-a', '/extra-b'],
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-5.4',
      sandboxMode: 'workspace-write',
      approvalPolicy: 'never',
    })

    expect(args).toEqual([
      'exec',
      '--json',
      '--sandbox',
      'workspace-write',
      '--output-schema',
      '/tmp/schema.json',
      '--output-last-message',
      '/tmp/final.json',
      '--config',
      'approval_policy="never"',
      '--skip-git-repo-check',
      '--config',
      'openai_base_url="https://api.openai.com/v1"',
      '--model',
      'gpt-5.4',
      '--cd',
      '/repo',
      '--add-dir',
      '/extra-a',
      '--add-dir',
      '/extra-b',
    ])
  })

  test('Codex CLI runner 执行 developer 并解析结构化结果', async () => {
    const events: PipelineStreamEvent[] = []
    const executor = new FakeCodexCliExecutor(JSON.stringify({
      summary: '完成修复',
      changes: ['新增 Codex CLI runner'],
      tests: ['bun test apps/electron/src/main/lib/codex-pipeline-node-runner.test.ts'],
      risks: [],
    }))
    const runner = new CodexCliPipelineNodeRunner({
      executor,
      onEvent: (event) => events.push(event),
    })

    const result = await runner.runNode('developer', context('developer'))

    expect(executor.calls).toHaveLength(1)
    expect(executor.calls[0]?.sandboxMode).toBe('workspace-write')
    expect(executor.calls[0]?.schema).toMatchObject({
      required: ['summary', 'changes', 'tests', 'risks'],
    })
    expect(result.summary).toBe('完成修复')
    expect(result.approved).toBe(true)
    expect(result.stageOutput).toMatchObject({
      node: 'developer',
      changes: ['新增 Codex CLI runner'],
    })
    expect(events.map((event) => event.type)).toEqual([
      'node_start',
      'text_delta',
      'node_complete',
    ])
  })

  test('Codex SDK runner 执行 reviewer 并保留驳回结论', async () => {
    const sdkOptions: CodexSdkOptions[] = []
    const threadOptions: CodexSdkThreadOptions[] = []
    const turnOptions: CodexSdkTurnOptions[] = []
    const createCodexClient: CreateCodexSdkClient = (options) => {
      sdkOptions.push(options)
      return {
        startThread: (optionsForThread) => {
          threadOptions.push(optionsForThread ?? {})
          return {
            run: async (_input, optionsForTurn) => {
              turnOptions.push(optionsForTurn ?? {})
              return {
                finalResponse: JSON.stringify({
                  approved: false,
                  summary: '需要返工',
                  issues: ['缺少回归测试'],
                }),
              }
            },
          }
        },
      }
    }
    const runner = new CodexSdkPipelineNodeRunner({
      createCodexClient,
      codexPath: '/mock/codex',
    })

    const result = await runner.runNode('reviewer', context('reviewer'))

    expect(sdkOptions[0]?.codexPathOverride).toBe('/mock/codex')
    expect(sdkOptions[0]?.apiKey).toBeUndefined()
    expect(sdkOptions[0]?.baseUrl).toBeUndefined()
    expect(threadOptions[0]).toMatchObject({
      sandboxMode: 'read-only',
      skipGitRepoCheck: true,
      approvalPolicy: 'never',
    })
    expect(threadOptions[0]?.model).toBeUndefined()
    expect(turnOptions[0]?.outputSchema).toMatchObject({
      required: ['approved', 'summary', 'issues'],
    })
    expect(result.approved).toBe(false)
    expect(result.issues).toEqual(['缺少回归测试'])
  })

  test('Codex SDK runner 遇到非法 JSON 时不发送 node_complete', async () => {
    const events: PipelineStreamEvent[] = []
    const createCodexClient: CreateCodexSdkClient = () => ({
      startThread: () => ({
        run: async () => ({ finalResponse: '不是 JSON' }),
      }),
    })
    const runner = new CodexSdkPipelineNodeRunner({
      createCodexClient,
      codexPath: '/mock/codex',
      onEvent: (event) => events.push(event),
    })

    await expect(runner.runNode('reviewer', context('reviewer'))).rejects.toThrow(/输出不是合法 JSON 对象/)
    expect(events.map((event) => event.type)).toEqual(['node_start'])
  })

  test('Codex SDK runner 会读取 OpenAI 兼容渠道配置', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-openai-channel-'))
    try {
      const channel = createChannel({
        name: 'OpenAI 渠道',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai-test',
        enabled: true,
        models: [
          { id: 'gpt-5.4', name: 'GPT-5.4', enabled: true },
          { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', enabled: false },
        ],
      })
      const sdkOptions: CodexSdkOptions[] = []
      const threadOptions: CodexSdkThreadOptions[] = []
      const createCodexClient: CreateCodexSdkClient = (options) => {
        sdkOptions.push(options)
        return {
          startThread: (optionsForThread) => {
            threadOptions.push(optionsForThread ?? {})
            return {
              run: async () => ({
                finalResponse: JSON.stringify({
                  summary: '完成修复',
                  changes: ['使用 OpenAI 渠道'],
                  tests: [],
                  risks: [],
                }),
              }),
            }
          },
        }
      }
      const runner = new CodexSdkPipelineNodeRunner({
        channelId: channel.id,
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await runner.runNode('developer', context('developer'))

      expect(sdkOptions[0]).toMatchObject({
        apiKey: 'sk-openai-test',
        baseUrl: 'https://api.openai.com/v1',
      })
      expect(threadOptions[0]?.model).toBe('gpt-5.4')
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
    }
  })

  test('Codex SDK runner 明确拒绝非 OpenAI 兼容渠道', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-channel-'))
    try {
      const channel = createChannel({
        name: 'Claude 渠道',
        provider: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-ant-test',
        enabled: true,
        models: [{ id: 'claude-sonnet-4-6', name: 'Claude', enabled: true }],
      })
      const createCodexClient: CreateCodexSdkClient = () => {
        throw new Error('不应创建 Codex client')
      }
      const runner = new CodexSdkPipelineNodeRunner({
        channelId: channel.id,
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await expect(runner.runNode('developer', context('developer'))).rejects.toThrow(
        /Codex 节点需要 OpenAI 或 Custom 渠道/,
      )
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
    }
  })
})

class FakePipelineRunner implements PipelineNodeRunner {
  readonly nodes: PipelineNodeKind[] = []

  constructor(private readonly summary: string) {}

  async runNode(
    node: PipelineNodeKind,
    _context: PipelineNodeExecutionContext,
  ): Promise<PipelineNodeExecutionResult> {
    this.nodes.push(node)
    return {
      output: this.summary,
      summary: this.summary,
      approved: true,
    }
  }
}

describe('pipeline-node-router', () => {
  test('developer/reviewer 走 Codex，其余节点保留 Claude', async () => {
    const claudeRunner = new FakePipelineRunner('claude')
    const codexRunner = new FakePipelineRunner('codex')
    const runner = new RoutedPipelineNodeRunner({
      claudeRunner,
      codexRunner,
    })

    await runner.runNode('explorer', context('explorer'))
    await runner.runNode('planner', context('planner'))
    await runner.runNode('developer', context('developer'))
    await runner.runNode('reviewer', context('reviewer'))
    await runner.runNode('tester', context('tester'))

    expect(claudeRunner.nodes).toEqual(['explorer', 'planner', 'tester'])
    expect(codexRunner.nodes).toEqual(['developer', 'reviewer'])
  })
})
