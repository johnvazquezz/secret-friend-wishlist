import { Navigate, Outlet, useLocation } from 'react-router-dom';
import ErrorState from '../../components/ui/ErrorState';
import Spinner from '../../components/ui/Spinner';
import { useAuth } from './useAuth';

export const CHANGE_PASSWORD_PATH = '/cambiar-contrasena';

/** Exige sesión. Si la contraseña es temporal, obliga a cambiarla antes de seguir. */
export function RequireAuth() {
  const { session, profile, isLoading, profileError, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!profile || !profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorState
          message={
            profileError
              ? 'No se pudo cargar tu perfil.'
              : 'Tu cuenta no está activa. Contacta con el organizador.'
          }
          onRetry={() => void signOut()}
          retryLabel="Cerrar sesión"
        />
      </div>
    );
  }

  if (profile.must_change_password && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }

  return <Outlet />;
}

export function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}
