import { PlusSquare, Share, Smartphone } from 'lucide-react';

/** Pasos para instalar la web en la pantalla de inicio del iPhone (requisito de iOS para push). */
export default function IosInstallGuide() {
  return (
    <div className="text-sm text-stone-700">
      <p>
        En iPhone, las notificaciones solo funcionan si instalas la app en tu pantalla de inicio
        (iOS 16.4 o superior):
      </p>
      <ol className="mt-3 space-y-2.5">
        <li className="flex items-start gap-2.5">
          <Step n={1} />
          <span>
            Abre esta página en <strong>Safari</strong> y toca{' '}
            <strong className="inline-flex items-center gap-1">
              Compartir <Share aria-hidden="true" className="w-4 h-4" />
            </strong>
            .
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <Step n={2} />
          <span>
            Elige{' '}
            <strong className="inline-flex items-center gap-1">
              Añadir a pantalla de inicio <PlusSquare aria-hidden="true" className="w-4 h-4" />
            </strong>
            .
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <Step n={3} />
          <span>
            Abre la app desde el nuevo icono{' '}
            <Smartphone aria-hidden="true" className="inline w-4 h-4 align-text-bottom" />, entra a{' '}
            <strong>Mi perfil</strong> y toca <strong>Activar notificaciones</strong>.
          </span>
        </li>
      </ol>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="w-5 h-5 shrink-0 mt-px rounded-full bg-primary-100 text-primary-800 text-xs font-bold inline-flex items-center justify-center"
    >
      {n}
    </span>
  );
}
