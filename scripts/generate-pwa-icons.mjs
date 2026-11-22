// Genera los iconos PNG de la PWA a partir del regalo de public/favicon.svg.
// Solo hace falta volver a ejecutarlo si cambia el logo; los PNG se guardan en el repositorio.
//
//   node scripts/generate-pwa-icons.mjs
//
// Usa playwright-core con el navegador del sistema (Edge por defecto, como los e2e).
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const BRAND = '#a13370';
const OUT = new URL('../public/icons/', import.meta.url);

// Trazos del icono "gift" (lucide), el mismo que favicon.svg y la cabecera de la app.
const GIFT = `
  <rect x="3" y="8" width="18" height="4" rx="1"/>
  <path d="M12 8v13"/>
  <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
  <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>`;

/** SVG cuadrado de `size` px: fondo opcional y regalo blanco ocupando `scale` del lado. */
function svg({ size, background, radius = 0, scale }) {
  const giftSize = size * scale;
  const offset = (size - giftSize) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${background ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${background}"/>` : ''}
    <svg x="${offset}" y="${offset}" width="${giftSize}" height="${giftSize}" viewBox="0 0 24 24"
      fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GIFT}</svg>
  </svg>`;
}

const icons = [
  // Iconos normales: cuadrado redondeado como el logo de la cabecera.
  { file: 'icon-192.png', size: 192, background: BRAND, radius: 42, scale: 0.6 },
  { file: 'icon-512.png', size: 512, background: BRAND, radius: 112, scale: 0.6 },
  // Maskable: fondo a sangre y regalo dentro de la zona segura (círculo del 80 %).
  { file: 'maskable-512.png', size: 512, background: BRAND, scale: 0.5 },
  // iOS redondea las esquinas por su cuenta.
  { file: 'apple-touch-icon.png', size: 180, background: BRAND, scale: 0.6 },
  // Insignia de la barra de estado en Android: monocroma sobre transparente.
  { file: 'badge-96.png', size: 96, scale: 0.8 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL ?? 'msedge' });
try {
  const page = await browser.newPage();
  for (const icon of icons) {
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${svg(icon)}</body></html>`,
    );
    const png = await page.locator('svg').first().screenshot({ omitBackground: true });
    await writeFile(new URL(icon.file, OUT), png);
    console.log(`public/icons/${icon.file}`);
  }
} finally {
  await browser.close();
}
