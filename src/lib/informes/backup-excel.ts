import "server-only";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ZONA } from "@/lib/fechas";

/** Tablas que entran al backup, en orden de lectura. Las fotos (Storage) y las contraseñas no. */
export const TABLAS_BACKUP = [
  "perfiles", "extractoras", "formatos_extractora", "configuracion", "anticipos", "tiquetes_pendientes",
  "tiquetes", "formatos_no_reconocidos", "notificaciones", "solicitudes_clave", "consumo_ia", "historial",
] as const;

const LIMITE_CELDA = 32000; // Excel admite hasta 32.767 caracteres por celda

/** Lee una tabla completa en bloques de 1.000 filas (límite de Supabase por consulta). */
async function leerTabla(tabla: string): Promise<Record<string, unknown>[]> {
  const db = supabaseAdmin();
  const filas: Record<string, unknown>[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select("*").range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) return filas;
  }
}

function celda(v: unknown) {
  if (v === null || v === undefined) return null;
  const t = typeof v === "object" ? JSON.stringify(v) : v;
  return typeof t === "string" && t.length > LIMITE_CELDA ? `${t.slice(0, LIMITE_CELDA)}…[recortado]` : t;
}

/**
 * Backup manual de la base de datos en Excel: una hoja por tabla con todas sus columnas y filas
 * (los JSON quedan como texto) y una hoja «Resumen» con cuántas filas tiene cada tabla.
 */
export async function backupExcel(generadoPor: string): Promise<{ archivo: Buffer; conteo: Record<string, number> }> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "BancoTicket";
  libro.created = new Date();
  const resumen = libro.addWorksheet("Resumen");
  const conteo: Record<string, number> = {};

  for (const tabla of TABLAS_BACKUP) {
    const filas = await leerTabla(tabla);
    conteo[tabla] = filas.length;
    const columnas = [...new Set(filas.flatMap((f) => Object.keys(f)))];
    const hoja = libro.addWorksheet(tabla, { views: [{ state: "frozen", ySplit: 1 }] });
    hoja.columns = columnas.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 2)) }));
    for (const f of filas) hoja.addRow(Object.fromEntries(columnas.map((c) => [c, celda(f[c])])));
    hoja.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    hoja.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  }

  const generado = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, dateStyle: "long", timeStyle: "medium" }).format(new Date());
  resumen.columns = [{ key: "a", width: 30 }, { key: "b", width: 16 }];
  resumen.addRow(["BancoTicket · Backup de la base de datos"]).font = { bold: true, size: 16, color: { argb: "FF1E3A8A" } };
  resumen.addRow([`Generado el ${generado} por ${generadoPor}`]).font = { italic: true, color: { argb: "FF64748B" } };
  resumen.addRow(["No incluye fotos de tiquetes (Storage) ni contraseñas (las guarda Supabase cifradas)."]).font = { italic: true, color: { argb: "FF64748B" } };
  resumen.addRow([]);
  const cab = resumen.addRow(["Tabla", "Filas"]);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }; });
  for (const t of TABLAS_BACKUP) resumen.addRow([t, conteo[t]]);

  return { archivo: Buffer.from(await libro.xlsx.writeBuffer()), conteo };
}
