import { AuthError, SignInWithPasswordCredentials } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

// Refactored signInWithPassword function
export const signInWithPassword = async (
  args: SignInWithPasswordCredentials
): Promise<{ data: any; error: AuthError | null }> => {
  return supabaseClient.auth.signInWithPassword({ ...args })
}
