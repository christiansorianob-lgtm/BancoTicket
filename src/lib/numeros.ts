/**
 * Convierte un peso impreso en kilos a entero: "2,070" → 2070, "26.500" → 26500,
 * "10680" → 10680, "17.500 kg" → 17500. Los pesos son enteros, así que un punto
 * o coma seguido de exactamente tres dígitos es separador de miles.
 * Devuelve null si el texto no es un entero válido.
 */
export function kilosDesdeTexto(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === "number") return Number.isInteger(texto) && texto >= 0 ? texto : null;
  const limpio = texto.replace(/kg|kilos?/gi, "").replace(/\s/g, "");
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(limpio)) return null;
  const n = Number(limpio.replace(/[.,]/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Peso neto que vale (con él se cobra): el IMPRESO en el tiquete. Solo si no lo tiene
 * (registro manual antiguo) se usa bruto − tara. Igual que la columna calculada en la base.
 */
export function netoKg(t: { peso_bruto_kg: number; tara_kg: number; neto_impreso_kg?: number | null }): number {
  return t.neto_impreso_kg ?? t.peso_bruto_kg - t.tara_kg;
}

/** Toneladas exactas a partir de kilos enteros (sin redondear). */
export function toneladas(kilos: number): number {
  return kilos / 1000;
}

export function formatoToneladas(t: number | string | null | undefined): string {
  if (t === null || t === undefined || t === "") return "—";
  return `${Number(t).toLocaleString("es-CO", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`;
}

export function formatoPesos(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return Number(v).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

/** Lee un monto escrito por el administrador: "1.500.000", "1500000", "1,500,000.50". */
export function montoDesdeTexto(texto: string): number | null {
  const t = texto.replace(/[$\s]/g, "");
  if (!t) return null;
  // Formato colombiano: punto de miles, coma decimal
  const normal = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/[.,](?=\d{3}(\D|$))/g, "");
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
