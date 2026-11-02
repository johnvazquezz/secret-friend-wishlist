import type { RouteObject } from 'react-router-dom';
import ChangePasswordPage from '../features/auth/ChangePasswordPage';
import { RequireAdmin, RequireAuth } from '../features/auth/guards';
import LoginPage from '../features/auth/LoginPage';
import HomePage from '../features/event/HomePage';
import MembersPage from '../features/members/MembersPage';
import ProfilePage from '../features/profile/ProfilePage';
import AppLayout from './AppLayout';
import AuthLayout from './AuthLayout';
import NotFoundPage from './NotFoundPage';
import RouteErrorPage from './RouteErrorPage';

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AuthLayout />,
        children: [{ path: 'login', element: <LoginPage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AuthLayout />,
            children: [{ path: 'cambiar-contrasena', element: <ChangePasswordPage /> }],
          },
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'deseos', element: <MembersPage /> },
              { path: 'perfil', element: <ProfilePage /> },
              {
                element: <RequireAdmin />,
                children: [
                  // Las páginas de admin se cargan bajo demanda: la mayoría de usuarios no las usa.
                  {
                    path: 'admin/evento',
                    lazy: async () => ({
                      Component: (await import('../features/admin/event/AdminEventPage')).default,
                    }),
                  },
                  {
                    path: 'admin/usuarios',
                    lazy: async () => ({
                      Component: (await import('../features/admin/users/AdminUsersPage')).default,
                    }),
                  },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];
