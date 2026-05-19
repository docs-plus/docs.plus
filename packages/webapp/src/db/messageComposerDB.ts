import Dexie, { Table } from 'dexie'
import debounce from 'lodash/debounce'

export type ComposerState = {
  text: string
  html?: string
  attachments?: Array<{
    id: string
    name: string
    size?: number
    type?: string
    dataUrl?: string
  }>
  selection?: { start: number; end: number }
  meta?: Record<string, unknown>
}

export type ComposerRow = {
  workspaceId: string
  roomId: string
  state: ComposerState
  updatedAt: number
}

class ChatAppDB extends Dexie {
  composer!: Table<ComposerRow, [string, string]>

  constructor() {
    super('chatApp')
    this.version(1).stores({
      composer: '[workspaceId+roomId], workspaceId, roomId, updatedAt'
    })
  }
}

let _db: ChatAppDB | null = null
let _openAttempted = false

async function getDB(): Promise<ChatAppDB> {
  if (typeof window === 'undefined') throw new Error('No IDB in SSR')
  if (_db) return _db
  if (_openAttempted && !_db) throw new Error('IDB init failed previously')

  _openAttempted = true
  const db = new ChatAppDB()
  try {
    await db.open()
    _db = db
  } catch (err) {
    console.warn('[composerDB] IndexedDB unavailable, using memory fallback', err)
    throw err
  }
  return _db
}

const memory = new Map<string, ComposerRow>()
const k = (workspaceId: string, roomId: string) => `${workspaceId}::${roomId}`

const MAX_MEMORY_ENTRIES = 100
const MAX_STATE_SIZE = 10 * 1024 * 1024
const MAX_IDB_DRAFTS = 800
const DRAFT_TTL_DAYS = 120
const DRAFT_TTL_MS = DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000

function pruneMemoryIfNeeded() {
  if (memory.size <= MAX_MEMORY_ENTRIES) return
  const sorted = [...memory.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)
  sorted.slice(0, memory.size - MAX_MEMORY_ENTRIES).forEach(([key]) => memory.delete(key))
}

export async function setComposerState(
  workspaceId: string,
  roomId: string,
  state: ComposerState
): Promise<void> {
  const estimatedSize = JSON.stringify(state).length
  if (estimatedSize > MAX_STATE_SIZE) {
    console.warn(
      `[composerDB] Draft too large (${(estimatedSize / 1024 / 1024).toFixed(2)}MB), truncating attachments`
    )
    state.attachments?.forEach((a) => delete a.dataUrl)
  }

  const row: ComposerRow = { workspaceId, roomId, state, updatedAt: Date.now() }
  try {
    const db = await getDB()
    await db.composer.put(row)
  } catch {
    memory.set(k(workspaceId, roomId), row)
    pruneMemoryIfNeeded()
  }
}

export async function getComposerState(
  workspaceId: string,
  roomId: string
): Promise<ComposerState | null> {
  try {
    const db = await getDB()
    const row = await db.composer.get([workspaceId, roomId])
    return row ? row.state : null
  } catch {
    const row = memory.get(k(workspaceId, roomId))
    return row ? row.state : null
  }
}

export async function clearComposerState(workspaceId: string, roomId: string): Promise<void> {
  try {
    const db = await getDB()
    await db.composer.delete([workspaceId, roomId])
  } catch {
    memory.delete(k(workspaceId, roomId))
  }
}

export async function clearWorkspaceComposerStates(workspaceId: string): Promise<number> {
  try {
    const db = await getDB()
    const coll = db.composer.where('workspaceId').equals(workspaceId)
    const keys = await coll.primaryKeys()
    await coll.delete()

    let memDeleted = 0
    for (const [mk] of memory) {
      if (mk.startsWith(`${workspaceId}::`)) {
        memory.delete(mk)
        memDeleted++
      }
    }
    return keys.length + memDeleted
  } catch {
    let count = 0
    for (const [mk] of memory) {
      if (mk.startsWith(`${workspaceId}::`)) {
        memory.delete(mk)
        count++
      }
    }
    return count
  }
}

