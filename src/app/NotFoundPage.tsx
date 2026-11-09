import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-4xl font-bold text-stone-900 mb-4">Página no encontrada</h1>
      <p className="text-stone-600 mb-6">La página que buscas no existe.</p>
      <Link to="/" className="text-primary-700 font-semibold hover:text-primary-800 underline">
        Volver al inicio
      </Link>
    </div>
  );
}
