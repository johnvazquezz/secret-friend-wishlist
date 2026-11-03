import { Trash2 } from 'lucide-react';
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
      <div className="container mx-auto px-4 py-10">
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
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Nuevo evento</h1>
        <p className="text-gray-600 mb-6">
          Crea el Amigo Secreto de este año. Quedará en borrador hasta que abras la inscripción.
        </p>
        <section className="bg-white rounded-xl shadow-lg p-6">
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

  if (participantsQuery.isPending || profilesQuery.isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (participantsQuery.isError || profilesQuery.isError) {
    return (
      <div className="container mx-auto px-4 py-10">
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

  const handleDelete = () => {
    if (!window.confirm(`¿Eliminar el borrador "${event.name}"?`)) return;
    deleteEvent.mutate();
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-800">{event.name}</h1>
        {event.status === 'draft' && (
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"
          >
            <Trash2 aria-hidden="true" className="w-4 h-4" />
            Eliminar borrador
          </button>
        )}
      </div>

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

      <section className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Datos del evento</h2>
        <EventForm
          key={event.id}
          event={event}
          submitLabel="Guardar cambios"
          onSubmit={(input) => updateEvent.mutateAsync(input)}
        />
      </section>
    </div>
  );
}
