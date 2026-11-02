import { Gift, HandHeart, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import Avatar from '../components/ui/Avatar';
import { useAuth } from '../features/auth/useAuth';
import { useAvatarUrls } from '../features/profile/hooks';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg font-medium transition-colors ${
    isActive ? 'bg-primary/10 text-primary-dark' : 'text-gray-600 hover:text-primary'
  }`;

export default function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth();
  const { data: urls } = useAvatarUrls([profile?.avatar_path]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-primary/20 via-white to-primary/10">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/" className="flex items-center gap-2 text-primary font-bold text-lg mr-auto">
            <Gift aria-hidden="true" className="w-6 h-6" />
            Amigo Secreto
          </Link>
          <nav
            aria-label="Principal"
            className="flex flex-wrap items-center gap-1 order-3 sm:order-none w-full sm:w-auto"
          >
            <NavLink to="/" end className={navLinkClass}>
              Inicio
            </NavLink>
            <NavLink to="/perfil" className={navLinkClass}>
              Mi perfil
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin/usuarios" className={navLinkClass}>
                Usuarios
              </NavLink>
            )}
          </nav>
          {profile && (
            <div className="flex items-center gap-3">
              <Link to="/perfil" className="flex items-center gap-2" aria-label="Mi perfil">
                <Avatar
                  name={profile.full_name}
                  url={profile.avatar_path ? urls?.[profile.avatar_path] : null}
                  size="sm"
                />
                <span className="hidden md:inline text-gray-700 font-medium">
                  {profile.full_name}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="p-2 rounded-full text-gray-500 hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <LogOut aria-hidden="true" className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

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
