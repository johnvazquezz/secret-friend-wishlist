import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom reemplaza AbortController/AbortSignal, pero `Request` sigue siendo el de Node (undici), que
// rechaza señales que no son suyas. El data router de React Router crea Requests en cada
// navegación, así que descartamos la señal solo en el entorno de tests.
// https://github.com/remix-run/react-router/issues/10375
const NodeRequest = globalThis.Request;
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, init ? { ...init, signal: undefined } : init);
  }
} as typeof Request;

// La campana de notificaciones está en todas las páginas: por defecto, sin notificaciones y sin
// conexión Realtime. Los tests que lo necesiten pueden sobrescribir este mock.
vi.mock('../features/notifications/api', () => ({
  fetchNotifications: vi.fn().mockResolvedValue([]),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  sendAnnouncement: vi.fn(),
  subscribeToNotifications: vi.fn(() => () => {}),
}));

// La primera página de cada archivo se carga en frío (rutas lazy); con la máquina ocupada puede
// pasar de 1 s, el límite por defecto de findBy/waitFor.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => {
  cleanup();
});
