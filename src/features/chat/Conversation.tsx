import { ArrowLeft, BellOff, BellRing, Send } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { toast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/useConfirm';
import { getErrorMessage } from '../../lib/errors';
import { MAX_MESSAGE_LENGTH, partnerLabel, type Conversation as ConversationData } from './api';
import { useMarkThreadRead, useSendMessage, useSetThreadBlocked, useThreadMessages } from './hooks';
import PartnerAvatar from './PartnerAvatar';

interface ConversationProps {
  eventId: string;
  conversation: ConversationData;
  canWrite: boolean;
  avatarUrl?: string | null;
  /** En móvil: volver a la lista de conversaciones. */
  onBack?: () => void;
}

const timeFormat = new Intl.DateTimeFormat('es', {
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Texto de ayuda según quién sabe qué en esta conversación. */
function privacyNote(c: ConversationData): string {
  const name = c.partner_name?.split(' ')[0];
  if (c.my_alias && c.is_my_recipient) {
    return `🎁 Le regalas a ${c.partner_name}. Escribes como «${c.my_alias}»: ${name} no sabe que eres tú. No firmes tus mensajes ni des pistas obvias.`;
  }
  if (c.my_alias) {
    return `🤫 Escribes como «${c.my_alias}». ${name} no sabe que eres tú: no firmes ni des pistas obvias.`;
  }
  if (c.partner_alias) {
    return '🎭 No sabes quién es… Puede que sea tu amigo secreto, o puede que no 😉';
  }
  return `👋 Chat con nombre: ${name} sabe que eres tú.`;
}

export default function Conversation({
  eventId,
  conversation,
  canWrite,
  avatarUrl,
  onBack,
}: ConversationProps) {
  const inputId = useId();
  const messages = useThreadMessages(conversation.thread_id);
  const send = useSendMessage(eventId, conversation.thread_id);
  const markRead = useMarkThreadRead(eventId);
  const setBlocked = useSetThreadBlocked(eventId);
  const [confirm, confirmDialog] = useConfirm();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const label = partnerLabel(conversation);
  const count = messages.data?.length ?? 0;
  const blocked = conversation.blocked_by_me || conversation.blocked_by_partner;

  // Desplazarse al último mensaje y marcar como leídos los recibidos.
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' });
  }, [count]);

  const { mutate: markThreadRead } = markRead;
  useEffect(() => {
    if (conversation.unread > 0) markThreadRead(conversation.thread_id);
  }, [conversation.thread_id, conversation.unread, count, markThreadRead]);

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

  const toggleBlocked = async () => {
    const block = !conversation.blocked_by_me;
    if (block) {
      const ok = await confirm({
        title: `¿Silenciar el chat con ${label}?`,
        message:
          'No podrá escribirte más en esta conversación y tú tampoco podrás escribirle. Nadie sabrá quién lo silenció ni se revelará ninguna identidad. Puedes reactivarlo cuando quieras.',
        confirmLabel: 'Silenciar',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setBlocked.mutate(
      { threadId: conversation.thread_id, blocked: block },
      {
        onSuccess: () => toast.success(block ? 'Chat silenciado.' : 'Chat reactivado.'),
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    );
  };

  return (
    <div className="flex flex-col h-full min-h-[28rem]">
      <header className="flex items-center gap-3 pb-4 mb-4 border-b border-stone-100">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a las conversaciones"
            className="icon-btn -ml-2 md:hidden"
          >
            <ArrowLeft aria-hidden="true" className="w-5 h-5" />
          </button>
        )}
        <PartnerAvatar conversation={conversation} url={avatarUrl} />
        <div className="flex-1 min-w-0">
          <h2 className="font-sans text-base font-semibold text-stone-900 truncate">{label}</h2>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {conversation.is_my_recipient && <Badge tone="primary">Tu amigo secreto 🎁</Badge>}
            {conversation.my_alias && <Badge tone="warning">Escribes en secreto 🎭</Badge>}
            {conversation.partner_alias && <Badge>Anónimo</Badge>}
          </div>
        </div>
        {canWrite && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void toggleBlocked()}
            disabled={setBlocked.isPending}
          >
            {conversation.blocked_by_me ? (
              <BellRing aria-hidden="true" className="w-4 h-4" />
            ) : (
              <BellOff aria-hidden="true" className="w-4 h-4" />
            )}
            <span className="sr-only sm:not-sr-only">
              {conversation.blocked_by_me ? 'Reactivar' : 'Silenciar'}
            </span>
          </Button>
        )}
      </header>

      <p className="note mb-4">{privacyNote(conversation)}</p>

      <div
        className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-48"
        role="log"
        aria-live="polite"
        aria-label={`Conversación con ${label}`}
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
            const mine = m.author_role === conversation.my_role;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    mine
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-stone-100 text-stone-900 rounded-bl-md'
                  }`}
                >
                  <p className="sr-only">{mine ? 'Tú' : label}:</p>
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

      {!canWrite ? (
        <p className="mt-4 note text-center">
          El evento terminó: la conversación es de solo lectura.
        </p>
      ) : blocked ? (
        <p className="mt-4 note text-center">
          {conversation.blocked_by_me
            ? 'Silenciaste este chat. Reactívalo para volver a escribir.'
            : 'Esta persona silenció el chat: ya no puedes escribirle aquí.'}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-4 pt-4 border-t border-stone-100 space-y-1.5">
          <label htmlFor={inputId} className="sr-only">
            Escribe un mensaje a {label}
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
      )}
      {confirmDialog}
    </div>
  );
}
