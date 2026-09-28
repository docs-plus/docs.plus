import { AuthError, SignInWithOAuthCredentials } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

export const signInWithOAuth = async (
  args: SignInWithOAuthCredentials
): Promise<{ data: any; error: AuthError | null }> => {
  return supabaseClient.auth.signInWithOAuth({ ...args })
}
