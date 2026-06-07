import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useState } from 'react'
import { LuCircleAlert, LuLayoutDashboard } from 'react-icons/lu'

// Disable static generation to prevent "NextRouter was not mounted" errors
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}
import { FcGoogle } from 'react-icons/fc'

import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
      }
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Login | Admin Dashboard</title>
      </Head>

      <div className="bg-base-200 flex min-h-screen items-center justify-center">
        <div className="card bg-base-100 w-96 shadow-lg">
          <div className="card-body">
            {/* Logo */}
            <div className="mb-2 flex items-center justify-center gap-2">
              <LuLayoutDashboard className="text-primary h-8 w-8" />
              <h1 className="text-primary text-2xl font-bold">docs.plus</h1>
            </div>
            <p className="text-base-content/60 mb-6 text-center text-sm">Admin Dashboard</p>

            {/* Error Alert */}
            {error && (
              <div className="alert alert-error mb-4 py-2 text-sm">
                <LuCircleAlert className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn btn-outline w-full gap-3">
              {loading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <>
                  <FcGoogle className="h-5 w-5" />
                  Sign in with Google
                </>
              )}
            </button>

            {/* Info Text */}
            <p className="text-base-content/50 mt-6 text-center text-xs">
              Only authorized administrators can access this dashboard.
              <br />
              Contact your system admin for access.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
