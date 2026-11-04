import { useRouteError } from 'react-router-dom';
import ErrorState from '../components/ui/ErrorState';

/** Última red de seguridad: errores de render no controlados dentro de una ruta. */
export default function RouteErrorPage() {
  const error = useRouteError();
  console.error(error);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/20 via-white to-primary/10">
      <ErrorState
        message="Algo salió mal al mostrar esta página."
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
