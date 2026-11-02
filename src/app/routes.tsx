import type { RouteObject } from 'react-router-dom';
import MembersPage from '../features/members/MembersPage';
import AppLayout from './AppLayout';
import NotFoundPage from './NotFoundPage';
import RouteErrorPage from './RouteErrorPage';

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <MembersPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
