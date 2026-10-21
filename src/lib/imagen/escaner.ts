/**
 * «Escáner» por código (sin IA): recorta el tiquete y le da efecto de documento
 * escaneado (fondo blanco, tinta oscura y nítida) antes de que la IA lo lea. Funciones puras
 * sobre una imagen en grises, iguales en el navegador y en las pruebas con Node.
 */
export type Gris = { w: number; h: number; d: Float32Array };

export function grisDesdeRGBA(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, canales = 4): Gris {
  const d = new Float32Array(w * h);
  if (canales === 1) { d.set(rgba); return { w, h, d }; }
  for (let i = 0, p = 0; i < d.length; i++, p += canales) d[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  return { w, h, d };
}

/** Reduce para analizar (promedio por cajas). */
export function reducir(g: Gris, lado: number): Gris {
  const f = Math.max(1, Math.max(g.w, g.h) / lado);
  if (f === 1) return g;
  const w = Math.max(1, Math.round(g.w / f)), h = Math.max(1, Math.round(g.h / f));
  const d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * f), y1 = Math.max(y0 + 1, Math.floor((y + 1) * f));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * f), x1 = Math.max(x0 + 1, Math.floor((x + 1) * f));
      let s = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < g.h; yy++) for (let xx = x0; xx < x1 && xx < g.w; xx++) { s += g.d[yy * g.w + xx]; n++; }
      d[y * w + x] = n ? s / n : 255;
    }
  }
  return { w, h, d };
}

export function recortar(g: Gris, x0: number, y0: number, x1: number, y1: number): Gris {
  const w = x1 - x0, h = y1 - y0, d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) d.set(g.d.subarray((y0 + y) * g.w + x0, (y0 + y) * g.w + x0 + w), y * w);
  return { w, h, d };
}

/**
 * Zona con texto impreso: bloques con fondo claro, trazos oscuros y bordes (como pareceDocumento).
 * Se quitan bloques sueltos (ruido de telas, mesas) y se toma el rectángulo de los demás.
 * Devuelve fracciones de la imagen, o null si no se encontró texto.
 */
export function zonaDeTexto(g: Gris): { x0: number; y0: number; x1: number; y1: number } | null {
  const a = reducir(g, 800);
  const B = 16, cw = Math.floor(a.w / B), ch = Math.floor(a.h / B);
  const texto = new Uint8Array(cw * ch);
  for (let by = 0; by < ch; by++) {
    for (let bx = 0; bx < cw; bx++) {
      let s = 0;
      for (let y = by * B; y < by * B + B; y++) for (let x = bx * B; x < bx * B + B; x++) s += a.d[y * a.w + x];
      const media = s / (B * B);
      if (media < 110) continue;
      let oscuros = 0, bordes = 0;
      for (let y = Math.max(1, by * B); y < Math.min(a.h - 1, by * B + B); y++) {
        for (let x = Math.max(1, bx * B); x < Math.min(a.w - 1, bx * B + B); x++) {
          const i = y * a.w + x;
          if (a.d[i] < media - 40) oscuros++;
          if (Math.abs(4 * a.d[i] - a.d[i - 1] - a.d[i + 1] - a.d[i - a.w] - a.d[i + a.w]) > 50) bordes++;
        }
      }
      const fo = oscuros / (B * B), fb = bordes / (B * B);
      if (fo > 0.015 && fo < 0.5 && fb > 0.02) texto[by * cw + bx] = 1;
    }
  }
  // Solo bloques con al menos 2 vecinos con texto: el texto viene en renglones, el ruido suelto no.
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1, total = 0;
  for (let by = 0; by < ch; by++) {
    for (let bx = 0; bx < cw; bx++) {
      if (!texto[by * cw + bx]) continue;
      let vecinos = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const yy = by + dy, xx = bx + dx;
        if (yy >= 0 && yy < ch && xx >= 0 && xx < cw && texto[yy * cw + xx]) vecinos++;
      }
      if (vecinos < 2) continue;
      total++;
      x0 = Math.min(x0, bx); y0 = Math.min(y0, by); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
    }
  }
  if (total < 12) return null;
  return { x0: (x0 * B) / a.w, y0: (y0 * B) / a.h, x1: ((x1 + 1) * B) / a.w, y1: ((y1 + 1) * B) / a.h };
}

