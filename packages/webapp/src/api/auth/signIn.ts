import { supabaseClient } from '@utils/supabase'
import {
  AuthError,
  SignInWithOAuthCredentials,
  SignInWithPasswordCredentials
} from '@supabase/supabase-js'

// Refactored signInWithPassword function
export const signInWithPassword = async (
  args: SignInWithPasswordCredentials
): Promise<{ data: any; error: AuthError | null }> => {
  return supabaseClient.auth.signInWithPassword({ ...args })
}

export const signInWithOAuth = async (
  args: SignInWithOAuthCredentials
): Promise<{ data: any; error: AuthError | null }> => {
  return supabaseClient.auth.signInWithOAuth({ ...args })
}
