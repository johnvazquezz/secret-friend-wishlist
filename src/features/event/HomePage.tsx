import { CalendarDays, Clock, MapPin, ScrollText, Sparkles, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Card, { CardHeader } from '../../components/ui/Card';
import ConfettiDecor from '../../components/ui/ConfettiDecor';
import CountdownDisplay from '../../components/ui/CountdownDisplay';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Spinner from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatMoney } from '../../lib/format';
import { useAuth } from '../auth/useAuth';
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
      <div className="mx-auto max-w-6xl w-full px-4 py-12">
        <ErrorState
          message={`No se pudo cargar el evento. ${getErrorMessage(eventQuery.error ?? participationQuery.error)}`}
          onRetry={() => void eventQuery.refetch()}
        />
      </div>
    );
  }

  if (!event || event.status === 'draft') {
    return (
      <div className="mx-auto max-w-xl w-full px-4 py-16">
        <h1 className="sr-only">Amigo Secreto</h1>
        <EmptyState
          icon={<Sparkles />}
          title="Muy pronto"
          message="Todavía no hay un Amigo Secreto en marcha. ¡Pronto habrá novedades!"
          action={
            isAdmin && (
              <Link to="/admin/evento" className="link">
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
  const showDeadline = !!event.registration_deadline && event.status === 'open';
  const hasInfo =
    !!event.exchange_at || event.budget_amount != null || !!event.location || showDeadline;
  const year = event.exchange_at ? new Date(event.exchange_at).getFullYear() : null;

  return (
    <div className="mx-auto max-w-3xl w-full px-4 py-8 sm:py-12 space-y-5">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-primary-50 ring-1 ring-primary-100 px-6 py-10 sm:px-10 sm:py-12 text-center">
        <ConfettiDecor />
        <Sparkles
          aria-hidden="true"
          className="absolute right-6 top-6 w-6 h-6 text-amber-400 motion-safe:animate-pulse"
        />
        <p className="eyebrow mb-3">Amigo Secreto{year ? ` ${year}` : ''}</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-stone-900 text-balance">{event.name}</h1>
        {event.description && (
          <p className="mt-4 text-lg text-stone-600 whitespace-pre-wrap max-w-xl mx-auto">
            {event.description}
          </p>
        )}
        {event.exchange_at && (
          <div className="mt-8">
            <CountdownDisplay target={event.exchange_at} />
          </div>
        )}
      </header>

      {assignment ? (
        <SecretFriendCard assignment={assignment} eventId={event.id} />
      ) : (
        <ParticipationPanel event={event} status={participation} />
      )}

      {hasInfo && (
        <section
          aria-label="Datos del intercambio"
          className="grid gap-3 grid-cols-1 sm:grid-cols-2"
        >
          {event.exchange_at && (
            <Info icon={<CalendarDays />} label="Intercambio">
              {formatDateTime(event.exchange_at)}
            </Info>
          )}
          {event.budget_amount != null && (
            <Info icon={<Wallet />} label="Presupuesto">
              {formatMoney(event.budget_amount, event.currency)}
            </Info>
          )}
          {event.location && (
            <Info icon={<MapPin />} label="Lugar">
              {event.location}
            </Info>
          )}
          {showDeadline && (
            <Info icon={<Clock />} label="Confirma antes de">
              {formatDateTime(event.registration_deadline!)}
            </Info>
          )}
        </section>
      )}

      {event.rules && (
        <Card>
          <CardHeader icon={<ScrollText />} title="Reglas" className="mb-3" />
          <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{event.rules}</p>
        </Card>
      )}
    </div>
  );
}

function Info({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <span
        aria-hidden="true"
        className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 inline-flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
        <p className="text-stone-900 font-semibold">{children}</p>
      </div>
    </div>
  );
}
