/**
 * Nitidez de la foto que se va a leer, igual en el navegador y en el servidor (funciones puras
 * sobre la luminancia). El servidor la repite para que nadie pueda saltársela. Solo rechaza
 * fotos claramente borrosas: lo que la IA no lea 100 % seguro pasa marcado para el administrador.
 */
export const FOTO = {
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

export const MENSAJE_BORROSA =
  "La foto está borrosa y no se podría leer bien. Tómela de nuevo con el celular quieto y el tiquete enfocado.";
