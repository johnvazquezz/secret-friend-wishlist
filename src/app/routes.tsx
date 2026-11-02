import type { RouteObject } from 'react-router-dom';
import AdminUsersPage from '../features/admin/users/AdminUsersPage';
import ChangePasswordPage from '../features/auth/ChangePasswordPage';
import { RequireAdmin, RequireAuth } from '../features/auth/guards';
import LoginPage from '../features/auth/LoginPage';
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
              { index: true, element: <MembersPage /> },
              { path: 'perfil', element: <ProfilePage /> },
              {
                element: <RequireAdmin />,
                children: [{ path: 'admin/usuarios', element: <AdminUsersPage /> }],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];
