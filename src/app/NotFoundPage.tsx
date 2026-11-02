import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">Página no encontrada</h1>
      <p className="text-gray-600 mb-6">La página que buscas no existe.</p>
      <Link to="/" className="text-primary font-semibold hover:text-primary-dark underline">
        Volver al inicio
      </Link>
    </div>
  );
}
