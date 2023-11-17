import { createClient } from '@supabase/supabase-js'
import { create } from 'zustand'

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
export const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user })
}))

// Listen to Supabase authentication changes
supabase.auth.onAuthStateChange((event, session) => {
  useAuthStore.getState().setUser(session?.user || null)
})
