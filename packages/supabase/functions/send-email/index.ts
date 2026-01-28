/**
 * @deprecated This edge function is DEPRECATED.
 *
 * Use the hocuspocus server email gateway instead:
 *   POST http://localhost:4000/api/email/send
 *
 * The gateway supports multiple providers (SMTP, Resend, SendGrid)
 * with queuing, retries, and templates.
 *
 * See: packages/hocuspocus.server/src/lib/email/
 *
 * This file is kept for reference only.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      error: 'This edge function is deprecated. Use the hocuspocus email gateway instead.',
      gateway: 'POST /api/email/send on your hocuspocus server'
    }),
    {
      status: 410, // Gone
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
})
