/** Fechas: se guardan en UTC y se muestran en hora de Colombia. */
export const ZONA = "America/Bogota";
const OFFSET_COLOMBIA = "-05:00"; // Colombia no tiene horario de verano

export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: ZONA,
  });
}

export function fecha(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  // Una fecha sin hora ("2026-10-15") se interpreta como día de Colombia, no UTC.
  const d = typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T12:00:00${OFFSET_COLOMBIA}`)
    : new Date(valor);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA });
}

/** Hoy en Colombia como "aaaa-mm-dd" (para inputs de fecha). */
export function hoyColombia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

/** Día de Colombia de una fecha, como [año, mes (1-12), día]. */
function diaColombia(d: Date): [number, number, number] {
  const [a, m, dd] = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d).split("-").map(Number);
  return [a, m, dd];
}

/**
 * Tiempo transcurrido desde la fecha de entrada hasta hoy, en días de Colombia (decisión del
 * usuario: la administradora ve cuántos meses lleva el tiquete al aprobarlo). Ej.: «hace 2 meses y 5 días».
 */
export function antiguedad(valor: string | Date, hoy: Date = new Date()): { texto: string; meses: number } {
  const [a1, m1, d1] = diaColombia(new Date(valor));
  const [a2, m2, d2] = diaColombia(hoy);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  let dias = d2 - d1;
  if (dias < 0) {
    meses -= 1;
    dias += new Date(Date.UTC(a2, m2 - 1, 0)).getUTCDate(); // días del mes anterior a hoy
  }
  if (meses < 0) return { texto: "fecha futura", meses: 0 };
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
  const partes = [meses > 0 && plural(meses, "mes", "meses"), (dias > 0 || meses === 0) && plural(dias, "día", "días")].filter(Boolean);
  return { texto: meses === 0 && dias === 0 ? "hoy" : `hace ${partes.join(" y ")}`, meses };
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

/**
 * Interpreta las fechas impresas en los tiquetes (siempre día/mes/año o ISO):
 * "27 de julio de 2026 10:15", "2026-10-13 9:41:42 AM", "07/10/2026 8:23:59 a. m.",
 * "14-octubre-2026 08:34:30", "08-09-2026 13:27:50".
 * Devuelve un ISO con zona de Colombia, o null si no es una fecha válida.
 */
export function interpretarFechaTiquete(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

  let dia: number, mes: number, anio: number;
  let m = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else if ((m = t.match(/(\d{1,2})[-/. ](?:de )?([a-z]+)\.?[-/. ](?:de |del )?(\d{4})/)) && MESES[m[2]]) {
    [dia, mes, anio] = [Number(m[1]), MESES[m[2]], Number(m[3])];
  } else if ((m = t.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (anio < 100) anio += 2000;
  } else {
    return null;
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || anio < 2000 || anio > 2100) return null;
  const prueba = new Date(Date.UTC(anio, mes - 1, dia));
  if (prueba.getUTCMonth() !== mes - 1) return null; // 31 de febrero, etc.

  let hora = 0, minuto = 0, segundo = 0;
  const h = t.slice((m.index ?? 0) + m[0].length).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?/);
  if (h) {
    hora = Number(h[1]); minuto = Number(h[2]); segundo = Number(h[3] ?? 0);
    if (h[4] === "p" && hora < 12) hora += 12;
    if (h[4] === "a" && hora === 12) hora = 0;
    if (hora > 23 || minuto > 59 || segundo > 59) { hora = 0; minuto = 0; segundo = 0; }
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${anio}-${p(mes)}-${p(dia)}T${p(hora)}:${p(minuto)}:${p(segundo)}${OFFSET_COLOMBIA}`;
}
