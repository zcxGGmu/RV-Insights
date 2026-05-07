/**
 * Pipeline 会话管理器
 *
 * 负责 Pipeline 会话的 CRUD 操作和记录持久化。
 */

import { appendFileSync, existsSync, readFileSync, rmSync, unlinkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { PipelineRecord, PipelineSessionMeta } from '@rv-insights/shared'
import { createInitialPipelineState } from '@rv-insights/shared'
import {
  getPipelineSessionRecordsPath,
  getPipelineSessionsDir,
  getPipelineSessionsIndexPath,
} from './config-paths'
import { readJsonFileSafe, writeJsonFileAtomic } from './safe-file'

interface PipelineSessionsIndex {
  version: number
  sessions: PipelineSessionMeta[]
}

const INDEX_VERSION = 1

function readIndex(): PipelineSessionsIndex {
  return readJsonFileSafe<PipelineSessionsIndex>(getPipelineSessionsIndexPath())
    ?? { version: INDEX_VERSION, sessions: [] }
}

function writeIndex(index: PipelineSessionsIndex): void {
  writeJsonFileAtomic(getPipelineSessionsIndexPath(), index)
}

export function listPipelineSessions(): PipelineSessionMeta[] {
  return readIndex().sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getPipelineSessionMeta(id: string): PipelineSessionMeta | undefined {
  return readIndex().sessions.find((session) => session.id === id)
}

export function createPipelineSession(
  title?: string,
  channelId?: string,
  workspaceId?: string,
): PipelineSessionMeta {
  const index = readIndex()
  const now = Date.now()
  const state = createInitialPipelineState(randomUUID(), now)

  const meta: PipelineSessionMeta = {
    id: state.sessionId,
    title: title || '新 Pipeline 会话',
    channelId,
    workspaceId,
    currentNode: state.currentNode,
    status: state.status,
    reviewIteration: state.reviewIteration,
    pendingGate: state.pendingGate,
    createdAt: now,
    updatedAt: now,
  }

  index.sessions.push(meta)
  writeIndex(index)
  getPipelineSessionsDir()
  return meta
}

export function updatePipelineSessionMeta(
  id: string,
  patch: Partial<Omit<PipelineSessionMeta, 'id' | 'createdAt'>>,
): PipelineSessionMeta {
  const index = readIndex()
  const target = index.sessions.find((session) => session.id === id)
  if (!target) {
    throw new Error(`未找到 Pipeline 会话: ${id}`)
  }

  Object.assign(target, patch, { updatedAt: Date.now() })
  writeIndex(index)
  return target
}

export function deletePipelineSession(id: string): void {
  const index = readIndex()
  index.sessions = index.sessions.filter((session) => session.id !== id)
  writeIndex(index)

  const recordsPath = getPipelineSessionRecordsPath(id)
  if (existsSync(recordsPath)) {
    unlinkSync(recordsPath)
  }

  rmSync(getPipelineSessionRecordsPath(id).replace(/\.jsonl$/, ''), {
    recursive: true,
    force: true,
  })
}

export function appendPipelineRecord(
  sessionId: string,
  record: PipelineRecord,
): void {
  appendFileSync(
    getPipelineSessionRecordsPath(sessionId),
    JSON.stringify(record) + '\n',
    'utf-8',
  )

  const current = getPipelineSessionMeta(sessionId)
  if (!current) return

  updatePipelineSessionMeta(sessionId, {
    currentNode: 'node' in record ? record.node : current.currentNode,
    reviewIteration: record.type === 'gate_decision'
      && record.node === 'reviewer'
      && record.action === 'reject_with_feedback'
      ? current.reviewIteration + 1
      : current.reviewIteration,
    status: record.type === 'gate_requested'
      ? 'waiting_human'
      : record.type === 'error'
        ? 'node_failed'
        : current.status,
  })
}

export function getPipelineRecords(sessionId: string): PipelineRecord[] {
  const filePath = getPipelineSessionRecordsPath(sessionId)
  if (!existsSync(filePath)) return []

  const raw = readFileSync(filePath, 'utf-8')
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as PipelineRecord)
}

export function searchPipelineRecords(
  sessionId: string,
  query: string,
): PipelineRecord[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  return getPipelineRecords(sessionId).filter((record) =>
    JSON.stringify(record).toLowerCase().includes(normalized),
  )
}
