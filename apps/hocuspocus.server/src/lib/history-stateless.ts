import type { VersionTrigger } from '../types'
import type { HistoryPayload } from '../types/document.types'
import type { ClientAuthorBinding } from './client-authors'
import { wsLogger } from './logger'
import { prisma } from './prisma'
import { distinctUserIds, getOwnerProfiles, type ProfileLite } from './profiles'

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
   * Uid -> profile side table rather than a profile per row. This list is
   * unpaginated and a handful of authors repeat across every version of a doc.
   */
  profiles: Record<string, ProfileLite>
  /** Per-document, not per-version (`@@id([documentId, clientId])`), so it ships once beside `profiles`. */
  clientAuthors: ClientAuthorBinding[]
}

// Attribution is decoration on the payload the whole sidebar is built from, so
// a profile-service outage degrades to bare uids. A throw here would surface as
// history_failed and blank the client's list.
const resolveProfiles = async (userIds: string[]): Promise<Record<string, ProfileLite>> => {
  if (userIds.length === 0) return {}
  try {
    const profiles = await getOwnerProfiles(userIds)
    return Object.fromEntries(profiles.map((profile) => [profile.id, profile]))
  } catch (error) {
    wsLogger.warn({ err: error, count: userIds.length }, 'History attribution lookup failed')
    return {}
  }
}

// Same posture as resolveProfiles: bindings decorate the payload, and a throw here
// would surface as history_failed and blank the client's whole list. Uncapped on
// purpose — a cap turns real writers into "Not recorded" with no signal.
const resolveClientAuthorBindings = async (documentId: string): Promise<ClientAuthorBinding[]> => {
  try {
    const rows = await prisma.documentClientAuthor.findMany({
      where: { documentId },
      select: { clientId: true, userId: true, isAnonymous: true }
    })
    return rows.map((row) => ({
      clientId: Number(row.clientId),
      userId: row.userId,
      isAnonymous: row.isAnonymous
    }))
  } catch (error) {
    wsLogger.warn({ err: error, documentId }, 'History client-author lookup failed')
    return []
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
      // Version order, not createdAt: an out-of-order commit would otherwise leave the
      // list head and latestSnapshot on different rows. Neither query needs the other's row.
      const [[rows, full], clientAuthors] = await Promise.all([
        prisma.$transaction([
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
        ]),
        resolveClientAuthorBindings(documentId)
      ])

      const versions: HistoryVersionMeta[] = rows.map((row) => ({
        ...row,
        trigger: row.trigger as VersionTrigger | null
      }))

      // A bound writer needs a profile too, or their roster row resolves to nothing.
      const profileIds = new Set(distinctUserIds(versions))
      for (const binding of clientAuthors) {
        if (!binding.isAnonymous) profileIds.add(binding.userId)
      }

      return {
        versions,
        latestSnapshot: full ? toSnapshot(full) : null,
        profiles: await resolveProfiles([...profileIds]),
        clientAuthors
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
