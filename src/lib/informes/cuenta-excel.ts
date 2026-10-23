import "server-only";
import ExcelJS from "exceljs";
import { ZONA } from "@/lib/fechas";
import type { Cuenta } from "./movimientos";

const AZUL = "FF1E3A8A";
const AZUL_SUAVE = "FFE8EEFB";
const GRIS = "FF64748B";
const VERDE = "FF15803D";
const AMBAR = "FFB45309";
const BORDE = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const PESOS = '"$" #,##0';
// El saldo es un número (con fórmula), pero se lee con las palabras de la app.
const SALDO = '"Saldo a mi favor $" #,##0;"Le debo $" #,##0;"Cuenta al día"';

/** Fecha y hora de Colombia como fecha de Excel (Excel no guarda zona horaria). */
function fechaExcel(iso: string): Date {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute));
}

/**
 * Excel del reporte «Tiquetes y anticipos»: mismo estilo del informe de tiquetes, con el saldo
 * acumulado como fórmula (saldo anterior + anticipo − valor del tiquete) y totales con fórmulas.
 */
export async function informeCuentaExcel(cuenta: Cuenta, conInicial: boolean, filtros: string, generadoPor: string): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "BancoTicket";
  libro.created = new Date();
  const hoja = libro.addWorksheet("Tiquetes y anticipos", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  hoja.columns = [
    { key: "fecha", width: 18 },
    { key: "tipo", width: 12 },
    { key: "detalle", width: 32 },
    { key: "entrada", width: 18 },
    { key: "neto", width: 14 },
    { key: "precio", width: 16 },
    { key: "valor", width: 18 },
    { key: "anticipo", width: 18 },
    { key: "saldo", width: 28 },
    { key: "obs", width: 18 },
  ];

  hoja.mergeCells("A1:J1");
  const titulo = hoja.getCell("A1");
  titulo.value = "BancoTicket · Tiquetes y anticipos";
  titulo.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  titulo.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 34;

  hoja.mergeCells("A2:J2");
  hoja.getCell("A2").value = filtros;
  hoja.getCell("A2").font = { size: 11, color: { argb: GRIS } };
  hoja.getCell("A2").alignment = { indent: 1 };

  hoja.mergeCells("A3:J3");
  const generado = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, dateStyle: "long", timeStyle: "short" }).format(new Date());
  hoja.getCell("A3").value = `Generado el ${generado} por ${generadoPor}`;
  hoja.getCell("A3").font = { size: 10, italic: true, color: { argb: GRIS } };
  hoja.getCell("A3").alignment = { indent: 1 };

  const encabezado = hoja.getRow(5);
  encabezado.values = ["Fecha de registro", "Tipo", "Detalle", "Fecha entrada fruta", "Peso neto (t)", "Precio por tonelada", "Valor tiquete", "Anticipo", "Saldo", "Observación"];
  encabezado.height = 24;
  encabezado.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE };
  });

  let fila = 6;
  if (conInicial) {
    const r = hoja.getRow(fila);
    r.values = ["Saldo que traía antes del período", null, null, null, null, null, null, null, cuenta.saldoInicial, null];
    hoja.mergeCells(`A${fila}:H${fila}`);
    r.getCell(9).numFmt = SALDO;
    r.eachCell({ includeEmpty: true }, (c) => {
      c.font = { bold: true, color: { argb: AZUL } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE4F7" } };
      c.border = { bottom: BORDE, left: BORDE, right: BORDE };
    });
    fila++;
  }

  const primera = fila;
  cuenta.movimientos.forEach((m, i) => {
    const r = hoja.getRow(fila);
    const anterior = fila === 6 ? "0" : `I${fila - 1}`;
    const esTiquete = m.tipo === "tiquete";
    r.values = [
      fechaExcel(m.fecha), esTiquete ? "Tiquete" : "Anticipo", m.detalle,
      m.fecha_entrada ? fechaExcel(m.fecha_entrada) : null,
      m.peso_neto_t,
      esTiquete ? (m.precio_tonelada == null ? "Sin precio" : m.precio_tonelada) : null,
      m.valor, m.anticipo,
      { formula: `${anterior}+N(H${fila})-N(G${fila})`, result: m.saldo },
      m.observacion,
    ];
    r.getCell(1).numFmt = "dd/mm/yyyy hh:mm";
    r.getCell(4).numFmt = "dd/mm/yyyy hh:mm";
    r.getCell(5).numFmt = "#,##0.000";
    r.getCell(6).numFmt = PESOS;
    r.getCell(7).numFmt = PESOS;
    r.getCell(8).numFmt = PESOS;
    r.getCell(9).numFmt = SALDO;
    r.getCell(2).font = { bold: true, color: { argb: esTiquete ? AZUL : VERDE } };
    r.getCell(3).alignment = { wrapText: true, vertical: "top" };
    if (esTiquete && m.precio_tonelada == null) {
      r.getCell(6).font = { italic: true, color: { argb: AMBAR } };
      r.getCell(6).alignment = { horizontal: "right" };
    }
    r.getCell(9).font = { bold: true, color: { argb: m.saldo > 0 ? VERDE : m.saldo < 0 ? AMBAR : AZUL } };
    r.getCell(10).font = { italic: true, color: { argb: AMBAR } };
    r.eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: BORDE, left: BORDE, right: BORDE };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_SUAVE } };
    });
    fila++;
  });

  const ultima = fila - 1;
  const conFilas = cuenta.movimientos.length > 0;
  const n = cuenta.movimientos.length;
  const total = hoja.getRow(fila);
  total.values = [
    `TOTAL (${n} movimiento${n === 1 ? "" : "s"})`, null, null, null, null, null,
    conFilas ? { formula: `SUM(G${primera}:G${ultima})`, result: cuenta.totalTiquetes } : 0,
    conFilas ? { formula: `SUM(H${primera}:H${ultima})`, result: cuenta.totalAnticipos } : 0,
    ultima >= 6 ? { formula: `I${ultima}`, result: cuenta.saldoFinal } : 0,
    null,
  ];
  hoja.mergeCells(`A${fila}:F${fila}`);
  total.height = 22;
  total.getCell(7).numFmt = PESOS;
  total.getCell(8).numFmt = PESOS;
  total.getCell(9).numFmt = SALDO;
  total.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true, size: 12, color: { argb: AZUL } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE4F7" } };
    c.border = { top: { style: "double", color: { argb: AZUL } }, bottom: BORDE };
    c.alignment = { vertical: "middle" };
  });

  const nota = hoja.getCell(`A${fila + 2}`);
  nota.value = "Saldo = anticipos confirmados − valor de tiquetes con precio. Los tiquetes «Sin precio» no mueven el saldo hasta que se les asigne precio.";
  nota.font = { size: 10, italic: true, color: { argb: GRIS } };

  return Buffer.from(await libro.xlsx.writeBuffer());
}
