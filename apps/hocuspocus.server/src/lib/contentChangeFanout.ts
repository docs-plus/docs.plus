/**
 * Decides who may learn that a document changed, then writes the carrier rows.
 * Supabase cannot decide this: `isPrivate`, `ownerId` and `deletedAt` live in
 * Prisma, and `join_workspace` adds any signed-in visitor to `workspace_members`.
 */

import { config } from '../config/env'
import { logger } from './logger'
import { prisma } from './prisma'
import { getServiceRoleClient } from './supabase'

const fanoutLogger = logger.child({ service: 'content-change-fanout' })

/** Live document metadata the audience rule reads, and nothing more. */
export interface ContentChangeMetadata {
  deletedAt: Date | null
  isPrivate: boolean
  ownerId: string | null
}

export type ContentChangeAudience =
  | { kind: 'none'; reason: 'tombstoned' | 'private-no-owner' }
  | { kind: 'owner'; onlyUser: string }
  | { kind: 'all' }

/** A tombstone outranks ownership, so a trashed document reaches nobody. A purge
 *  leaves no metadata row at all, so it never reaches this rule. */
export function resolveContentChangeAudience(meta: ContentChangeMetadata): ContentChangeAudience {
  if (meta.deletedAt) return { kind: 'none', reason: 'tombstoned' }
  if (!meta.isPrivate) return { kind: 'all' }
  if (!meta.ownerId) return { kind: 'none', reason: 'private-no-owner' }
  return { kind: 'owner', onlyUser: meta.ownerId }
}

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

    // The actor goes in twice, in two roles: self-suppression reads the array
    // only. The RPC strips nulls itself, so this filter is belt-and-braces. The
    // real hazard is a non-uuid string, which raises 22P02 inside the RPC and
    // reaches the warn below as a silent no-op.
    const editorIds = [
      ...new Set(
        [...(params.contributors ?? []), params.actorId].filter((id): id is string => Boolean(id))
      )
    ]

    const { data, error } = await client.rpc('notify_document_content_change', {
      p_document_id: documentId,
      p_editor_ids: editorIds,
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
      { documentId, audience: audience.kind, inserted: data },
      'Content change fanned out'
    )
  } catch (err) {
    fanoutLogger.warn({ err, documentId }, 'Error fanning out content change')
  }
}
