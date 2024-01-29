import { supabaseClient } from '@utils/supabase'
import { AuthError, SignInWithPasswordCredentials } from '@supabase/supabase-js'

// Refactored signInWithPassword function
export const signInWithPassword = async (
  args: SignInWithPasswordCredentials
): Promise<{ data: any; error: AuthError | null }> => {
  return supabaseClient.auth.signInWithPassword({ ...args })
}
