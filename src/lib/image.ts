export const AVATAR_SIZE = 256;
export const MAX_SOURCE_IMAGE_BYTES = 10 * 1024 * 1024;

export interface CropRect {
  sx: number;
  sy: number;
  size: number;
}

/** Recorte cuadrado centrado de una imagen de w × h. */
export function computeSquareCrop(width: number, height: number): CropRect {
  const size = Math.min(width, height);
  return {
    sx: Math.floor((width - size) / 2),
    sy: Math.floor((height - size) / 2),
    size,
  };
}

export function validateImageFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'El archivo debe ser una imagen.';
  if (file.size > MAX_SOURCE_IMAGE_BYTES) return 'La imagen no puede superar 10 MB.';
  return null;
}

/** Recorta al centro, reduce a 256×256 y comprime (webp si el navegador lo soporta). */
export async function prepareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { sx, sy, size } = computeSquareCrop(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.85),
  );
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return blob;
}
