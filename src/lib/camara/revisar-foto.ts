import "server-only";
import sharp from "sharp";
import { FOTO, MENSAJE_BORROSA, luminancia, varianzaLaplaciano } from "./nitidez";

/**
 * El servidor repite la revisión de nitidez del celular antes de gastar una lectura de la IA,
 * para que una foto borrosa no entre aunque alguien se salte la app. Devuelve el motivo o null.
 */
export async function revisarFotoServidor(bytes: Buffer): Promise<string | null> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize(FOTO.ladoMedida, FOTO.ladoMedida, { fit: "inside", withoutEnlargement: true })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const nitidez = varianzaLaplaciano(luminancia(data, info.channels), info.width, info.height);
  return nitidez < FOTO.nitidezMin * FOTO.toleranciaServidor ? MENSAJE_BORROSA : null;
}
