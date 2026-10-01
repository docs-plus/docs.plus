import { useAuthStore } from '@stores'
import type { User } from '@supabase/supabase-js'

/**
 * The signed-in Supabase user, which the store keeps under `session`.
 * The profile query leaves out `email` (column grant), so read email from here.
 */
export const useAuthUser = () => useAuthStore((state) => state.session) as User | null
