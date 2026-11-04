import Spinner from '../../components/ui/Spinner';
import type { Preferences } from './api';
import { useRecipientPreferences, useWishlist } from './hooks';
import WishlistView from './WishlistView';

interface RecipientDetailsProps {
  eventId: string;
  receiverId: string;
  firstName: string;
}

const PREFERENCE_LABELS: [keyof Preferences, string][] = [
  ['likes', 'Le gusta'],
  ['dislikes', 'No le gusta'],
  ['sizes', 'Tallas'],
  ['allergies', 'Alergias o restricciones'],
  ['notes', 'Otros detalles'],
];

/** Lista de deseos y gustos del destinatario, para inspirar el regalo. */
export default function RecipientDetails({
  eventId,
  receiverId,
  firstName,
}: RecipientDetailsProps) {
  const wishlist = useWishlist(receiverId);
  const preferences = useRecipientPreferences(eventId, true);

  if (wishlist.isPending || preferences.isPending)
    return <Spinner label="Cargando sus deseos..." />;

  const filled = PREFERENCE_LABELS.filter(([key]) => preferences.data?.[key]);

  return (
    <div className="w-full text-left space-y-6 mt-6 border-t border-gray-100 pt-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Lista de deseos de {firstName}</h3>
        <WishlistView
          items={wishlist.data ?? []}
          emptyMessage={`${firstName} todavía no ha añadido deseos. ¡Vuelve a mirar más adelante!`}
        />
      </div>
      {filled.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Sus gustos</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {filled.map(([key, label]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3">
                <dt className="text-sm text-gray-500">{label}</dt>
                <dd className="text-gray-800 whitespace-pre-wrap break-words">
                  {preferences.data![key]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
