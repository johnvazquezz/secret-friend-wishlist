import { Camera, ChevronRight, KeyRound, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card, { CardHeader } from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import { useAuth } from '../auth/useAuth';
import AvatarUploader from './AvatarUploader';
import ProfileForm from './ProfileForm';

export default function ProfilePage() {
  const { profile } = useAuth();
  if (!profile) return null; // RequireAuth garantiza el perfil

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <PageHeader eyebrow="Tu cuenta" title="Mi perfil" />

      <div className="space-y-5">
        <Card>
          <CardHeader icon={<Camera />} title="Foto" />
          <AvatarUploader profile={profile} />
        </Card>

        <Card>
          <CardHeader icon={<UserRound />} title="Datos personales" description={profile.email} />
          <ProfileForm profile={profile} />
        </Card>

        <Card padded={false}>
          <h2 className="sr-only">Seguridad</h2>
          <Link
            to="/cambiar-contrasena"
            className="group flex items-center gap-3 p-5 sm:p-6 rounded-2xl hover:bg-stone-50 transition-colors"
          >
            <span
              aria-hidden="true"
              className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 inline-flex items-center justify-center"
            >
              <KeyRound className="w-5 h-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-stone-900">Cambiar contraseña</span>
              <span className="block text-sm text-stone-500">Seguridad de tu cuenta</span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="w-5 h-5 text-stone-400 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </Card>
      </div>
    </div>
  );
}
