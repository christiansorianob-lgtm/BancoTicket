/**
 * Formulario de la factura (sin dependencias de servidor): los números se muestran y se escriben en
 * formato colombiano (punto de miles, coma decimal) y se leen con montoDesdeTexto.
 */
import { montoDesdeTexto } from "@/lib/numeros";
import type { FacturaLeida } from "./tipos";

export const CAMPOS_TEXTO = ["numero_factura", "cufe", "emisor_razon_social", "emisor_nit", "extractora_razon_social", "extractora_nit"] as const;
export const CAMPOS_FECHA = ["fecha_emision", "fecha_vencimiento", "periodo_desde", "periodo_hasta"] as const;
export const CAMPOS_NUMERO = ["kilos", "precio_kilo", "subtotal", "iva", "total_retenciones_esperadas", "total_a_pagar"] as const;

/** Número para mostrar en un campo editable: 142060536.75 → "142.060.536,75". */
export function numeroEnCampo(n: number | null | undefined): string {
  return n == null ? "" : n.toLocaleString("es-CO", { maximumFractionDigits: 2, useGrouping: true });
}

/** Lee el formulario (o cualquier fuente clave → texto) como datos de factura. Vacío = null. */
export function facturaDesde(leer: (clave: string) => string | null | undefined): FacturaLeida {
  const t = (k: string) => (leer(k) ?? "").trim() || null;
  const datos = {} as Record<string, unknown>;
  for (const k of CAMPOS_TEXTO) datos[k] = t(k);
  for (const k of CAMPOS_FECHA) datos[k] = t(k);
  for (const k of CAMPOS_NUMERO) datos[k] = t(k) == null ? null : montoDesdeTexto(t(k)!);
  // Retenciones: 0 si no aplican, nunca null (decisión del usuario).
  if (datos.total_retenciones_esperadas == null) datos.total_retenciones_esperadas = 0;
  return datos as FacturaLeida;
}
