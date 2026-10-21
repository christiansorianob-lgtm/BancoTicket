import "server-only";
import sharp from "sharp";
import { FOTO, MENSAJE_BORROSA, MENSAJE_RESOLUCION, luminancia, varianzaLaplaciano } from "./nitidez";

/**
 * El servidor repite la revisión del celular (resolución y nitidez) antes de gastar una
 * lectura de la IA, para que una foto mala no entre aunque alguien se salte la app.
 * Devuelve el motivo de rechazo o null.
 */
export async function revisarFotoServidor(bytes: Buffer): Promise<string | null> {
  const meta = await sharp(bytes).metadata();
  if (((meta.width ?? 0) * (meta.height ?? 0)) / 1e6 < FOTO.megapixelesServidorMin) return MENSAJE_RESOLUCION;
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize(FOTO.ladoMedida, FOTO.ladoMedida, { fit: "inside", withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const nitidez = varianzaLaplaciano(luminancia(data, info.channels), info.width, info.height);
  return nitidez < FOTO.nitidezMin * FOTO.toleranciaServidor ? MENSAJE_BORROSA : null;
}
