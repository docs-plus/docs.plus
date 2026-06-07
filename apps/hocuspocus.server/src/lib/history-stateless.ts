import type { HistoryPayload } from '../types/document.types'
import { prisma } from './prisma'

/** Metadata rows for the version sidebar (no Yjs payload). */
export type HistoryVersionMeta = {
  version: number
  commitMessage: string | null
  createdAt: Date
}

/** Full row for editor hydration (base64 Yjs). */
export type HistorySnapshot = {
  data: string
  version: number
  commitMessage: string | null
  createdAt: Date
}

/** New list shape: sidebar list + latest body in one response (one network round-trip). */
export type HistoryListResult = {
  versions: HistoryVersionMeta[]
  latestSnapshot: HistorySnapshot | null
}

function toSnapshot(doc: {
  data: Buffer | Uint8Array
  version: number
  commitMessage: string | null
  createdAt: Date
}): HistorySnapshot {
  return {
    data: Buffer.from(doc.data).toString('base64'),
    version: doc.version,
    commitMessage: doc.commitMessage,
    createdAt: doc.createdAt
  }
}

/**
 * Document version history over Hocuspocus stateless channel.
 * `history.prev` / `history.next` are reserved for future UI; not used by the webapp today.
 */
export async function handleHistoryStateless(payload: HistoryPayload): Promise<unknown> {
  const { type, documentId } = payload

  switch (type) {
    case 'history.list': {
      const versions = await prisma.documents.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        select: { version: true, commitMessage: true, createdAt: true }
      })

      if (versions.length === 0) {
        return { versions: [], latestSnapshot: null } satisfies HistoryListResult
      }

      const latestVersion = versions[0].version
      const full = await prisma.documents.findFirst({
        where: { documentId, version: latestVersion },
        select: { data: true, version: true, commitMessage: true, createdAt: true }
      })

      return {
        versions,
        latestSnapshot: full ? toSnapshot(full) : null
      } satisfies HistoryListResult
    }

    case 'history.watch': {
      const doc = await prisma.documents.findFirst({
        where: { documentId, version: payload.version },
        select: { data: true, version: true, commitMessage: true, createdAt: true }
      })

      if (!doc) return null

      return toSnapshot(doc)
    }

    case 'history.prev':
      return prisma.documents.findFirst({
        where: { documentId, version: { lt: payload.currentVersion || 0 } },
        orderBy: { version: 'desc' }
      })

    case 'history.next':
      return prisma.documents.findFirst({
        where: { documentId, version: { gt: payload.currentVersion || 0 } },
        orderBy: { version: 'asc' }
      })

    default:
      return payload
  }
}
