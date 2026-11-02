import { UserMinus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import Avatar from '../../../components/ui/Avatar';
import Button from '../../../components/ui/Button';
import { getErrorMessage } from '../../../lib/errors';
import type { EventRow, Participant, ParticipationStatus } from '../../event/api';
import { useAddParticipants, useRemoveParticipant, useSetParticipation } from '../../event/hooks';
import type { Profile } from '../../profile/api';
import { useAvatarUrls } from '../../profile/hooks';

const STATUS_LABELS: Record<ParticipationStatus, string> = {
  invited: 'Sin responder',
  confirmed: 'Confirmado',
  declined: 'No participa',
};

interface ParticipantsSectionProps {
  event: EventRow;
  participants: Participant[];
  profiles: Profile[];
  editable: boolean;
}

export default function ParticipantsSection({
  event,
  participants,
  profiles,
  editable,
}: ParticipantsSectionProps) {
  const add = useAddParticipants(event.id);
  const remove = useRemoveParticipant(event.id);
  const setStatus = useSetParticipation(event.id);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const { data: urls } = useAvatarUrls(participants.map((p) => p.profile?.avatar_path));

  const participantIds = new Set(participants.map((p) => p.user_id));
  const candidates = profiles.filter((p) => p.is_active && !participantIds.has(p.id));
  const onError = (err: unknown) => setError(getErrorMessage(err));

  const addAll = () => {
    setError('');
    add.mutate(
      candidates.map((p) => p.id),
      { onError },
    );
  };

  const addOne = () => {
    if (!selected) return;
    setError('');
    add.mutate([selected], { onSuccess: () => setSelected(''), onError });
  };

  return (
    <section className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-800">
          Participantes <span className="text-gray-500 font-normal">({participants.length})</span>
        </h2>
        {editable && candidates.length > 0 && (
          <Button variant="secondary" onClick={addAll} disabled={add.isPending}>
            <UsersRound aria-hidden="true" className="w-5 h-5" />
            Agregar a todos ({candidates.length})
          </Button>
        )}
      </div>

      {editable && candidates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Persona a agregar"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none bg-white"
          >
            <option value="">Elegir persona…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} — {p.email}
              </option>
            ))}
          </select>
          <Button onClick={addOne} disabled={!selected || add.isPending}>
            Agregar
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}

      {participants.length === 0 ? (
        <p className="text-gray-600">Aún no hay participantes en la lista.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {participants.map((p) => {
            const name = p.profile?.full_name ?? 'Usuario eliminado';
            return (
              <li key={p.user_id} className="py-3 flex flex-wrap items-center gap-3">
                <Avatar
                  name={name}
                  url={p.profile?.avatar_path ? urls?.[p.profile.avatar_path] : null}
                  size="sm"
                />
                <div className="flex-1 min-w-40">
                  <p className="font-medium text-gray-800">
                    {name}
                    {p.profile && !p.profile.is_active && (
                      <span className="text-xs text-gray-500"> (cuenta inactiva)</span>
                    )}
                  </p>
                  {p.profile?.department && (
                    <p className="text-sm text-gray-500">{p.profile.department}</p>
                  )}
                </div>
                {editable ? (
                  <>
                    <select
                      aria-label={`Estado de ${name}`}
                      value={p.status}
                      onChange={(e) =>
                        setStatus.mutate(
                          { userId: p.user_id, status: e.target.value as ParticipationStatus },
                          { onError },
                        )
                      }
                      className="px-2 py-1 border-2 border-gray-200 rounded-lg text-sm bg-white"
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => remove.mutate(p.user_id, { onError })}
                      aria-label={`Quitar a ${name}`}
                      title="Quitar de la lista"
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <UserMinus aria-hidden="true" className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-gray-600">{STATUS_LABELS[p.status]}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
