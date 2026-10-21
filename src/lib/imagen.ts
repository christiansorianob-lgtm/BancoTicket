/**
 * Reduce la foto en el navegador: hasta `ladoLargo` px por el lado largo, WebP (o JPEG
 * si el navegador no codifica WebP, como Safari) con calidad media. Los tiquetes van
 * recortados a 2000 px para que se lean bien los números; si pesa más de 500 KB se
 * baja la calidad y luego el tamaño.
 */
export async function reducirImagen(fuente: CanvasImageSource & { width: number; height: number }, ladoLargo = 1280): Promise<Blob> {
  // No se reduce más de 0,85: por debajo la foto pierde la resolución que exige el servidor.
  for (const factor of [1, 0.85]) {
    const escala = Math.min(1, (ladoLargo * factor) / Math.max(fuente.width, fuente.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(fuente.width * escala);
    canvas.height = Math.round(fuente.height * escala);
    canvas.getContext("2d")!.drawImage(fuente, 0, 0, canvas.width, canvas.height);

    const aBlob = (tipo: string, calidad: number) =>
      new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, calidad));

    for (const calidad of [0.8, 0.7, 0.6, 0.5]) {
      let blob = await aBlob("image/webp", calidad);
      if (!blob || blob.type !== "image/webp") blob = await aBlob("image/jpeg", calidad);
      if (blob && blob.size <= 500_000) return blob;
    }
  }
  throw new Error("No se pudo reducir la foto");
}

/** Carga un archivo de la galería o de la cámara del celular como imagen (respeta la orientación EXIF). */
export async function imagenDesdeArchivo(archivo: File): Promise<ImageBitmap> {
  return createImageBitmap(archivo, { imageOrientation: "from-image" });
}
