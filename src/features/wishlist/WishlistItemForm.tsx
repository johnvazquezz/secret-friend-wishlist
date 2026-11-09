import { useId, useState, type FormEvent } from 'react';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { getErrorMessage } from '../../lib/errors';
import type { WishlistItem, WishlistItemInput } from './api';
import { parseWishlistItem, PRIORITY_LABELS, type WishlistItemFormValues } from './schemas';

interface WishlistItemFormProps {
  item?: WishlistItem;
  submitLabel: string;
  onSubmit: (input: WishlistItemInput) => Promise<unknown>;
  onCancel?: () => void;
}

function initial(item?: WishlistItem): WishlistItemFormValues {
  return {
    title: item?.title ?? '',
    notes: item?.notes ?? '',
    priority: String(item?.priority ?? 2),
  };
}

export default function WishlistItemForm({
  item,
  submitLabel,
  onSubmit,
  onCancel,
}: WishlistItemFormProps) {
  const priorityId = useId();
  const [values, setValues] = useState(() => initial(item));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof WishlistItemFormValues) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseWishlistItem(values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
      if (!item) setValues(initial());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="¿Qué te gustaría?"
        placeholder="Ej.: Un libro de cocina italiana"
        maxLength={120}
        value={values.title}
        onChange={set('title')}
      />
      <TextField
        label="Detalles (opcional)"
        placeholder="Color, talla, modelo…"
        maxLength={500}
        value={values.notes}
        onChange={set('notes')}
      />
      <div>
        <label htmlFor={priorityId} className="block text-sm font-medium text-stone-700 mb-1.5">
          Prioridad
        </label>
        <select
          id={priorityId}
          value={values.priority}
          onChange={set('priority')}
          className="input-base h-11 py-0"
        >
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
