import { Gift, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/ui/Avatar';
import ErrorState from '../../components/ui/ErrorState';
import Spinner from '../../components/ui/Spinner';
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
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (profiles.isError || wishlists.isError) {
    return (
      <div className="container mx-auto px-4 py-12">
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

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="text-center mb-10">
        <div className="flex items-center justify-center gap-4 mb-4" aria-hidden="true">
          <Sparkles className="w-10 h-10 text-primary animate-pulse" />
          <Gift className="w-14 h-14 text-primary" />
          <Sparkles className="w-10 h-10 text-primary animate-pulse" />
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 mb-4">Deseos del equipo</h1>
        <p className="text-lg text-gray-600">
          {withWishes} de {active.length} personas ya compartieron sus deseos.{' '}
          <Link to="/mi-lista" className="text-primary font-semibold underline">
            Edita la tuya
          </Link>
        </p>
      </header>

      <div className="relative mb-8 max-w-md mx-auto">
        <Search
          aria-hidden="true"
          className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
        />
        <input
          type="search"
          aria-label="Buscar persona"
          placeholder="Buscar por nombre o departamento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none bg-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {visible.map((p) => (
          <article
            key={p.id}
            className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow flex flex-col"
          >
            <div className="bg-gradient-to-r from-primary to-primary-dark px-5 py-3 flex items-center gap-3">
              <Avatar
                name={p.full_name}
                url={p.avatar_path ? urls?.[p.avatar_path] : null}
                className="ring-2 ring-white/50"
              />
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-white truncate">
                  {p.full_name}
                  {p.id === me?.id && <span className="text-white/70 font-normal"> (tú)</span>}
                </h2>
                {p.department && <p className="text-white/80 text-sm">{p.department}</p>}
              </div>
            </div>
            <div className="p-5 flex-1">
              <WishlistView items={wishlists.data[p.id] ?? []} />
            </div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="text-gray-600 text-center py-8">Nadie coincide con la búsqueda.</p>
      )}
    </div>
  );
}
