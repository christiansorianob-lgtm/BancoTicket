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
  total_retenciones_esperadas: z.number().nullable(),
  total_a_pagar: z.number().nullable().describe("Total a Pagar (neto final), no el Vr. Total del ítem"),
});
export type FacturaLeida = z.infer<typeof FacturaLeida>;

export const ESTADOS_COBRO = ["PENDIENTE_PAGO", "ABONADA_PARCIAL", "PAGADA", "ANULADA"] as const;
export type EstadoCobro = (typeof ESTADOS_COBRO)[number];
export const NOMBRE_ESTADO: Record<EstadoCobro, string> = {
  PENDIENTE_PAGO: "Pendiente de pago", ABONADA_PARCIAL: "Abonada parcial", PAGADA: "Pagada", ANULADA: "Anulada",
};
