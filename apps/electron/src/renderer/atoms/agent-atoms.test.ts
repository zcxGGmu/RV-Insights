import { describe, expect, test } from 'bun:test'
import { createStore } from 'jotai/vanilla'
import type { SDKMessage } from '@rv-insights/shared'
import type { AgentStreamState } from './agent-atoms'
import {
  agentAttachedDirectoriesMapAtom,
  agentSessionDraftsAtom,
  agentStreamingStatesAtom,
  liveMessagesMapAtom,
  sessionAttachedDirsFamily,
  sessionDraftFamily,
  sessionLiveMessagesFamily,
  sessionStreamingStateFamily,
} from './agent-atoms'

function createStreamState(model: string): AgentStreamState {
  return {
    running: false,
    content: '',
    toolActivities: [],
    teammates: [],
    model,
  }
}

function createUserMessage(text: string): SDKMessage {
  return {
    type: 'user',
    message: {
      content: [{ type: 'text', text }],
    },
    parent_tool_use_id: null,
    _createdAt: Date.now(),
  } as SDKMessage
}

describe('agent session scoped atoms', () => {
  test('无关 session 更新时保持当前 session 的派生引用稳定', () => {
    const store = createStore()
    const sessionAState = createStreamState('model-a')
    const sessionBState = createStreamState('model-b')

    store.set(agentStreamingStatesAtom, new Map([
      ['session-a', sessionAState],
      ['session-b', sessionBState],
    ]))

    const firstRead = store.get(sessionStreamingStateFamily('session-a'))

    store.set(agentStreamingStatesAtom, new Map([
      ['session-a', sessionAState],
      ['session-b', createStreamState('model-b-2')],
    ]))

    expect(store.get(sessionStreamingStateFamily('session-a'))).toBe(firstRead)
  })

  test('空 live messages、附加目录和草稿回退值保持稳定', () => {
    const store = createStore()

    const emptyLiveMessages = store.get(sessionLiveMessagesFamily('missing'))
    const emptyAttachedDirs = store.get(sessionAttachedDirsFamily('missing'))

    expect(store.get(sessionDraftFamily('missing'))).toBe('')

    store.set(liveMessagesMapAtom, new Map([
      ['other', [createUserMessage('hello')]],
    ]))
    store.set(agentAttachedDirectoriesMapAtom, new Map([
      ['other', ['/tmp/workspace']],
    ]))
    store.set(agentSessionDraftsAtom, new Map([
      ['other', 'draft'],
    ]))

    expect(store.get(sessionLiveMessagesFamily('missing'))).toBe(emptyLiveMessages)
    expect(store.get(sessionAttachedDirsFamily('missing'))).toBe(emptyAttachedDirs)
    expect(store.get(sessionDraftFamily('missing'))).toBe('')
  })
})
