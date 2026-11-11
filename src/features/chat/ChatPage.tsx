import { MessageCircle, MessageCirclePlus, VenetianMask } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import { useAuth } from '../auth/useAuth';
import { useActiveEvent, useMyParticipation } from '../event/hooks';
import { useAvatarUrls } from '../profile/hooks';
import { partnerLabel, type Conversation as ConversationData } from './api';
import Conversation from './Conversation';
import { isChatAvailable, useMyConversations } from './hooks';
import NewConversationModal from './NewConversationModal';
import PartnerAvatar from './PartnerAvatar';

/** Parámetro de la URL: id del hilo, o "amigo" para el hilo con la persona a la que regalo. */
const CHAT_PARAM = 'chat';

const listTime = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
const todayTime = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

function formatListTime(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? todayTime.format(date)
    : listTime.format(date);
}

export default function ChatPage() {
  const { profile } = useAuth();
  const eventQuery = useActiveEvent();
  const event = eventQuery.data ?? null;
  const participation = useMyParticipation(event?.id, profile?.id);
  const conversationsQuery = useMyConversations(event?.id, event?.status);
  const conversations = conversationsQuery.data ?? [];
  const { data: urls } = useAvatarUrls(conversations.map((c) => c.partner_avatar_path));
  const [params, setParams] = useSearchParams();
  const [composing, setComposing] = useState(false);

  const chatOpen = !!event && isChatAvailable(event.status);
  if (
    eventQuery.isPending ||
    (chatOpen && (conversationsQuery.isPending || participation.isPending))
  ) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (eventQuery.isError || conversationsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ErrorState
          message="No se pudieron cargar tus conversaciones."
          onRetry={() => void conversationsQuery.refetch()}
        />
      </div>
    );
  }

  const isParticipant = participation.data === 'confirmed';
  if (!chatOpen || (!isParticipant && conversations.length === 0)) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <h1 className="sr-only">Mensajes</h1>
        <EmptyState
          icon={<MessageCircle />}
          title="Mensajes"
          message={
            chatOpen
              ? 'No participas en el sorteo de este año, así que no tienes conversaciones.'
              : 'El chat se abrirá cuando se publique el sorteo.'
          }
        />
      </div>
    );
  }

  const canWrite = event.status === 'published';
  const param = params.get(CHAT_PARAM);
  const explicit =
    param === 'amigo'
      ? conversations.find((c) => c.is_my_recipient)
      : conversations.find((c) => c.thread_id === param);
  const current = explicit ?? conversations[0];

  const select = (threadId: string | null) => {
    const next = new URLSearchParams(params);
    if (threadId) next.set(CHAT_PARAM, threadId);
    else next.delete(CHAT_PARAM);
    setParams(next, { replace: !threadId });
  };

  const urlFor = (c: ConversationData) =>
    c.partner_avatar_path ? urls?.[c.partner_avatar_path] : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <PageHeader
        eyebrow="Chat"
        title="Mensajes"
        description="Escríbele a quien quieras, con tu nombre o en secreto. ¡Despista todo lo que puedas! 🎭"
        className="mb-6"
        actions={
          canWrite &&
          isParticipant && (
            <Button onClick={() => setComposing(true)}>
              <MessageCirclePlus aria-hidden="true" className="w-4 h-4" />
              Nuevo mensaje
            </Button>
          )
        }
      />

      {conversations.length === 0 ? (
        <EmptyState
          icon={<VenetianMask />}
          title="Aún no tienes conversaciones"
          message="¡Anímate a escribirle a alguien! Puedes hacerlo en secreto para despistar."
          action={
            canWrite && (
              <Button onClick={() => setComposing(true)}>
                <MessageCirclePlus aria-hidden="true" className="w-4 h-4" />
                Nuevo mensaje
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[20rem_1fr] md:items-start">
          <nav
            aria-label="Conversaciones"
            className={`card p-2 md:sticky md:top-24 ${explicit ? 'hidden md:block' : ''}`}
          >
            <ul className="space-y-0.5">
              {conversations.map((c) => {
                const active = c.thread_id === current.thread_id;
                return (
                  <li key={c.thread_id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => select(c.thread_id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-primary-50' : 'hover:bg-stone-50'
                      }`}
                    >
                      <PartnerAvatar conversation={c} url={urlFor(c)} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="flex-1 truncate text-sm font-semibold text-stone-900">
                            {partnerLabel(c)}
                          </span>
                          <span className="text-[11px] text-stone-400 shrink-0">
                            {formatListTime(c.last_message_at)}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 mt-0.5 text-xs text-stone-500">
                          <span className="flex-1 truncate">
                            {c.blocked_by_me
                              ? 'Silenciado'
                              : c.is_my_recipient
                                ? 'Tu amigo secreto 🎁'
                                : c.my_alias
                                  ? 'Escribes en secreto 🎭'
                                  : c.partner_alias
                                    ? 'Anónimo'
                                    : 'Con nombre'}
                          </span>
                          {c.unread > 0 && (
                            <span
                              className="min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-stone-900 text-[11px] font-bold inline-flex items-center justify-center"
                              aria-label={`${c.unread} sin leer`}
                            >
                              {c.unread}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <section
            aria-label={`Chat con ${partnerLabel(current)}`}
            className={`card p-4 sm:p-6 ${explicit ? '' : 'hidden md:block'}`}
          >
            <Conversation
              key={current.thread_id}
              eventId={event.id}
              conversation={current}
              canWrite={canWrite}
              avatarUrl={urlFor(current)}
              onBack={() => select(null)}
            />
          </section>
        </div>
      )}

      {composing && profile && (
        <NewConversationModal
          eventId={event.id}
          myId={profile.id}
          onClose={() => setComposing(false)}
          onStarted={(threadId) => {
            setComposing(false);
            select(threadId);
          }}
        />
      )}
    </div>
  );
}
