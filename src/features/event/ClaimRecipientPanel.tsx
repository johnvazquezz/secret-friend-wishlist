import { NotebookPen } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/errors';
import { useClaimRecipient, useParticipants } from './hooks';

interface ClaimRecipientPanelProps {
  eventId: string;
  myId: string;
}

/** Sorteo con papelitos: el participante elige a la persona que le tocó. */
export default function ClaimRecipientPanel({ eventId, myId }: ClaimRecipientPanelProps) {
  const participants = useParticipants(eventId);
  const claim = useClaimRecipient(eventId);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  const options = (participants.data ?? []).filter(
    (p) => p.user_id !== myId && p.status === 'confirmed' && p.profile?.is_active,
  );
  const selectedName = options.find((p) => p.user_id === selected)?.profile?.full_name;

  const submit = () => {
    if (!selected || !selectedName) return;
    if (
      !window.confirm(
        `¿Tu papelito dice ${selectedName}?\n\nPodrás cambiarlo mientras no hayáis empezado a chatear.`,
      )
    )
      return;
    setError('');
    claim.mutate(selected, { onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <section className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-4 flex items-center gap-3">
        <NotebookPen aria-hidden="true" className="w-7 h-7 text-white" />
        <h2 className="text-2xl font-bold text-white">Registra a tu amigo secreto</h2>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-gray-700">
          El sorteo se hizo con papelitos. Elige a la persona que te tocó para ver su lista de
          deseos y poder escribirle de forma anónima.
        </p>
        {participants.isPending ? (
          <Spinner />
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Persona de tu papelito"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 min-w-48 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none bg-white"
            >
              <option value="">Elegir persona…</option>
              {options.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.profile?.full_name}
                  {p.profile?.department ? ` — ${p.profile.department}` : ''}
                </option>
              ))}
            </select>
            <Button onClick={submit} disabled={!selected || claim.isPending}>
              {claim.isPending ? 'Guardando…' : 'Registrar'}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        <p className="text-sm text-gray-500">
          🤫 Nadie más ve a quién registras, ni siquiera los organizadores.
        </p>
      </div>
    </section>
  );
}
