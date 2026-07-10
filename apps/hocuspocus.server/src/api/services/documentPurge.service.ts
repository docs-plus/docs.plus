import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'

import { deleteDocumentMedia } from './media.service'

export interface PurgeDocumentOptions {
  documentId: string
  slug: string
  // Retention boundary for the reaper: the driver row is deleted only if its
  // tombstone predates it. Omitted for user-initiated permanent delete.
  cutoff?: Date
}

// Fully purges a soft-deleted doc's footprint in contract order: Supabase RPC
// (chat media + analytics + workspace cascade), then editor media (a separate
// store the RPC can't reach), then the driver row LAST — an earlier throw leaves
// deletedAt set so the caller retries; the deletedAt guard keeps it idempotent.
export async function purgeDocumentFootprint(
  prisma: PrismaClient,
  supabase: SupabaseClient | null,
  { documentId, slug, cutoff }: PurgeDocumentOptions
): Promise<{ purged: number }> {
  if (!documentId) return { purged: 0 }
  if (!supabase) throw new Error('Supabase service-role client unavailable')

  const { error } = await supabase.rpc('purge_document_footprint', {
    p_document_id: documentId,
    p_slug: slug
  })
  if (error) throw new Error(`Footprint purge RPC failed: ${error.message}`)

  await deleteDocumentMedia(documentId)

  const { count } = await prisma.documentMetadata.deleteMany({
    where: { documentId, deletedAt: cutoff ? { not: null, lt: cutoff } : { not: null } }
  })
  return { purged: count }
}
