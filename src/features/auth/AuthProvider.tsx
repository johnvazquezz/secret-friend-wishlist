import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../profile/hooks';
import { signOut as apiSignOut } from './api';
import { AuthContext, type AuthState } from './AuthContext';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setInitializing(false);
      if (event === 'SIGNED_OUT') queryClient.clear();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id;
  const profileQuery = useProfile(userId);

  const signOut = useCallback(async () => {
    await apiSignOut();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(() => {
    const profile = profileQuery.data ?? null;
    return {
      session,
      profile,
      isLoading: initializing || (!!userId && profileQuery.isPending),
      profileError: profileQuery.error,
      isAdmin: profile?.role === 'admin' && profile.is_active,
      signOut,
    };
  }, [
    session,
    initializing,
    userId,
    profileQuery.data,
    profileQuery.isPending,
    profileQuery.error,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
