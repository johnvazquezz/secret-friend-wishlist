import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { providerFutureFlags, routerFutureFlags } from '../app/routerConfig';

export function renderRoutes(routes: RouteObject[], initialPath = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, {
    initialEntries: [initialPath],
    future: routerFutureFlags,
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} future={providerFutureFlags} />
    </QueryClientProvider>,
  );
}
