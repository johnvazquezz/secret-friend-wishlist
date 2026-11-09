import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import {
  dismiss,
  getToasts,
  pauseDismiss,
  scheduleDismiss,
  subscribe,
  type ToastTone,
} from './toast';

const tones: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-600' },
  info: { icon: Info, className: 'bg-primary-50 text-primary-600' },
  error: { icon: AlertCircle, className: 'bg-red-50 text-red-600' },
};

/** Pila de notificaciones flotantes: arriba en móvil (no tapa la barra inferior), abajo a la derecha en escritorio. */
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribe, getToasts, getToasts);

  return (
    <div
      role="region"
      aria-label="Avisos"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:top-auto sm:bottom-6 sm:right-6 sm:items-end sm:px-0"
    >
      {toasts.map((t) => {
        const { icon: Icon, className } = tones[t.tone];
        return (
          <div
            key={t.id}
            onMouseEnter={() => pauseDismiss(t.id)}
            onMouseLeave={() => scheduleDismiss(t.id, 2000)}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white p-3.5 pr-2.5 shadow-lift ring-1 ring-stone-900/5 motion-safe:animate-pop-in"
          >
            <span
              aria-hidden="true"
              className={`w-8 h-8 shrink-0 rounded-xl inline-flex items-center justify-center ${className}`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm font-semibold text-stone-900">{t.message}</p>
              {t.description && <p className="mt-0.5 text-sm text-stone-600">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar notificación"
              className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
