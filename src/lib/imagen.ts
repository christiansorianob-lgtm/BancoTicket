/**
 * Reduce la foto en el navegador: ≈1280 px por el lado largo, WebP (o JPEG si el
 * navegador no codifica WebP, como Safari) con calidad media. Meta: 80–150 KB.
 */
export async function reducirImagen(fuente: CanvasImageSource & { width: number; height: number }, ladoLargo = 1280): Promise<Blob> {
  const escala = Math.min(1, ladoLargo / Math.max(fuente.width, fuente.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(fuente.width * escala);
  canvas.height = Math.round(fuente.height * escala);
  canvas.getContext("2d")!.drawImage(fuente, 0, 0, canvas.width, canvas.height);

  const aBlob = (tipo: string, calidad: number) =>
    new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, calidad));

  for (const calidad of [0.72, 0.6, 0.5]) {
    let blob = await aBlob("image/webp", calidad);
    if (!blob || blob.type !== "image/webp") blob = await aBlob("image/jpeg", calidad);
    if (blob && blob.size <= 500_000) return blob;
  }
  throw new Error("No se pudo reducir la foto");
}

/** Carga un archivo de la galería como imagen (respeta la orientación EXIF). */
export async function imagenDesdeArchivo(archivo: File): Promise<ImageBitmap> {
  return createImageBitmap(archivo, { imageOrientation: "from-image" });
}
