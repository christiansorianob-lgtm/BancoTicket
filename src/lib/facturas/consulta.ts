import "server-only";
import type { supabaseServidor } from "@/lib/supabase/servidor";
import { NOMBRE_ESTADO, type EstadoCobro } from "./tipos";

/**
 * Filtros del buscador de facturas: los mismos para la pantalla y el Excel. `estado`: APROBADA (todas
 * las no anuladas), ANULADA o un estado de cobro. Fechas por fecha de emisión.
 */
export type FiltrosFacturas = { buscar: string; estado: string; vencida: string; extractora: string; emisor: string; desde: string; hasta: string };

export function filtrosFacturasDesde(leer: (k: string) => string | null | undefined): FiltrosFacturas {
  const v = (k: string) => (leer(k) ?? "").trim();
  return { buscar: v("buscar"), estado: v("estado"), vencida: v("vencida"), extractora: v("extractora"), emisor: v("emisor"), desde: v("desde"), hasta: v("hasta") };
}

/** Opciones del filtro de estado (los dos estados y, dentro de las aprobadas, el estado de cobro). */
export const OPCIONES_ESTADO: [string, string][] = [
  ["APROBADA", "Aprobadas (todas)"], ["PENDIENTE_PAGO", `Aprobadas · ${NOMBRE_ESTADO.PENDIENTE_PAGO}`],
  ["ABONADA_PARCIAL", `Aprobadas · ${NOMBRE_ESTADO.ABONADA_PARCIAL}`], ["PAGADA", `Aprobadas · ${NOMBRE_ESTADO.PAGADA}`], ["ANULADA", "Anuladas"],
];

/** Los filtros en palabras (encabezado del Excel). */
export function filtrosEnTexto(f: FiltrosFacturas): string {
  return [
    `Estado: ${OPCIONES_ESTADO.find(([v]) => v === f.estado)?.[1] ?? "todos"}`,
    f.buscar ? `Buscar: ${f.buscar}` : null, `Emisor: ${f.emisor || "todos"}`, `Extractora: ${f.extractora || "todas"}`,
    f.desde || f.hasta ? `Emisión: ${f.desde || "…"} a ${f.hasta || "…"}` : null, f.vencida ? "Solo vencidas" : null,
  ].filter(Boolean).join("  ·  ");
}

export type FilaFactura = {
  id: string; numero_factura: string; emisor_razon_social: string | null; extractora_razon_social: string | null;
  fecha_emision: string | null; fecha_vencimiento: string | null; kilos: number | null; total_cobrar: number; total_a_pagar: number;
  subtotal: number; iva: number; retefuente: number; reteiva: number; reteica: number;
  total_aplicado: number; saldo_pendiente: number; estado_cobro: EstadoCobro; vencida: boolean; dias_mora: number;
  alerta_sobrepago: boolean; alerta_retenciones: boolean; motivo_revision: string | null;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Facturas con su estado de cobro calculado (vista fact_facturas_estado), más recientes primero. */
export async function consultarFacturas(supabase: Awaited<ReturnType<typeof supabaseServidor>>, f: FiltrosFacturas, maximo = 2000) {
  let q = supabase.from("fact_facturas_estado")
    .select("id, numero_factura, emisor_razon_social, extractora_razon_social, fecha_emision, fecha_vencimiento, kilos, subtotal, iva, retefuente, reteiva, reteica, total_cobrar, total_a_pagar, total_aplicado, saldo_pendiente, estado_cobro, vencida, dias_mora, alerta_sobrepago, alerta_retenciones, motivo_revision")
    .order("fecha_emision", { ascending: false, nullsFirst: true })
    .limit(maximo);
  if (f.estado === "APROBADA") q = q.neq("estado_cobro", "ANULADA");
  else if (f.estado) q = q.eq("estado_cobro", f.estado);
  if (f.vencida) q = q.eq("vencida", true);
  if (f.extractora) q = q.eq("extractora_razon_social", f.extractora);
  if (f.emisor) q = q.eq("emisor_razon_social", f.emisor);
  if (FECHA.test(f.desde)) q = q.gte("fecha_emision", f.desde);
  if (FECHA.test(f.hasta)) q = q.lte("fecha_emision", f.hasta);
  if (f.buscar) {
    // N° de factura o CUFE; se quitan los caracteres que usa la sintaxis del filtro «or».
    const t = f.buscar.replace(/[%,()*\\]/g, " ").trim();
    if (t) q = q.or(`numero_factura.ilike.%${t}%,cufe.ilike.%${t}%`);
  }
  const { data, error } = await q;
  const filas = (data ?? []).map((r) => ({
    ...r, kilos: r.kilos == null ? null : Number(r.kilos), total_cobrar: Number(r.total_cobrar), total_a_pagar: Number(r.total_a_pagar),
    subtotal: Number(r.subtotal), iva: Number(r.iva), retefuente: Number(r.retefuente), reteiva: Number(r.reteiva), reteica: Number(r.reteica),
    total_aplicado: Number(r.total_aplicado), saldo_pendiente: Number(r.saldo_pendiente),
  })) as FilaFactura[];
  return { filas, error: error?.message };
}

export type TotalGrupo = { clave: string; facturas: number; kilos: number; facturado: number; pagado: number; saldo: number };

/** Totales de las facturas APROBADAS (las anuladas no suman) agrupados por emisor, extractora o mes. */
export function totalesPor(filas: FilaFactura[], dimension: "emisor" | "extractora" | "mes"): TotalGrupo[] {
  const grupos = new Map<string, TotalGrupo>();
  for (const x of filas) {
    if (x.estado_cobro === "ANULADA") continue;
    const clave = (dimension === "emisor" ? x.emisor_razon_social : dimension === "extractora" ? x.extractora_razon_social : x.fecha_emision?.slice(0, 7)) ?? "—";
    const g = grupos.get(clave) ?? { clave, facturas: 0, kilos: 0, facturado: 0, pagado: 0, saldo: 0 };
    g.facturas++; g.kilos += x.kilos ?? 0; g.facturado += x.total_cobrar; g.pagado += x.total_aplicado; g.saldo += x.saldo_pendiente;
    grupos.set(clave, g);
  }
  const lista = [...grupos.values()];
  return dimension === "mes" ? lista.sort((a, b) => b.clave.localeCompare(a.clave)) : lista.sort((a, b) => b.facturado - a.facturado);
}
