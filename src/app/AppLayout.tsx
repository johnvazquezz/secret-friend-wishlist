import {
  CalendarDays,
  Gift,
  HandHeart,
  Home,
  ListChecks,
  LogOut,
  MessageCircle,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import Avatar from '../components/ui/Avatar';
import { useAuth } from '../features/auth/useAuth';
import { useChatRealtime, useMyThreads } from '../features/chat/hooks';
import { useActiveEvent } from '../features/event/hooks';
import NotificationBell from '../features/notifications/NotificationBell';
import { useAvatarUrls } from '../features/profile/hooks';

/** Enlace de la navegación principal: barra inferior en móvil, pastilla en escritorio. */
function MainLink({
  to,
  icon: Icon,
  children,
  end,
}: {
  to: string;
  icon: LucideIcon;
  children: ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group relative flex flex-1 lg:flex-none flex-col lg:flex-row items-center justify-center gap-0.5 lg:gap-2 min-h-14 lg:min-h-0 lg:h-9 lg:px-3 lg:rounded-lg text-[11px] lg:text-sm font-medium transition-colors ${
          isActive
            ? 'text-primary-700 lg:bg-primary-50'
            : 'text-stone-500 hover:text-stone-900 lg:text-stone-600 lg:hover:bg-stone-100'
        }`
      }
    >
      <Icon aria-hidden="true" className="w-5 h-5 lg:w-4 lg:h-4" />
      {children}
    </NavLink>
  );
}

function AdminLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        `inline-flex items-center gap-2 h-9 px-2.5 lg:px-3 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-stone-900 text-white'
            : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
        }`
      }
    >
      <Icon aria-hidden="true" className="w-4 h-4" />
      <span className="sr-only xl:not-sr-only">{label}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth();
  const { data: urls } = useAvatarUrls([profile?.avatar_path]);
  const event = useActiveEvent().data;
  const threads = useMyThreads(event?.id, event?.status).data ?? [];
  useChatRealtime(
    event?.id,
    threads.map((t) => t.thread_id),
  );
  const unread = threads.reduce((sum, t) => sum + t.unread, 0);

  return (
    <div className="relative min-h-screen flex flex-col bg-stone-50">
      {/* Halo de marca muy sutil detrás de la cabecera */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,theme(colors.primary.100/.7),transparent)]"
      />

      {/* Sin backdrop-filter: crearía un bloque contenedor y rompería la barra inferior fija en móvil. */}
      <header className="sticky top-0 z-40 bg-white/95 border-b border-stone-200/80">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2.5 mr-auto lg:mr-4 rounded-lg font-display font-bold text-stone-900 text-lg tracking-tight"
          >
            <span className="w-8 h-8 rounded-lg bg-primary-600 text-white inline-flex items-center justify-center shadow-sm shadow-primary-900/20">
              <Gift aria-hidden="true" className="w-[18px] h-[18px]" />
            </span>
            Amigo Secreto
          </Link>

          <nav
            aria-label="Principal"
            className="fixed lg:static inset-x-0 bottom-0 z-40 flex lg:items-center lg:gap-1 lg:mr-auto bg-white/95 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border-t lg:border-0 border-stone-200 pb-[env(safe-area-inset-bottom)] lg:pb-0"
          >
            <MainLink to="/" end icon={Home}>
              Inicio
            </MainLink>
            <MainLink to="/mi-lista" icon={ListChecks}>
              Mi lista
            </MainLink>
            <MainLink to="/deseos" icon={Gift}>
              Deseos
            </MainLink>
            {threads.length > 0 && (
              <MainLink to="/mensajes" icon={MessageCircle}>
                Mensajes
                {unread > 0 && (
                  <span
                    aria-label={`${unread} sin leer`}
                    className="absolute top-1.5 left-1/2 ml-1.5 lg:static lg:ml-0 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-stone-900 text-[10px] font-bold inline-flex items-center justify-center"
                  >
                    {unread}
                  </span>
                )}
              </MainLink>
            )}
            <MainLink to="/perfil" icon={UserRound}>
              Mi perfil
            </MainLink>
          </nav>

          {isAdmin && (
            <nav
              aria-label="Administración"
              className="flex items-center gap-1 lg:pl-3 lg:border-l border-stone-200"
            >
              <AdminLink to="/admin/evento" icon={CalendarDays} label="Evento" />
              <AdminLink to="/admin/usuarios" icon={Users} label="Usuarios" />
            </nav>
          )}

          {profile && (
            <div className="flex items-center gap-1 lg:gap-2 lg:pl-3 lg:border-l border-stone-200">
              <NotificationBell userId={profile.id} />
              <Link
                to="/perfil"
                className="hidden lg:flex items-center gap-2 rounded-full p-0.5 hover:bg-stone-100 transition-colors"
                aria-label="Mi perfil"
              >
                <Avatar
                  name={profile.full_name}
                  url={profile.avatar_path ? urls?.[profile.avatar_path] : null}
                  size="sm"
                />
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
                className="p-2 rounded-full text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              >
                <LogOut aria-hidden="true" className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="relative flex-1 flex flex-col pb-20 lg:pb-0">
        <Outlet />
      </main>

      <footer className="relative hidden lg:block py-8 text-center text-sm text-stone-500">
        <p className="flex items-center justify-center gap-1.5">
          Hecho con <HandHeart aria-label="cariño" className="w-4 h-4 text-primary-600" /> para el
          Amigo Secreto
        </p>
      </footer>
    </div>
  );
}
