import "server-only";
import ExcelJS from "exceljs";
import { ZONA } from "@/lib/fechas";

export type FilaInforme = {
  comprador: string;
  extractora: string;
  fecha_entrada: string; // ISO
  numero: string;
  peso_neto_t: number;
  precio_tonelada: number | null;
  valor: number | null;
};

const AZUL = "FF1E3A8A";
const AZUL_SUAVE = "FFE8EEFB";
const GRIS = "FF64748B";
const BORDE = { style: "thin" as const, color: { argb: "FFCBD5E1" } };

/** Fecha y hora de Colombia como fecha de Excel (Excel no guarda zona horaria). */
function fechaExcel(iso: string): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute));
}

/**
 * Informe ejecutivo de tiquetes: título, filtros aplicados, tabla con encabezado de color,
 * filas alternas, formatos de toneladas y pesos, y fila de totales con fórmulas.
 */
export async function informeTiquetesExcel(filas: FilaInforme[], filtros: string, generadoPor: string): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "BancoTicket";
  libro.created = new Date();
  const hoja = libro.addWorksheet("Tiquetes", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  hoja.columns = [
    { key: "comprador", width: 28 },
    { key: "extractora", width: 20 },
    { key: "fecha", width: 18 },
    { key: "numero", width: 16 },
    { key: "neto", width: 16 },
    { key: "precio", width: 20 },
    { key: "total", width: 22 },
  ];

  // Encabezado del informe
  hoja.mergeCells("A1:G1");
  const titulo = hoja.getCell("A1");
  titulo.value = "BancoTicket · Informe de tiquetes";
  titulo.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  titulo.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 34;

  hoja.mergeCells("A2:G2");
  hoja.getCell("A2").value = filtros;
  hoja.getCell("A2").font = { size: 11, color: { argb: GRIS } };
  hoja.getCell("A2").alignment = { indent: 1 };

  hoja.mergeCells("A3:G3");
  const generado = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, dateStyle: "long", timeStyle: "short" }).format(new Date());
  hoja.getCell("A3").value = `Generado el ${generado} por ${generadoPor}`;
  hoja.getCell("A3").font = { size: 10, italic: true, color: { argb: GRIS } };
  hoja.getCell("A3").alignment = { indent: 1 };

  // Tabla
  const encabezado = hoja.getRow(5);
  encabezado.values = ["Comprador", "Extractora", "Fecha", "N° Tiquete", "Peso neto (t)", "Precio por tonelada", "Precio total"];
  encabezado.height = 24;
  encabezado.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
  });

  const primera = 6;
  filas.forEach((f, i) => {
    const fila = hoja.getRow(primera + i);
    fila.values = [f.comprador, f.extractora, fechaExcel(f.fecha_entrada), f.numero, Number(f.peso_neto_t),
      f.precio_tonelada == null ? "Sin precio" : Number(f.precio_tonelada), f.valor == null ? null : Number(f.valor)];
    fila.getCell(3).numFmt = "dd/mm/yyyy hh:mm";
    fila.getCell(4).alignment = { horizontal: "center" };
    fila.getCell(5).numFmt = "#,##0.000";
    fila.getCell(6).numFmt = '"$" #,##0';
    fila.getCell(7).numFmt = '"$" #,##0';
    if (f.precio_tonelada == null) {
      fila.getCell(6).font = { italic: true, color: { argb: "FFB45309" } };
      fila.getCell(6).alignment = { horizontal: "right" };
    }
    fila.eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: BORDE, left: BORDE, right: BORDE };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_SUAVE } };
    });
  });

  // Totales (con fórmulas: si editan una celda, el total se actualiza)
  const ultima = primera + filas.length - 1;
  const total = hoja.getRow(ultima + 1);
  const conFilas = filas.length > 0;
  total.values = [
    `TOTAL (${filas.length} tiquete${filas.length === 1 ? "" : "s"})`, null, null, null,
    conFilas ? { formula: `SUM(E${primera}:E${ultima})`, result: filas.reduce((s, f) => s + Number(f.peso_neto_t), 0) } : 0,
    null,
    conFilas ? { formula: `SUM(G${primera}:G${ultima})`, result: filas.reduce((s, f) => s + Number(f.valor ?? 0), 0) } : 0,
  ];
  hoja.mergeCells(`A${ultima + 1}:D${ultima + 1}`);
  total.height = 22;
  total.getCell(5).numFmt = "#,##0.000";
  total.getCell(7).numFmt = '"$" #,##0';
  total.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true, size: 12, color: { argb: AZUL } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE4F7" } };
    c.border = { top: { style: "double", color: { argb: AZUL } }, bottom: BORDE };
    c.alignment = { vertical: "middle" };
  });

  if (conFilas) hoja.autoFilter = { from: "A5", to: `G${ultima}` };
  if (filas.some((f) => f.precio_tonelada == null)) {
    const nota = hoja.getCell(`A${ultima + 3}`);
    nota.value = "Los tiquetes «Sin precio» no suman al precio total hasta que se les asigne precio.";
    nota.font = { size: 10, italic: true, color: { argb: GRIS } };
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}
