import Head from 'next/head';
import Link from 'next/link';
import { LuShieldX } from 'react-icons/lu';
import { supabase } from '@/lib/supabase';

export default function UnauthorizedPage() {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <Head>
        <title>Access Denied | Admin Dashboard</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="text-center max-w-md px-4">
          <LuShieldX className="h-20 w-20 text-error mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">Access Denied</h1>
          <p className="text-base-content/60 mb-6">
            You don&apos;t have permission to access the admin dashboard.
            This area is restricted to administrators only.
          </p>
          <div className="flex gap-3 justify-center">
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
  );
}
