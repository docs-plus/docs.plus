import { MAX_VERSION_NUMBER } from '../modules/document-versions/types'
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

/** One sidebar page. The document bytes stay on `history.watch`. */
const HISTORY_LIST_PAGE = 50

/** Sidebar list. Rows carry no bytes; every version loads through watch. */
export type HistoryListResult = {
  versions: HistoryVersionMeta[]
  hasMore: boolean
  beforeVersion?: number
  /** Pass this as the next `beforeVersion`. */
  nextBefore?: number
  /**
   * First page with `since` only. The Anchor for `since`, else the oldest row.
   * It is not added to `versions`, but it can repeat a row that `versions` holds.
   */
  anchor?: HistoryVersionMeta
  /**
   * Uid -> profile side table rather than a profile per row. A handful of
   * authors repeat across the page.
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

// `Documents.version` is int4, so only 1..MAX_VERSION_NUMBER can name a row.
const toVersion = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_VERSION_NUMBER
    ? value
    : undefined

/** Document version history over the Hocuspocus stateless channel. */
export async function handleHistoryStateless(
  payload: HistoryPayload & { type: 'history.list' | 'history.watch' }
): Promise<unknown> {
  const { type, documentId } = payload

  switch (type) {
    case 'history.list': {
      const beforeVersion = toVersion(payload.beforeVersion)
      const sinceMs = typeof payload.since === 'string' ? Date.parse(payload.since) : Number.NaN
      const versionSelect = {
        version: true,
        commitMessage: true,
        trigger: true,
        triggeredBy: true,
        contributors: true,
        createdAt: true
      } as const

      const [pageRows, clientAuthors] = await Promise.all([
        prisma.documents.findMany({
          where: {
            documentId,
            ...(beforeVersion !== undefined ? { version: { lt: beforeVersion } } : {})
          },
          orderBy: { version: 'desc' },
          take: HISTORY_LIST_PAGE + 1,
          select: versionSelect
        }),
        resolveClientAuthorBindings(documentId)
      ])

      const hasMore = pageRows.length > HISTORY_LIST_PAGE
      const rows = pageRows.slice(0, HISTORY_LIST_PAGE)
      const nextBefore = rows[rows.length - 1]?.version

      // Last left can sit below this page, so the reply names it separately.
      // When retention took every earlier row, the oldest row stands in.
      const anchor =
        beforeVersion === undefined && Number.isFinite(sinceMs)
          ? ((await prisma.documents.findFirst({
              where: { documentId, createdAt: { lte: new Date(sinceMs) } },
              orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
              select: versionSelect
            })) ??
            (await prisma.documents.findFirst({
              where: { documentId },
              orderBy: [{ createdAt: 'asc' }, { version: 'asc' }],
              select: versionSelect
            })))
          : null

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
        hasMore,
        ...(hasMore && nextBefore !== undefined ? { nextBefore } : {}),
        ...(beforeVersion !== undefined ? { beforeVersion } : {}),
        ...(anchor
          ? { anchor: { ...anchor, trigger: anchor.trigger as VersionTrigger | null } }
          : {}),
        profiles: await resolveProfiles([...profileIds]),
        clientAuthors
      } satisfies HistoryListResult
    }

    case 'history.watch': {
      const version = toVersion(payload.version)
      if (version === undefined) return null

      const doc = await prisma.documents.findFirst({
        where: { documentId, version },
        select: { data: true, version: true, commitMessage: true, createdAt: true }
      })

      if (!doc) return null

      return toSnapshot(doc)
    }
  }
}
