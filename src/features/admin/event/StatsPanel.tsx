import { BarChart3 } from 'lucide-react';
import type { EventRow } from '../../event/api';
import { useEventStats } from '../../event/hooks';

/** Participación del evento: solo conteos agregados (nunca parejas ni contenido). */
export default function StatsPanel({ event }: { event: EventRow }) {
  const { data: stats } = useEventStats(event.id);
  if (!stats) return null;

  const active = stats.invited + stats.confirmed;
  const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const chatOpen = event.status === 'published' || event.status === 'finished';

  const items = [
    {
      label: 'Con lista de deseos',
      value: `${stats.with_wishlist} de ${active}`,
      progress: pct(stats.with_wishlist, active),
    },
    {
      label: 'Con gustos completados',
      value: `${stats.with_preferences} de ${active}`,
      progress: pct(stats.with_preferences, active),
    },
    {
      label: 'Aún con contraseña temporal',
      value: String(stats.pending_password),
      hint: stats.pending_password > 0 ? 'No han entrado nunca a la app' : undefined,
    },
    ...(chatOpen
      ? [
          {
            label: 'Conversaciones iniciadas',
            value: `${stats.conversations_started} de ${stats.confirmed}`,
            progress: pct(stats.conversations_started, stats.confirmed),
          },
          { label: 'Mensajes enviados', value: String(stats.messages_total) },
        ]
      : []),
  ];

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-stone-900 mb-4">
        <BarChart3 aria-hidden="true" className="w-5 h-5 text-primary-600" />
        Participación
      </h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl bg-stone-50 ring-1 ring-inset ring-stone-200/70 p-4"
          >
            <dt className="text-xs font-medium text-stone-500">{item.label}</dt>
            <dd className="mt-1 font-display text-2xl font-bold text-stone-900 tabular-nums">
              {item.value}
            </dd>
            {item.progress !== undefined && (
              <div
                className="mt-3 h-1.5 bg-stone-200 rounded-full overflow-hidden"
                role="progressbar"
                aria-label={item.label}
                aria-valuenow={item.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary-500"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
            )}
            {item.hint && <p className="text-xs text-stone-500 mt-1">{item.hint}</p>}
          </div>
        ))}
      </dl>
      <p className="text-xs text-stone-500 mt-4">
        🔒 Solo se muestran totales: nunca quién le regala a quién ni el contenido de los mensajes.
      </p>
    </section>
  );
}
