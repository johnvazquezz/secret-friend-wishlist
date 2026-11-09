import { Gift, Lock, MessageCircleHeart, Sparkles } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import ConfettiDecor from '../components/ui/ConfettiDecor';
import Toaster from '../components/ui/Toaster';

const highlights = [
  { icon: Lock, text: 'Nadie, ni siquiera el organizador, sabe quién te regala.' },
  { icon: Sparkles, text: 'Comparte tu lista de deseos y acierta con el regalo.' },
  { icon: MessageCircleHeart, text: 'Escríbele a tu amigo secreto de forma anónima.' },
];

/** Layout para login y cambio de contraseña: panel de marca + formulario. */
export default function AuthLayout() {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-stone-50">
      <Toaster />
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-primary-700 p-12 text-white">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full text-white/[0.07]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="auth-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-dots)" />
        </svg>
        <ConfettiDecor className="opacity-70" />
        <div
          aria-hidden="true"
          className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-primary-500/40 blur-3xl"
        />

        <div className="relative flex items-center gap-3 font-display text-xl font-bold">
          <span className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/25 inline-flex items-center justify-center">
            <Gift aria-hidden="true" className="w-5 h-5" />
          </span>
          Amigo Secreto
        </div>

        <div className="relative max-w-md">
          <p className="font-display text-4xl xl:text-5xl font-bold leading-[1.05] tracking-tight">
            Regala sin que nadie lo sepa.
          </p>
          <ul className="mt-10 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-white/85">
                <Icon aria-hidden="true" className="w-5 h-5 mt-0.5 shrink-0 text-amber-300" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/60">Hecho con cariño para el equipo.</p>
      </aside>

      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8 lg:sr-only">
            <span className="w-14 h-14 rounded-2xl bg-primary-600 text-white inline-flex items-center justify-center shadow-lg shadow-primary-900/20 mb-4">
              <Gift aria-hidden="true" className="w-7 h-7" />
            </span>
            <h1 className="text-3xl font-bold text-stone-900">Amigo Secreto</h1>
            <p className="text-stone-600 mt-1">Regala sin que nadie lo sepa.</p>
          </div>
          <div className="card p-6 sm:p-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
