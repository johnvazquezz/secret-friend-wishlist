import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

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

afterEach(() => {
  cleanup();
});
