import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import ErrorState from '../../components/ui/ErrorState';
import Spinner from '../../components/ui/Spinner';
import { useActiveEvent } from '../event/hooks';
import { useAvatarUrls } from '../profile/hooks';
import type { ChatRole, Thread } from './api';
import Conversation from './Conversation';
import { isChatAvailable, useMyThreads } from './hooks';

export default function ChatPage() {
  const eventQuery = useActiveEvent();
  const event = eventQuery.data ?? null;
  const threadsQuery = useMyThreads(event?.id, event?.status);
  const [selected, setSelected] = useState<ChatRole>('receiver');
  const threads = threadsQuery.data ?? [];
  const giverThread = threads.find((t) => t.my_role === 'giver');
  const { data: urls } = useAvatarUrls([giverThread?.partner_avatar_path]);

  if (eventQuery.isPending || (event && isChatAvailable(event.status) && threadsQuery.isPending)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (eventQuery.isError || threadsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ErrorState
          message="No se pudieron cargar tus conversaciones."
          onRetry={() => void threadsQuery.refetch()}
        />
      </div>
    );
  }

  if (!event || !isChatAvailable(event.status) || threads.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <h1 className="sr-only">Mensajes</h1>
        <EmptyState
          icon={<MessageCircle />}
          title="Mensajes"
          message={
            event && isChatAvailable(event.status)
              ? 'No participas en el sorteo de este año, así que no tienes conversaciones.'
              : 'El chat se abrirá cuando se publique el sorteo.'
          }
        />
      </div>
    );
  }

  const current = threads.find((t) => t.my_role === selected) ?? threads[0];
  const tab = (thread: Thread) => {
    const isGiver = thread.my_role === 'giver';
    const active = thread.thread_id === current.thread_id;
    return (
      <button
        key={thread.thread_id}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setSelected(thread.my_role)}
        className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
          active
            ? 'bg-white text-stone-900 shadow-soft ring-1 ring-stone-200'
            : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
        }`}
      >
        {isGiver ? (
          <Avatar
            name={thread.partner_name ?? '?'}
            url={thread.partner_avatar_path ? urls?.[thread.partner_avatar_path] : null}
            size="sm"
          />
        ) : (
          <span
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-primary-50 ring-1 ring-primary-100 inline-flex items-center justify-center text-base"
          >
            🎅
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block font-semibold truncate">
            {isGiver ? thread.partner_name : 'Tu amigo secreto'}
          </span>
          <span className="block text-xs text-stone-500">
            {isGiver ? 'A quien le regalas' : 'Anónimo: quien te regala'}
          </span>
        </span>
        {thread.unread > 0 && (
          <span
            className="min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-stone-900 text-[11px] font-bold inline-flex items-center justify-center"
            aria-label={`${thread.unread} sin leer`}
          >
            {thread.unread}
          </span>
        )}
      </button>
    );
  };

  // Orden fijo: primero quien me regala (anónimo), luego mi destinatario.
  const rank = (t: Thread) => (t.my_role === 'receiver' ? 0 : 1);
  const ordered = [...threads].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <PageHeader eyebrow="Chat anónimo" title="Mensajes" className="mb-6" />
      <div
        role="tablist"
        aria-label="Conversaciones"
        className="flex flex-col sm:flex-row gap-1 p-1 mb-4 rounded-2xl bg-stone-100 ring-1 ring-inset ring-stone-200/70"
      >
        {ordered.map(tab)}
      </div>
      <section role="tabpanel" className="card p-4 sm:p-6">
        <Conversation
          key={current.thread_id}
          eventId={event.id}
          thread={current}
          canWrite={event.status === 'published'}
        />
      </section>
    </div>
  );
}
