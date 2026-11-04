import { CheckCircle2, XCircle } from 'lucide-react';
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
      <Panel>
        <p className="text-gray-600">
          No estás en la lista de participantes de este año. Si quieres participar, habla con el
          organizador.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      {status === 'invited' && (
        <p className="text-lg text-gray-800 mb-4">¿Participas en el Amigo Secreto de este año?</p>
      )}
      {status === 'confirmed' && (
        <p className="text-lg text-green-700 flex items-center justify-center gap-2 mb-2">
          <CheckCircle2 aria-hidden="true" className="w-6 h-6" />
          ¡Estás dentro!
        </p>
      )}
      {status === 'declined' && (
        <p className="text-lg text-gray-700 flex items-center justify-center gap-2 mb-2">
          <XCircle aria-hidden="true" className="w-6 h-6" />
          Indicaste que no participas este año.
        </p>
      )}

      {canRespond && (
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {status !== 'confirmed' && (
            <Button onClick={() => answer(true)} disabled={respond.isPending}>
              {status === 'declined' ? 'Cambiar de opinión: participo' : '¡Participo!'}
            </Button>
          )}
          {status !== 'declined' && (
            <Button variant="secondary" onClick={() => answer(false)} disabled={respond.isPending}>
              {status === 'confirmed' ? 'Ya no puedo participar' : 'No participaré'}
            </Button>
          )}
        </div>
      )}
      {event.status === 'open' && deadlinePassed && status === 'invited' && (
        <p className="text-gray-600">El plazo para confirmar terminó.</p>
      )}
      {event.status === 'drawn' && status === 'confirmed' && (
        <p className="text-gray-600 mt-2">
          El sorteo ya se hizo. Pronto podrás ver aquí a quién le regalas.
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-600 mt-3">
          {error}
        </p>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="bg-white rounded-2xl shadow-lg p-6 text-center">{children}</section>;
}
