import React, { useContext, useState, useEffect } from 'react'
import { useCallback } from 'react'
import { supabase } from '../supabase'


export const AuthContext = React.createContext()

const Spinner = () => {
  return (
    <div className='bg-slate-100 h-full overflow-auto   min-h-screen flex items-center justify-center'>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden flex align-middle items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      </div>
    </div>
  )
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState()
  const [profile, setProfile] = useState()
  const [loading, setLoading] = useState(false)

  // usememo hook to get GetUser
  // const getUser = useCallback(() => {

  //   (async () => {
  //     const { data, error } = await supabase.auth.getUser()
  //     let { data: profile, error: profileError } = await supabase
  //       .from('users')
  //       .select()
  //       .eq('id', data?.user?.id)
  //       .single()

  //     setProfile(profile)
  //     setUser(data?.user ?? null)
  //     setLoading(false)
  //   })()

  // }, [])


  useEffect(() => {
    // getUser()
    // Listen for changes on auth state (logged in, signed out, etc.)
    // const listener = supabase.auth.onAuthStateChange(async (event, session) => {
    //   setUser(session?.user ?? null)
    //   setLoading(false)
    // })

    // return () => {
    //   listener?.subscription?.unsubscribe()
    // }
  }, [])

  // Will be passed down to Signup, Login and Dashboard components
  const value = {
    signInWithOtp: (data) => supabase.auth.signInWithOtp(data),
    signInWithOAuth: (data) => supabase.auth.signInWithOAuth(data),
    signIn: (data) => supabase.auth.signIn(data),
    signOut: () => {
      // this is not good, I have to migrate to a real state management
      (async () => {
        await supabase.auth.signOut();
        window.location.reload();
      })()
    },
    user,
    loading,
    profile,
  }

  return <AuthContext.Provider value={value}>{loading ? <Spinner /> : children}</AuthContext.Provider>
}







export function useAuth() {
  return useContext(AuthContext)
}
