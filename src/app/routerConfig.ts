// Opt-in anticipado al comportamiento de React Router v7 (facilita la futura actualización).
export const routerFutureFlags = {
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_relativeSplatPath: true,
  v7_skipActionErrorRevalidation: true,
} as const;

export const providerFutureFlags = { v7_startTransition: true } as const;
