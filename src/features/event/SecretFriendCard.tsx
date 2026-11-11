import { Eye, EyeOff, Gift, Lock, Undo2, VenetianMask } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import ConfettiDecor from '../../components/ui/ConfettiDecor';
import { toast } from '../../components/ui/toast';
import { useConfirm } from '../../components/ui/useConfirm';
import { celebrate } from '../../lib/confetti';
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
  const [confirm, confirmDialog] = useConfirm();

  const handleRelease = async () => {
    const ok = await confirm({
      title: `¿Anular el registro de ${assignment.full_name}?`,
      message: 'Podrás elegir otra vez a la persona de tu papelito.',
      confirmLabel: 'Anular registro',
      tone: 'danger',
    });
    if (!ok) return;
    setError('');
    release.mutate(undefined, {
      onSuccess: () => toast.info('Registro anulado.', 'Elige ahora a la persona de tu papelito.'),
      onError: (err) => setError(getErrorMessage(err)),
    });
  };

  return (
    <section className="card overflow-hidden">
      <div className="relative bg-primary-700 px-6 py-5 flex items-center gap-3 overflow-hidden">
        <ConfettiDecor className="opacity-60" />
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full text-white/[0.08]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="sf-dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.4" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sf-dots)" />
        </svg>
        <span className="relative w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/25 inline-flex items-center justify-center">
          <Gift aria-hidden="true" className="w-5 h-5 text-white" />
        </span>
        <h2 className="relative text-xl font-semibold text-white">Tu amigo secreto</h2>
      </div>

      <div className="p-6 sm:p-8 text-center">
        {visible ? (
          <div className="flex flex-col items-center gap-2 motion-safe:animate-pop-in">
            <p className="text-sm font-medium text-stone-500">Este año le regalas a…</p>
            <div className="relative my-3">
              <div
                aria-hidden="true"
                className="absolute -inset-2 rounded-full bg-gradient-to-tr from-primary-200 via-amber-100 to-primary-100"
              />
              <Avatar
                name={assignment.full_name}
                url={assignment.avatar_path ? urls?.[assignment.avatar_path] : null}
                size="xl"
                className="relative ring-4 ring-white"
              />
            </div>
            <p className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-stone-900">
              {assignment.full_name}
            </p>
            {assignment.department && <p className="text-stone-500">{assignment.department}</p>}
            <Link
              to="/mensajes?chat=amigo"
              className="mt-3 inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold bg-primary-50 text-primary-800 ring-1 ring-inset ring-primary-200 hover:bg-primary-100 transition-colors"
            >
              <VenetianMask aria-hidden="true" className="w-4 h-4" />
              Escríbele en secreto
            </Link>
            <RecipientDetails
              eventId={eventId}
              receiverId={assignment.receiver_id}
              firstName={assignment.full_name.split(' ')[0]}
            />
            {canChange.data && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleRelease()}
                disabled={release.isPending}
                className="mt-4 hover:!bg-red-50 hover:!text-red-700"
              >
                <Undo2 aria-hidden="true" className="w-4 h-4" />
                Me equivoqué de persona
              </Button>
            )}
            {error && (
              <p role="alert" className="alert-error mt-2">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="py-4">
            <div
              aria-hidden="true"
              className="mx-auto mb-5 w-20 h-20 rounded-3xl bg-primary-50 ring-1 ring-primary-100 inline-flex items-center justify-center"
            >
              <Gift className="w-10 h-10 text-primary-600" strokeWidth={1.5} />
            </div>
            <p className="text-stone-600 max-w-sm mx-auto">
              Asegúrate de que nadie esté mirando tu pantalla antes de mostrarlo.
            </p>
          </div>
        )}

        <Button
          variant={visible ? 'secondary' : 'primary'}
          size={visible ? 'md' : 'lg'}
          onClick={() => {
            if (!visible) window.setTimeout(celebrate, 150);
            setVisible((v) => !v);
          }}
          className="mt-6"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="w-5 h-5" />
          ) : (
            <Eye aria-hidden="true" className="w-5 h-5" />
          )}
          {visible ? 'Ocultar' : 'Mostrar a quién le regalo'}
        </Button>

        <p className="mt-6 inline-flex items-start gap-2 text-left text-sm text-stone-500 bg-stone-50 rounded-xl px-4 py-3">
          <Lock aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-stone-400" />
          <span>
            Es un secreto: nadie más puede verlo, ni siquiera los organizadores. No se lo cuentes a
            nadie.
          </span>
        </p>
      </div>
      {confirmDialog}
    </section>
  );
}
