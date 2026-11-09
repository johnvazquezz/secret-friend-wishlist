import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { getErrorMessage } from '../../lib/errors';
import { profileKeys } from '../profile/hooks';
import { changePassword } from './api';
import { fieldErrors, newPasswordSchema } from './schemas';
import { useAuth } from './useAuth';

type Field = 'password' | 'confirm';

export default function ChangePasswordPage() {
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const forced = profile?.must_change_password ?? false;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const parsed = newPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await changePassword(parsed.data.password);
      await queryClient.invalidateQueries({ queryKey: profileKeys.all });
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <h2 className="text-2xl font-bold text-stone-900">Cambiar contraseña</h2>
      {forced && (
        <p className="text-sm bg-primary-50 ring-1 ring-inset ring-primary-200 rounded-xl px-3.5 py-3 text-primary-900">
          Hola{profile ? `, ${profile.full_name}` : ''}. Estás usando una contraseña temporal: elige
          una nueva para continuar.
        </p>
      )}
      <TextField
        label="Nueva contraseña"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint="Mínimo 10 caracteres, con letras y números."
      />
      <TextField
        label="Repite la contraseña"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={errors.confirm}
      />
      {formError && (
        <p role="alert" className="alert-error">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        <KeyRound aria-hidden="true" className="w-4 h-4" />
        {submitting ? 'Guardando...' : 'Guardar contraseña'}
      </Button>
      <div className="text-center text-sm">
        {forced ? (
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-stone-500 hover:text-stone-900 underline underline-offset-4"
          >
            Cerrar sesión
          </button>
        ) : (
          <Link
            to="/perfil"
            className="text-stone-500 hover:text-stone-900 underline underline-offset-4"
          >
            Cancelar
          </Link>
        )}
      </div>
    </form>
  );
}
