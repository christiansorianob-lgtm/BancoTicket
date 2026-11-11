/**
 * Validaciones de una factura antes de guardarla (sin dependencias: navegador, servidor y pruebas).
 * Lo que falte o no cuadre se muestra al aprobar y queda anotado en la factura (motivo_revision).
 */
import { formatoNit, nitDigitos, totalRetenciones, type FacturaLeida } from "./tipos";
import { comprobarFactura, pesos, type TarifasPorTipo } from "./comprobacion";

export type Validacion = { nombre: string; ok: boolean; mensaje: string };

/** Si la factura no trae el precio por kilo, se calcula subtotal / kilos. */
export function completarPrecio<T extends Pick<FacturaLeida, "kilos" | "precio_kilo" | "subtotal">>(d: T): T {
  if (d.precio_kilo == null && d.kilos && d.subtotal != null) return { ...d, precio_kilo: Math.round((d.subtotal / d.kilos) * 100) / 100 };
  return d;
}

/** Dígito de verificación de un NIT colombiano (algoritmo de la DIAN). */
export function digitoVerificacion(base: string): number {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const r = [...base].reverse().reduce((s, d, i) => s + Number(d) * pesos[i], 0) % 11;
  return r < 2 ? r : 11 - r;
}

/**
 * NIT de empresa leído SIN dígito de verificación (9 dígitos y sin guion, como en las facturas de
 * «Solución Gratuita DIAN»): se le agrega el dígito calculado para que sea el mismo cliente o emisor que
 * ya está registrado con él (901253217 → 901.253.217-5). Si trae guion o no tiene 9 dígitos, no cambia.
 */
export function completarNit(nit: string | null): string | null {
  const d = nitDigitos(nit);
  if (!nit || nit.includes("-") || d.length !== 9) return nit;
  return formatoNit(`${d}${digitoVerificacion(d)}`);
}

/**
 * Ajustes sin IA a lo leído (decisión del usuario 2026-11-10), con un aviso por cada uno:
 *  - NIT del cliente y del emisor sin dígito de verificación → se completa.
 *  - Facturas sin «Total a pagar» (Solución Gratuita DIAN): su «Total factura» es subtotal + IVA y las
 *    retenciones van aparte. Si el total leído es subtotal + IVA (± $ 1) y hay retenciones, el total a
 *    pagar es ese total menos las retenciones.
 */
export function ajustarLectura(d: FacturaLeida): { datos: FacturaLeida; avisos: string[] } {
  const avisos: string[] = [];
  const datos = { ...d };
  for (const [campo, nombre] of [["extractora_nit", "del cliente"], ["emisor_nit", "del emisor"]] as const) {
    const completo = completarNit(datos[campo]);
    if (completo !== datos[campo]) {
      avisos.push(`El NIT ${nombre} venía sin dígito de verificación (${datos[campo]}): se completó como ${completo}.`);
      datos[campo] = completo;
    }
  }
  const ret = totalRetenciones(datos);
  if (ret > 0 && datos.subtotal != null && datos.iva != null && datos.total_a_pagar != null
      && Math.abs(datos.total_a_pagar - (datos.subtotal + datos.iva)) <= 1) {
    const neto = Math.round((datos.total_a_pagar - ret) * 100) / 100;
    avisos.push(`Esta factura no trae «Total a pagar»: su total (${pesos(datos.total_a_pagar)}) es antes de retenciones. Se calculó el total a pagar restando las retenciones: ${pesos(neto)}.`);
    datos.total_a_pagar = neto;
  }
  return { datos, avisos };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function validarFactura(d: FacturaLeida): Validacion[] {
  const v: Validacion[] = [];
  const faltan = ([
    ["N° de factura", d.numero_factura], ["CUFE", d.cufe], ["emisor", d.emisor_razon_social], ["cliente", d.extractora_razon_social], ["NIT del cliente", d.extractora_nit],
    ["fecha de emisión", d.fecha_emision], ["kilos", d.kilos], ["subtotal", d.subtotal], ["IVA", d.iva], ["total a pagar", d.total_a_pagar],
  ] as const).filter(([, x]) => x == null || x === "").map(([n]) => n);
  v.push({ nombre: "Campos completos", ok: faltan.length === 0, mensaje: faltan.length ? `Falta: ${faltan.join(", ")}` : "Todos los datos principales están" });

  const fechas = ([["emisión", d.fecha_emision], ["vencimiento", d.fecha_vencimiento], ["periodo desde", d.periodo_desde], ["periodo hasta", d.periodo_hasta]] as const)
    .filter(([, f]) => f && (!FECHA.test(f) || Number.isNaN(new Date(`${f}T12:00:00-05:00`).getTime())));
  v.push({ nombre: "Fechas", ok: fechas.length === 0, mensaje: fechas.length ? `Fecha no válida: ${fechas.map(([n]) => n).join(", ")}` : "Fechas válidas" });
  return v;
}

/** Validaciones + cada cálculo de la comprobación que no coincide (decide si la factura queda en revisión). */
export function fallasFactura(d: FacturaLeida, t: TarifasPorTipo): string[] {
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
