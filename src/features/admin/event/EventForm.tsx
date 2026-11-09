import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import Button from '../../../components/ui/Button';
import TextAreaField from '../../../components/ui/TextAreaField';
import TextField from '../../../components/ui/TextField';
import { getErrorMessage } from '../../../lib/errors';
import { toDateTimeLocal } from '../../../lib/format';
import type { EventInput, EventRow } from '../../event/api';
import { parseEventForm, type EventFormValues } from '../../event/schemas';

interface EventFormProps {
  event?: EventRow;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (input: EventInput) => Promise<unknown>;
}

function initialValues(event?: EventRow): EventFormValues {
  return {
    name: event?.name ?? `Amigo Secreto ${new Date().getFullYear()}`,
    description: event?.description ?? '',
    rules: event?.rules ?? '',
    budget_amount: event?.budget_amount != null ? String(event.budget_amount) : '',
    currency: event?.currency ?? 'USD',
    location: event?.location ?? '',
    registration_deadline: toDateTimeLocal(event?.registration_deadline ?? null),
    exchange_at: toDateTimeLocal(event?.exchange_at ?? null),
  };
}

export default function EventForm({ event, submitLabel, disabled, onSubmit }: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(() => initialValues(event));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const field = (key: keyof EventFormValues) => ({
    value: values[key],
    disabled,
    onChange: (e: { target: { value: string } }) => {
      setSaved(false);
      setValues((v) => ({ ...v, [key]: e.target.value }));
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseEventForm(values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit(parsed.data);
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField label="Nombre del evento" maxLength={120} {...field('name')} />
      <TextAreaField
        label="Descripción"
        hint="Un mensaje de bienvenida para los participantes (opcional)."
        maxLength={2000}
        {...field('description')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Presupuesto"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          {...field('budget_amount')}
        />
        <TextField label="Moneda" maxLength={8} hint="Ej.: USD, EUR" {...field('currency')} />
        <TextField
          label="Fecha y hora del intercambio"
          type="datetime-local"
          {...field('exchange_at')}
        />
        <TextField
          label="Confirmar participación antes de"
          type="datetime-local"
          hint="Opcional"
          {...field('registration_deadline')}
        />
      </div>
      <TextField label="Lugar" maxLength={200} hint="Opcional" {...field('location')} />
      <TextAreaField
        label="Reglas"
        hint="Ej.: el regalo no debe superar el presupuesto, envolverlo con el nombre del destinatario…"
        maxLength={4000}
        {...field('rules')}
      />
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      {saved && <p className="alert-success">Cambios guardados.</p>}
      {!disabled && (
        <Button type="submit" disabled={submitting}>
          <Save aria-hidden="true" className="w-5 h-5" />
          {submitting ? 'Guardando...' : submitLabel}
        </Button>
      )}
    </form>
  );
}
