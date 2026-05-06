import { join } from 'path'

interface RendererLoadFileOptions {
  query?: Record<string, string>
}

interface DidFailLoadListener {
  (
    event: unknown,
    errorCode: number,
    errorDescription: string,
    validatedURL: string,
    isMainFrame: boolean,
  ): void
}

interface RendererWebContentsLike {
  on(event: 'did-fail-load', listener: DidFailLoadListener): void
}

export interface RendererWindowLike {
  webContents: RendererWebContentsLike
  loadURL(url: string): Promise<unknown> | void
  loadFile(filePath: string, options?: RendererLoadFileOptions): Promise<unknown> | void
}

export interface LoadRendererWindowOptions {
  isPackaged: boolean
  rendererBaseDir: string
  query?: Record<string, string>
  useDevServer?: boolean
}

const DEV_SERVER_URL = 'http://localhost:5173'

function buildRendererFilePath(rendererBaseDir: string): string {
  return join(rendererBaseDir, 'renderer', 'index.html')
}

function buildRendererDevServerUrl(query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) {
    return DEV_SERVER_URL
  }

  const searchParams = new URLSearchParams(query)
  return `${DEV_SERVER_URL}?${searchParams.toString()}`
}

export function loadRendererWindow(
  window: RendererWindowLike,
  options: LoadRendererWindowOptions,
): void {
  const filePath = buildRendererFilePath(options.rendererBaseDir)
  const fileOptions = options.query ? { query: options.query } : undefined

  if (options.isPackaged || !options.useDevServer) {
    void window.loadFile(filePath, fileOptions)
    return
  }

  const devServerUrl = buildRendererDevServerUrl(options.query)
  let hasFallenBack = false

  window.webContents.on(
    'did-fail-load',
    (_event, _errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (hasFallenBack || !isMainFrame || validatedURL !== devServerUrl) {
        return
      }

      hasFallenBack = true
      console.warn(`[窗口] Dev server 加载失败，回退到本地构建文件: ${errorDescription}`)
      void window.loadFile(filePath, fileOptions)
    },
  )

  void window.loadURL(devServerUrl)
}
