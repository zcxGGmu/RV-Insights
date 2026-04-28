type ToastType = 'error' | 'info' | 'success'

interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number
}

export function showToast(options: ToastOptions | string): void {
  const config: ToastOptions = typeof options === 'string' ? { message: options } : options
  const detail = {
    message: config.message,
    type: config.type || 'info',
    duration: config.duration === undefined ? 3000 : config.duration,
  }
  window.dispatchEvent(new CustomEvent('toast', { detail }))
}

export function showErrorToast(message: string, duration?: number): void {
  showToast({ message, type: 'error', duration })
}

export function showInfoToast(message: string, duration?: number): void {
  showToast({ message, type: 'info', duration })
}

export function showSuccessToast(message: string, duration?: number): void {
  showToast({ message, type: 'success', duration })
}
