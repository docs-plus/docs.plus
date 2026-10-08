import { AppError } from './errors'
import { logger } from './logger'
import { getServiceRoleClient } from './supabase'

const mirrorLogger = logger.child({ service: 'document-access-mirror' })

const unavailable = () =>
  new AppError('Document access could not be saved', 503, 'SERVICE_UNAVAILABLE')

/**
 * Copies the stored Private flag and owner into Supabase `public.document_access`,
 * which gates chat (#396). Throws 503 on a missing client or a failed write. A lost
 * write leaves a Private document's chat open, so the caller must see it and retry.
 */
export const writeDocumentAccessMirror = async (params: {
  documentId: string
  isPrivate: boolean
  ownerId: string | null
}): Promise<void> => {
  const client = getServiceRoleClient()
  if (!client) {
    mirrorLogger.error({ documentId: params.documentId }, 'No service-role client')
    throw unavailable()
  }

  const { error } = await client.from('document_access').upsert(
    {
      document_id: params.documentId,
      is_private: params.isPrivate,
      owner_id: params.ownerId,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'document_id' }
  )
  if (error) {
    mirrorLogger.error({ error, documentId: params.documentId }, 'Mirror write failed')
    throw unavailable()
  }
}
