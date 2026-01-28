-- Migration: Move push notifications from Edge Function to hocuspocus backend
-- Description: Updates get_push_config() to use the hocuspocus.server gateway
--              instead of Supabase Edge Function for cohesive backend architecture.
-- Date: 2026-01-28

-- =============================================================================
-- BEFORE: Edge Function URL: {supabase_url}/functions/v1/send-push
-- AFTER:  Backend Gateway URL: {app.push_gateway_url}/api/push/send
--                           OR {hocuspocus_url}:4000/api/push/send
-- =============================================================================

-- Update the get_push_config function to use backend gateway
create or replace function internal.get_push_config()
returns table (edge_url text, service_key text)
language plpgsql
security definer
as $$
declare
    v_gateway_url text;
    v_service_key text;
begin
    -- Get push gateway URL (hocuspocus backend)
    -- Priority: app.push_gateway_url > app.hocuspocus_url > default localhost
    v_gateway_url := coalesce(
        current_setting('app.push_gateway_url', true),
        current_setting('app.hocuspocus_url', true),
        'http://localhost:4000'
    );

    -- Get service role key for authorization
    v_service_key := current_setting('app.settings.service_role_key', true);

    -- Validate configuration
    if v_service_key is null or v_service_key = '' then
        raise warning 'Push notifications: app.settings.service_role_key not configured';
        return;
    end if;

    -- Return backend gateway URL and service key
    -- Note: Now pointing to hocuspocus.server /api/push/send endpoint
    return query select
        v_gateway_url || '/api/push/send',
        v_service_key;
end;
$$;

comment on function internal.get_push_config() is
'Returns push gateway URL and service key.
Uses hocuspocus.server backend instead of Edge Function for cohesive architecture.
Configure via: ALTER DATABASE postgres SET app.push_gateway_url = ''https://your-backend.com'';';

-- =============================================================================
-- DEPLOYMENT NOTES:
-- =============================================================================
-- 1. Set the push gateway URL in your database:
--    ALTER DATABASE postgres SET app.push_gateway_url = 'https://your-hocuspocus-server.com';
--
-- 2. Ensure hocuspocus.server has VAPID keys configured:
--    VAPID_PUBLIC_KEY=...
--    VAPID_PRIVATE_KEY=...
--    VAPID_SUBJECT=mailto:support@yourdomain.com
--
-- 3. The Edge Function (send-push) is now deprecated but can remain as fallback.
--    To fully remove, run: supabase functions delete send-push
-- =============================================================================

