import { describe, expect, mock, test } from 'bun:test'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  SpawnCodexCliExecutor,
  buildCodexCliArgs,
  buildWindowsTaskkillArgs,
  killCodexCliProcessTree,
} = await import('./codex-pipeline-node-runner')
const { RoutedPipelineNodeRunner } = await import('./pipeline-node-router')
const { resolvePipelineCodexChannelId } = await import('./pipeline-codex-settings')
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

async function waitForCondition(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('等待条件超时')
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function createLongRunningCodexFixture(): {
  codexPath: string
  grandchildPidPath: string
  tempDir: string
} {
  const tempDir = mkdtempSync(join(tmpdir(), 'rv-codex-cli-abort-'))
  const grandchildPidPath = join(tempDir, 'grandchild.pid')
  const grandchildPath = join(tempDir, 'grandchild.mjs')
  const codexPath = join(tempDir, 'fake-codex')

  writeFileSync(grandchildPath, [
    "import { writeFileSync } from 'node:fs'",
    `writeFileSync(${JSON.stringify(grandchildPidPath)}, String(process.pid), 'utf8')`,
    "process.on('SIGTERM', () => {})",
    'setInterval(() => {}, 1000)',
  ].join('\n'), 'utf8')

  writeFileSync(codexPath, [
    `#!${process.execPath}`,
    "import { spawn } from 'node:child_process'",
    `const child = spawn(process.execPath, [${JSON.stringify(grandchildPath)}], { stdio: 'ignore' })`,
    'child.unref()',
    "process.on('SIGTERM', () => {})",
    'process.stdin.resume()',
    'setInterval(() => {}, 1000)',
  ].join('\n'), 'utf8')
  chmodSync(codexPath, 0o755)

  return { codexPath, grandchildPidPath, tempDir }
}

function createProcessHandle(pid: number): {
  child: ChildProcessWithoutNullStreams
  killSignals: Array<NodeJS.Signals | number | undefined>
} {
  const killSignals: Array<NodeJS.Signals | number | undefined> = []
  const child = {
    pid,
    kill: (signal?: NodeJS.Signals | number) => {
      killSignals.push(signal)
      return true
    },
  } as unknown as ChildProcessWithoutNullStreams

  return { child, killSignals }
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
  test('resolvePipelineCodexChannelId 默认不注入渠道，使用本机 Codex auth', () => {
    expect(resolvePipelineCodexChannelId({}, {})).toBeUndefined()
  })

  test('resolvePipelineCodexChannelId 优先使用 settings 中的 Codex 渠道', () => {
    expect(resolvePipelineCodexChannelId(
      { pipelineCodexChannelId: 'settings-channel' },
      { RV_PIPELINE_CODEX_CHANNEL_ID: 'env-channel' },
    )).toBe('settings-channel')
  })

  test('resolvePipelineCodexChannelId 保留环境变量作为兼容 fallback', () => {
    expect(resolvePipelineCodexChannelId(
      {},
      { RV_PIPELINE_CODEX_CHANNEL_ID: '  env-channel  ' },
    )).toBe('env-channel')
  })

  test('resolvePipelineCodexChannelId 显式本机 auth 不回退旧环境变量', () => {
    expect(resolvePipelineCodexChannelId(
      { pipelineCodexChannelId: null },
      { RV_PIPELINE_CODEX_CHANNEL_ID: 'env-channel' },
    )).toBeUndefined()
  })

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

  test('killCodexCliProcessTree 在 Windows 下使用 taskkill 级联清理', () => {
    const { child, killSignals } = createProcessHandle(1234)
    const taskkillPids: number[] = []

    killCodexCliProcessTree(child, {
      platform: 'win32',
      runTaskkill: (pid) => {
        taskkillPids.push(pid)
      },
    })

    expect(taskkillPids).toEqual([1234])
    expect(killSignals).toEqual([])
  })

  test('buildWindowsTaskkillArgs 构造 Windows 级联终止参数', () => {
    expect(buildWindowsTaskkillArgs(1234)).toEqual(['/F', '/T', '/PID', '1234'])
  })

  test('killCodexCliProcessTree 在 taskkill 失败后回退强杀直接子进程', () => {
    const { child, killSignals } = createProcessHandle(1234)

    killCodexCliProcessTree(child, {
      platform: 'win32',
      runTaskkill: () => {
        throw new Error('taskkill failed')
      },
    })

    expect(killSignals).toEqual(['SIGKILL'])
  })

  if (process.platform !== 'win32') {
    test('SpawnCodexCliExecutor 通过 AbortSignal 强杀 Codex CLI 进程树', async () => {
      const fixture = createLongRunningCodexFixture()
      const controller = new AbortController()
      let grandchildPid: number | undefined
      const executor = new SpawnCodexCliExecutor(fixture.codexPath)
      const runPromise = executor.run({
        sessionId: 'session-abort',
        prompt: '保持运行',
        schema: { type: 'object' },
        additionalDirectories: [],
        env: {},
        sandboxMode: 'workspace-write',
        approvalPolicy: 'never',
        signal: controller.signal,
      })

      try {
        await waitForCondition(() => existsSync(fixture.grandchildPidPath))
        const observedGrandchildPid = Number(readFileSync(fixture.grandchildPidPath, 'utf8'))
        grandchildPid = observedGrandchildPid
        expect(isProcessAlive(observedGrandchildPid)).toBe(true)

        controller.abort()

        await expect(runPromise).rejects.toThrow(/Codex CLI 执行已中止/)
        await waitForCondition(() => !isProcessAlive(observedGrandchildPid))
      } finally {
        controller.abort()
        if (grandchildPid && isProcessAlive(grandchildPid)) {
          process.kill(grandchildPid, 'SIGKILL')
        }
        await runPromise.catch(() => undefined)
        rmSync(fixture.tempDir, { recursive: true, force: true })
      }
    })
  }

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

  test('Codex CLI runner 在 executor 返回后若 signal 已中止则不发送 node_complete', async () => {
    const controller = new AbortController()
    const events: PipelineStreamEvent[] = []
    const executor: CodexCliExecutor = {
      abort: () => {},
      run: async () => {
        controller.abort()
        return {
          finalResponse: JSON.stringify({
            summary: '不应发布成功结果',
            changes: [],
            tests: [],
            risks: [],
          }),
        }
      },
    }
    const runner = new CodexCliPipelineNodeRunner({
      executor,
      onEvent: (event) => events.push(event),
    })

    await expect(runner.runNode('developer', {
      ...context('developer'),
      signal: controller.signal,
    })).rejects.toThrow(/Pipeline 节点执行已中止/)
    expect(events.map((event) => event.type)).toEqual(['node_start'])
  })

  test('Codex CLI runner 无渠道时保留凭证环境并过滤宿主会话环境', async () => {
    const previousCodexKey = process.env.CODEX_API_KEY
    const previousCodexThreadId = process.env.CODEX_THREAD_ID
    const previousAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN
    process.env.CODEX_API_KEY = 'codex-env-key'
    process.env.CODEX_THREAD_ID = 'outer-thread-id'
    process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-token'
    try {
      const executor = new FakeCodexCliExecutor(JSON.stringify({
        summary: '完成修复',
        changes: [],
        tests: [],
        risks: [],
      }))
      const runner = new CodexCliPipelineNodeRunner({
        executor,
      })

      await runner.runNode('developer', context('developer'))

      expect(executor.calls[0]?.apiKey).toBeUndefined()
      expect(executor.calls[0]?.env.CODEX_API_KEY).toBe('codex-env-key')
      expect(executor.calls[0]?.env.CODEX_THREAD_ID).toBeUndefined()
      expect(executor.calls[0]?.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    } finally {
      if (previousCodexKey === undefined) {
        delete process.env.CODEX_API_KEY
      } else {
        process.env.CODEX_API_KEY = previousCodexKey
      }
      if (previousCodexThreadId === undefined) {
        delete process.env.CODEX_THREAD_ID
      } else {
        process.env.CODEX_THREAD_ID = previousCodexThreadId
      }
      if (previousAnthropicToken === undefined) {
        delete process.env.ANTHROPIC_AUTH_TOKEN
      } else {
        process.env.ANTHROPIC_AUTH_TOKEN = previousAnthropicToken
      }
    }
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

  test('Codex SDK runner 无渠道时保留凭证环境并过滤宿主会话环境', async () => {
    const previousCodexKey = process.env.CODEX_API_KEY
    const previousOpenAiKey = process.env.OPENAI_API_KEY
    const previousCodexThreadId = process.env.CODEX_THREAD_ID
    const previousAnthropicToken = process.env.ANTHROPIC_AUTH_TOKEN
    process.env.CODEX_API_KEY = 'codex-env-key'
    process.env.OPENAI_API_KEY = 'openai-env-key'
    process.env.CODEX_THREAD_ID = 'outer-thread-id'
    process.env.ANTHROPIC_AUTH_TOKEN = 'anthropic-token'
    try {
      const sdkOptions: CodexSdkOptions[] = []
      const createCodexClient: CreateCodexSdkClient = (options) => {
        sdkOptions.push(options)
        return {
          startThread: () => ({
            run: async () => ({
              finalResponse: JSON.stringify({
                summary: '完成修复',
                changes: [],
                tests: [],
                risks: [],
              }),
            }),
          }),
        }
      }
      const runner = new CodexSdkPipelineNodeRunner({
        createCodexClient,
        codexPath: '/mock/codex',
      })

      await runner.runNode('developer', context('developer'))

      expect(sdkOptions[0]?.apiKey).toBeUndefined()
      expect(sdkOptions[0]?.baseUrl).toBeUndefined()
      expect(sdkOptions[0]?.env?.CODEX_API_KEY).toBe('codex-env-key')
      expect(sdkOptions[0]?.env?.OPENAI_API_KEY).toBe('openai-env-key')
      expect(sdkOptions[0]?.env?.CODEX_THREAD_ID).toBeUndefined()
      expect(sdkOptions[0]?.env?.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    } finally {
      if (previousCodexKey === undefined) {
        delete process.env.CODEX_API_KEY
      } else {
        process.env.CODEX_API_KEY = previousCodexKey
      }
      if (previousOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY
      } else {
        process.env.OPENAI_API_KEY = previousOpenAiKey
      }
      if (previousCodexThreadId === undefined) {
        delete process.env.CODEX_THREAD_ID
      } else {
        process.env.CODEX_THREAD_ID = previousCodexThreadId
      }
      if (previousAnthropicToken === undefined) {
        delete process.env.ANTHROPIC_AUTH_TOKEN
      } else {
        process.env.ANTHROPIC_AUTH_TOKEN = previousAnthropicToken
      }
    }
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

  test('Codex SDK runner 会读取 Custom OpenAI 兼容渠道配置', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-custom-channel-'))
    try {
      const channel = createChannel({
        name: 'Custom 渠道',
        provider: 'custom',
        baseUrl: 'https://llm.example.com/v1',
        apiKey: 'sk-custom-test',
        enabled: true,
        models: [
          { id: 'custom-codex-model', name: 'Custom Codex', enabled: true },
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
                  changes: ['使用 Custom 渠道'],
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
        apiKey: 'sk-custom-test',
        baseUrl: 'https://llm.example.com/v1',
      })
      expect(threadOptions[0]?.model).toBe('custom-codex-model')
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

  test('Codex CLI runner 明确拒绝已禁用的 OpenAI 兼容渠道', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-cli-disabled-channel-'))
    try {
      const channel = createChannel({
        name: '禁用 CLI OpenAI 渠道',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai-test',
        enabled: false,
        models: [{ id: 'gpt-5.4', name: 'GPT-5.4', enabled: true }],
      })
      const executor = new FakeCodexCliExecutor(JSON.stringify({
        summary: '不应执行',
        changes: [],
        tests: [],
        risks: [],
      }))
      const runner = new CodexCliPipelineNodeRunner({
        channelId: channel.id,
        executor,
      })

      await expect(runner.runNode('developer', context('developer'))).rejects.toThrow(
        /Codex 渠道已禁用/,
      )
      expect(executor.calls).toHaveLength(0)
    } finally {
      if (previousConfigDir === undefined) {
        delete process.env.RV_INSIGHTS_CONFIG_DIR
      } else {
        process.env.RV_INSIGHTS_CONFIG_DIR = previousConfigDir
      }
    }
  })

  test('Codex SDK runner 明确拒绝已禁用的 OpenAI 兼容渠道', async () => {
    const previousConfigDir = process.env.RV_INSIGHTS_CONFIG_DIR
    process.env.RV_INSIGHTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'rv-codex-disabled-channel-'))
    try {
      const channel = createChannel({
        name: '禁用 OpenAI 渠道',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-openai-test',
        enabled: false,
        models: [{ id: 'gpt-5.4', name: 'GPT-5.4', enabled: true }],
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
        /Codex 渠道已禁用/,
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
