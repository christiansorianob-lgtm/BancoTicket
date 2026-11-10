import "server-only";
import type { supabaseServidor } from "@/lib/supabase/servidor";
import { NOMBRE_TIPO, TIPOS_FACTURA, type ClienteSaldo, type CuentaSaldo, type Emisor, type TipoFactura } from "./tipos";

type Supabase = Awaited<ReturnType<typeof supabaseServidor>>;

/**
 * Filtros del buscador de facturas: los mismos para la pantalla y el Excel. `estado`: APROBADA o
 * ANULADA. Fechas por fecha de emisión.
 */
export type FiltrosFacturas = { buscar: string; estado: string; tipo: string; cliente: string; emisor: string; desde: string; hasta: string };

export function filtrosFacturasDesde(leer: (k: string) => string | null | undefined): FiltrosFacturas {
  const v = (k: string) => (leer(k) ?? "").trim();
  return { buscar: v("buscar"), estado: v("estado"), tipo: v("tipo"), cliente: v("cliente"), emisor: v("emisor"), desde: v("desde"), hasta: v("hasta") };
}

export const OPCIONES_ESTADO: [string, string][] = [["APROBADA", "Aprobadas"], ["ANULADA", "Anuladas"]];

/** Los filtros en palabras (encabezado del Excel). */
export function filtrosEnTexto(f: FiltrosFacturas, nombreCliente?: string): string {
  return [
    `Estado: ${OPCIONES_ESTADO.find(([v]) => v === f.estado)?.[1] ?? "todas"}`,
    f.buscar ? `Buscar: ${f.buscar}` : null, f.tipo ? `Tipo: ${NOMBRE_TIPO[f.tipo as TipoFactura] ?? f.tipo}` : null, `Cliente: ${f.cliente ? nombreCliente ?? "elegido" : "todos"}`, `Emisor: ${f.emisor || "todos"}`,
    f.desde || f.hasta ? `Emisión: ${f.desde || "…"} a ${f.hasta || "…"}` : null,
  ].filter(Boolean).join("  ·  ");
}

export type FilaFactura = {
  id: string; numero_factura: string; emisor_razon_social: string | null; emisor_nit: string | null; extractora_razon_social: string | null;
  cliente_id: string | null; cliente_nombre: string | null; cliente_nit: string | null;
  fecha_emision: string | null; fecha_vencimiento: string | null; kilos: number | null;
  subtotal: number; iva: number; retefuente: number; reteiva: number; reteica: number; total_a_pagar: number;
  anulada: boolean; motivo_revision: string | null;
  iva_pct: number | null; retefuente_pct: number | null; reteiva_pct: number | null; reteica_pct: number | null;
  descripcion: string | null; tipo: TipoFactura | null;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/;

/** Facturas (vista fact_facturas_estado), más recientes primero. */
export async function consultarFacturas(supabase: Supabase, f: FiltrosFacturas, maximo = 2000) {
  let q = supabase.from("fact_facturas_estado")
    .select("id, numero_factura, emisor_razon_social, emisor_nit, extractora_razon_social, cliente_id, cliente_nombre, cliente_nit, fecha_emision, fecha_vencimiento, kilos, subtotal, iva, retefuente, reteiva, reteica, total_a_pagar, anulada, motivo_revision, iva_pct, retefuente_pct, reteiva_pct, reteica_pct, descripcion, tipo")
    .order("fecha_emision", { ascending: false, nullsFirst: true })
    .limit(maximo);
  if (f.estado === "APROBADA") q = q.eq("anulada", false);
  else if (f.estado === "ANULADA") q = q.eq("anulada", true);
  if ((TIPOS_FACTURA as readonly string[]).includes(f.tipo)) q = q.eq("tipo", f.tipo);
  if (UUID.test(f.cliente)) q = q.eq("cliente_id", f.cliente);
  if (f.emisor) q = q.eq("emisor_razon_social", f.emisor);
  if (FECHA.test(f.desde)) q = q.gte("fecha_emision", f.desde);
  if (FECHA.test(f.hasta)) q = q.lte("fecha_emision", f.hasta);
  if (f.buscar) {
    // N° de factura o CUFE; se quitan los caracteres que usa la sintaxis del filtro «or».
    const t = f.buscar.replace(/[%,()*\\]/g, " ").trim();
    if (t) q = q.or(`numero_factura.ilike.%${t}%,cufe.ilike.%${t}%`);
  }
  const { data, error } = await q;
  const n = (x: unknown) => Number(x ?? 0);
  const filas = (data ?? []).map((r) => ({
    ...r, kilos: r.kilos == null ? null : n(r.kilos), subtotal: n(r.subtotal), iva: n(r.iva), retefuente: n(r.retefuente),
    reteiva: n(r.reteiva), reteica: n(r.reteica), total_a_pagar: n(r.total_a_pagar),
  })) as FilaFactura[];
  return { filas, error: error?.message };
}

/** Clientes con su cuenta (deuda = facturas aprobadas − abonos vigentes), los que más deben primero. */
export async function consultarClientes(supabase: Supabase): Promise<ClienteSaldo[]> {
  const { data } = await supabase.from("fact_clientes_saldo").select("*").order("deuda", { ascending: false });
  return (data ?? []).map((c) => ({
    ...c, facturas: Number(c.facturas), facturado: Number(c.facturado), abonos: Number(c.abonos), abonado: Number(c.abonado),
    deuda: Number(c.deuda), facturas_vencidas: Number(c.facturas_vencidas),
  })) as ClienteSaldo[];
}

/** Cuentas de cada cliente con cada emisor, las que más deben primero. */
export async function consultarCuentas(supabase: Supabase): Promise<CuentaSaldo[]> {
  const { data } = await supabase.from("fact_cuentas_saldo").select("*").order("deuda", { ascending: false });
  return (data ?? []).map(numerosCuenta);
}

export const numerosCuenta = (c: Record<string, unknown>) => ({
  ...c, facturas: Number(c.facturas), facturado: Number(c.facturado), abonos: Number(c.abonos), abonado: Number(c.abonado),
  deuda: Number(c.deuda), facturas_vencidas: Number(c.facturas_vencidas),
}) as CuentaSaldo;

/** Emisores (empresas que facturan), por nombre. */
export async function consultarEmisores(supabase: Supabase): Promise<Emisor[]> {
  const { data } = await supabase.from("fact_emisores").select("nit, nombre").order("nombre");
  return (data ?? []) as Emisor[];
}

export type TotalGrupo ={ clave: string; facturas: number; kilos: number; total: number };

/** Total a pagar de las facturas APROBADAS (las anuladas no suman) agrupado por emisor o por mes. */
export function totalesPor(filas: FilaFactura[], dimension: "emisor" | "mes"): TotalGrupo[] {
  const grupos = new Map<string, TotalGrupo>();
  for (const x of filas) {
    if (x.anulada) continue;
    const clave = (dimension === "emisor" ? x.emisor_razon_social : x.fecha_emision?.slice(0, 7)) ?? "—";
    const g = grupos.get(clave) ?? { clave, facturas: 0, kilos: 0, total: 0 };
    g.facturas++; g.kilos += x.kilos ?? 0; g.total += x.total_a_pagar;
    grupos.set(clave, g);
  }
  const lista = [...grupos.values()];
  return dimension === "mes" ? lista.sort((a, b) => b.clave.localeCompare(a.clave)) : lista.sort((a, b) => b.total - a.total);
}
