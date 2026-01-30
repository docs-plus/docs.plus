import { AuthError } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

// Refactored signOut function
export const signOut = async (): Promise<{ data: null; error: AuthError | null }> => {
  const { error } = await supabaseClient.auth.signOut()
  return { data: null, error }
}
