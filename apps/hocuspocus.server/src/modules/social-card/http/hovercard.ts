import type { Context } from 'hono'
import type { Logger } from 'pino'

import type { PrismaClient } from '../../../generated/prisma/client'
import { fail, ok } from '../../../http/envelope'
import { decideDocumentAccess } from '../../../lib/documentAccess'
import { captureHttpError } from '../../../lib/instrument'
import { ydocToPmJson } from '../../../lib/nested-flat-migration'
import { padName } from '../domain/eligibility'
import {
  filterFacts,
  headingFacts,
  HOVERCARD_LIST,
  type HovercardReply,
  type HovercardRequest,
  parseHovercardQuery
} from '../domain/hovercard'
import { parseChangeSummary, type StoredOutline } from '../domain/storedData'
import * as reads from '../infra/hovercardReads'
import { createSingleFlight } from '../infra/renderGuards'
import { readVersionRow } from '../infra/versionRead'

// Larger heads skip the filter kind: a decode costs about 16x the snapshot in heap.
const HOVERCARD_FILTER_MAX_BYTES = 1024 * 1024

export const HOVERCARD_ROUTE = '/:docName/hovercard'

export interface HovercardDeps {
  prisma: PrismaClient
  logger: Logger
  chat: reads.HovercardChatRead
}

type HovercardDetail = Exclude<HovercardReply, { locked: true } | { kind: 'pad' }>

/** The decoded head of a pad, or null when it is over the cap or does not decode. */
type ReadFilterHead = (documentId: string) => Promise<Record<string, unknown> | null>

interface HovercardInput {
  deps: HovercardDeps
  readFilterHead: ReadFilterHead
  documentId: string
  outline: StoredOutline | null
  padTitle: string
  request: HovercardRequest
}

/** The heading of a chat room. The pad's own room has the documentId as its heading id. */
const roomHeading = (input: HovercardInput, headingId: string) => {
  if (headingId === input.documentId) return { heading: input.padTitle, trail: [] as string[] }
  const facts = headingFacts(input.outline, headingId)
  return facts ? { heading: facts.title, trail: facts.trail } : null
}

/** A failed chat read is not an absent room: it is logged, and each kind decides what to show. */
const readChat = async <T>(input: HovercardInput, read: () => Promise<T>) => {
  try {
    return { ok: true as const, value: await read() }
  } catch (error) {
    input.deps.logger.warn(
      { err: error, documentId: input.documentId },
      'Hovercard chat read failed'
    )
    return { ok: false as const }
  }
}

/** The detail for one link kind, or null when its sub-id is unknown: the pad card answers then. */
const hovercardDetail = async (input: HovercardInput): Promise<HovercardDetail | null> => {
  const { deps, documentId, outline, padTitle, request } = input
  const { prisma, chat } = deps
  switch (request.kind) {
    case 'pad':
      return null
    case 'heading': {
      const facts = headingFacts(outline, request.id)
      if (!facts) return null
      const room = await readChat(input, () =>
        chat({ documentId, linkId: request.id, match: 'heading' })
      )
      return {
        kind: 'heading',
        padTitle,
        ...facts,
        // A failed read leaves the count out rather than failing the card or saying 0.
        ...(room.ok ? { messages: room.value?.messages ?? 0 } : {})
      }
    }
    case 'chat':
    case 'message': {
      const messageId = request.kind === 'message' ? request.messageId : undefined
      const room = await readChat(input, () =>
        chat({ documentId, linkId: request.chatroom, match: 'link', messageId })
      )
      if (!room.ok || !room.value) return null
      const place = roomHeading(input, room.value.headingId)
      if (!place) return null
      if (request.kind === 'chat') {
        const { lastMessageAt } = room.value
        return {
          kind: 'chat',
          padTitle,
          ...place,
          messages: room.value.messages,
          ...(lastMessageAt ? { lastMessageAt: lastMessageAt.toISOString() } : {})
        }
      }
      const { message } = room.value
      if (!message) return null
      return {
        kind: 'message',
        padTitle,
        ...place,
        sentAt: message.sentAt.toISOString(),
        replies: message.replies,
        reactions: Object.values(message.reactions).reduce((sum, n) => sum + n, 0)
      }
    }
    case 'version': {
      const row = await readVersionRow(prisma, documentId, request.version)
      if (!row) return null
      const summary = parseChangeSummary(row.changeSummary)
      return {
        kind: 'version',
        padTitle,
        version: request.version,
        ...(row.commitMessage ? { name: row.commitMessage } : {}),
        savedAt: row.createdAt.toISOString(),
        ...(summary
          ? {
              sectionsChanged:
                summary.sectionsAdded +
                summary.sectionsRemoved +
                summary.sectionsModified +
                summary.sectionsMoved,
              wordsAdded: summary.wordsAdded,
              wordsRemoved: summary.wordsRemoved
            }
          : {})
      }
    }
    case 'history': {
      const { versions, lastSavedAt } = await reads.getHistoryFacts(prisma, documentId)
      return {
        kind: 'history',
        padTitle,
        versions,
        ...(lastSavedAt ? { lastSavedAt: lastSavedAt.toISOString() } : {})
      }
    }
    case 'filter': {
      const doc = await input.readFilterHead(documentId)
      if (!doc) return null
      return { kind: 'filter', padTitle, ...filterFacts(doc, request.terms, request.mode) }
    }
  }
}

