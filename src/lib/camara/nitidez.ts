/**
 * Revisión de la foto que se va a leer, igual en el navegador y en el servidor (funciones
 * puras sobre la luminancia). El servidor la repite para que nadie pueda saltársela.
 *
 * Calibrado con fotos reales (2026-10-20): una foto reenviada por WhatsApp llega a 720×1280
 * (0,92 MP) y se ve borrosa al ampliarla; las fotos legibles tienen ≥ 1,4 MP. La varianza del
 * laplaciano depende del tamaño de la letra (letra grande = valor más bajo), así que no basta
 * sola: la certeza final la dan los controles de la lectura (neto impreso y cero dudas).
 */
export const FOTO = {
  megapixelesMin: 1.2, // de la foto original (cámara o galería)
  megapixelesServidorMin: 1.0, // de la foto ya reducida que recibe el servidor
  ladoMedida: 1000, // px del lado largo para medir la nitidez
  nitidezMin: 200, // varianza del laplaciano en el 60 % central, a 1000 px
  toleranciaServidor: 0.85, // la compresión WebP baja un poco la medida
};

export function luminancia(data: Uint8ClampedArray | Uint8Array, canales = 4): Float32Array {
  const lum = new Float32Array(data.length / canales);
  if (canales === 1) { lum.set(data); return lum; }
  for (let i = 0, p = 0; i < lum.length; i++, p += canales) lum[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  return lum;
}

/** Varianza del laplaciano en la zona central: alta con letras nítidas, baja si está desenfocado. */
export function varianzaLaplaciano(lum: Float32Array, w: number, h: number): number {
  let suma = 0, suma2 = 0, cuenta = 0;
  const x0 = Math.max(1, Math.floor(w * 0.2)), x1 = Math.min(w - 1, Math.floor(w * 0.8));
  const y0 = Math.max(1, Math.floor(h * 0.2)), y1 = Math.min(h - 1, Math.floor(h * 0.8));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      const l = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w];
      suma += l; suma2 += l * l; cuenta++;
    }
  }
  if (cuenta === 0) return 0;
  const media = suma / cuenta;
  return suma2 / cuenta - media * media;
}

export const MENSAJE_RESOLUCION =
  "La foto tiene muy poca resolución (por ejemplo, una foto reenviada por WhatsApp) y no se puede leer con certeza. Tome la foto al tiquete en físico con la cámara de la app.";
export const MENSAJE_BORROSA =
  "La foto está borrosa y no se podría leer con certeza. Tómela de nuevo con el celular quieto y el tiquete enfocado.";
