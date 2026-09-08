/**
 * Decides who may learn that a document changed, then writes the carrier rows.
 * Supabase cannot decide this: `isPrivate`, `ownerId` and `deletedAt` live in
 * Prisma, and `join_workspace` adds any signed-in visitor to `workspace_members`.
 */

import { config } from '../config/env'
import { resolveContentChangeAudience } from './contentChangeAudience'
import { readOccupantUserIds } from './documentOccupancy'
import { logger } from './logger'
import { prisma } from './prisma'
import { getServiceRoleClient } from './supabase'

export type { ContentChangeAudience, ContentChangeMetadata } from './contentChangeAudience'
export { resolveContentChangeAudience } from './contentChangeAudience'

const fanoutLogger = logger.child({ service: 'content-change-fanout' })

/** `p_editor_ids` is uuid[], and one malformed entry raises 22P02 for the whole call. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface FanOutContentChangeParams {
  documentId: string
  contributors?: string[] | null
  actorId: string | null
}

/**
 * Never rejects. The caller runs it detached, so a failure cannot reach the
 * processor. It would surface as an unhandled rejection, or as an
 * `uncaughtException` counting toward the worker's error threshold.
 */
export async function fanOutContentChange(params: FanOutContentChangeParams): Promise<void> {
  const { documentId } = params

  try {
    const client = getServiceRoleClient()
    if (!client) {
      fanoutLogger.warn({ documentId }, 'No service-role client; skipped content-change fan-out')
      return
    }

    const meta = await prisma.documentMetadata.findUnique({
      where: { documentId },
      select: { isPrivate: true, ownerId: true, deletedAt: true, slug: true }
    })
    // A `Documents` row cannot exist without this one, so a miss is a purge race.
    if (!meta) {
      fanoutLogger.warn({ documentId }, 'No document metadata; skipped content-change fan-out')
      return
    }

    const audience = resolveContentChangeAudience(meta)
    if (audience.kind === 'none') {
      fanoutLogger.debug({ documentId, reason: audience.reason }, 'Content change reaches nobody')
      return
    }

    // Live occupants are muted too: `p_editor_ids` already means "do not notify
    // these people". Every degraded arm returns no ids, so the fan-out notifies
    // anyway. That includes an empty read after the key expired under
    // OCCUPANCY_TTL_S, which no later reader may "fix" into an error arm.
    const occupancy = await readOccupantUserIds(documentId, Date.now())

    // The actor goes in twice, in two roles: self-suppression reads the array
    // only. The gate is the uuid shape, not truthiness: the array is uuid[], and
    // one malformed id raises 22P02 inside the RPC, which reaches the warn below
    // as a silent no-op that drops every notification for this save.
    const suppressedIds = [
      ...new Set(
        [...(params.contributors ?? []), params.actorId, ...occupancy.userIds].filter(
          (id): id is string => typeof id === 'string' && UUID_PATTERN.test(id)
        )
      )
    ]

    const { data, error } = await client.rpc('notify_document_content_change', {
      p_document_id: documentId,
      p_editor_ids: suppressedIds,
      p_only_user: audience.kind === 'owner' ? audience.onlyUser : null,
      p_actor_id: params.actorId,
      // Dormant in the digest: `compile_digest_emails` never selects it. The
      // push trigger does copy it into the push payload, and content_change
      // push is opt-in and off by default.
      p_action_url: `${config.email.appUrl}/${meta.slug}`
    })

    if (error) {
      fanoutLogger.warn({ error, documentId }, 'Failed to fan out content change')
      return
    }

    fanoutLogger.debug(
      {
        documentId,
        audience: audience.kind,
        inserted: data,
        occupancy: occupancy.outcome,
        occupants: occupancy.userIds.length
      },
      'Content change fanned out'
    )
  } catch (err) {
    fanoutLogger.warn({ err, documentId }, 'Error fanning out content change')
  }
}
