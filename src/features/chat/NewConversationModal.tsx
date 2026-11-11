import { Check, Search, Send, VenetianMask } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Spinner';
import { toast } from '../../components/ui/toast';
import { confettiFrom } from '../../lib/confetti';
import { getErrorMessage } from '../../lib/errors';
import { useParticipants } from '../event/hooks';
import { useAvatarUrls } from '../profile/hooks';
import { MAX_MESSAGE_LENGTH } from './api';
import { useStartConversation } from './hooks';

interface NewConversationModalProps {
  eventId: string;
  myId: string;
  onClose: () => void;
  onStarted: (threadId: string) => void;
}

/** Escribir a cualquier participante, con tu nombre o en secreto. */
export default function NewConversationModal({
  eventId,
  myId,
  onClose,
  onStarted,
}: NewConversationModalProps) {
  const bodyId = useId();
  const participants = useParticipants(eventId);
  const start = useStartConversation(eventId);
  const [query, setQuery] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const people = (participants.data ?? []).filter(
    (p) => p.user_id !== myId && p.status === 'confirmed' && p.profile?.is_active,
  );
  const { data: urls } = useAvatarUrls(people.map((p) => p.profile?.avatar_path));
  const normalized = query.trim().toLowerCase();
  const visible = people.filter(
    (p) =>
      !normalized ||
      (p.profile?.full_name ?? '').toLowerCase().includes(normalized) ||
      (p.profile?.department ?? '').toLowerCase().includes(normalized),
  );
  const recipient = people.find((p) => p.user_id === recipientId);
  const recipientName = recipient?.profile?.full_name ?? '';

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = body.trim();
    if (!recipientId) {
      setError('Elige a quién quieres escribirle.');
      return;
    }
    if (!text) {
      setError('Escribe un mensaje.');
      return;
    }
    setError('');
    const button = e.currentTarget.querySelector('button[type="submit"]');
    start.mutate(
      { recipientId, anonymous, body: text },
      {
        onSuccess: (threadId) => {
          confettiFrom(button, { count: 70, spread: 80, power: 11 });
          toast.success(
            anonymous ? 'Mensaje enviado en secreto 🤫' : 'Mensaje enviado',
            anonymous ? `${recipientName.split(' ')[0]} no sabrá que eres tú.` : undefined,
          );
          onStarted(threadId);
        },
        onError: (err) => setError(getErrorMessage(err)),
      },
    );
  };

  return (
    <Modal title="Nuevo mensaje" onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <fieldset>
          <legend className="block text-sm font-medium text-stone-700 mb-1.5">Para</legend>
          <div className="relative mb-2">
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            />
            <input
              type="search"
              aria-label="Buscar participante"
              placeholder="Buscar por nombre o departamento"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-base h-11 py-0 pl-10"
            />
          </div>
          {participants.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <ul
              aria-label="Participantes"
              className="max-h-56 overflow-y-auto rounded-xl ring-1 ring-inset ring-stone-200 divide-y divide-stone-100"
            >
              {visible.map((p) => {
                const name = p.profile?.full_name ?? '';
                const selected = p.user_id === recipientId;
                return (
                  <li key={p.user_id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setRecipientId(p.user_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        selected ? 'bg-primary-50' : 'hover:bg-stone-50'
                      }`}
                    >
                      <Avatar
                        name={name}
                        url={p.profile?.avatar_path ? urls?.[p.profile.avatar_path] : null}
                        size="sm"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-stone-900 truncate">
                          {name}
                        </span>
                        {p.profile?.department && (
                          <span className="block text-xs text-stone-500 truncate">
                            {p.profile.department}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <Check aria-hidden="true" className="w-4 h-4 text-primary-600 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="px-3 py-6 text-sm text-stone-500 text-center">
                  Nadie coincide con la búsqueda.
                </li>
              )}
            </ul>
          )}
        </fieldset>

        <button
          type="button"
          role="switch"
          aria-checked={anonymous}
          onClick={() => setAnonymous((v) => !v)}
          className={`w-full flex items-center gap-3 rounded-2xl p-3.5 text-left ring-1 ring-inset transition-colors ${
            anonymous
              ? 'bg-primary-50 ring-primary-200'
              : 'bg-white ring-stone-200 hover:bg-stone-50'
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-10 h-10 shrink-0 rounded-xl inline-flex items-center justify-center ${
              anonymous ? 'bg-primary-600 text-white' : 'bg-stone-100 text-stone-500'
            }`}
          >
            <VenetianMask className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-stone-900">Escribir en secreto</span>
            <span className="block text-sm text-stone-600">
              {anonymous
                ? 'Verá un alias misterioso, no tu nombre. Ni el organizador sabrá que eres tú.'
                : 'Verá tu nombre y tu foto.'}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${
              anonymous ? 'bg-primary-600' : 'bg-stone-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                anonymous ? 'translate-x-5' : ''
              }`}
            />
          </span>
        </button>

        <div>
          <label htmlFor={bodyId} className="block text-sm font-medium text-stone-700 mb-1.5">
            Mensaje
          </label>
          <textarea
            id={bodyId}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={3}
            placeholder={
              anonymous ? 'Un mensajito misterioso… (no firmes 😉)' : '¡Hola! Te escribo para…'
            }
            className="input-base resize-none"
          />
          <p className="mt-1 text-right text-xs text-stone-400">
            {body.length}/{MAX_MESSAGE_LENGTH}
          </p>
        </div>

        {error && (
          <p role="alert" className="alert-error">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={start.isPending}>
            {anonymous ? (
              <VenetianMask aria-hidden="true" className="w-4 h-4" />
            ) : (
              <Send aria-hidden="true" className="w-4 h-4" />
            )}
            {start.isPending ? 'Enviando…' : anonymous ? 'Enviar en secreto' : 'Enviar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
