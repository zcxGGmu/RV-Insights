import { describe, expect, test } from 'bun:test'

import { loadRendererWindow } from './renderer-loader'

interface FakeLoadFileOptions {
  query?: Record<string, string>
}

interface FailLoadListener {
  (
    event: unknown,
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean,
  ): void
}

function createFakeWindow() {
  let failLoadListener: FailLoadListener | null = null

  return {
    loadURLCalls: [] as string[],
    loadFileCalls: [] as Array<{ filePath: string; options?: FakeLoadFileOptions }>,
    webContents: {
      on(event: string, listener: FailLoadListener) {
        if (event === 'did-fail-load') {
          failLoadListener = listener
        }
      },
    },
    loadURL(url: string) {
      this.loadURLCalls.push(url)
    },
    loadFile(filePath: string, options?: FakeLoadFileOptions) {
      this.loadFileCalls.push({ filePath, options })
    },
    emitDidFailLoad(validatedURL: string, isMainFrame = true) {
      failLoadListener?.({}, -102, 'ERR_CONNECTION_REFUSED', validatedURL, isMainFrame)
    },
  }
}

describe('loadRendererWindow', () => {
  test('未打包启动时先尝试 dev server，并在主框架加载失败后回退到本地构建文件', () => {
    const fakeWindow = createFakeWindow()

    loadRendererWindow(fakeWindow, {
      isPackaged: false,
      rendererBaseDir: '/tmp/rv-insights/dist',
      useDevServer: true,
    })

    expect(fakeWindow.loadURLCalls).toEqual(['http://localhost:5173'])
    expect(fakeWindow.loadFileCalls).toEqual([])

    fakeWindow.emitDidFailLoad('http://localhost:5173')

    expect(fakeWindow.loadFileCalls).toEqual([
      {
        filePath: '/tmp/rv-insights/dist/renderer/index.html',
        options: undefined,
      },
    ])
  })

  test('快速任务窗口会保留 query 参数并在回退时继续传递', () => {
    const fakeWindow = createFakeWindow()

    loadRendererWindow(fakeWindow, {
      isPackaged: false,
      rendererBaseDir: '/tmp/rv-insights/dist',
      query: { window: 'quick-task' },
      useDevServer: true,
    })

    expect(fakeWindow.loadURLCalls).toEqual(['http://localhost:5173?window=quick-task'])

    fakeWindow.emitDidFailLoad('http://localhost:5173?window=quick-task')

    expect(fakeWindow.loadFileCalls).toEqual([
      {
        filePath: '/tmp/rv-insights/dist/renderer/index.html',
        options: { query: { window: 'quick-task' } },
      },
    ])
  })

  test('已打包启动时直接加载本地构建文件', () => {
    const fakeWindow = createFakeWindow()

    loadRendererWindow(fakeWindow, {
      isPackaged: true,
      rendererBaseDir: '/tmp/rv-insights/dist',
    })

    expect(fakeWindow.loadURLCalls).toEqual([])
    expect(fakeWindow.loadFileCalls).toEqual([
      {
        filePath: '/tmp/rv-insights/dist/renderer/index.html',
        options: undefined,
      },
    ])
  })

  test('未显式启用 dev server 时直接加载本地构建文件，避免误连其他项目的 5173', () => {
    const fakeWindow = createFakeWindow()

    loadRendererWindow(fakeWindow, {
      isPackaged: false,
      rendererBaseDir: '/tmp/rv-insights/dist',
      useDevServer: false,
    })

    expect(fakeWindow.loadURLCalls).toEqual([])
    expect(fakeWindow.loadFileCalls).toEqual([
      {
        filePath: '/tmp/rv-insights/dist/renderer/index.html',
        options: undefined,
      },
    ])
  })
})
