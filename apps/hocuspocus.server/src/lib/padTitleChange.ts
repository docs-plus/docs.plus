import { logger } from './logger'
import { getServiceRoleClient } from './supabase'

const padTitleChangeLogger = logger.child({ service: 'pad-title-change' })

/** `p_actor_id` is uuid, and a malformed value raises 22P02 for the whole call. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isPadTitleChange(params: {
  existed: boolean
  storedTitle: string | null | undefined
  nextTitle: string | undefined
}): boolean {
  if (!params.existed) return false
  if (params.nextTitle === undefined) return false
  if (params.nextTitle === '') return false
  return params.nextTitle !== (params.storedTitle ?? '')
}

/**
 * Never rejects. The caller runs it detached, so a hung or missing RPC cannot
 * hang the rename or fail the PUT.
 */
export function notifyPadTitleChange(params: {
  documentId: string
  actorId: string
  titleFrom: string
  titleTo: string
}): void {
  void postPadTitleChangeNotice(params).catch((err: unknown) => {
    padTitleChangeLogger.warn(
      { err, documentId: params.documentId },
      'Error posting pad title change notice'
    )
  })
}

async function postPadTitleChangeNotice(params: {
  documentId: string
  actorId: string
  titleFrom: string
  titleTo: string
}): Promise<void> {
  const { documentId, actorId, titleFrom, titleTo } = params

  if (!UUID_PATTERN.test(actorId)) {
    padTitleChangeLogger.warn(
      { documentId },
      'Skipped pad title change notice: actor id is not a uuid'
    )
    return
  }

  const client = getServiceRoleClient()
  if (!client) {
    padTitleChangeLogger.warn(
      { documentId },
      'No service-role client; skipped pad title change notice'
    )
    return
  }

  const { data, error } = await client.rpc('notify_document_title_change', {
    p_document_id: documentId,
    p_actor_id: actorId,
    p_title_from: titleFrom,
    p_title_to: titleTo
  })

  if (error) {
    padTitleChangeLogger.warn({ error, documentId }, 'Failed to post pad title change notice')
    return
  }

  padTitleChangeLogger.debug({ documentId, inserted: data }, 'Pad title change notice posted')
}
