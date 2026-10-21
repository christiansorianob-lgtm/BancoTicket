/**
 * Análisis en vivo de la zona del marco guía, reducida (≈640 px). Todo corre en el
 * navegador; los umbrales son de partida y se ajustan con tiquetes reales.
 */
import { FOTO, luminancia as luminanciaRGBA, varianzaLaplaciano } from "./nitidez";

/** bloquea: si no se cumple, no se toma la foto. Las demás son consejos en pantalla. */
export type Verificacion = { clave: string; ok: boolean; aviso: string; bloquea: boolean };

export const UMBRALES = {
  brilloMin: 75,
  brilloMax: 205,
  reflejoMax: 0.035, // fracción de píxeles casi blancos saturados
  ladoAnalisis: 640, // px del lado largo para el análisis en vivo (más grande = detecta mejor el desenfoque)
  // Calibrado con tiquetes reales (2026-10-20): nítidos 328–2.779 a 1000 px; la foto borrosa e
  // ilegible de la segunda prueba dio 85. El video en vivo siempre es menos nítido que la foto
  // del sensor, así que en vivo se pide poco y la revisión decisiva es la de la foto final.
  nitidezMin: 120, // varianza del laplaciano en vivo, a 640 px (filtro suave)
  nitidezFotoMin: FOTO.nitidezMin, // varianza del laplaciano de la foto final, a 1000 px (revisión decisiva)
  movimientoMax: 10, // diferencia media de luz entre cuadros seguidos: más = el celular se mueve
  // Fracción de bloques con texto impreso (fondo claro + trazos oscuros + bordes). Calibrado con
  // fotos reales (2026-10-20): tiquetes 0,31–0,59; mantel, teclado, telas y fondos 0–0,04.
  textoMin: 0.15,
  papelMin: 0.45, // fracción del marco ocupada por el tiquete
  bordeMax: 0.92, // si el papel cubre todo el borde del marco, el tiquete se sale
};

const luminancia = (img: ImageData) => luminanciaRGBA(img.data);

/** ¿La foto original tiene resolución suficiente para leer cada carácter con certeza? */
export function resolucionSuficiente(fuente: { width: number; height: number }) {
  return (fuente.width * fuente.height) / 1e6 >= FOTO.megapixelesMin;
}

/**
 * ¿Hay un documento impreso? Divide la imagen en bloques de 32 px y cuenta los que tienen
 * fondo claro (con cualquier tinte), trazos oscuros y bordes nítidos: letras sobre papel.
 * Devuelve la fracción de bloques con texto. Corre en el celular, sin costo de IA.
 */
function fraccionTexto(lum: Float32Array, w: number, h: number): number {
  const B = 32;
  const hist = new Uint16Array(256);
  let total = 0, conTexto = 0;
  for (let by = 1; by + B < h - 1; by += B) {
    for (let bx = 1; bx + B < w - 1; bx += B) {
      total++;
      hist.fill(0);
      for (let y = by; y < by + B; y++) for (let x = bx; x < bx + B; x++) hist[Math.min(255, lum[y * w + x] | 0)]++;
      let acumulado = 0, mediana = 0;
      while (mediana < 255 && acumulado + hist[mediana] < (B * B) / 2) acumulado += hist[mediana++];
      if (mediana < 110) continue; // sin fondo claro no es papel
      let oscuros = 0, bordes = 0;
      for (let y = by; y < by + B; y++) {
        for (let x = bx; x < bx + B; x++) {
          const i = y * w + x;
          if (lum[i] < mediana - 45) oscuros++;
          if (Math.abs(4 * lum[i] - lum[i - 1] - lum[i + 1] - lum[i - w] - lum[i + w]) > 60) bordes++;
        }
      }
      const fo = oscuros / (B * B), fb = bordes / (B * B);
      if (fo > 0.02 && fo < 0.45 && fb > 0.03) conTexto++;
    }
  }
  return total ? conTexto / total : 0;
}

/** Para la foto final o una imagen de la galería: ¿parece un documento impreso? */
export function pareceDocumento(fuente: CanvasImageSource & { width: number; height: number }): boolean {
  const escala = Math.min(1, UMBRALES.ladoAnalisis / Math.max(fuente.width, fuente.height));
  const c = document.createElement("canvas");
  c.width = Math.round(fuente.width * escala);
  c.height = Math.round(fuente.height * escala);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(fuente, 0, 0, c.width, c.height);
  return fraccionTexto(luminancia(ctx.getImageData(0, 0, c.width, c.height)), c.width, c.height) >= UMBRALES.textoMin;
}

/**
 * Revisa un cuadro del video. `previo` es la luminancia del cuadro anterior (mismo tamaño)
 * para detectar si el celular se mueve. Devuelve también la luminancia para el siguiente.
 */
export function analizarCuadro(img: ImageData, previo?: Float32Array | null) {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const lum = luminancia(img);
  let suma = 0, saturados = 0;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    suma += lum[i];
    if (data[p] > 248 && data[p + 1] > 248 && data[p + 2] > 248) saturados++;
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

  const nitidez = varianzaLaplaciano(lum, w, h);

  // Movimiento: cuánto cambió la imagen desde el cuadro anterior.
  let movimiento = 0;
  if (previo && previo.length === n) {
    let dif = 0;
    for (let i = 0; i < n; i += 4) dif += Math.abs(lum[i] - previo[i]);
    movimiento = dif / Math.ceil(n / 4);
  }

  const u = UMBRALES;
  const verificaciones: Verificacion[] = [
    // Bloquean: sin esto la foto no sirve.
    { clave: "tiquete", bloquea: true, ok: fraccionTexto(lum, w, h) >= u.textoMin, aviso: "Apunte la cámara a un tiquete: no se ve texto impreso" },
    { clave: "luz", bloquea: true, ok: brillo >= u.brilloMin && brillo <= u.brilloMax, aviso: brillo < u.brilloMin ? "Poca luz" : "Demasiada luz" },
    { clave: "quieto", bloquea: true, ok: movimiento <= u.movimientoMax, aviso: "Sostén el celular quieto" },
    { clave: "enfoque", bloquea: true, ok: nitidez >= u.nitidezMin, aviso: "Imagen borrosa: espera a que enfoque" },
    // Consejos: la detección del papel es aproximada y no debe impedir la foto.
    { clave: "reflejos", bloquea: false, ok: saturados / n <= u.reflejoMax, aviso: "Hay brillo sobre el papel: inclina un poco el tiquete" },
    { clave: "distancia", bloquea: false, ok: fraccionPapel >= u.papelMin, aviso: "Acércate: el tiquete debe llenar el marco" },
    { clave: "encuadre", bloquea: false, ok: fraccionBorde <= u.bordeMax, aviso: "Aléjate un poco: el tiquete debe verse completo" },
  ];
  return { verificaciones, lum, nitidez: nitidez / u.nitidezMin };
}

/**
 * Revisión final de la foto que se va a enviar (cámara o galería): mide la nitidez del
 * centro a 1000 px. Devuelve la proporción frente al mínimo (1 = justo en el límite).
 */
export function nitidezDeFoto(fuente: CanvasImageSource & { width: number; height: number }): number {
  const escala = Math.min(1, FOTO.ladoMedida / Math.max(fuente.width, fuente.height));
  const c = document.createElement("canvas");
  c.width = Math.round(fuente.width * escala);
  c.height = Math.round(fuente.height * escala);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(fuente, 0, 0, c.width, c.height);
  const lum = luminancia(ctx.getImageData(0, 0, c.width, c.height));
  return varianzaLaplaciano(lum, c.width, c.height) / UMBRALES.nitidezFotoMin;
}
