import { z } from "zod";

/** Lo que la IA devuelve de una factura de venta (null si no está o no se lee con claridad). */
export const FacturaLeida = z.object({
  numero_factura: z.string().nullable().describe("Número de la factura, ej. FEIA 669"),
  cufe: z.string().nullable().describe("CUFE completo"),
  emisor_razon_social: z.string().nullable(),
  emisor_nit: z.string().nullable(),
  extractora_razon_social: z.string().nullable().describe("Cliente/adquiriente de la factura"),
  extractora_nit: z.string().nullable(),
  fecha_emision: z.string().nullable().describe("AAAA-MM-DD"),
  fecha_vencimiento: z.string().nullable().describe("AAAA-MM-DD"),
  periodo_desde: z.string().nullable().describe("AAAA-MM-DD, de la descripción del ítem"),
  periodo_hasta: z.string().nullable().describe("AAAA-MM-DD, de la descripción del ítem"),
  kilos: z.number().nullable(),
  precio_kilo: z.number().nullable(),
  subtotal: z.number().nullable(),
  iva: z.number().nullable(),
  retefuente: z.number().nullable().describe("Valor de la línea Retefuente del bloque de totales; 0 si no aparece"),
  reteiva: z.number().nullable().describe("Valor de la línea ReteIVA; 0 si no aparece"),
  reteica: z.number().nullable().describe("Valor de la línea ReteICA; 0 si no aparece"),
  total_a_pagar: z.number().nullable().describe("Total a Pagar (neto final), no el Vr. Total del ítem"),
});
export type FacturaLeida = z.infer<typeof FacturaLeida>;

/** Total de retenciones esperadas: ReteFuente + ReteIVA + ReteICA (cada una va en su propio campo). */
export const totalRetenciones = (d: Pick<FacturaLeida, "retefuente" | "reteiva" | "reteica">) => (d.retefuente ?? 0) + (d.reteiva ?? 0) + (d.reteica ?? 0);

/** Formas de pago de un abono (decisión del usuario). */
export const FORMAS_PAGO = ["TRANSFERENCIA", "CONSIGNACION", "CHEQUE", "EFECTIVO", "OTRO"] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];
export const NOMBRE_FORMA_PAGO: Record<FormaPago, string> = {
  TRANSFERENCIA: "Transferencia", CONSIGNACION: "Consignación", CHEQUE: "Cheque", EFECTIVO: "Efectivo", OTRO: "Otro",
};

/** Solo los dígitos del NIT, como lo guarda la base (fact_nit): «901.253.217-5» → «9012532175». */
export const nitDigitos = (nit: string | null | undefined) => (nit ?? "").replace(/\D/g, "");

/** NIT para mostrar, con puntos y dígito de verificación: «9012532175» → «901.253.217-5». */
export function formatoNit(nit: string | null | undefined): string {
  const d = nitDigitos(nit);
  if (d.length < 2) return d || "—";
  return `${Number(d.slice(0, -1)).toLocaleString("es-CO")}-${d.slice(-1)}`;
}

/** Cliente con su cuenta (vista fact_clientes_saldo). Deuda negativa = saldo a favor del cliente. */
export type ClienteSaldo = {
  id: string; nit: string; nombre: string; facturas: number; facturado: number; abonos: number; abonado: number;
  deuda: number; ultima_factura: string | null; ultimo_abono: string | null; facturas_vencidas: number;
};
