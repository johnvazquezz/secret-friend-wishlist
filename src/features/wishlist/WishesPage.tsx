import { Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import { Skeleton } from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth/useAuth';
import { useAvatarUrls, useProfiles } from '../profile/hooks';
import { useAllWishlists } from './hooks';
import WishlistView from './WishlistView';

/** Las listas de deseos de todo el equipo (reemplaza a la antigua página de tarjetas). */
export default function WishesPage() {
  const { profile: me } = useAuth();
  const profiles = useProfiles();
  const wishlists = useAllWishlists();
  const [query, setQuery] = useState('');
  const active = (profiles.data ?? []).filter((p) => p.is_active);
  const { data: urls } = useAvatarUrls(active.map((p) => p.avatar_path));

  if (profiles.isPending || wishlists.isPending) {
    return (
      <div role="status" className="mx-auto w-full max-w-6xl px-4 py-12">
        <span className="sr-only">Cargando...</span>
        <Skeleton className="h-10 w-72 mb-3" />
        <Skeleton className="h-5 w-96 max-w-full mb-10" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }
  if (profiles.isError || wishlists.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12">
        <ErrorState
          message={`No se pudieron cargar los deseos. ${getErrorMessage(profiles.error ?? wishlists.error)}`}
          onRetry={() => {
            void profiles.refetch();
            void wishlists.refetch();
          }}
        />
      </div>
    );
  }

  const normalized = query.trim().toLowerCase();
  const visible = active
    .filter(
      (p) =>
        !normalized ||
        p.full_name.toLowerCase().includes(normalized) ||
        (p.department ?? '').toLowerCase().includes(normalized),
    )
    // Primero quien ya tiene deseos
    .sort(
      (a, b) =>
        Number(!!wishlists.data[b.id]?.length) - Number(!!wishlists.data[a.id]?.length) ||
        a.full_name.localeCompare(b.full_name, 'es'),
    );
  const withWishes = active.filter((p) => wishlists.data[p.id]?.length).length;
  const progress = active.length ? Math.round((withWishes / active.length) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <PageHeader
        eyebrow="Inspiración"
        title="Deseos del equipo"
        description={
          <>
            {withWishes} de {active.length} personas ya compartieron sus deseos.{' '}
            <Link to="/mi-lista" className="link">
              Edita la tuya
            </Link>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="relative w-full sm:max-w-sm">
          <Search
            aria-hidden="true"
            className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2"
          />
          <input
            type="search"
            aria-label="Buscar persona"
            placeholder="Buscar por nombre o departamento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-base h-11 py-0 pl-10"
          />
        </div>
        <div className="flex items-center gap-3 sm:ml-auto sm:w-64" aria-hidden="true">
          <div className="h-1.5 flex-1 rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full rounded-full bg-primary-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-medium text-stone-600 tabular-nums">{progress}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visible.map((p) => {
          const items = wishlists.data[p.id] ?? [];
          return (
            <article key={p.id} className="card flex flex-col transition-shadow hover:shadow-lift">
              <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-stone-100">
                <Avatar name={p.full_name} url={p.avatar_path ? urls?.[p.avatar_path] : null} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-stone-900 truncate">
                    {p.full_name}
                    {p.id === me?.id && <span className="text-stone-400 font-normal"> (tú)</span>}
                  </h2>
                  {p.department && (
                    <p className="text-stone-500 text-sm truncate">{p.department}</p>
                  )}
                </div>
                {items.length > 0 && (
                  <Badge tone="primary">
                    {items.length} {items.length === 1 ? 'deseo' : 'deseos'}
                  </Badge>
                )}
              </div>
              <div className="p-5 flex-1">
                <WishlistView items={items} />
              </div>
            </article>
          );
        })}
      </div>
      {visible.length === 0 && (
        <p className="text-stone-500 text-center py-12">Nadie coincide con la búsqueda.</p>
      )}
    </div>
  );
}
