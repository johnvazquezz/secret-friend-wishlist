import { LogIn } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Button from '../../components/ui/Button';
import TextField from '../../components/ui/TextField';
import { getErrorMessage } from '../../lib/errors';
import { signIn } from './api';
import { fieldErrors, loginSchema } from './schemas';
import { useAuth } from './useAuth';

type Field = 'email' | 'password';

export default function LoginPage() {
  const { session } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (session) return <Navigate to={from} replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      // La redirección ocurre al cambiar la sesión (ver `if (session)` arriba).
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <h2 className="text-2xl font-bold text-stone-900">Iniciar sesión</h2>
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <TextField
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      {formError && (
        <p role="alert" className="alert-error">
          {formError}
        </p>
      )}
      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        <LogIn aria-hidden="true" className="w-4 h-4" />
        {submitting ? 'Entrando...' : 'Entrar'}
      </Button>
      <p className="text-sm text-stone-500 text-center pt-1">
        ¿No tienes cuenta o olvidaste tu contraseña? Pídesela al organizador del Amigo Secreto.
      </p>
    </form>
  );
}
