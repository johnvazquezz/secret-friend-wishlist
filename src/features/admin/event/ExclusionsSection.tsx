import { Ban, X } from 'lucide-react';
import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { getErrorMessage } from '../../../lib/errors';
import type { EventRow, Participant } from '../../event/api';
import { useAddExclusion, useExclusions, useRemoveExclusion } from '../../event/hooks';

interface ExclusionsSectionProps {
  event: EventRow;
  participants: Participant[];
  editable: boolean;
}

/** Parejas que no pueden tocarse entre sí (p. ej. pareja sentimental o mismo hogar). */
export default function ExclusionsSection({
  event,
  participants,
  editable,
}: ExclusionsSectionProps) {
  const { data: exclusions = [] } = useExclusions(event.id);
  const add = useAddExclusion(event.id);
  const remove = useRemoveExclusion(event.id);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState('');

  const nameOf = (id: string) =>
    participants.find((p) => p.user_id === id)?.profile?.full_name ?? 'Persona fuera de la lista';
  const options = participants.filter((p) => p.profile);
  const onError = (err: unknown) => setError(getErrorMessage(err));

  const submit = () => {
    setError('');
    add.mutate(
      { a, b },
      {
        onSuccess: () => {
          setA('');
          setB('');
        },
        onError,
      },
    );
  };

  const select = (value: string, onChange: (v: string) => void, label: string, exclude: string) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 min-w-40 px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none bg-white"
    >
      <option value="">{label}…</option>
      {options
        .filter((p) => p.user_id !== exclude)
        .map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.profile!.full_name}
          </option>
        ))}
    </select>
  );

  return (
    <section className="bg-white rounded-xl shadow-lg p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Exclusiones</h2>
        <p className="text-sm text-gray-500">
          Personas que no pueden tocarse entre sí en ningún sentido (opcional).
        </p>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          {select(a, setA, 'Persona A', b)}
          <span className="text-gray-500">y</span>
          {select(b, setB, 'Persona B', a)}
          <Button onClick={submit} disabled={!a || !b || add.isPending}>
            <Ban aria-hidden="true" className="w-5 h-5" />
            Excluir
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}

      {exclusions.length === 0 ? (
        <p className="text-gray-600">Sin exclusiones.</p>
      ) : (
        <ul className="space-y-2">
          {exclusions.map((x) => (
            <li
              key={`${x.user_a}-${x.user_b}`}
              className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2"
            >
              <span className="text-gray-800">
                {nameOf(x.user_a)} <span className="text-gray-500">↮</span> {nameOf(x.user_b)}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => remove.mutate(x, { onError })}
                  aria-label={`Quitar exclusión entre ${nameOf(x.user_a)} y ${nameOf(x.user_b)}`}
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <X aria-hidden="true" className="w-5 h-5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
