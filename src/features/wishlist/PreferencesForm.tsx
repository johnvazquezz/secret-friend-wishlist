import { Lock, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import Button from '../../components/ui/Button';
import TextAreaField from '../../components/ui/TextAreaField';
import TextField from '../../components/ui/TextField';
import { getErrorMessage } from '../../lib/errors';
import type { Preferences } from './api';
import { useSavePreferences } from './hooks';
import { parsePreferences, type PreferencesFormValues } from './schemas';

function initial(p: Preferences | null): PreferencesFormValues {
  return {
    likes: p?.likes ?? '',
    dislikes: p?.dislikes ?? '',
    sizes: p?.sizes ?? '',
    allergies: p?.allergies ?? '',
    notes: p?.notes ?? '',
  };
}

export default function PreferencesForm({ preferences }: { preferences: Preferences | null }) {
  const save = useSavePreferences();
  const [values, setValues] = useState(() => initial(preferences));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const field = (key: keyof PreferencesFormValues) => ({
    value: values[key],
    onChange: (e: { target: { value: string } }) => {
      setSaved(false);
      setValues((v) => ({ ...v, [key]: e.target.value }));
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parsePreferences(values);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError('');
    save.mutate(parsed.data, {
      onSuccess: () => setSaved(true),
      onError: (err) => setError(getErrorMessage(err)),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
        <Lock aria-hidden="true" className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
        Solo lo verá la persona que te regale, cuando se publique el sorteo.
      </p>
      <TextAreaField
        label="Me gusta"
        placeholder="Café, series de misterio, plantas…"
        maxLength={1000}
        {...field('likes')}
      />
      <TextAreaField
        label="No me gusta"
        placeholder="Perfumes fuertes, chocolate blanco…"
        maxLength={1000}
        {...field('dislikes')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Tallas"
          placeholder="Camiseta M, zapato 40…"
          maxLength={300}
          {...field('sizes')}
        />
        <TextField
          label="Alergias o restricciones"
          placeholder="Nueces, lactosa…"
          maxLength={300}
          {...field('allergies')}
        />
      </div>
      <TextAreaField label="Otros detalles" maxLength={1000} {...field('notes')} />
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {saved && <p className="text-green-700">Gustos guardados.</p>}
      <Button type="submit" disabled={save.isPending}>
        <Save aria-hidden="true" className="w-5 h-5" />
        {save.isPending ? 'Guardando...' : 'Guardar mis gustos'}
      </Button>
    </form>
  );
}