export async function listRoomsWithDrafts(
  workspaceId: string
): Promise<Array<{ roomId: string; updatedAt: number }>> {
  try {
    const db = await getDB()
    const rows = await db.composer.where('workspaceId').equals(workspaceId).toArray()
    return rows.map(({ roomId, updatedAt }) => ({ roomId, updatedAt }))
  } catch {
    const out: Array<{ roomId: string; updatedAt: number }> = []
    for (const [mk, row] of memory) {
      if (mk.startsWith(`${workspaceId}::`))
        out.push({ roomId: row.roomId, updatedAt: row.updatedAt })
    }
    return out
  }
}

export async function cleanupStaleDrafts(): Promise<number> {
  try {
    const db = await getDB()
    const cutoffTime = Date.now() - DRAFT_TTL_MS
    const stale = await db.composer.where('updatedAt').below(cutoffTime).toArray()

    if (stale.length > 0) {
      await db.composer.where('updatedAt').below(cutoffTime).delete()
    }

    return stale.length
  } catch {
    let count = 0
    for (const [key, row] of memory) {
      if (row.updatedAt < Date.now() - DRAFT_TTL_MS) {
        memory.delete(key)
        count++
      }
    }
    return count
  }
}

export async function enforceMaxDraftsLimit(): Promise<number> {
  try {
    const db = await getDB()
    const count = await db.composer.count()

    if (count <= MAX_IDB_DRAFTS) return 0

    const toDelete = count - MAX_IDB_DRAFTS
    const oldest = await db.composer.orderBy('updatedAt').limit(toDelete).toArray()
    const keysToDelete = oldest.map((row) => [row.workspaceId, row.roomId] as [string, string])
    await db.composer.bulkDelete(keysToDelete)

    return toDelete
  } catch {
    return 0
  }
}

export async function performMaintenanceCleanup(): Promise<{ stale: number; excess: number }> {
  const stale = await cleanupStaleDrafts()
  const excess = await enforceMaxDraftsLimit()

  if (stale > 0 || excess > 0) {
    console.info(`[composerDB] Cleanup: removed ${stale} stale drafts, ${excess} excess drafts`)
  }

  return { stale, excess }
}

const debouncedWriters = new Map<string, ReturnType<typeof debounce>>()

function getDebouncedWriter(workspaceId: string, roomId: string, delayMs = 500) {
  const key = k(workspaceId, roomId)

  if (!debouncedWriters.has(key)) {
    const debouncedFn = debounce(
      (ws: string, rm: string, state: ComposerState) => {
        setComposerState(ws, rm, state)
      },
      delayMs,
      { leading: false, trailing: true, maxWait: 2000 }
    )
    debouncedWriters.set(key, debouncedFn)
  }

  return debouncedWriters.get(key)!
}

export function setComposerStateDebounced(
  workspaceId: string,
  roomId: string,
  state: ComposerState,
  delayMs = 500
): void {
  getDebouncedWriter(workspaceId, roomId, delayMs)(workspaceId, roomId, state)
}

/** Cancel queued debounced writes for one room without touching storage. */
export function cancelComposerDraftWrites(workspaceId: string, roomId: string): void {
  debouncedWriters.get(k(workspaceId, roomId))?.cancel()
}

/** Non-empty text debounces to IDB; empty text clears storage immediately. */
export function syncComposerDraft(
  workspaceId: string,
  roomId: string,
  state: ComposerState,
  delayMs = 500
): void {
  if (!state.text.trim()) {
    cancelComposerDraftWrites(workspaceId, roomId)
    void clearComposerState(workspaceId, roomId)
    return
  }
  setComposerStateDebounced(workspaceId, roomId, state, delayMs)
}

/** After send: cancel trailing debounced writes, then delete the row. */
export async function discardComposerDraft(workspaceId: string, roomId: string): Promise<void> {
  cancelComposerDraftWrites(workspaceId, roomId)
  await clearComposerState(workspaceId, roomId)
}

export function flushPendingWrites(): void {
  debouncedWriters.forEach((debouncedFn) => debouncedFn.flush())
}

export function cancelPendingWrites(): void {
  debouncedWriters.forEach((debouncedFn) => debouncedFn.cancel())
  debouncedWriters.clear()
}
