import { supabaseClient } from '@utils/supabase'
import { AuthError, SignInWithOAuthCredentials } from '@supabase/supabase-js'

export const signInWithOAuth = async (
  args: SignInWithOAuthCredentials
): Promise<{ data: any; error: AuthError | null }> => {
  return supabaseClient.auth.signInWithOAuth({ ...args })
}
