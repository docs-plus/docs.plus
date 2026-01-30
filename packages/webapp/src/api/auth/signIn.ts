import {
  AuthError,
  SignInWithOAuthCredentials,
  SignInWithPasswordCredentials
} from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'

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
