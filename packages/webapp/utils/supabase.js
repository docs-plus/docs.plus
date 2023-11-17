import { createClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import createSelectors from './zustand'
// Initialize Supabase
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true
    }
  }
)

// Create Zustand store for authentication state
const AuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user })
}))

export const useAuthStore = createSelectors(AuthStore)
