import { Eye, EyeOff, Gift, Undo2 } from 'lucide-react';
import { useState } from 'react';
import Avatar from '../../components/ui/Avatar';
import { getErrorMessage } from '../../lib/errors';
import { useAvatarUrls } from '../profile/hooks';
import RecipientDetails from '../wishlist/RecipientDetails';
import type { MyAssignment } from './api';
import { useCanChangeMyClaim, useReleaseMyClaim } from './hooks';

interface SecretFriendCardProps {
  assignment: MyAssignment;
  eventId: string;
  /** Sorteo con papelitos: permite deshacer el registro mientras no haya mensajes. */
  canRelease?: boolean;
}

/** Muestra a quién le regala el usuario. Oculto por defecto para evitar miradas indiscretas. */
export default function SecretFriendCard({
  assignment,
  eventId,
  canRelease = false,
}: SecretFriendCardProps) {
  const [visible, setVisible] = useState(false);
  const { data: urls } = useAvatarUrls(visible ? [assignment.avatar_path] : []);
  const canChange = useCanChangeMyClaim(eventId, canRelease && visible);
  const release = useReleaseMyClaim(eventId);
  const [error, setError] = useState('');

  const handleRelease = () => {
    if (!window.confirm(`¿Anular el registro de ${assignment.full_name} y elegir otra persona?`))
      return;
    setError('');
    release.mutate(undefined, { onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <section className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 py-4 flex items-center gap-3">
        <Gift aria-hidden="true" className="w-7 h-7 text-white" />
        <h2 className="text-2xl font-bold text-white">Tu amigo secreto</h2>
      </div>
      <div className="p-6 text-center">
        {visible ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-gray-600">Este año le regalas a…</p>
            <Avatar
              name={assignment.full_name}
              url={assignment.avatar_path ? urls?.[assignment.avatar_path] : null}
              size="lg"
            />
            <p className="text-3xl font-bold text-gray-800">{assignment.full_name}</p>
            {assignment.department && <p className="text-gray-500">{assignment.department}</p>}
            <RecipientDetails
              eventId={eventId}
              receiverId={assignment.receiver_id}
              firstName={assignment.full_name.split(' ')[0]}
            />
            {canChange.data && (
              <button
                type="button"
                onClick={handleRelease}
                disabled={release.isPending}
                className="mt-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"
              >
                <Undo2 aria-hidden="true" className="w-4 h-4" />
                Me equivoqué de persona
              </button>
            )}
            {error && (
              <p role="alert" className="text-red-600">
                {error}
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-600 py-6">
            Asegúrate de que nadie esté mirando tu pantalla antes de mostrarlo.
          </p>
        )}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="mt-6 inline-flex items-center gap-2 font-medium text-primary hover:text-primary-dark"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="w-5 h-5" />
          ) : (
            <Eye aria-hidden="true" className="w-5 h-5" />
          )}
          {visible ? 'Ocultar' : 'Mostrar a quién le regalo'}
        </button>
        <p className="mt-4 text-sm text-gray-500">
          🤫 Es un secreto: nadie más puede verlo, ni siquiera los organizadores. No se lo cuentes a
          nadie.
        </p>
      </div>
    </section>
  );
}
