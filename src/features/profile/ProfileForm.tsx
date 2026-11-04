import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { getErrorMessage } from '../../lib/errors';
import type { Profile } from './api';
import { useUpdateProfile } from './hooks';
import { profileSchema } from './schemas';

interface ProfileFormProps {
  profile: Profile;
  onSaved?: () => void;
}

export default function ProfileForm({ profile, onSaved }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.full_name);
  const [department, setDepartment] = useState(profile.department ?? '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const update = useUpdateProfile(profile.id);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    const parsed = profileSchema.safeParse({ full_name: fullName, department });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError('');
    update.mutate(parsed.data, {
      onSuccess: () => {
        setSaved(true);
        onSaved?.();
      },
      onError: (err) => setError(getErrorMessage(err)),
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Nombre completo"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        maxLength={120}
        autoComplete="name"
      />
      <TextField
        label="Departamento"
        value={department}
        onChange={(e) => setDepartment(e.target.value)}
        maxLength={120}
        hint="Opcional"
      />
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {saved && <p className="text-green-700">Cambios guardados.</p>}
      <Button type="submit" disabled={update.isPending}>
        <Save aria-hidden="true" className="w-5 h-5" />
        {update.isPending ? 'Guardando...' : 'Guardar'}
      </Button>
    </form>
  );
}
