import { AlertTriangle, Check, CheckCircle2, Lock, RotateCcw, Shuffle } from 'lucide-react';
import { useState } from 'react';
import Button from '../../../components/ui/Button';
import type { ConfirmTone } from '../../../components/ui/ConfirmDialog';
import { useConfirm } from '../../../components/ui/useConfirm';
import { toast } from '../../../components/ui/toast';
import { celebrate, launchConfetti } from '../../../lib/confetti';
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
  /** Diálogo de confirmación */
  title: string;
  confirm: string;
  confirmLabel: string;
  tone?: ConfirmTone;
  variant?: 'primary' | 'secondary';
}

function actionsFor(status: EventStatus, pendingCount: number): Action[] {
  switch (status) {
    case 'draft':
      return [
        {
          action: 'open_event',
          label: 'Abrir inscripción',
          title: '¿Abrir la inscripción?',
          confirmLabel: 'Abrir inscripción',
          confirm:
            'Los participantes de la lista verán el evento y podrán confirmar si participan. ¿Continuar?',
        },
      ];
    case 'open':
      return [
        {
          action: 'run_draw',
          label: 'Hacer el sorteo',
          title: '¿Hacer el sorteo?',
          confirmLabel: 'Sortear ahora',
          tone: 'celebrate',
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
          title: '¿Publicar los resultados?',
          confirmLabel: 'Publicar',
          tone: 'celebrate',
          confirm:
            'Cada participante verá a quién le regala. Esto es DEFINITIVO: después no se puede repetir el sorteo. ¿Publicar?',
        },
        {
          action: 'reset_draw',
          label: 'Repetir sorteo',
          variant: 'secondary',
          title: '¿Repetir el sorteo?',
          confirmLabel: 'Repetir',
          tone: 'danger',
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
          title: '¿Finalizar el evento?',
          confirmLabel: 'Finalizar',
          tone: 'danger',
          confirm:
            'Usa esto después del intercambio. El evento quedará archivado y podrás crear uno nuevo. ¿Finalizar?',
        },
      ];
    default:
      return [];
  }
}

const SUCCESS_MESSAGES: Record<LifecycleAction, string> = {
  open_event: 'Inscripción abierta.',
  run_draw: '¡Sorteo hecho! Revísalo antes de publicarlo.',
  publish_draw: '¡Resultados publicados! 🎁',
  reset_draw: 'Sorteo descartado. El evento vuelve a inscripción.',
  finish_event: 'Evento finalizado y archivado.',
};

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

  const [confirm, confirmDialog] = useConfirm();

  const run = async (action: Action) => {
    const ok = await confirm({
      title: action.title,
      message: action.confirm,
      confirmLabel: action.confirmLabel,
      tone: action.tone,
    });
    if (!ok) return;
    setError('');
    lifecycle.mutate(action.action, {
      onSuccess: () => {
        if (action.action === 'publish_draw') celebrate();
        else if (action.action === 'run_draw') launchConfetti({ count: 90, spread: 100 });
        toast.success(SUCCESS_MESSAGES[action.action]);
      },
      onError: (err) => setError(getErrorMessage(err)),
    });
  };

  return (
    <section className="card p-5 sm:p-6 space-y-5">
      <ol className="grid grid-cols-5" aria-label="Estado del evento">
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const current = i === currentIndex;
          return (
            <li
              key={step.status}
              aria-current={current ? 'step' : undefined}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${
                    i <= currentIndex ? 'bg-primary-500' : 'bg-stone-200'
                  }`}
                />
              )}
              <span
                className={`relative z-10 w-8 h-8 rounded-full inline-flex items-center justify-center text-sm font-semibold ring-4 ring-white ${
                  current
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-900/20'
                    : done
                      ? 'bg-primary-100 text-primary-800'
                      : 'bg-stone-100 text-stone-500'
                }`}
              >
                {done ? <Check aria-hidden="true" className="w-4 h-4" /> : i + 1}
                {done && <span className="sr-only">{i + 1}.</span>}
              </span>
              <span
                className={`text-[11px] sm:text-xs font-medium ${
                  current ? 'text-stone-900' : 'text-stone-500'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Confirmados" value={confirmed} />
        <Stat label="Sin responder" value={pending} />
        <Stat label="No participan" value={declined} />
      </dl>

      {showSummary && summary.data && (
        <p
          className={`flex items-start gap-2 ${
            summary.data.is_valid ? 'alert-success' : 'alert-error'
          }`}
        >
          {summary.data.is_valid ? (
            <CheckCircle2 aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          {summary.data.is_valid
            ? `Sorteo válido: ${summary.data.assigned} de ${summary.data.confirmed} participantes tienen a quién regalar.`
            : `Revisa el sorteo: ${summary.data.assigned} asignaciones para ${summary.data.confirmed} confirmados.`}
        </p>
      )}
      {showSummary && (
        <p className="note flex items-start gap-2">
          <Lock aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-stone-400" />
          Por privacidad, nadie (tampoco los administradores) puede ver quién le regala a quién.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {actionsFor(event.status, pending).map((action) => {
          const Icon = icons[action.action];
          return (
            <Button
              key={action.action}
              variant={action.variant}
              disabled={lifecycle.isPending}
              onClick={() => void run(action)}
            >
              {Icon && <Icon aria-hidden="true" className="w-4 h-4" />}
              {action.label}
            </Button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      {confirmDialog}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-stone-50 ring-1 ring-inset ring-stone-200/70 p-3 sm:p-4">
      <dt className="text-xs font-medium text-stone-500">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold text-stone-900 tabular-nums">{value}</dd>
    </div>
  );
}
