/**
 * Records a document view per Hocuspocus connection and enqueues it to pgmq
 * (pg_cron drains the queue); view duration is patched on disconnect by id.
 */

import type { connectedPayload, Extension, onDisconnectPayload } from '@hocuspocus/server'
import { isbot } from 'isbot'

import { logger } from '../lib/logger'
import { getServiceRoleClient } from '../lib/supabase'

const viewLogger = logger.child({ service: 'document-views' })

interface ViewContext {
  viewId?: string
  connectedAt: number
  documentSlug: string
  sessionId: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
}

const enqueueView = async (
  ctx: ViewContext,
  userId?: string,
  isAnonymous?: boolean
): Promise<string | null> => {
  const client = getServiceRoleClient()
  if (!client) return null

  try {
    const { data, error } = await client.rpc('enqueue_document_view', {
      p_document_slug: ctx.documentSlug,
      p_session_id: ctx.sessionId,
      p_user_id: userId || null,
      p_is_anonymous: isAnonymous || false,
      p_device_type: ctx.deviceType
    })

    if (error) {
      viewLogger.error({ error, slug: ctx.documentSlug }, 'Failed to enqueue view')
      return null
    }

    return data?.view_id || null
  } catch (err) {
    viewLogger.error({ err, slug: ctx.documentSlug }, 'Error enqueuing view')
    return null
  }
}

const updateDuration = async (viewId: string, durationMs: number): Promise<void> => {
  const client = getServiceRoleClient()
  if (!client || !viewId) return

  try {
    await client.rpc('update_view_duration', {
      p_view_id: viewId,
      p_duration_ms: durationMs
    })
  } catch (err) {
    viewLogger.warn({ err, viewId }, 'Failed to update duration')
  }
}

const normalizeDevice = (d?: string): 'desktop' | 'mobile' | 'tablet' => {
  const v = d?.toLowerCase()
  return v === 'mobile' || v === 'tablet' ? v : 'desktop'
}

export class DocumentViewsExtension implements Extension {
  // `connected` runs after onAuthenticate, so context.user is populated;
  // onConnect runs pre-auth and would record every view as a guest.
  async connected({ context, requestHeaders, documentName, socketId }: connectedPayload) {
    // Crawlers/AI bots that render the page open this socket like a browser.
    // The user-agent is the standard signal to keep them out of analytics.
    const userAgent = requestHeaders['user-agent']
    if (!userAgent || isbot(userAgent)) return

    const userId = context?.user?.sub || null
    const isAnonymous = context?.user?.is_anonymous || false
    const sessionId = userId || `hp_${socketId}_${Date.now()}`

    const viewContext: ViewContext = {
      connectedAt: Date.now(),
      documentSlug: documentName,
      sessionId,
      deviceType: normalizeDevice(context?.deviceType)
    }

    context.viewContext = viewContext

    // Fire-and-forget so the analytics write never sits in the connection path.
    enqueueView(viewContext, userId, isAnonymous).then((viewId) => {
      if (viewId) viewContext.viewId = viewId
    })
  }

  async onDisconnect({ context }: onDisconnectPayload) {
    const ctx = context?.viewContext as ViewContext | undefined
    if (!ctx?.viewId) return

    // Fire-and-forget so teardown never blocks on the duration write.
    void updateDuration(ctx.viewId, Date.now() - ctx.connectedAt)
  }
}

export default DocumentViewsExtension
