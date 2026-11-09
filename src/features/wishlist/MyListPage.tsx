import { ListChecks, Lock } from 'lucide-react';
import Card, { CardHeader } from '../../components/ui/Card';
import ErrorState from '../../components/ui/ErrorState';
import PageHeader from '../../components/ui/PageHeader';
import Spinner from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth/useAuth';
import { MAX_WISHLIST_ITEMS } from './api';
import { useMyPreferences, useWishlist } from './hooks';
import PreferencesForm from './PreferencesForm';
import WishlistEditor from './WishlistEditor';

export default function MyListPage() {
  const { profile } = useAuth();
  const wishlist = useWishlist(profile?.id);
  const preferences = useMyPreferences();

  if (wishlist.isPending || preferences.isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (wishlist.isError || preferences.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ErrorState
          message={`No se pudo cargar tu lista. ${getErrorMessage(wishlist.error ?? preferences.error)}`}
          onRetry={() => {
            void wishlist.refetch();
            void preferences.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <PageHeader
        eyebrow="Tu espacio"
        title="Mi lista de deseos"
        description="Todo el equipo puede verla: así nadie sabe quién te regala. Ordénala por preferencia."
      />
      <div className="space-y-5">
        <Card>
          <CardHeader
            icon={<ListChecks />}
            title="Deseos"
            description={`${wishlist.data.length} de ${MAX_WISHLIST_ITEMS} · visibles para todo el equipo`}
          />
          <WishlistEditor items={wishlist.data} />
        </Card>

        <Card>
          <CardHeader
            icon={<Lock />}
            title="Mis gustos"
            description="Solo los verá quien te regale."
          />
          <PreferencesForm preferences={preferences.data} />
        </Card>
      </div>
    </div>
  );
}
