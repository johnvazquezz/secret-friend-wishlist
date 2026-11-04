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
        className="relative p-2 rounded-full text-gray-500 hover:text-primary hover:bg-primary/10 transition-colors"
      >
        <Bell aria-hidden="true" className="w-5 h-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 rounded-full bg-amber-400 text-gray-900 text-xs font-bold inline-flex items-center justify-center"
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
          className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-100 z-50"
        >
          <p className="px-4 py-3 font-semibold text-gray-800 border-b border-gray-100">
            Notificaciones
          </p>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-gray-500 text-center">No tienes notificaciones.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => {
                const content = (
                  <>
                    <p className="flex items-center gap-2 font-medium text-gray-800">
                      {n.kind === 'announcement' && (
                        <Megaphone aria-hidden="true" className="w-4 h-4 text-primary shrink-0" />
                      )}
                      {n.title}
                      {!n.read_at && (
                        <span
                          className="w-2 h-2 rounded-full bg-primary shrink-0"
                          aria-label="nueva"
                        />
                      )}
                    </p>
                    {n.body && (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{n.body}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
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
                        className="block px-4 py-3 hover:bg-primary/5"
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
