import { useState } from 'react';
import Head from 'next/head';
import { LuCircleAlert, LuLayoutDashboard } from 'react-icons/lu';
import { FcGoogle } from 'react-icons/fc';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
      }
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login | Admin Dashboard</title>
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="card w-96 bg-base-100 shadow-lg">
          <div className="card-body">
            {/* Logo */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <LuLayoutDashboard className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-primary">docs.plus</h1>
            </div>
            <p className="text-sm text-center text-base-content/60 mb-6">
              Admin Dashboard
            </p>

            {/* Error Alert */}
            {error && (
              <div className="alert alert-error text-sm py-2 mb-4">
                <LuCircleAlert className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn btn-outline w-full gap-3"
            >
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
            <p className="text-xs text-center text-base-content/50 mt-6">
              Only authorized administrators can access this dashboard.
              <br />
              Contact your system admin for access.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
