import { KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AvatarUploader from './AvatarUploader';
import ProfileForm from './ProfileForm';

export default function ProfilePage() {
  const { profile } = useAuth();
  if (!profile) return null; // RequireAuth garantiza el perfil

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Mi perfil</h1>

      <section className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Foto</h2>
        <AvatarUploader profile={profile} />
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Datos personales</h2>
        <p className="text-sm text-gray-500 mb-4">{profile.email}</p>
        <ProfileForm profile={profile} />
      </section>

      <section className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Seguridad</h2>
        <Link
          to="/cambiar-contrasena"
          className="inline-flex items-center gap-2 font-medium text-primary hover:text-primary-dark"
        >
          <KeyRound aria-hidden="true" className="w-5 h-5" />
          Cambiar contraseña
        </Link>
      </section>
    </div>
  );
}
