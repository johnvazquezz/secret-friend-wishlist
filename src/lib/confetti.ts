/**
 * Confeti ligero sobre un <canvas> temporal, sin dependencias.
 * No hace nada si el usuario prefiere menos movimiento o si no hay canvas (p. ej. en tests).
 */

const COLORS = ['#a13370', '#e077b0', '#f6d0e5', '#fbbf24', '#fde68a', '#34d399', '#38bdf8'];

interface ConfettiOptions {
  /** Origen en coordenadas de la ventana. Por defecto, el centro superior. */
  x?: number;
  y?: number;
  /** Número de piezas. */
  count?: number;
  /** Apertura del abanico en grados (360 = explosión en todas direcciones). */
  spread?: number;
  /** Dirección central en grados (-90 = hacia arriba). */
  angle?: number;
  /** Velocidad inicial. */
  power?: number;
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  spin: number;
  tilt: number;
  shape: 'rect' | 'circle';
}

function shouldAnimate() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function launchConfetti({
  x = window.innerWidth / 2,
  y = window.innerHeight / 3,
  count = 120,
  spread = 70,
  power = 13,
  angle: direction = -90,
}: ConfettiOptions = {}) {
  if (!shouldAnimate()) return;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '100',
  });
  document.body.appendChild(canvas);
  ctx.scale(dpr, dpr);

  const spreadRad = (spread * Math.PI) / 180;
  const pieces: Piece[] = Array.from({ length: count }, () => {
    // Alrededor de la dirección indicada, con la apertura pedida.
    const angle = (direction * Math.PI) / 180 + (Math.random() - 0.5) * spreadRad;
    const speed = power * (0.55 + Math.random() * 0.6);
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI,
      shape: Math.random() < 0.25 ? 'circle' : 'rect',
    };
  });

  const start = performance.now();
  const duration = 2800;

  const frame = (now: number) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const fade = elapsed > duration - 700 ? Math.max(0, (duration - elapsed) / 700) : 1;

    for (const p of pieces) {
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.32;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      p.tilt += 0.12;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // El coseno del "tilt" simula el giro del papel en 3D.
        ctx.fillRect(
          -p.size / 2,
          (-p.size / 4) * Math.cos(p.tilt),
          p.size,
          (p.size / 2) * Math.cos(p.tilt),
        );
      }
      ctx.restore();
    }

    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Confeti que sale desde un elemento (p. ej. el botón pulsado). */
export function confettiFrom(element: Element | null, options: ConfettiOptions = {}) {
  if (!element) return launchConfetti(options);
  const rect = element.getBoundingClientRect();
  launchConfetti({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, ...options });
}

/** Gran celebración: dos cañones desde las esquinas inferiores. */
export function celebrate() {
  if (!shouldAnimate()) return;
  const h = window.innerHeight;
  const w = window.innerWidth;
  launchConfetti({ x: w * 0.05, y: h, count: 110, spread: 45, power: 24, angle: -65 });
  launchConfetti({ x: w * 0.95, y: h, count: 110, spread: 45, power: 24, angle: -115 });
  window.setTimeout(
    () => launchConfetti({ x: w / 2, y: h * 0.35, count: 90, spread: 360, power: 9 }),
    250,
  );
}
