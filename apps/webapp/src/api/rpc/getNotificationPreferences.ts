import { supabaseClient } from '@utils/supabase'

/** The owner's only read: the column has no client SELECT grant. */
export const getNotificationPreferences = () => supabaseClient.rpc('get_notification_preferences')
