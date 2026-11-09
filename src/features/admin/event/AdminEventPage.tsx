import { Trash2 } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { useConfirm } from '../../../components/ui/useConfirm';
import ErrorState from '../../../components/ui/ErrorState';
import Spinner from '../../../components/ui/Spinner';
import { getErrorMessage } from '../../../lib/errors';
import type { EventRow } from '../../event/api';
import {
  useActiveEvent,
  useCreateEvent,
  useDeleteEvent,
  useParticipants,
  useUpdateEvent,
} from '../../event/hooks';
import { useProfiles } from '../../profile/hooks';
import AnnouncementSection from './AnnouncementSection';
import EventForm from './EventForm';
import ExclusionsSection from './ExclusionsSection';
import LifecyclePanel from './LifecyclePanel';
import ParticipantsSection from './ParticipantsSection';
import StatsPanel from './StatsPanel';

export default function AdminEventPage() {
  const eventQuery = useActiveEvent();
  const createEvent = useCreateEvent();

  if (eventQuery.isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (eventQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ErrorState
          message={`No se pudo cargar el evento. ${getErrorMessage(eventQuery.error)}`}
          onRetry={() => void eventQuery.refetch()}
        />
      </div>
    );
  }

  const event = eventQuery.data;

  if (!event) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <PageHeader
          eyebrow="Administración"
          title="Nuevo evento"
          description="Crea el Amigo Secreto de este año. Quedará en borrador hasta que abras la inscripción."
        />
        <section className="card p-5 sm:p-6">
          <EventForm
            submitLabel="Crear evento"
            onSubmit={(input) => createEvent.mutateAsync(input)}
          />
        </section>
      </div>
    );
  }

  return <ManageEvent event={event} />;
}

function ManageEvent({ event }: { event: EventRow }) {
  const participantsQuery = useParticipants(event.id);
  const profilesQuery = useProfiles();
  const updateEvent = useUpdateEvent(event.id);
  const deleteEvent = useDeleteEvent(event.id);
  const editable = event.status === 'draft' || event.status === 'open';
  const [confirm, confirmDialog] = useConfirm();

  if (participantsQuery.isPending || profilesQuery.isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (participantsQuery.isError || profilesQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ErrorState
          message="No se pudieron cargar los participantes."
          onRetry={() => {
            void participantsQuery.refetch();
            void profilesQuery.refetch();
          }}
        />
      </div>
    );
  }

  const participants = participantsQuery.data;

  const handleDelete = async () => {
    const ok = await confirm({
      title: `¿Eliminar el borrador "${event.name}"?`,
      message: 'Se borrarán el evento, su lista de participantes y las exclusiones.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (ok) deleteEvent.mutate();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12 space-y-5">
      <PageHeader
        eyebrow="Administración del evento"
        title={event.name}
        className="!mb-3"
        actions={
          event.status === 'draft' && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-stone-600 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <Trash2 aria-hidden="true" className="w-4 h-4" />
              Eliminar borrador
            </button>
          )
        }
      />

      <LifecyclePanel event={event} participants={participants} />

      {event.status !== 'draft' && <StatsPanel event={event} />}

      <ParticipantsSection
        event={event}
        participants={participants}
        profiles={profilesQuery.data}
        editable={editable}
      />

      <ExclusionsSection event={event} participants={participants} editable={editable} />

      <AnnouncementSection />

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">Datos del evento</h2>
        <EventForm
          key={event.id}
          event={event}
          submitLabel="Guardar cambios"
          onSubmit={(input) => updateEvent.mutateAsync(input)}
        />
      </section>
      {confirmDialog}
    </div>
  );
}
