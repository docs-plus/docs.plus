import { supabaseClient } from '@utils/supabase'

/**
 * Partial JSONB merge into `users.profile_data.notification_preferences`.
 * The caller passes typed-but-loose at this boundary so the `@api` layer
 * does not depend on `@components/settings` types.
 */
export const updateNotificationPreferences = (patch: Record<string, unknown>) =>
  supabaseClient.rpc('update_notification_preferences', { p_patch: patch })