/**
 * The link hovercard for another pad, for every pad link kind. Never drafts a row: an unknown
 * slug is a 404. The answer depends on who reads it, so nothing may cache it.
 */
export const createHovercardHandler = (deps: HovercardDeps) => {
  // Concurrent filter hovers on one pad share one head read and one decode. The flight wraps
  // the read, because the decode alone is synchronous and no second hover could join it.
  const decodeOnce = createSingleFlight<Record<string, unknown> | null>()
  const readFilterHead: ReadFilterHead = (documentId) =>
    decodeOnce(documentId, async () => {
      const head = await reads.getPadHeadWithin(deps.prisma, documentId, HOVERCARD_FILTER_MAX_BYTES)
      if (!head?.data) return null
      const decoded = ydocToPmJson(head.data)
      if (decoded.ok) return decoded.json
      deps.logger.warn(
        { err: decoded.error, documentId, version: head.version },
        'Hovercard snapshot decode failed'
      )
      return null
    })

  return async (c: Context): Promise<Response> => {
    c.header('Cache-Control', 'private, no-store')
    const docName = c.req.param('docName')
    if (!docName?.trim()) return fail(c, 400, 'BAD_REQUEST', 'Missing document name')

    try {
      const doc = await reads.getPadAccessBySlug(deps.prisma, docName)
      // No 503 here, unlike the slug read: an Auth outage attaches no user, so the lock shows.
      const access = decideDocumentAccess(
        doc,
        { userId: c.get('userId'), isAnonymous: c.get('user')?.is_anonymous },
        'read'
      )
      if (!doc || access === 'not-found') return fail(c, 404, 'NOT_FOUND', 'Document not found')
      if (access !== 'allow') return ok(c, { locked: true } satisfies HovercardReply)

      const outline = await reads.getPadOutline(deps.prisma, doc.documentId)
      const items = outline?.items ?? []
      const padTitle = padName(doc.title || doc.slug, doc.slug, outline?.title)
      const detail = await hovercardDetail({
        deps,
        readFilterHead,
        documentId: doc.documentId,
        outline,
        padTitle,
        request: parseHovercardQuery(c.req)
      })
      const reply: HovercardReply = detail ?? {
        kind: 'pad',
        title: padTitle,
        sections: items.slice(0, HOVERCARD_LIST).map((item) => item.text),
        total: items.length
      }
      return ok(c, reply)
    } catch (error) {
      deps.logger.error({ err: error, docName }, 'Hovercard read failed')
      captureHttpError(error, { extra: { docName } })
      return fail(c, 500, 'INTERNAL_SERVER_ERROR', 'Hovercard read failed')
    }
  }
}