/**
 * Efecto escaneo: estima el fondo (papel con sombras y luz desigual) y lo divide, así el papel
 * queda blanco parejo y la tinta oscura; luego estira el contraste. Conserva los grises del
 * borde de cada letra (pasar a solo 2 colores puede borrar dígitos tenues del papel térmico).
 */
export function efectoEscaneo(g: Gris, { negro = 0.3, blanco = 0.95, curva = 1.15 } = {}): Gris {
  // Fondo: versión pequeña, «máximo» local (borra la tinta) y suavizado; luego se amplía.
  const lado = 64;
  const p = reducir(g, lado);
  let fondo = p.d;
  for (let paso = 0; paso < 3; paso++) {
    const sig = new Float32Array(fondo.length);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = Math.min(p.h - 1, Math.max(0, y + dy)), xx = Math.min(p.w - 1, Math.max(0, x + dx));
        m = Math.max(m, fondo[yy * p.w + xx]);
      }
      sig[y * p.w + x] = m;
    }
    fondo = sig;
  }
  const d = new Float32Array(g.d.length);
  const fx = p.w / g.w, fy = p.h / g.h;
  for (let y = 0; y < g.h; y++) {
    const sy = Math.min(p.h - 1, Math.max(0, (y + 0.5) * fy - 0.5)), y0 = Math.floor(sy), y1 = Math.min(p.h - 1, y0 + 1), ty = sy - y0;
    for (let x = 0; x < g.w; x++) {
      const sx = Math.min(p.w - 1, Math.max(0, (x + 0.5) * fx - 0.5)), x0 = Math.floor(sx), x1 = Math.min(p.w - 1, x0 + 1), tx = sx - x0;
      const f = (fondo[y0 * p.w + x0] * (1 - tx) + fondo[y0 * p.w + x1] * tx) * (1 - ty)
              + (fondo[y1 * p.w + x0] * (1 - tx) + fondo[y1 * p.w + x1] * tx) * ty;
      d[y * g.w + x] = Math.min(1, g.d[y * g.w + x] / Math.max(40, f));
    }
  }
  // Contraste suave (calibrado con tiquetes reales, 2026-10-21): el papel (≥ 0,95 del fondo) a
  // blanco y la tinta oscura con una curva leve. Una curva fuerte (0,35–0,9 y 1,6) adelgazaba y
  // cortaba las letras, y la IA dejaba de leer el neto con certeza.
  for (let i = 0; i < d.length; i++) {
    const v = Math.min(1, Math.max(0, (d[i] - negro) / (blanco - negro)));
    d[i] = 255 * Math.pow(v, curva);
  }
  return { w: g.w, h: g.h, d };
}

/** Todo el proceso (sin girar: decisión del usuario): recortar al texto con margen y escanear. */
export function prepararTiquete(original: Gris): { imagen: Gris; recorte: boolean } {
  let g = original;
  const z = zonaDeTexto(g);
  let recorte = false;
  if (z) {
    const m = 0.03;
    const x0 = Math.max(0, Math.floor((z.x0 - m) * g.w)), y0 = Math.max(0, Math.floor((z.y0 - m) * g.h));
    const x1 = Math.min(g.w, Math.ceil((z.x1 + m) * g.w)), y1 = Math.min(g.h, Math.ceil((z.y1 + m) * g.h));
    // Solo si de verdad quita fondo (más del 8 % del área) y deja una zona razonable.
    if ((x1 - x0) * (y1 - y0) < g.w * g.h * 0.92 && (x1 - x0) > g.w * 0.3 && (y1 - y0) > g.h * 0.3) {
      g = recortar(g, x0, y0, x1, y1);
      recorte = true;
    }
  }
  return { imagen: efectoEscaneo(g), recorte };
}
