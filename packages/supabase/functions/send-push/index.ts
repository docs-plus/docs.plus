/**
 * Edge Function: send-push
 *
 * Sends Web Push notifications to registered devices.
 * Called immediately via pg_net when a notification is created.
 *
 * REQUIRED Environment variables (set in Supabase Dashboard > Edge Functions > Secrets):
 *   - VAPID_PUBLIC_KEY  - Generated via: npx web-push generate-vapid-keys
 *   - VAPID_PRIVATE_KEY - Generated via: npx web-push generate-vapid-keys
 *   - VAPID_SUBJECT     - Contact email (e.g., mailto:support@yourdomain.com)
 *
 * Automatically available:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Web Push implementation for Deno
import * as webpush from 'npm:web-push@3.6.6'

interface PushPayload {
  // Identifiers
  user_id: string
  notification_id: string
  // Raw data - service worker formats the display
  type: string
  sender_name?: string
  sender_avatar?: string
  message_preview?: string
  action_url?: string
  channel_id?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify this is an internal call (from database or cron)
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Extract the token from Bearer header
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

    // Check authorization:
    // 1. Token matches service role key exactly
    // 2. Token is a JWT (starts with 'eyJ') and contains service_role claim
    let isAuthorized = token === serviceRoleKey

    if (!isAuthorized && token?.startsWith('eyJ')) {
      try {
        // Decode JWT payload (middle part) to check role
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]))
          isAuthorized = payload.role === 'service_role'
        }
      } catch {
        // Invalid JWT format
      }
    }

    if (!isAuthorized) {
      console.error('Authorization failed')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get VAPID credentials from environment
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')

    // Validate required configuration
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      const missing = [
        !vapidPublicKey && 'VAPID_PUBLIC_KEY',
        !vapidPrivateKey && 'VAPID_PRIVATE_KEY',
        !vapidSubject && 'VAPID_SUBJECT'
      ].filter(Boolean)

      console.error('Missing required environment variables:', missing.join(', '))
      return new Response(JSON.stringify({ error: 'Push notifications not configured', missing }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Configure web-push
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabase = createClient(supabaseUrl, serviceRoleKey!)

    // Parse payload
    const payload: PushPayload = await req.json()

    // Get user's active web push subscriptions
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', payload.user_id)
      .eq('platform', 'web')
      .eq('is_active', true)

    if (fetchError) {
      console.error('Failed to fetch subscriptions:', fetchError)
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No active subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Pass raw data to service worker (it formats the title/body)
    const pushPayload = JSON.stringify({
      notification_id: payload.notification_id,
      type: payload.type,
      sender_name: payload.sender_name,
      sender_avatar: payload.sender_avatar,
      message_preview: payload.message_preview,
      action_url: payload.action_url,
      channel_id: payload.channel_id
    })

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.push_credentials.endpoint,
              keys: sub.push_credentials.keys
            },
            pushPayload
          )

          // Update last_used_at and reset failed_count
          await supabase
            .from('push_subscriptions')
            .update({
              last_used_at: new Date().toISOString(),
              failed_count: 0,
              last_error: null
            })
            .eq('id', sub.id)

          return { success: true, id: sub.id }
        } catch (err: unknown) {
          const error = err as { statusCode?: number; message?: string }
          console.error(`Push failed for ${sub.id}:`, error.message)

          // Handle expired/invalid subscriptions
          if (error.statusCode === 404 || error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .update({
                is_active: false,
                last_error: 'Subscription expired or invalid'
              })
              .eq('id', sub.id)
          } else {
            // Increment failed count
            await supabase
              .from('push_subscriptions')
              .update({
                failed_count: (sub.failed_count || 0) + 1,
                last_error: error.message || 'Unknown error'
              })
              .eq('id', sub.id)
          }

          return { success: false, id: sub.id, error: error.message }
        }
      })
    )

    const successful = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as { success: boolean }).success
    ).length

    return new Response(
      JSON.stringify({
        sent: successful,
        total: subscriptions.length,
        results: results.map((r) =>
          r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }
        )
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
