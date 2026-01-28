import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { logError } from '@/utils/logger';
import type { User } from '@supabase/supabase-js';

interface AdminAuthState {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

export function useAdminAuth(): AdminAuthState {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Wait for router to be ready (prevents SSG/SSR issues)
    if (!router.isReady) return;

    // Skip auth check on login page
    if (router.pathname === '/login' || router.pathname === '/unauthorized') {
      setLoading(false);
      return;
    }

    async function checkAuth() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
          router.replace('/login');
          return;
        }

        // Check if user exists in admin_users table
        const { data: adminData, error } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (error) {
          logError('Failed to check admin status:', error);
          router.replace('/unauthorized');
          return;
        }

        const isAdminUser = !!adminData;

        if (!isAdminUser) {
          router.replace('/unauthorized');
          return;
        }

        setUser(authUser);
        setIsAdmin(true);
      } catch (error) {
        logError('Auth check failed:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
        router.replace('/login');
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Check if user is in admin_users table
        const { data: adminData } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const isAdminUser = !!adminData;

        if (isAdminUser) {
          setUser(session.user);
          setIsAdmin(true);
          router.replace('/');
        } else {
          router.replace('/unauthorized');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router, router.isReady]);

  return { user, loading, isAdmin };
}
