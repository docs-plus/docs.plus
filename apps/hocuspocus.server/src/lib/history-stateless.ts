import { getOwnerProfiles } from '../api/services/documents.service'
import type { ProfileLite } from '../modules/document-versions'
import type { VersionTrigger } from '../types'
import type { HistoryPayload } from '../types/document.types'
import { wsLogger } from './logger'
import { prisma } from './prisma'

/** Metadata rows for the version sidebar (no Yjs payload). */
export type HistoryVersionMeta = {
  version: number
  commitMessage: string | null
  trigger: VersionTrigger | null
  triggeredBy: string | null
  contributors: string[]
  createdAt: Date
}

/** Full row for editor hydration (base64 Yjs). */
export type HistorySnapshot = {
  data: string
  version: number
  commitMessage: string | null
  createdAt: Date
}

/** Sidebar list + latest body in one response (one network round-trip). */
export type HistoryListResult = {
  versions: HistoryVersionMeta[]
  latestSnapshot: HistorySnapshot | null
  /**
   * Uid -> profile side table rather than a profile per row: this list is
   * unpaginated and a handful of authors repeat across every version of a doc.
   */
  profiles: Record<string, ProfileLite>
}

const distinctUserIds = (rows: HistoryVersionMeta[]): string[] => {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.triggeredBy) ids.add(row.triggeredBy)
    for (const contributor of row.contributors) if (contributor) ids.add(contributor)
  }
  return [...ids]
}

// Attribution is decoration on the payload the whole sidebar is built from, so
// a profile-service outage degrades to bare uids; a throw here would surface as
// history_failed and blank the client's list.
const resolveProfiles = async (userIds: string[]): Promise<Record<string, ProfileLite>> => {
  if (userIds.length === 0) return {}
  try {
    const profiles = (await getOwnerProfiles(userIds)) as ProfileLite[]
    return Object.fromEntries(profiles.map((profile) => [profile.id, profile]))
  } catch (error) {
    wsLogger.warn({ err: error, count: userIds.length }, 'History attribution lookup failed')
    return {}
  }
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

/** Document version history over the Hocuspocus stateless channel. */
export async function handleHistoryStateless(payload: HistoryPayload): Promise<unknown> {
  const { type, documentId } = payload

  switch (type) {
    case 'history.list': {
      // Latest is the newest row, so query 2 does not depend on query 1's version.
      // Both order by version alone: the (documentId, version) unique index serves
      // it in one step, and it keeps the list head and latestSnapshot on the same
      // row when an out-of-order commit makes createdAt disagree.
      const [rows, full] = await prisma.$transaction([
        prisma.documents.findMany({
          where: { documentId },
          orderBy: { version: 'desc' },
          select: {
            version: true,
            commitMessage: true,
            trigger: true,
            triggeredBy: true,
            contributors: true,
            createdAt: true
          }
        }),
        prisma.documents.findFirst({
          where: { documentId },
          orderBy: { version: 'desc' },
          select: { data: true, version: true, commitMessage: true, createdAt: true }
        })
      ])

      const versions: HistoryVersionMeta[] = rows.map((row) => ({
        ...row,
        trigger: row.trigger as VersionTrigger | null
      }))

      return {
        versions,
        latestSnapshot: full ? toSnapshot(full) : null,
        profiles: await resolveProfiles(distinctUserIds(versions))
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

    default:
      return payload
  }
}
