import "server-only";
import ExcelJS from "exceljs";
import { ZONA } from "@/lib/fechas";
import { formatoNit, NOMBRE_FORMA_PAGO, type ClienteSaldo } from "./tipos";
import type { Movimiento } from "./cuenta";

const AZUL = "FF1E3A8A";
const AZUL_SUAVE = "FFE8EEFB";
const GRIS = "FF64748B";
const BORDE = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const PESOS = '"$" #,##0.00';
const dia = (f: string | null) => (f ? new Date(`${f}T00:00:00Z`) : null);

/** Excel de la cuenta de un cliente: facturas y abonos por fecha con el saldo acumulado. */
export async function cuentaClienteExcel(c: ClienteSaldo, movimientos: Movimiento[], generadoPor: string): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "BancoTicket";
  const hoja = libro.addWorksheet("Cuenta", {
    views: [{ state: "frozen", ySplit: 7, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  hoja.columns = [{ width: 13 }, { width: 22 }, { width: 30 }, { width: 34 }, { width: 18 }, { width: 18 }, { width: 19 }, { width: 14 }];
  hoja.mergeCells("A1:H1");
  const t = hoja.getCell("A1");
  t.value = `BancoTicket · Cuenta de ${c.nombre}`;
  t.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  t.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 32;
  hoja.mergeCells("A2:H2");
  hoja.getCell("A2").value = `NIT ${formatoNit(c.nit)}`;
  hoja.mergeCells("A3:H3");
  hoja.getCell("A3").value = c.deuda > 1 ? `Le debe: $ ${c.deuda.toLocaleString("es-CO", { maximumFractionDigits: 2 })}`
    : c.deuda < -1 ? `Saldo a favor del cliente: $ ${(-c.deuda).toLocaleString("es-CO", { maximumFractionDigits: 2 })}` : "Cuenta al día";
  hoja.getCell("A3").font = { size: 14, bold: true, color: { argb: c.deuda > 1 ? "FFB45309" : "FF15803D" } };
  hoja.mergeCells("A4:H4");
  hoja.getCell("A4").value = `Facturado ${c.facturado.toLocaleString("es-CO")} · Abonado ${c.abonado.toLocaleString("es-CO")} · ${c.facturas} factura(s) aprobada(s)`;
  hoja.getCell("A4").font = { color: { argb: GRIS } };
  hoja.mergeCells("A5:H5");
  hoja.getCell("A5").value = `Generado el ${new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, dateStyle: "long", timeStyle: "short" }).format(new Date())} por ${generadoPor}`;
  hoja.getCell("A5").font = { size: 10, italic: true, color: { argb: GRIS } };

  const enc = hoja.getRow(7);
  enc.values = ["Fecha", "Movimiento", "Emisor / quién abona", "Referencia / observación", "Factura (+)", "Abono (−)", "Saldo", "Estado"];
  enc.height = 24;
  enc.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  movimientos.forEach((m, i) => {
    const r = hoja.getRow(8 + i);
    r.values = [
      dia(m.fecha), m.tipo === "factura" ? m.detalle : `Abono · ${NOMBRE_FORMA_PAGO[m.forma_pago!]}`,
      m.tipo === "factura" ? m.emisor ?? "—" : m.realizado_por ?? "—",
      [m.referencia && `Ref. ${m.referencia}`, m.observacion, !m.vigente && m.anulado_motivo && `Anulado: ${m.anulado_motivo}`].filter(Boolean).join(" · ") || null,
      m.cargo || null, m.abono || null, m.saldo, m.vigente ? "Vigente" : "Anulado (no cuenta)",
    ];
    r.getCell(1).numFmt = "dd/mm/yyyy";
    for (const col of [5, 6, 7]) r.getCell(col).numFmt = PESOS;
    r.eachCell({ includeEmpty: true }, (celda) => {
      celda.border = { bottom: BORDE, left: BORDE, right: BORDE };
      if (i % 2 === 1) celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_SUAVE } };
      if (!m.vigente) celda.font = { color: { argb: GRIS }, strike: true };
    });
  });
  if (movimientos.length) hoja.autoFilter = { from: "A7", to: `H${7 + movimientos.length}` };
  return Buffer.from(await libro.xlsx.writeBuffer());
}
