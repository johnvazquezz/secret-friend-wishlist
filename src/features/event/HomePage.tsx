import { CalendarDays, Clock, MapPin, ScrollText, Sparkles, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import CountdownDisplay from '../../components/ui/CountdownDisplay';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Spinner from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatMoney } from '../../lib/format';
import { useAuth } from '../auth/useAuth';
import ClaimRecipientPanel from './ClaimRecipientPanel';
import { useActiveEvent, useMyAssignment, useMyParticipation } from './hooks';
import ParticipationPanel from './ParticipationPanel';
import SecretFriendCard from './SecretFriendCard';

export default function HomePage() {
  const { profile, isAdmin } = useAuth();
  const eventQuery = useActiveEvent();
  const event = eventQuery.data ?? null;
  const participationQuery = useMyParticipation(event?.id, profile?.id);
  const assignmentQuery = useMyAssignment(event?.id, event?.status);

  if (eventQuery.isPending || (event && participationQuery.isPending)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (eventQuery.isError || participationQuery.isError) {
    return (
      <div className="container mx-auto px-4 py-12">
        <ErrorState
          message={`No se pudo cargar el evento. ${getErrorMessage(eventQuery.error ?? participationQuery.error)}`}
          onRetry={() => void eventQuery.refetch()}
        />
      </div>
    );
  }

  if (!event || event.status === 'draft') {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Sparkles aria-hidden="true" className="w-14 h-14 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Amigo Secreto</h1>
        <EmptyState
          message="Todavía no hay un Amigo Secreto en marcha. ¡Pronto habrá novedades!"
          action={
            isAdmin && (
              <Link to="/admin/evento" className="text-primary font-semibold underline">
                {event ? 'Continuar configurando el evento' : 'Crear el evento'}
              </Link>
            )
          }
        />
      </div>
    );
  }

  const participation = participationQuery.data ?? null;
  const assignment = assignmentQuery.data ?? null;
  const isManual = event.draw_mode === 'manual';
  const showDeadline = !!event.registration_deadline && event.status === 'open';
  const hasInfo =
    !!event.exchange_at || event.budget_amount != null || !!event.location || showDeadline;

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
      <header className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-3">{event.name}</h1>
        {event.description && (
          <p className="text-lg text-gray-600 whitespace-pre-wrap">{event.description}</p>
        )}
      </header>

      {event.exchange_at && <CountdownDisplay target={event.exchange_at} />}

      {assignment ? (
        <SecretFriendCard
          assignment={assignment}
          eventId={event.id}
          canRelease={isManual && event.status === 'published'}
        />
      ) : isManual && event.status === 'published' && participation === 'confirmed' ? (
        assignmentQuery.isPending ? (
          <Spinner />
        ) : (
          <ClaimRecipientPanel eventId={event.id} myId={profile!.id} />
        )
      ) : (
        <ParticipationPanel event={event} status={participation} />
      )}

      {hasInfo && (
        <section className="bg-white rounded-2xl shadow-lg p-6 grid gap-4 sm:grid-cols-2">
          {event.exchange_at && (
            <Info icon={<CalendarDays className="w-5 h-5" />} label="Intercambio">
              {formatDateTime(event.exchange_at)}
            </Info>
          )}
          {event.budget_amount != null && (
            <Info icon={<Wallet className="w-5 h-5" />} label="Presupuesto">
              {formatMoney(event.budget_amount, event.currency)}
            </Info>
          )}
          {event.location && (
            <Info icon={<MapPin className="w-5 h-5" />} label="Lugar">
              {event.location}
            </Info>
          )}
          {showDeadline && (
            <Info icon={<Clock className="w-5 h-5" />} label="Confirma antes de">
              {formatDateTime(event.registration_deadline!)}
            </Info>
          )}
        </section>
      )}

      {event.rules && (
        <section className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-3">
            <ScrollText aria-hidden="true" className="w-5 h-5 text-primary" />
            Reglas
          </h2>
          <p className="text-gray-700 whitespace-pre-wrap">{event.rules}</p>
        </section>
      )}
    </div>
  );
}

function Info({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span aria-hidden="true" className="text-primary mt-0.5">
        {icon}
      </span>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-gray-800 font-medium">{children}</p>
      </div>
    </div>
  );
}
