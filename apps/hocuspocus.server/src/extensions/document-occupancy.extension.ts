/**
 * Registers each live socket in the shared occupancy set, refreshes it from real
 * client traffic, and stamps Last left when a person's final socket on the
 * document closes. Per-connection state rides `context`, as document-views does.
 */

import type {
  beforeHandleMessagePayload,
  connectedPayload,
  Extension,
  onDisconnectPayload
} from '@hocuspocus/server'
import { isbot } from 'isbot'

import {
  OCCUPANCY_TOUCH_MS,
  occupancyMember,
  releaseOccupant,
  touchOccupant
} from '../lib/documentOccupancy'
import { logger } from '../lib/logger'
import { documentLastLeftStampsTotal } from '../lib/metrics'
import { getServiceRoleClient } from '../lib/supabase'

const occupancyLogger = logger.child({ service: 'document-occupancy' })

/** The marker `connected` plants. Its presence is the only gate the later hooks read. */
export interface OccupancyContext {
  userId: string
  member: string
  lastSeenAt: number
  lastTouchAt: number
}

const readOccupancyContext = (context: unknown): OccupancyContext | undefined =>
  (context as { occupancy?: OccupancyContext } | undefined)?.occupancy

export type OccupancyCandidate = Pick<connectedPayload, 'context' | 'requestHeaders' | 'socketId'>

/**
 * Each refusal names a different fact, so none folds into another. `readOnly` is
 * deliberately absent: a watching viewer is an occupant.
 */
export const decideOccupancy = (
  { context, requestHeaders, socketId }: OccupancyCandidate,
  nowMs: number
): OccupancyContext | null => {
  const userAgent = requestHeaders['user-agent']
  if (!userAgent || isbot(userAgent)) return null
  if (socketId === 'server') return null
  if (context?.deviceType === 'service') return null

  const userId = context?.user?.sub
  if (typeof userId !== 'string' || !userId) return null
  if (context.user?.is_anonymous === true) return null

  return {
    userId,
    member: occupancyMember(userId, socketId),
    lastSeenAt: nowMs,
    lastTouchAt: nowMs
  }
}

const stampLastLeft = async (
  documentId: string,
  userId: string,
  closedAtMs: number
): Promise<void> => {
  const client = getServiceRoleClient()
  if (!client) {
    documentLastLeftStampsTotal.inc({ outcome: 'no-client' })
    return
  }

  try {
    const { data, error } = await client.rpc('mark_document_connection_closed', {
      p_document_id: documentId,
      p_user_id: userId,
      p_closed_at: new Date(closedAtMs).toISOString()
    })

    if (error) {
      documentLastLeftStampsTotal.inc({ outcome: 'error' })
      occupancyLogger.warn({ error, documentId }, 'Failed to stamp Last left')
      return
    }

    // The writer is UPDATE-only, so `false` means this person holds no active
    // membership row on the document. That is ordinary, not a fault.
    documentLastLeftStampsTotal.inc({ outcome: data === true ? 'stamped' : 'no-row' })
  } catch (err) {
    documentLastLeftStampsTotal.inc({ outcome: 'error' })
    occupancyLogger.warn({ err, documentId }, 'Error stamping Last left')
  }
}

/** Never rejects: the caller fires it detached so teardown does not wait on Supabase. */
const releaseAndStamp = async (documentId: string, occupancy: OccupancyContext): Promise<void> => {
  const release = await releaseOccupant(documentId, occupancy.userId, occupancy.member, Date.now())
  if (!release.lastOccupantGone) {
    documentLastLeftStampsTotal.inc({ outcome: 'skipped-present' })
    return
  }
  // The last instant this socket was heard from, never now(): detection lags a
  // real leave by 30-60 s. Never a ZSCORE either — the member is already gone.
  await stampLastLeft(documentId, occupancy.userId, occupancy.lastSeenAt)
}

export class DocumentOccupancyExtension implements Extension {
  // `connected` runs after onAuthenticate, so context.user is populated.
  async connected(payload: connectedPayload) {
    const occupancy = decideOccupancy(payload, Date.now())
    if (!occupancy) return

    payload.context.occupancy = occupancy
    void touchOccupant(
      payload.documentName,
      occupancy.member,
      occupancy.lastSeenAt,
      'register'
    ).catch(() => {})
  }

  // Real client traffic is the only refresh. A server timer would keep a dead
  // socket fresh, because Hocuspocus needs 30-60 s to notice one.
  async beforeHandleMessage({ context, documentName }: beforeHandleMessagePayload) {
    const occupancy = readOccupancyContext(context)
    // Queued messages are emitted before `connected` runs, so this hook can fire
    // first. An unregistered socket must not refresh.
    if (!occupancy) return

    const now = Date.now()
    occupancy.lastSeenAt = now
    if (now - occupancy.lastTouchAt < OCCUPANCY_TOUCH_MS) return
    occupancy.lastTouchAt = now

    // This hook is awaited before the message applies, and a rejection closes the
    // connection. Detached with a catch, so neither can happen.
    void touchOccupant(documentName, occupancy.member, now, 'refresh').catch(() => {})
  }

  async onDisconnect({ context, documentName }: onDisconnectPayload) {
    // Gate on the marker, never on context.user: an internal DirectConnection
    // fires this hook carrying the owner's id and never fires `connected`.
    const occupancy = readOccupancyContext(context)
    if (!occupancy) return

    void releaseAndStamp(documentName, occupancy).catch(() => {})
  }
}

export default DocumentOccupancyExtension
