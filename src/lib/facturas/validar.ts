/**
 * Validaciones de una factura antes de guardarla (sin dependencias: navegador, servidor y pruebas).
 * Si alguna falla, la factura se guarda como PENDIENTE_REVISION y se muestra resaltada.
 */
import type { FacturaLeida } from "./tipos";
import { comprobarFactura, pesos, type TarifasFactura } from "./comprobacion";

export type Validacion = { nombre: string; ok: boolean; mensaje: string };

/** Si la factura no trae el precio por kilo, se calcula subtotal / kilos. */
export function completarPrecio<T extends Pick<FacturaLeida, "kilos" | "precio_kilo" | "subtotal">>(d: T): T {
  if (d.precio_kilo == null && d.kilos && d.subtotal != null) return { ...d, precio_kilo: Math.round((d.subtotal / d.kilos) * 100) / 100 };
  return d;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function validarFactura(d: FacturaLeida): Validacion[] {
  const v: Validacion[] = [];
  const faltan = ([
    ["N° de factura", d.numero_factura], ["CUFE", d.cufe], ["emisor", d.emisor_razon_social], ["extractora", d.extractora_razon_social],
    ["fecha de emisión", d.fecha_emision], ["kilos", d.kilos], ["subtotal", d.subtotal], ["IVA", d.iva], ["total a pagar", d.total_a_pagar],
  ] as const).filter(([, x]) => x == null || x === "").map(([n]) => n);
  v.push({ nombre: "Campos completos", ok: faltan.length === 0, mensaje: faltan.length ? `Falta: ${faltan.join(", ")}` : "Todos los datos principales están" });

  const fechas = ([["emisión", d.fecha_emision], ["vencimiento", d.fecha_vencimiento], ["periodo desde", d.periodo_desde], ["periodo hasta", d.periodo_hasta]] as const)
    .filter(([, f]) => f && (!FECHA.test(f) || Number.isNaN(new Date(`${f}T12:00:00-05:00`).getTime())));
  v.push({ nombre: "Fechas", ok: fechas.length === 0, mensaje: fechas.length ? `Fecha no válida: ${fechas.map(([n]) => n).join(", ")}` : "Fechas válidas" });
  return v;
}

/** Validaciones + cada cálculo de la comprobación que no coincide (decide si la factura queda en revisión). */
export function fallasFactura(d: FacturaLeida, t: TarifasFactura): string[] {
  return [
    ...validarFactura(d).filter((v) => !v.ok).map((v) => `${v.nombre}: ${v.mensaje}`),
    ...comprobarFactura(d, t).filter((c) => !c.ok).map((c) => `${c.nombre}: ${c.diferencia == null ? "falta un dato" : `diferencia ${pesos(Math.abs(c.diferencia))}`}`),
  ];
}

/** Tipo real del archivo por su contenido (primeros bytes), no por la extensión. */
export function tipoReal(b: Uint8Array): "pdf" | "jpeg" | "png" | "webp" | null {
  const es = (...x: number[]) => x.every((n, i) => b[i] === n);
  if (es(0x25, 0x50, 0x44, 0x46)) return "pdf"; // %PDF
  if (es(0xff, 0xd8, 0xff)) return "jpeg";
  if (es(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (es(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp"; // RIFF....WEBP
  return null;
}

export const MAX_BYTES_FACTURA = 4 * 1024 * 1024;
