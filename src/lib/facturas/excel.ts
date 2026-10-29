import "server-only";
import ExcelJS from "exceljs";
import { ZONA } from "@/lib/fechas";
import { NOMBRE_ESTADO } from "./tipos";
import type { FilaFactura } from "./consulta";

const AZUL = "FF1E3A8A";
const AZUL_SUAVE = "FFE8EEFB";
const GRIS = "FF64748B";
const BORDE = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
const PESOS = '"$" #,##0';

/** Fecha «aaaa-mm-dd» como fecha de Excel (día de Colombia). */
const dia = (f: string | null) => (f ? new Date(`${f}T00:00:00Z`) : null);

/**
 * Excel de la lista de facturas (decisión del usuario: todo reporte tiene Excel), con el mismo estilo
 * de los demás informes y totales con fórmulas. Las anuladas salen, pero no suman.
 */
export async function informeFacturasExcel(filas: FilaFactura[], filtros: string, generadoPor: string): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "BancoTicket";
  const hoja = libro.addWorksheet("Facturas", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  hoja.columns = [
    { width: 14 }, { width: 30 }, { width: 30 }, { width: 13 }, { width: 13 }, { width: 13 },
    { width: 19 }, { width: 19 }, { width: 19 }, { width: 18 }, { width: 10 }, { width: 26 },
  ];
  hoja.mergeCells("A1:L1");
  const t = hoja.getCell("A1");
  t.value = "BancoTicket · Facturas de venta";
  t.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  t.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 34;
  hoja.mergeCells("A2:L2");
  hoja.getCell("A2").value = filtros;
  hoja.getCell("A2").font = { color: { argb: GRIS } };
  hoja.mergeCells("A3:L3");
  hoja.getCell("A3").value = `Generado el ${new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, dateStyle: "long", timeStyle: "short" }).format(new Date())} por ${generadoPor}`;
  hoja.getCell("A3").font = { size: 10, italic: true, color: { argb: GRIS } };

  const enc = hoja.getRow(5);
  enc.values = ["Factura", "Extractora", "Emisor", "Emisión", "Vencimiento", "Kilos", "Subtotal + IVA", "Aplicado", "Saldo", "Estado", "Días mora", "Alertas"];
  enc.height = 24;
  enc.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  const primera = 6;
  filas.forEach((f, i) => {
    const r = hoja.getRow(primera + i);
    const anulada = f.estado_cobro === "ANULADA";
    r.values = [
      f.numero_factura, f.extractora_razon_social ?? "—", f.emisor_razon_social ?? "—", dia(f.fecha_emision), dia(f.fecha_vencimiento), f.kilos,
      anulada ? 0 : f.total_cobrar, anulada ? 0 : f.total_aplicado, anulada ? 0 : f.saldo_pendiente,
      NOMBRE_ESTADO[f.estado_cobro] + (f.estado_lectura === "PENDIENTE_REVISION" ? " (en revisión)" : ""), f.vencida ? f.dias_mora : null,
      [f.vencida && "Vencida", f.alerta_sobrepago && "Sobrepago", f.alerta_retenciones && "Retenciones"].filter(Boolean).join(", ") || null,
    ];
    r.getCell(4).numFmt = "dd/mm/yyyy";
    r.getCell(5).numFmt = "dd/mm/yyyy";
    r.getCell(6).numFmt = "#,##0";
    for (const c of [7, 8, 9]) r.getCell(c).numFmt = PESOS;
    r.eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: BORDE, left: BORDE, right: BORDE };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_SUAVE } };
      if (anulada) c.font = { color: { argb: GRIS }, strike: true };
    });
  });

  const ultima = primera + filas.length - 1;
  const total = hoja.getRow(ultima + 1);
  const hay = filas.length > 0;
  const vig = filas.filter((f) => f.estado_cobro !== "ANULADA");
  const suma = (col: string, valor: number) => (hay ? { formula: `SUM(${col}${primera}:${col}${ultima})`, result: valor } : 0);
  total.values = [`TOTAL (${vig.length} factura${vig.length === 1 ? "" : "s"} vigentes)`, null, null, null, null,
    suma("F", vig.reduce((s, f) => s + (f.kilos ?? 0), 0)),
    suma("G", vig.reduce((s, f) => s + f.total_cobrar, 0)), suma("H", vig.reduce((s, f) => s + f.total_aplicado, 0)),
    suma("I", vig.reduce((s, f) => s + f.saldo_pendiente, 0))];
  hoja.mergeCells(`A${ultima + 1}:E${ultima + 1}`);
  total.getCell(6).numFmt = "#,##0";
  for (const c of [7, 8, 9]) total.getCell(c).numFmt = PESOS;
  total.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true, size: 12, color: { argb: AZUL } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE4F7" } };
    c.border = { top: { style: "double", color: { argb: AZUL } } };
  });
  if (hay) hoja.autoFilter = { from: "A5", to: `L${ultima}` };
  return Buffer.from(await libro.xlsx.writeBuffer());
}
