interface PendingChatData {
  message: string
  attachments: string[]
  mode?: string
  modelConfigId?: string | null
}

let _pending: PendingChatData | null = null

export function setPendingChat(data: PendingChatData) {
  _pending = data
}

export function consumePendingChat(): PendingChatData | null {
  const data = _pending
  _pending = null
  return data
}
