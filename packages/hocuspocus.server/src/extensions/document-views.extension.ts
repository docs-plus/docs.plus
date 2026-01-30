/**
 * Document Views Extension for Hocuspocus (v2 - pgmq + Anonymous Auth)
 *
 * Tracks document views using Hocuspocus connection lifecycle.
 * Zero frontend changes required - views recorded automatically.
 *
 * Features:
 *   - pgmq queue for high concurrency (no contention)
 *   - Anonymous user support (Supabase Anonymous Auth)
 *   - Duration tracking via view_id
 *
 * Flow:
 *   1. onConnect: Enqueue view to pgmq (returns view_id)
 *   2. pg_cron worker processes queue every 10 seconds
 *   3. onDisconnect: Update duration by view_id
 */

import type { Extension, onConnectPayload, onDisconnectPayload } from '@hocuspocus/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

import { logger } from '../lib/logger'

const viewLogger = logger.child({ service: 'document-views' })

interface ViewContext {
  viewId?: string
  connectedAt: number
  documentSlug: string
  sessionId: string
  deviceType: 'desktop' | 'mobile' | 'tablet'
}

// Singleton Supabase client
let supabase: SupabaseClient | null = null

const getClient = (): SupabaseClient | null => {
  if (supabase) return supabase

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  return supabase
}

/**
 * Enqueue view to pgmq (fast, ~1ms, no contention)
 */
const enqueueView = async (
  ctx: ViewContext,
  userId?: string,
  isAnonymous?: boolean
): Promise<string | null> => {
  const client = getClient()
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

/**
 * Update duration by view_id
 */
const updateDuration = async (viewId: string, durationMs: number): Promise<void> => {
  const client = getClient()
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

/**
 * Document Views Extension (v2 - pgmq + Anonymous Auth)
 */
export class DocumentViewsExtension implements Extension {
  async onConnect({ documentName, context, socketId }: onConnectPayload) {
    const userId = context?.user?.sub || null
    // Check if user is anonymous (Supabase Anonymous Auth)
    const isAnonymous = context?.user?.is_anonymous || false
    const sessionId = userId || `hp_${socketId}_${Date.now()}`

    const viewContext: ViewContext = {
      connectedAt: Date.now(),
      documentSlug: documentName,
      sessionId,
      deviceType: normalizeDevice(context?.deviceType)
    }

    context.viewContext = viewContext

    // Enqueue view (fast, returns view_id for duration update)
    enqueueView(viewContext, userId, isAnonymous).then((viewId) => {
      if (viewId) viewContext.viewId = viewId
    })
  }

  async onDisconnect({ context }: onDisconnectPayload) {
    const ctx = context?.viewContext as ViewContext | undefined
    if (!ctx?.viewId) return

    updateDuration(ctx.viewId, Date.now() - ctx.connectedAt)
  }
}

export default DocumentViewsExtension
