/**
 * Análisis en vivo de un cuadro de video reducido (≈320 px). Todo corre en el
 * navegador; los umbrales son de partida y se ajustan con tiquetes reales.
 */
export type Verificacion = { clave: string; ok: boolean; aviso: string };

export const UMBRALES = {
  brilloMin: 75,
  brilloMax: 205,
  reflejoMax: 0.035, // fracción de píxeles casi blancos saturados
  nitidezMin: 90, // varianza del laplaciano
  papelMin: 0.3, // fracción del cuadro ocupada por el tiquete
  papelMax: 0.93,
  bordeMax: 0.6, // fracción del borde del cuadro cubierta por papel
  orientacion: 1.35, // dominio de gradientes horizontales sobre verticales
};

export function analizarCuadro(img: ImageData): Verificacion[] {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const lum = new Float32Array(n);
  let suma = 0, saturados = 0;

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = y;
    suma += y;
    if (r > 248 && g > 248 && b > 248) saturados++;
  }
  const brillo = suma / n;

  // Papel: claro y poco saturado de color.
  const papel = new Uint8Array(n);
  let papelTotal = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const max = Math.max(data[p], data[p + 1], data[p + 2]);
    const min = Math.min(data[p], data[p + 1], data[p + 2]);
    if (lum[i] > Math.max(130, brillo * 0.95) && max - min < 45) { papel[i] = 1; papelTotal++; }
  }
  const fraccionPapel = papelTotal / n;

  let bordePapel = 0;
  for (let x = 0; x < w; x++) bordePapel += papel[x] + papel[(h - 1) * w + x];
  for (let y = 0; y < h; y++) bordePapel += papel[y * w] + papel[y * w + w - 1];
  const fraccionBorde = bordePapel / (2 * (w + h));

  // Nitidez y orientación en la zona central.
  let sumaL = 0, sumaL2 = 0, cuenta = 0, gx = 0, gy = 0;
  const x0 = Math.floor(w * 0.2), x1 = Math.floor(w * 0.8), y0 = Math.floor(h * 0.2), y1 = Math.floor(h * 0.8);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      const l = 4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w];
      sumaL += l; sumaL2 += l * l; cuenta++;
      gx += Math.abs(lum[i + 1] - lum[i - 1]);
      gy += Math.abs(lum[i + w] - lum[i - w]);
    }
  }
  const media = sumaL / cuenta;
  const nitidez = sumaL2 / cuenta - media * media;

  const u = UMBRALES;
  return [
    { clave: "luz", ok: brillo >= u.brilloMin && brillo <= u.brilloMax, aviso: brillo < u.brilloMin ? "Poca luz" : "Demasiada luz" },
    { clave: "reflejos", ok: saturados / n <= u.reflejoMax, aviso: "Hay brillo sobre el papel: inclina un poco el tiquete" },
    { clave: "distancia", ok: fraccionPapel >= u.papelMin && fraccionPapel <= u.papelMax, aviso: fraccionPapel < u.papelMin ? "Acércate" : "Aléjate" },
    { clave: "encuadre", ok: fraccionBorde <= u.bordeMax, aviso: "El tiquete debe verse completo dentro del marco" },
    { clave: "orientacion", ok: gx <= gy * u.orientacion, aviso: "Gira el tiquete: el texto debe verse derecho" },
    { clave: "enfoque", ok: nitidez >= u.nitidezMin, aviso: "Imagen borrosa: sostén el celular quieto" },
  ];
}
