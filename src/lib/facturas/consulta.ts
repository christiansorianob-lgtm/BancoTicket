import "server-only";
import type { supabaseServidor } from "@/lib/supabase/servidor";
import type { EstadoCobro } from "./tipos";

/** Filtros de la lista de facturas: los mismos para la pantalla y el Excel. */
export type FiltrosFacturas = { estado: string; vencida: string; extractora: string; emisor: string; mes: string };

export function filtrosFacturasDesde(leer: (k: string) => string | null | undefined): FiltrosFacturas {
  const v = (k: string) => (leer(k) ?? "").trim();
  return { estado: v("estado"), vencida: v("vencida"), extractora: v("extractora"), emisor: v("emisor"), mes: v("mes") };
}

export type FilaFactura = {
  id: string; numero_factura: string; emisor_razon_social: string | null; extractora_razon_social: string | null;
  fecha_emision: string | null; fecha_vencimiento: string | null; kilos: number | null; total_cobrar: number; total_a_pagar: number;
  total_aplicado: number; saldo_pendiente: number; estado_cobro: EstadoCobro; vencida: boolean; dias_mora: number;
  alerta_sobrepago: boolean; alerta_retenciones: boolean; estado_lectura: string;
};

/** Facturas con su estado de cobro calculado (vista fact_facturas_estado), más recientes primero. */
export async function consultarFacturas(supabase: Awaited<ReturnType<typeof supabaseServidor>>, f: FiltrosFacturas, maximo = 2000) {
  let q = supabase.from("fact_facturas_estado")
    .select("id, numero_factura, emisor_razon_social, extractora_razon_social, fecha_emision, fecha_vencimiento, kilos, total_cobrar, total_a_pagar, total_aplicado, saldo_pendiente, estado_cobro, vencida, dias_mora, alerta_sobrepago, alerta_retenciones, estado_lectura")
    .order("fecha_emision", { ascending: false, nullsFirst: true })
    .limit(maximo);
  if (f.estado) q = q.eq("estado_cobro", f.estado);
  if (f.vencida) q = q.eq("vencida", true);
  if (f.extractora) q = q.eq("extractora_razon_social", f.extractora);
  if (f.emisor) q = q.eq("emisor_razon_social", f.emisor);
  if (/^\d{4}-\d{2}$/.test(f.mes)) {
    const [a, m] = f.mes.split("-").map(Number);
    const fin = new Date(Date.UTC(a, m, 0)).getUTCDate();
    q = q.gte("fecha_emision", `${f.mes}-01`).lte("fecha_emision", `${f.mes}-${String(fin).padStart(2, "0")}`);
  }
  const { data, error } = await q;
  const filas = (data ?? []).map((r) => ({
    ...r, kilos: r.kilos == null ? null : Number(r.kilos), total_cobrar: Number(r.total_cobrar), total_a_pagar: Number(r.total_a_pagar),
    total_aplicado: Number(r.total_aplicado), saldo_pendiente: Number(r.saldo_pendiente),
  })) as FilaFactura[];
  return { filas, error: error?.message };
}
