/**
 * Keeps each visible socket in the shared occupancy set and stamps Last left
 * when a socket closes. Per-connection state rides `context`, as document-views
 * does.
 */

import type {
  beforeHandleMessagePayload,
  connectedPayload,
  Extension,
  onDisconnectPayload,
  onStatelessPayload
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

/** A tab must stay visible this long before the visit counts as reading. */
export const READ_DWELL_MS = 10_000

/** The stateless `msg` the pad sends when its tab is shown or hidden. */
export const READING_MSG = 'reading'

export interface ReadingState {
  /** When the tab last became visible; null while it is hidden. */
  visibleSince: number | null
  /** The last instant this socket counted as reading; null until it does. */
  readAt: number | null
}

/** The marker `connected` plants. Its presence is the only gate the later hooks read. */
export interface OccupancyContext extends ReadingState {
  userId: string
  member: string
  /** The score last written to the set. */
  lastTouchAt: number
}

export type ReadingEvent = 'heard' | 'visible' | 'hidden'

/**
 * A visit counts only after the tab has been visible for READ_DWELL_MS. Edits
 * earn no shortcut: opening a pad writes toc-ids and replays the local copy,
 * so a quick open would otherwise move Last left past unseen changes.
 */
export const advanceReading = (
  state: ReadingState,
  event: ReadingEvent,
  nowMs: number
): ReadingState => {
  const dwelled = state.visibleSince !== null && nowMs - state.visibleSince >= READ_DWELL_MS
  const readAt = dwelled ? nowMs : state.readAt
  switch (event) {
    case 'visible':
      return { visibleSince: state.visibleSince ?? nowMs, readAt }
    case 'hidden':
      return { visibleSince: null, readAt }
    case 'heard':
      return { visibleSince: state.visibleSince, readAt }
    default: {
      const unseen: never = event
      return unseen
    }
  }
}

interface ConnectionContext {
  occupancy?: OccupancyContext
  /** A report that landed before `connected` planted the marker. */
  reportedVisible?: boolean
}

const readOccupancyContext = (context: unknown): OccupancyContext | undefined =>
  (context as ConnectionContext | undefined)?.occupancy

const applyReading = (occupancy: OccupancyContext, event: ReadingEvent, nowMs: number): void => {
  const next = advanceReading(occupancy, event, nowMs)
  occupancy.visibleSince = next.visibleSince
  occupancy.readAt = next.readAt
}

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

  // A client that never reports reads as visible from the start.
  const hidden = (context as ConnectionContext).reportedVisible === false
  return {
    userId,
    member: occupancyMember(userId, socketId),
    lastTouchAt: nowMs,
    visibleSince: hidden ? null : nowMs,
    readAt: null
  }
}

/** The `visible` flag of a reading message, or null for any other payload. */
export const readingVisibility = (payload: string): boolean | null => {
  try {
    const data = JSON.parse(payload) as { msg?: unknown; visible?: unknown }
    if (data.msg !== READING_MSG || typeof data.visible !== 'boolean') return null
    return data.visible
  } catch {
    return null
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

/**
 * Never rejects: the caller fires it detached so teardown does not wait on Supabase.
 * Every close stamps its own reading, because the column only moves forward: a
 * short second tab must not swallow a long first one.
 */
const releaseAndStamp = async (documentId: string, occupancy: OccupancyContext): Promise<void> => {
  await releaseOccupant(documentId, occupancy.member)
  if (occupancy.readAt === null) {
    documentLastLeftStampsTotal.inc({ outcome: 'not-read' })
    return
  }
  await stampLastLeft(documentId, occupancy.userId, occupancy.readAt)
}

const touch = (
  documentName: string,
  occupancy: OccupancyContext,
  nowMs: number,
  op: 'register' | 'refresh'
): void => {
  occupancy.lastTouchAt = nowMs
  // Hooks are awaited before the message applies, and a rejection closes the
  // connection. Detached with a catch, so neither can happen.
  void touchOccupant(documentName, occupancy.member, nowMs, op).catch(() => {})
}

export class DocumentOccupancyExtension implements Extension {
  // `connected` runs after onAuthenticate, so context.user is populated.
  async connected(payload: connectedPayload) {
    const occupancy = decideOccupancy(payload, Date.now())
    if (!occupancy) return

    payload.context.occupancy = occupancy
    if (occupancy.visibleSince !== null) {
      touch(payload.documentName, occupancy, occupancy.lastTouchAt, 'register')
    }
  }

  // Real client traffic is the only refresh, and only while the tab is visible.
  // A server timer would keep a dead socket fresh for the 30-60 s Hocuspocus
  // needs to notice it.
  async beforeHandleMessage({ context, documentName }: beforeHandleMessagePayload) {
    const occupancy = readOccupancyContext(context)
    // Queued messages are emitted before `connected` runs, so this hook can fire
    // first. An unregistered socket must not refresh.
    if (!occupancy) return

    const now = Date.now()
    applyReading(occupancy, 'heard', now)
    if (occupancy.visibleSince === null) return
    if (now - occupancy.lastTouchAt < OCCUPANCY_TOUCH_MS) return
    touch(documentName, occupancy, now, 'refresh')
  }

  async onStateless({ payload, connection, documentName }: onStatelessPayload) {
    const visible = readingVisibility(payload)
    if (visible === null) return
    const context = connection.context as ConnectionContext
    const occupancy = context.occupancy
    if (!occupancy) {
      context.reportedVisible = visible
      return
    }

    const now = Date.now()
    const wasVisible = occupancy.visibleSince !== null
    applyReading(occupancy, visible ? 'visible' : 'hidden', now)
    // Only a visible tab mutes the fan-out, so the set follows the tab at once.
    if (visible && !wasVisible) touch(documentName, occupancy, now, 'register')
    if (!visible && wasVisible) void releaseOccupant(documentName, occupancy.member).catch(() => {})
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
