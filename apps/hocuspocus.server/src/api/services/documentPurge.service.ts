import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'

import { publishDocumentAccessEvent } from '../../lib/accessRealtime'
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

  const { count } = await prisma.documentMetadata.deleteMany({
    where: {
      documentId,
      deletedAt: 'retention' in scope ? { not: null, lt: scope.retention } : undefined
    }
  })
  return { purged: count }
}
