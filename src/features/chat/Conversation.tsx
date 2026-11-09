import { Send } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/errors';
import { MAX_MESSAGE_LENGTH, type Thread } from './api';
import { useMarkThreadRead, useSendMessage, useThreadMessages } from './hooks';

interface ConversationProps {
  eventId: string;
  thread: Thread;
  canWrite: boolean;
}

const timeFormat = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default function Conversation({ eventId, thread, canWrite }: ConversationProps) {
  const inputId = useId();
  const messages = useThreadMessages(thread.thread_id);
  const send = useSendMessage(eventId, thread.my_role, thread.thread_id);
  const markRead = useMarkThreadRead(eventId);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const isGiver = thread.my_role === 'giver';
  const partnerLabel = isGiver ? (thread.partner_name ?? 'Tu destinatario') : 'Tu amigo secreto';
  const count = messages.data?.length ?? 0;

  // Desplazarse al último mensaje y marcar como leídos los recibidos.
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [count]);

  const { mutate: markThreadRead } = markRead;
  useEffect(() => {
    if (thread.unread > 0) markThreadRead(thread.thread_id);
  }, [thread.thread_id, thread.unread, count, markThreadRead]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = body.trim();
    if (!text || send.isPending) return;
    setError('');
    send.mutate(text, {
      onSuccess: () => setBody(''),
      onError: (err) => setError(getErrorMessage(err)),
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col h-[60vh] min-h-96">
      <p className="note mb-4">
        {isGiver
          ? `🤫 ${thread.partner_name ?? 'Tu destinatario'} no sabe que eres tú. No firmes tus mensajes ni des pistas obvias.`
          : '🎁 No sabes quién es tu amigo secreto. Puedes contarle qué te gusta o resolver sus dudas.'}
      </p>

      <div
        className="flex-1 overflow-y-auto space-y-3 pr-1"
        role="log"
        aria-live="polite"
        aria-label={`Conversación con ${partnerLabel}`}
      >
        {messages.isPending ? (
          <Spinner label="Cargando mensajes..." />
        ) : messages.isError ? (
          <p className="alert-error">No se pudieron cargar los mensajes.</p>
        ) : count === 0 ? (
          <p className="text-stone-500 text-sm text-center py-12">
            Aún no hay mensajes. ¡Rompe el hielo!
          </p>
        ) : (
          messages.data.map((m) => {
            const mine = m.author_role === thread.my_role;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    mine
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-stone-100 text-stone-900 rounded-bl-md'
                  }`}
                >
                  <p className="sr-only">{mine ? 'Tú' : partnerLabel}:</p>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-xs mt-1 ${mine ? 'text-white/70' : 'text-stone-400'}`}>
                    {timeFormat.format(new Date(m.created_at))}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {canWrite ? (
        <form onSubmit={submit} className="mt-4 pt-4 border-t border-stone-100 space-y-1.5">
          <label htmlFor={inputId} className="sr-only">
            Escribe un mensaje a {partnerLabel}
          </label>
          <div className="flex gap-2 items-end">
            <textarea
              id={inputId}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={2}
              placeholder="Escribe un mensaje… (Enter para enviar)"
              className="input-base flex-1 resize-none"
            />
            <Button
              type="submit"
              disabled={!body.trim() || send.isPending}
              aria-label="Enviar"
              className="!px-0 w-12 h-12 !rounded-full shrink-0"
            >
              <Send aria-hidden="true" className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex justify-between gap-3 text-xs text-stone-400 px-1">
            <span>
              {error && (
                <span role="alert" className="text-red-600">
                  {error}
                </span>
              )}
            </span>
            <span>
              {body.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </form>
      ) : (
        <p className="mt-4 note text-center">
          El evento terminó: la conversación es de solo lectura.
        </p>
      )}
    </div>
  );
}
