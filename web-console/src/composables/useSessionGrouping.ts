import { computed, ref, type Ref, toValue, type MaybeRefOrGetter } from 'vue'
import type { SessionListItem } from '@/api/chat'

export type FilterType = 'all' | 'pinned' | 'running' | 'shared'

export interface SessionGroup {
  key: string
  label: string
  sessions: SessionListItem[]
  collapsed: boolean
}

function isToday(ts: number | null): boolean {
  if (!ts) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(ts * 1000)
  d.setHours(0, 0, 0, 0)
  return d.getTime() === today.getTime()
}

function isYesterday(ts: number | null): boolean {
  if (!ts) return false
  const y = new Date()
  y.setHours(0, 0, 0, 0)
  y.setDate(y.getDate() - 1)
  const d = new Date(ts * 1000)
  d.setHours(0, 0, 0, 0)
  return d.getTime() === y.getTime()
}

function isWithinDays(ts: number | null, days: number): boolean {
  if (!ts) return false
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(ts * 1000)
  d.setHours(0, 0, 0, 0)
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000)
  return diff > 0 && diff <= days
}

export function useSessionGrouping(sessions: MaybeRefOrGetter<SessionListItem[]>) {
  const activeFilter = ref<FilterType>('all')
  const collapsedGroups = ref<Set<string>>(new Set())
  const searchQuery = ref('')

  const filteredSessions = computed(() => {
    let result = toValue(sessions) ?? []
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter(
        (s) =>
          s.title?.toLowerCase().includes(q) ||
          s.latest_message?.toLowerCase().includes(q),
      )
    }
    switch (activeFilter.value) {
      case 'pinned':
        return result.filter((s) => s.pinned)
      case 'running':
        return result.filter((s) => s.status === 'running' || s.status === 'pending')
      case 'shared':
        return result.filter((s) => s.is_shared)
      default:
        return result
    }
  })

  const groupedSessions = computed<SessionGroup[]>(() => {
    const items = filteredSessions.value
    const pinned: SessionListItem[] = []
    const today: SessionListItem[] = []
    const yesterday: SessionListItem[] = []
    const last7: SessionListItem[] = []
    const last30: SessionListItem[] = []
    const older: SessionListItem[] = []

    for (const s of items) {
      if (s.pinned) pinned.push(s)
      else if (isToday(s.latest_message_at)) today.push(s)
      else if (isYesterday(s.latest_message_at)) yesterday.push(s)
      else if (isWithinDays(s.latest_message_at, 7)) last7.push(s)
      else if (isWithinDays(s.latest_message_at, 30)) last30.push(s)
      else older.push(s)
    }

    const groups: SessionGroup[] = []
    const add = (key: string, label: string, list: SessionListItem[]) => {
      if (list.length > 0) {
        groups.push({ key, label, sessions: list, collapsed: collapsedGroups.value.has(key) })
      }
    }
    add('pinned', '置顶', pinned)
    add('today', '今天', today)
    add('yesterday', '昨天', yesterday)
    add('last7', '最近 7 天', last7)
    add('last30', '最近 30 天', last30)
    add('older', '更早', older)
    return groups
  })

  const toggleGroupCollapse = (key: string) => {
    const next = new Set(collapsedGroups.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    collapsedGroups.value = next
  }

  const stats = computed(() => {
    const list = toValue(sessions) ?? []
    return {
      all: list.length,
      pinned: list.filter((s) => s.pinned).length,
      running: list.filter((s) => s.status === 'running' || s.status === 'pending').length,
      shared: list.filter((s) => s.is_shared).length,
    }
  })

  return {
    activeFilter,
    searchQuery,
    filteredSessions,
    groupedSessions,
    stats,
    toggleGroupCollapse,
    setFilter: (f: FilterType) => { activeFilter.value = f },
    setSearchQuery: (q: string) => { searchQuery.value = q },
  }
}
