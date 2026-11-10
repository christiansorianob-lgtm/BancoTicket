import "server-only";
import ExcelJS from "exceljs";
import { ZONA } from "@/lib/fechas";
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
    { width: 19 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 17 }, { width: 19 }, { width: 13 }, { width: 30 },
  ];
  hoja.mergeCells("A1:N1");
  const t = hoja.getCell("A1");
  t.value = "BancoTicket · Facturas de venta";
  t.font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  t.alignment = { vertical: "middle", indent: 1 };
  hoja.getRow(1).height = 34;
  hoja.mergeCells("A2:N2");
  hoja.getCell("A2").value = filtros;
  hoja.getCell("A2").font = { color: { argb: GRIS } };
  hoja.mergeCells("A3:N3");
  hoja.getCell("A3").value = `Generado el ${new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, dateStyle: "long", timeStyle: "short" }).format(new Date())} por ${generadoPor}`;
  hoja.getCell("A3").font = { size: 10, italic: true, color: { argb: GRIS } };

  const enc = hoja.getRow(5);
  // Cada impuesto en su propia columna (decisión del usuario), como el bloque de totales de la factura.
  enc.values = ["Factura", "Cliente", "Emisor", "Emisión", "Vencimiento", "Kilos", "Subtotal", "IVA", "ReteFuente", "ReteIVA", "ReteICA",
    "Total a pagar", "Estado", "Tarifas (impresas en la factura)"];
  enc.height = 24;
  enc.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  const primera = 6;
  filas.forEach((f, i) => {
    const r = hoja.getRow(primera + i);
    const anulada = f.anulada;
    r.values = [
      f.numero_factura, f.cliente_nombre ?? f.extractora_razon_social ?? "—", f.emisor_razon_social ?? "—", dia(f.fecha_emision), dia(f.fecha_vencimiento), f.kilos,
      ...(anulada ? [0, 0, 0, 0, 0, 0] : [f.subtotal, f.iva, f.retefuente, f.reteiva, f.reteica, f.total_a_pagar]),
      anulada ? "Anulada" : "Aprobada",
      ([["IVA", f.iva_pct], ["ReteFuente", f.retefuente_pct], ["ReteIVA", f.reteiva_pct], ["ReteICA", f.reteica_pct]] as const)
        .filter(([, v]) => v != null).map(([n, v]) => `${n} ${Number(v).toLocaleString("es-CO")} %`).join(" · ") || "—",
    ];
    r.getCell(4).numFmt = "dd/mm/yyyy";
    r.getCell(5).numFmt = "dd/mm/yyyy";
    r.getCell(6).numFmt = "#,##0";
    for (let c = 7; c <= 12; c++) r.getCell(c).numFmt = PESOS;
    r.eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: BORDE, left: BORDE, right: BORDE };
      if (i % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_SUAVE } };
      if (anulada) c.font = { color: { argb: GRIS }, strike: true };
    });
  });

  const ultima = primera + filas.length - 1;
  const total = hoja.getRow(ultima + 1);
  const hay = filas.length > 0;
  const vig = filas.filter((f) => !f.anulada);
  const suma = (col: string, valor: number) => (hay ? { formula: `SUM(${col}${primera}:${col}${ultima})`, result: valor } : 0);
  total.values = [`TOTAL (${vig.length} factura${vig.length === 1 ? "" : "s"} aprobada${vig.length === 1 ? "" : "s"})`, null, null, null, null,
    suma("F", vig.reduce((s, f) => s + (f.kilos ?? 0), 0)),
    ...(["subtotal", "iva", "retefuente", "reteiva", "reteica", "total_a_pagar"] as const)
      .map((k, j) => suma(String.fromCharCode(71 + j), vig.reduce((s, f) => s + f[k], 0)))];
  hoja.mergeCells(`A${ultima + 1}:E${ultima + 1}`);
  total.getCell(6).numFmt = "#,##0";
  for (let c = 7; c <= 12; c++) total.getCell(c).numFmt = PESOS;
  total.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true, size: 12, color: { argb: AZUL } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE4F7" } };
    c.border = { top: { style: "double", color: { argb: AZUL } } };
  });
  if (hay) hoja.autoFilter = { from: "A5", to: `N${ultima}` };
  return Buffer.from(await libro.xlsx.writeBuffer());
}
