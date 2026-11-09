import { CheckCircle2, PartyPopper, UserX, XCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import Button from '../../components/ui/Button';
import { getErrorMessage } from '../../lib/errors';
import type { EventRow, ParticipationStatus } from './api';
import { useRespondParticipation } from './hooks';

interface ParticipationPanelProps {
  event: EventRow;
  status: ParticipationStatus | null;
}

export default function ParticipationPanel({ event, status }: ParticipationPanelProps) {
  const respond = useRespondParticipation(event.id);
  const [error, setError] = useState('');

  const deadlinePassed =
    !!event.registration_deadline && new Date(event.registration_deadline) < new Date();
  const canRespond = event.status === 'open' && !deadlinePassed;

  const answer = (accept: boolean) => {
    setError('');
    respond.mutate(accept, { onError: (err) => setError(getErrorMessage(err)) });
  };

  if (!status) {
    return (
      <Panel icon={<UserX />} tone="neutral">
        <p className="text-stone-600">
          No estás en la lista de participantes de este año. Si quieres participar, habla con el
          organizador.
        </p>
      </Panel>
    );
  }

  const icon =
    status === 'confirmed' ? (
      <CheckCircle2 />
    ) : status === 'declined' ? (
      <XCircle />
    ) : (
      <PartyPopper />
    );
  const tone = status === 'confirmed' ? 'success' : status === 'declined' ? 'neutral' : 'primary';

  return (
    <Panel icon={icon} tone={tone}>
      {status === 'invited' && (
        <p className="font-display text-xl font-semibold text-stone-900">
          ¿Participas en el Amigo Secreto de este año?
        </p>
      )}
      {status === 'confirmed' && (
        <p className="font-display text-xl font-semibold text-emerald-800">¡Estás dentro!</p>
      )}
      {status === 'declined' && (
        <p className="text-lg font-medium text-stone-700">Indicaste que no participas este año.</p>
      )}

      {canRespond && (
        <div className="flex flex-wrap justify-center gap-3 mt-5">
          {status !== 'confirmed' && (
            <Button size="lg" onClick={() => answer(true)} disabled={respond.isPending}>
              {status === 'declined' ? 'Cambiar de opinión: participo' : '¡Participo!'}
            </Button>
          )}
          {status !== 'declined' && (
            <Button
              variant={status === 'confirmed' ? 'ghost' : 'secondary'}
              size={status === 'confirmed' ? 'sm' : 'lg'}
              onClick={() => answer(false)}
              disabled={respond.isPending}
            >
              {status === 'confirmed' ? 'Ya no puedo participar' : 'No participaré'}
            </Button>
          )}
        </div>
      )}
      {event.status === 'open' && deadlinePassed && status === 'invited' && (
        <p className="text-stone-600 mt-2">El plazo para confirmar terminó.</p>
      )}
      {event.status === 'drawn' && status === 'confirmed' && (
        <p className="text-stone-600 mt-2">
          El sorteo ya se hizo. Pronto podrás ver aquí a quién le regalas.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </Panel>
  );
}

const toneClasses = {
  primary: 'bg-primary-50 text-primary-600',
  success: 'bg-emerald-50 text-emerald-600',
  neutral: 'bg-stone-100 text-stone-500',
} as const;

function Panel({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: keyof typeof toneClasses;
  children: ReactNode;
}) {
  return (
    <section className="card p-6 sm:p-8 text-center">
      <span
        aria-hidden="true"
        className={`w-12 h-12 rounded-2xl inline-flex items-center justify-center mb-4 [&>svg]:w-6 [&>svg]:h-6 ${toneClasses[tone]}`}
      >
        {icon}
      </span>
      {children}
    </section>
  );
}
