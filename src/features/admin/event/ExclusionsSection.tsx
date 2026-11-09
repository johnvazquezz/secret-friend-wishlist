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
      className="flex-1 min-w-40 input-base w-auto h-11 py-0"
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
    <section className="card p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">Exclusiones</h2>
        <p className="text-sm text-stone-500">
          Personas que no pueden tocarse entre sí en ningún sentido (opcional).
        </p>
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          {select(a, setA, 'Persona A', b)}
          <span className="text-stone-500">y</span>
          {select(b, setB, 'Persona B', a)}
          <Button onClick={submit} disabled={!a || !b || add.isPending}>
            <Ban aria-hidden="true" className="w-5 h-5" />
            Excluir
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}

      {exclusions.length === 0 ? (
        <p className="text-stone-600">Sin exclusiones.</p>
      ) : (
        <ul className="space-y-2">
          {exclusions.map((x) => (
            <li
              key={`${x.user_a}-${x.user_b}`}
              className="flex items-center justify-between gap-3 bg-stone-50 rounded-lg px-3 py-2"
            >
              <span className="text-stone-900">
                {nameOf(x.user_a)} <span className="text-stone-500">↮</span> {nameOf(x.user_b)}
              </span>
              {editable && (
                <button
                  type="button"
                  onClick={() => remove.mutate(x, { onError })}
                  aria-label={`Quitar exclusión entre ${nameOf(x.user_a)} y ${nameOf(x.user_b)}`}
                  className="icon-btn hover:!text-red-600 hover:!bg-red-50"
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
