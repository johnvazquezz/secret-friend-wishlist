import { CheckCircle2, Lock, RotateCcw, Shuffle } from 'lucide-react';
import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { getErrorMessage } from '../../../lib/errors';
import type { EventRow, EventStatus, LifecycleAction, Participant } from '../../event/api';
import { useDrawSummary, useLifecycleAction } from '../../event/hooks';

const STEPS: { status: EventStatus; label: string }[] = [
  { status: 'draft', label: 'Borrador' },
  { status: 'open', label: 'Inscripción' },
  { status: 'drawn', label: 'Sorteado' },
  { status: 'published', label: 'Publicado' },
  { status: 'finished', label: 'Finalizado' },
];

interface Action {
  action: LifecycleAction;
  label: string;
  confirm: string;
  variant?: 'primary' | 'secondary';
}

function actionsFor(status: EventStatus, pendingCount: number): Action[] {
  switch (status) {
    case 'draft':
      return [
        {
          action: 'open_event',
          label: 'Abrir inscripción',
          confirm:
            'Los participantes de la lista verán el evento y podrán confirmar si participan. ¿Continuar?',
        },
      ];
    case 'open':
      return [
        {
          action: 'run_draw',
          label: 'Hacer el sorteo',
          confirm:
            (pendingCount > 0
              ? `${pendingCount} persona(s) aún no han respondido y quedarán FUERA del sorteo.\n\n`
              : '') +
            'Se sortearán solo los participantes confirmados. Después ya no se podrán añadir personas ni exclusiones. ¿Hacer el sorteo?',
        },
      ];
    case 'drawn':
      return [
        {
          action: 'publish_draw',
          label: 'Publicar resultados',
          confirm:
            'Cada participante verá a quién le regala. Esto es DEFINITIVO: después no se puede repetir el sorteo. ¿Publicar?',
        },
        {
          action: 'reset_draw',
          label: 'Repetir sorteo',
          variant: 'secondary',
          confirm:
            'Se descartará el sorteo actual (nadie lo ha visto) y el evento volverá a inscripción. ¿Continuar?',
        },
      ];
    case 'published':
      return [
        {
          action: 'finish_event',
          label: 'Finalizar evento',
          variant: 'secondary',
          confirm:
            'Usa esto después del intercambio. El evento quedará archivado y podrás crear uno nuevo. ¿Finalizar?',
        },
      ];
    default:
      return [];
  }
}

const icons: Partial<Record<LifecycleAction, typeof Shuffle>> = {
  run_draw: Shuffle,
  reset_draw: RotateCcw,
  publish_draw: Lock,
};

interface LifecyclePanelProps {
  event: EventRow;
  participants: Participant[];
}

export default function LifecyclePanel({ event, participants }: LifecyclePanelProps) {
  const lifecycle = useLifecycleAction(event.id);
  const showSummary = event.status === 'drawn' || event.status === 'published';
  const summary = useDrawSummary(event.id, showSummary);
  const [error, setError] = useState('');

  const confirmed = participants.filter((p) => p.status === 'confirmed').length;
  const pending = participants.filter((p) => p.status === 'invited').length;
  const declined = participants.filter((p) => p.status === 'declined').length;
  const currentIndex = STEPS.findIndex((s) => s.status === event.status);

  const run = (action: Action) => {
    if (!window.confirm(action.confirm)) return;
    setError('');
    lifecycle.mutate(action.action, { onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <section className="bg-white rounded-xl shadow-lg p-6 space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="Estado del evento">
        {STEPS.map((step, i) => (
          <li
            key={step.status}
            aria-current={i === currentIndex ? 'step' : undefined}
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              i === currentIndex
                ? 'bg-primary text-white'
                : i < currentIndex
                  ? 'bg-primary/10 text-primary-dark'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            {i + 1}. {step.label}
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Confirmados" value={confirmed} />
        <Stat label="Sin responder" value={pending} />
        <Stat label="No participan" value={declined} />
      </dl>

      {showSummary && summary.data && (
        <p
          className={`flex items-center gap-2 font-medium ${
            summary.data.is_valid ? 'text-green-700' : 'text-red-600'
          }`}
        >
          <CheckCircle2 aria-hidden="true" className="w-5 h-5" />
          {summary.data.is_valid
            ? `Sorteo válido: ${summary.data.assigned} de ${summary.data.confirmed} participantes tienen a quién regalar.`
            : `Revisa el sorteo: ${summary.data.assigned} asignaciones para ${summary.data.confirmed} confirmados.`}
        </p>
      )}
      {showSummary && (
        <p className="text-sm text-gray-500">
          🔒 Por privacidad, nadie (tampoco los administradores) puede ver quién le regala a quién.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {actionsFor(event.status, pending).map((action) => {
          const Icon = icons[action.action];
          return (
            <Button
              key={action.action}
              variant={action.variant}
              disabled={lifecycle.isPending}
              onClick={() => run(action)}
            >
              {Icon && <Icon aria-hidden="true" className="w-5 h-5" />}
              {action.label}
            </Button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-2xl font-bold text-gray-800 tabular-nums">{value}</dd>
    </div>
  );
}
