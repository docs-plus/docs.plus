import type { SupabaseClient } from '@supabase/supabase-js'

import type { PrismaClient } from '../../../generated/prisma/client'
import { normalizeSlug } from '../../../lib/slug'
import { getServiceRoleClient } from '../../../lib/supabase'
import { parseCardData, type StoredOutline } from '../domain/storedData'
import { type ChatRoom, readChatRoom, type RoomQuery } from './chatRoom'

// A hover is short-lived; the client's own 10 s deadline is for writes.
const HOVERCARD_CHAT_TIMEOUT_MS = 500

/** Counts and dates only. A failed read throws, so a caller never takes an outage for "no chat". */
export type HovercardChatRead = (query: Omit<RoomQuery, 'timeoutMs'>) => Promise<ChatRoom | null>

/**
 * Service role, because RLS hides a Private pad's chat from its own owner. The caller runs the
 * pad access check first.
 */
export const createHovercardChatRead =
  (getClient: () => SupabaseClient | null = getServiceRoleClient): HovercardChatRead =>
  async (query) => {
    const client = getClient()
    if (!client) throw new Error('hovercard chat read failed: no service-role client')
    const read = await readChatRoom(client, { ...query, timeoutMs: HOVERCARD_CHAT_TIMEOUT_MS })
    if (read.status === 'ok') return read.room
    if (read.status === 'rejected') return null
    throw new Error(
      `hovercard chat read failed: ${read.status === 'error' ? read.code : 'timeout'}`
    )
  }

/** The access fields of one pad, found by slug like the slug read. Never drafts a row. */
export const getPadAccessBySlug = (prisma: PrismaClient, slug: string) =>
  prisma.documentMetadata.findUnique({
    where: { slug: normalizeSlug(slug) },
    select: {
      documentId: true,
      slug: true,
      title: true,
      isPrivate: true,
      readOnly: true,
      ownerId: true,
      deletedAt: true
    }
  })

/** Read only after the access check, so a locked reader never loads the outline. */
export const getPadOutline = async (
  prisma: PrismaClient,
  documentId: string
): Promise<StoredOutline | null> => {
  const row = await prisma.documentMetadata.findUnique({
    where: { documentId },
    select: { cardData: true }
  })
  return parseCardData(row?.cardData)?.outline ?? null
}

/**
 * The head snapshot, or null bytes when it is larger than `maxBytes`. `octet_length` reads the
 * stored length, so a large head never leaves the database.
 */
export const getPadHeadWithin = async (
  prisma: PrismaClient,
  documentId: string,
  maxBytes: number
): Promise<{ version: number; data: Uint8Array | null } | null> => {
  const rows = await prisma.$queryRaw<{ version: number; data: Uint8Array | null }[]>`
    SELECT version, CASE WHEN octet_length(data) <= ${maxBytes} THEN data END AS data
    FROM "Documents"
    WHERE "documentId" = ${documentId}
    ORDER BY version DESC
    LIMIT 1
  `
  return rows[0] ?? null
}

/** One version row without its snapshot. */
export const getVersionFacts = (prisma: PrismaClient, documentId: string, version: number) =>
  prisma.documents.findUnique({
    where: { Documents_documentId_version_unique: { documentId, version } },
    select: { createdAt: true, commitMessage: true, changeSummary: true }
  })

/** The version count and the head's save time; the count is the one the history list shows. */
export const getHistoryFacts = async (prisma: PrismaClient, documentId: string) => {
  const [versions, head] = await Promise.all([
    prisma.documents.count({ where: { documentId } }),
    prisma.documents.findFirst({
      where: { documentId },
      orderBy: { version: 'desc' },
      select: { createdAt: true }
    })
  ])
  return { versions, lastSavedAt: head?.createdAt ?? null }
}
