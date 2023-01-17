import React, { useContext, useState, useEffect } from 'react'
import { useCallback } from 'react'
import { supabase } from '../supabase'


const AuthContext = React.createContext()



export function AuthProvider({ children }) {
  const [user, setUser] = useState()
  const [loading, setLoading] = useState(true)


  const getSession = useCallback(async () => {

    const { data, error } = await supabase.auth.getUser()
    // console.log(data, error)
    setUser(data?.user ?? null)

    return data?.user
  }, [])


  useEffect(() => {
    // Check active sessions and sets the user
    const data = getSession()
    console.log(data)
    setLoading(false)

    // Listen for changes on auth state (logged in, signed out, etc.)
    const listener = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  console.log("authcontect.profiver", user)

  // Will be passed down to Signup, Login and Dashboard components
  const value = {
    signInWithOtp: (data) => supabase.auth.signInWithOtp(data),
    signIn: (data) => supabase.auth.signIn(data),
    signOut: () => supabase.auth.signOut(),
    user,
  }

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
}


export function useAuth() {
  return useContext(AuthContext)
}
