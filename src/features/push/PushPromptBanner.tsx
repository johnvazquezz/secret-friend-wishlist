import { BellRing, X } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/ui/Button';
import { usePushNotifications } from './hooks';
import IosInstallGuide from './IosInstallGuide';

const DISMISSED_KEY = 'push-banner-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Aviso cerrable en Mensajes para activar las notificaciones push (o instalar la app en iPhone). */
export default function PushPromptBanner({ userId }: { userId: string }) {
  const { status, busy, enable } = usePushNotifications(userId);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [showGuide, setShowGuide] = useState(false);

  if (dismissed || (status !== 'off' && status !== 'ios-install')) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* se volverá a mostrar en la próxima visita */
    }
  };

  return (
    <aside
      aria-label="Notificaciones"
      className="card mb-6 p-4 sm:p-5 border-primary-200 bg-primary-50/60"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="w-9 h-9 rounded-xl bg-white text-primary-700 inline-flex items-center justify-center shrink-0"
        >
          <BellRing className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900">¿Te avisamos cuando te escriban? 🔔</p>
          <p className="text-sm text-stone-600 mt-0.5">
            Recibe una notificación en el celular aunque tengas la app cerrada.
          </p>
          <div className="mt-3">
            {status === 'off' ? (
              <Button size="sm" onClick={() => void enable()} disabled={busy}>
                Activar notificaciones
              </Button>
            ) : showGuide ? (
              <IosInstallGuide />
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setShowGuide(true)}>
                Ver cómo activarlas en iPhone
              </Button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso"
          className="p-1.5 -m-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-white/70 transition-colors"
        >
          <X aria-hidden="true" className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
