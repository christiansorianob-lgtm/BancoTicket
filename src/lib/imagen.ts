import { grisDesdeRGBA, prepararTiquete } from "@/lib/imagen/escaner";

/**
 * Reduce la foto en el navegador: hasta `ladoLargo` px por el lado largo, WebP (o JPEG
 * si el navegador no codifica WebP, como Safari) con calidad media. Los tiquetes van
 * recortados a 2000 px para que se lean bien los números; si pesa más de 500 KB se
 * baja la calidad y luego el tamaño.
 */
export async function reducirImagen(
  fuente: CanvasImageSource & { width: number; height: number }, ladoLargo = 1280, calidades = [0.8, 0.7, 0.6, 0.5],
): Promise<Blob> {
  // No se reduce más de 0,85: por debajo la foto pierde la resolución que exige el servidor.
  for (const factor of [1, 0.85]) {
    const escala = Math.min(1, (ladoLargo * factor) / Math.max(fuente.width, fuente.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(fuente.width * escala);
    canvas.height = Math.round(fuente.height * escala);
    canvas.getContext("2d")!.drawImage(fuente, 0, 0, canvas.width, canvas.height);

    const aBlob = (tipo: string, calidad: number) =>
      new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, calidad));

    for (const calidad of calidades) {
      let blob = await aBlob("image/webp", calidad);
      if (!blob || blob.type !== "image/webp") blob = await aBlob("image/jpeg", calidad);
      if (blob && blob.size <= 500_000) return blob;
    }
  }
  throw new Error("No se pudo reducir la foto");
}

/**
 * Recorta el tiquete y le da efecto escaneo (fondo blanco, tinta oscura) en el celular, sin IA
 * (ver src/lib/imagen/escaner.ts). Devuelve la foto lista para mostrar y leer, reducida a 2000 px.
 */
export async function escanearTiquete(fuente: CanvasImageSource & { width: number; height: number }): Promise<Blob> {
  // Se procesa a 2400 px como máximo: suficiente para los dígitos y rápido en el celular.
  const escala = Math.min(1, 2400 / Math.max(fuente.width, fuente.height));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(fuente.width * escala);
  lienzo.height = Math.round(fuente.height * escala);
  const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
  const { imagen } = prepararTiquete(grisDesdeRGBA(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, lienzo.width, lienzo.height));

  const salida = document.createElement("canvas");
  salida.width = imagen.w;
  salida.height = imagen.h;
  const sctx = salida.getContext("2d")!;
  const px = sctx.createImageData(imagen.w, imagen.h);
  for (let i = 0, p = 0; i < imagen.d.length; i++, p += 4) {
    const v = imagen.d[i];
    px.data[p] = v; px.data[p + 1] = v; px.data[p + 2] = v; px.data[p + 3] = 255;
  }
  sctx.putImageData(px, 0, 0);
  // Calidad alta: en blanco y negro pesa poco, y una compresión fuerte desgasta el borde de las letras.
  return reducirImagen(salida, 2000, [0.92, 0.85, 0.8, 0.7]);
}

/** Carga un archivo de la galería o de la cámara del celular como imagen (respeta la orientación EXIF). */
export async function imagenDesdeArchivo(archivo: File): Promise<ImageBitmap> {
  return createImageBitmap(archivo, { imageOrientation: "from-image" });
}
