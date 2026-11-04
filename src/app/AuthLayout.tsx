import { Gift } from 'lucide-react';
import { Outlet } from 'react-router-dom';

/** Layout centrado para login y cambio de contraseña. */
export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/20 via-white to-primary/10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Gift aria-hidden="true" className="w-14 h-14 text-primary mx-auto mb-2" />
          <h1 className="text-4xl font-bold text-gray-800">Amigo Secreto</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
