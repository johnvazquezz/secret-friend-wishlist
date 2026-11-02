import type { Session } from '@supabase/supabase-js';
import { createContext } from 'react';
import type { Profile } from '../profile/api';

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  /** true mientras se recupera la sesión o el perfil del usuario. */
  isLoading: boolean;
  profileError: unknown;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
