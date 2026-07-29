import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'

import { publishDocumentAccessEvent } from '../../lib/accessRealtime'
import { deriveDocumentId, INITIAL_EPOCH } from '../../lib/documentId'
import { documentsServiceLogger as purgeLogger } from '../../lib/logger'
import { normalizeSlug } from '../../lib/slug'
import { deleteDocumentMedia } from './media.service'

// `permanent` deletes the row whether or not it is tombstoned, so it must be
// spelled out: an optional cutoff would make an unguarded hard delete the arm a
// caller reaches by forgetting a field. Callers that pass it have already gated
// (owner plus soft-deleted, or admin slug confirmation).
export type PurgeScope = { retention: Date } | { permanent: true }

export interface PurgeDocumentOptions {
  documentId: string
  slug: string
  scope: PurgeScope
}

// Contract order: Supabase RPC (chat media, analytics, workspace cascade), then
// editor media (a store the RPC cannot reach), then the seal, then the driver row
// LAST. Accepted failure: an RPC that lands before a throw leaves the doc hollow
// but live and openable, and the caller retries.
export async function purgeDocumentFootprint(
  prisma: PrismaClient,
  supabase: SupabaseClient | null,
  { documentId, slug, scope }: PurgeDocumentOptions
): Promise<{ purged: number }> {
  if (!documentId) return { purged: 0 }
  if (!supabase) throw new Error('Supabase service-role client unavailable')

  const { error } = await supabase.rpc('purge_document_footprint', {
    p_document_id: documentId,
    p_slug: slug
  })
  if (error) throw new Error(`Footprint purge RPC failed: ${error.message}`)

  await deleteDocumentMedia(documentId)

  // Seal after the steps that can throw, still before the row delete. Earlier and
  // a failed purge closes a room that survives — the client's deleted arm calls
  // stopReconnect, so nobody comes back. Later and the close-time flush re-creates
  // the row this is about to remove.
  await publishDocumentAccessEvent({
    documentId,
    deleted: true,
    purged: true,
    ownerId: null,
    timestamp: new Date().toISOString()
  })

  // Row delete and epoch bump share a transaction: the delete frees the slug, and a
  // draft opened in the gap would derive this document's id and let a stale
  // IndexedDB mirror sync the erased content back.
  const count = await prisma.$transaction(
    async (tx) => {
      const { count } = await tx.documentMetadata.deleteMany({
        where: {
          documentId,
          deletedAt: 'retention' in scope ? { not: null, lt: scope.retention } : undefined
        }
      })
      if (count === 0) return 0

      // Prove the key instead of trusting the caller's slug. `updateDocument` and the
      // store worker can both persist an un-normalized slug, and bumping under one
      // leaves the real slug at INITIAL_EPOCH — the next visitor re-derives the erased
      // id. Detects only: the base slug stays unbumped, so this warns, it does not repair.
      const current =
        (await tx.documentSlugEpoch.findUnique({ where: { slug }, select: { epoch: true } }))
          ?.epoch ?? INITIAL_EPOCH
      if (deriveDocumentId(normalizeSlug(slug), current) !== documentId) {
        purgeLogger.warn(
          { documentId, slug },
          'Purged document id is not derived from its slug; epoch not bumped'
        )
        return count
      }

      await tx.documentSlugEpoch.upsert({
        where: { slug },
        create: { slug, epoch: current + 1 },
        update: { epoch: { increment: 1 } }
      })
      return count
    },
    // The reaper is hourly and background, so both bounds favour finishing over
    // failing fast — the opposite of the save path's. Prisma's 2s/5s defaults are a
    // deadline the bare deleteMany never had: the worst live document is 23 MB across
    // 18 cascading version rows (max 119 versions), and a P2028 here is permanent,
    // because the retry re-runs an already-erased footprint into the same wall.
    { maxWait: 10_000, timeout: 30_000 }
  )
  return { purged: count }
}
