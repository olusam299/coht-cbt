/**
 * Client-side crop + compression for the student identifier photo.
 * We deliberately store a small square JPEG (default 320px, ~25–45 KB) and
 * never upload the camera original.
 */
export interface ProcessedPhoto {
  blob: Blob;
  dataUrl: string;
  bytes: number;
  size: number;
}

export async function processIdentifierPhoto(
  file: File,
  { size = 320, quality = 0.72 }: { size?: number; quality?: number } = {},
): Promise<ProcessedPhoto> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not supported on this device.");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Could not compress the photo. Try another image.");

  return {
    blob,
    dataUrl: canvas.toDataURL("image/jpeg", quality),
    bytes: blob.size,
    size,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}