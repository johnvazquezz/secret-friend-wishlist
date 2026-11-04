import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { AuthContext, type AuthState } from '../features/auth/AuthContext';
import type { Profile } from '../features/profile/api';

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    email: 'ana@empresa.com',
    full_name: 'Ana Pérez',
    department: null,
    avatar_path: null,
    role: 'participant',
    must_change_password: false,
    is_active: true,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

export function makeAuth(overrides: Partial<AuthState> = {}): AuthState {
  const profile = 'profile' in overrides ? overrides.profile! : makeProfile();
  return {
    session: profile ? ({ user: { id: profile.id } } as Session) : null,
    profile,
    isLoading: false,
    profileError: null,
    isAdmin: profile?.role === 'admin',
    signOut: async () => {},
    ...overrides,
  };
}

/** Renderiza las rutas en memoria con un estado de autenticación controlado. */
export function renderRoutes(
  routes: RouteObject[],
  initialPath = '/',
  auth: AuthState = makeAuth(),
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, {
    initialEntries: [initialPath],
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...result, router };
}
