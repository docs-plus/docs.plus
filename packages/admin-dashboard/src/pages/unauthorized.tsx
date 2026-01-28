import Head from 'next/head'
import Link from 'next/link'
import type { GetServerSideProps } from 'next'
import { LuShieldX } from 'react-icons/lu'

// Disable static generation to prevent "NextRouter was not mounted" errors
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}
import { supabase } from '@/lib/supabase'

export default function UnauthorizedPage() {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <>
      <Head>
        <title>Access Denied | Admin Dashboard</title>
      </Head>

      <div className="bg-base-200 flex min-h-screen items-center justify-center">
        <div className="max-w-md px-4 text-center">
          <LuShieldX className="text-error mx-auto mb-6 h-20 w-20" />
          <h1 className="mb-3 text-3xl font-bold">Access Denied</h1>
          <p className="text-base-content/60 mb-6">
            You don&apos;t have permission to access the admin dashboard. This area is restricted to
            administrators only.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={handleSignOut} className="btn btn-outline">
              Sign Out
            </button>
            <Link href="/login" className="btn btn-primary">
              Try Another Account
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
