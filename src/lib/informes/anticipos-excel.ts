import "server-only";
import ExcelJS from "exceljs";
import { ZONA } from "@/lib/fechas";
import { ESTADOS_ANTICIPO, type FilaAnticipo } from "./anticipos";

const AZUL = "FF1E3A8A";
const AZUL_SUAVE = "FFE8EEFB";
const GRIS = "FF64748B";
const BORDE = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const PESOS = '"$" #,##0;[Red]-"$" #,##0';
const dia = (f: string) => new Date(`${f}T00:00:00Z`);

/**
 * Excel del reporte «Anticipos» con el estilo de los demás informes. Al final, los totales por estado:
 * solo los confirmados suman al saldo de los compradores.
 */
export async function informeAnticiposExcel(filas: FilaAnticipo[], filtros: string, generadoPor: string): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "BancoTicket";
  const hoja = libro.addWorksheet("Anticipos", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  hoja.columns = [{ width: 13 }, { width: 28 }, { width: 18 }, { width: 22 }, { width: 40 }, { width: 24 }, { width: 12 }];
  hoja.mergeCells("A1:G1");
  const t = hoja.getCell("A1");
  t.value = "BancoTicket · Informe de anticipos";
  t.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  t.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 34;
  hoja.mergeCells("A2:G2");
  hoja.getCell("A2").value = filtros;
  hoja.getCell("A2").font = { color: { argb: GRIS } };
  hoja.mergeCells("A3:G3");
  hoja.getCell("A3").value = `Generado el ${new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, dateStyle: "long", timeStyle: "short" }).format(new Date())} por ${generadoPor}`;
  hoja.getCell("A3").font = { size: 10, italic: true, color: { argb: GRIS } };

  const enc = hoja.getRow(5);
  enc.values = ["Fecha", "Comprador", "Monto", "Estado", "Nota", "Registrado por", "Soporte"];
  enc.height = 24;
  enc.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
  const nombre = (e: string) => ESTADOS_ANTICIPO.find(([v]) => v === e)?.[1] ?? e;
  filas.forEach((a, i) => {
    const r = hoja.getRow(6 + i);
    r.values = [dia(a.fecha), a.comprador, a.monto, nombre(a.estado),
      [a.nota, a.estado === "en_disputa" && a.motivo_disputa ? `Disputa: ${a.motivo_disputa}` : null].filter(Boolean).join(" · ") || null,
      a.registrador, a.soporte_ruta ? "Sí" : "No"];
    r.getCell(1).numFmt = "dd/mm/yyyy";
    r.getCell(3).numFmt = PESOS;
    r.getCell(7).alignment = { horizontal: "center" };
    r.eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: BORDE, left: BORDE, right: BORDE };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_SUAVE } };
    });
  });

  // Totales por estado (fórmulas: si editan un monto, se actualizan).
  const primera = 6, ultima = 5 + filas.length;
  let fila = ultima + 2;
  for (const [valor, texto] of ESTADOS_ANTICIPO) {
    const delEstado = filas.filter((a) => a.estado === valor);
    const r = hoja.getRow(fila++);
    r.values = [`${texto} (${delEstado.length})${valor === "confirmado" ? " · suman al saldo" : " · no cuentan aún"}`, null,
      filas.length ? { formula: `SUMIF(D${primera}:D${ultima},"${texto}",C${primera}:C${ultima})`, result: delEstado.reduce((s, a) => s + a.monto, 0) } : 0];
    hoja.mergeCells(`A${r.number}:B${r.number}`);
    r.getCell(3).numFmt = PESOS;
    r.eachCell({ includeEmpty: true }, (c) => {
      c.font = { bold: true, color: { argb: AZUL } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE4F7" } };
    });
  }
  const nota = hoja.getCell(`A${fila + 1}`);
  nota.value = "Montos negativos: saldo a favor del comprador (la administración le debe).";
  nota.font = { size: 10, italic: true, color: { argb: GRIS } };
  if (filas.length) hoja.autoFilter = { from: "A5", to: `G${ultima}` };
  return Buffer.from(await libro.xlsx.writeBuffer());
}
