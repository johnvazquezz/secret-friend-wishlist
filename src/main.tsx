import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { registerServiceWorker } from './features/push/browser';
import './index.css';

// Service worker para las notificaciones push (registrarlo no pide ningún permiso).
window.addEventListener('load', () => void registerServiceWorker());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
