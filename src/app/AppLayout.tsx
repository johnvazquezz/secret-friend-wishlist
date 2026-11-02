import { HandHeart } from 'lucide-react';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/20 via-white to-primary/10">
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <footer className="text-center py-8 text-gray-600">
        <p className="flex items-center justify-center gap-2">
          Hecho con <HandHeart aria-label="cariño" className="w-6 h-6 text-primary" /> para el Amigo
          Secreto
        </p>
      </footer>
    </div>
  );
}
