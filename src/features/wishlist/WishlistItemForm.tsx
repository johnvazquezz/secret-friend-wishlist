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
    url: item?.url ?? '',
    notes: item?.notes ?? '',
    price_hint: item?.price_hint != null ? String(item.price_hint) : '',
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
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <TextField
        label="¿Qué te gustaría?"
        placeholder="Ej.: Un libro de cocina italiana"
        maxLength={120}
        value={values.title}
        onChange={set('title')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Enlace (opcional)"
          type="url"
          placeholder="https://…"
          maxLength={500}
          value={values.url}
          onChange={set('url')}
        />
        <TextField
          label="Precio aproximado (opcional)"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={values.price_hint}
          onChange={set('price_hint')}
        />
      </div>
      <TextField
        label="Detalles (opcional)"
        placeholder="Color, talla, modelo…"
        maxLength={500}
        value={values.notes}
        onChange={set('notes')}
      />
      <div>
        <label htmlFor={priorityId} className="block text-gray-700 font-medium mb-2">
          Prioridad
        </label>
        <select
          id={priorityId}
          value={values.priority}
          onChange={set('priority')}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary focus:outline-none bg-white"
        >
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
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
