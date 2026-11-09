import { Lock, NotebookPen } from 'lucide-react';
import { useState } from 'react';
import Button from '../../components/ui/Button';
import ConfettiDecor from '../../components/ui/ConfettiDecor';
import Spinner from '../../components/ui/Spinner';
import { useConfirm } from '../../components/ui/useConfirm';
import { celebrate } from '../../lib/confetti';
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
  const [confirm, confirmDialog] = useConfirm();

  const options = (participants.data ?? []).filter(
    (p) => p.user_id !== myId && p.status === 'confirmed' && p.profile?.is_active,
  );
  const selectedName = options.find((p) => p.user_id === selected)?.profile?.full_name;

  const submit = async () => {
    if (!selected || !selectedName) return;
    const ok = await confirm({
      title: `¿Tu papelito dice ${selectedName}?`,
      message: 'Podrás cambiarlo mientras no hayáis empezado a chatear.',
      confirmLabel: 'Sí, registrar',
      tone: 'celebrate',
    });
    if (!ok) return;
    setError('');
    claim.mutate(selected, {
      onSuccess: () => celebrate(),
      onError: (err) => setError(getErrorMessage(err)),
    });
  };

  return (
    <section className="card overflow-hidden">
      <div className="relative bg-primary-700 px-6 py-5 flex items-center gap-3 overflow-hidden">
        <ConfettiDecor className="opacity-60" />
        <span className="relative w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/25 inline-flex items-center justify-center">
          <NotebookPen aria-hidden="true" className="w-5 h-5 text-white" />
        </span>
        <h2 className="relative text-xl font-semibold text-white">Registra a tu amigo secreto</h2>
      </div>
      <div className="p-6 sm:p-8 space-y-5">
        <p className="text-stone-700">
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
              className="flex-1 min-w-48 input-base w-auto h-11 py-0"
            >
              <option value="">Elegir persona…</option>
              {options.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.profile?.full_name}
                  {p.profile?.department ? ` — ${p.profile.department}` : ''}
                </option>
              ))}
            </select>
            <Button onClick={() => void submit()} disabled={!selected || claim.isPending}>
              {claim.isPending ? 'Guardando…' : 'Registrar'}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}
        <p className="note flex items-start gap-2">
          <Lock aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-stone-400" />
          Nadie más ve a quién registras, ni siquiera los organizadores.
        </p>
      </div>
      {confirmDialog}
    </section>
  );
}
