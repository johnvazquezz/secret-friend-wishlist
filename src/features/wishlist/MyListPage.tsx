import ErrorState from '../../components/ui/ErrorState';
import Spinner from '../../components/ui/Spinner';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth/useAuth';
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
      <div className="container mx-auto px-4 py-10">
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
    <div className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
      <section className="bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Mi lista de deseos</h1>
        <p className="text-sm text-gray-500 mb-4">
          Todo el equipo puede verla: así nadie sabe quién te regala. Ordénala por preferencia.
        </p>
        <WishlistEditor items={wishlist.data} />
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Mis gustos</h2>
        <PreferencesForm preferences={preferences.data} />
      </section>
    </div>
  );
}
