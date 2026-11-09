import { Bell, Megaphone } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarkAllNotificationsRead, useNotifications } from './hooks';

const timeFormat = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Campana con las notificaciones del usuario. Al abrirla se marcan como leídas. */
export default function NotificationBell({ userId }: { userId: string }) {
  const panelId = useId();
  const { data: notifications = [] } = useNotifications(userId);
  const markAll = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read_at).length;

  // Cerrar al hacer clic fuera o con Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAll.mutate();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
        className={`relative p-2 rounded-full transition-colors ${open ? 'bg-stone-100 text-stone-900' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'}`}
      >
        <Bell aria-hidden="true" className="w-5 h-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-stone-900 text-[10px] font-bold ring-2 ring-white inline-flex items-center justify-center"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Notificaciones"
          className="fixed inset-x-4 top-[4.5rem] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[22rem] max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-lift ring-1 ring-stone-900/5 z-50 motion-safe:animate-pop-in"
        >
          <p className="sticky top-0 bg-white/95 backdrop-blur px-4 py-3 font-display font-semibold text-stone-900 border-b border-stone-100">
            Notificaciones
          </p>
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-sm text-stone-500 text-center">
              No tienes notificaciones.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {notifications.map((n) => {
                const content = (
                  <>
                    <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                      {n.kind === 'announcement' && (
                        <Megaphone
                          aria-hidden="true"
                          className="w-4 h-4 text-primary-700 shrink-0"
                        />
                      )}
                      {n.title}
                      {!n.read_at && (
                        <span
                          className="ml-auto w-2 h-2 rounded-full bg-primary-500 shrink-0"
                          aria-label="nueva"
                        />
                      )}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 text-sm text-stone-600 whitespace-pre-wrap">{n.body}</p>
                    )}
                    <p className="text-xs text-stone-400 mt-1">
                      {timeFormat.format(new Date(n.created_at))}
                    </p>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 hover:bg-stone-50 transition-colors"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
