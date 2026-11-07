import "server-only";
import type { supabaseServidor } from "@/lib/supabase/servidor";

type Supabase = Awaited<ReturnType<typeof supabaseServidor>>;

/** Filtros del reporte «Anticipos»: los mismos para la tabla y para el Excel. Fechas: fecha del anticipo. */
export type FiltrosAnticipos = { desde: string; hasta: string; comprador: string; estado: string };

export const ESTADOS_ANTICIPO: [string, string][] = [["confirmado", "Confirmado"], ["pendiente", "Pendiente de confirmar"], ["en_disputa", "En disputa"]];

export function filtrosAnticiposDesde(leer: (clave: string) => string | null | undefined): FiltrosAnticipos {
  const v = (k: string) => (leer(k) ?? "").trim();
  return { desde: v("desde"), hasta: v("hasta"), comprador: v("comprador"), estado: v("estado") };
}

export type FilaAnticipo = {
  id: string; fecha: string; monto: number; estado: string; nota: string | null; soporte_ruta: string | null;
  registrado_en: string; respondido_en: string | null; motivo_disputa: string | null; comprador: string; registrador: string;
};

export type TotalesAnticipos = Record<"confirmado" | "pendiente" | "en_disputa", { cantidad: number; monto: number }> & { cantidad: number };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/;
const COLUMNAS = "id, fecha, monto, estado, nota, soporte_ruta, registrado_en, respondido_en, motivo_disputa, comprador, registrador";

/** Consulta de la vista con los filtros; los más recientes primero. */
function consulta(supabase: Supabase, f: FiltrosAnticipos, contar = false) {
  let q = supabase.from("anticipos_reporte").select(COLUMNAS, contar ? { count: "exact" } : undefined)
    .order("fecha", { ascending: false }).order("registrado_en", { ascending: false });
  if (FECHA.test(f.desde)) q = q.gte("fecha", f.desde);
  if (FECHA.test(f.hasta)) q = q.lte("fecha", f.hasta);
  if (UUID.test(f.comprador)) q = q.eq("comprador_id", f.comprador);
  if (ESTADOS_ANTICIPO.some(([v]) => v === f.estado)) q = q.eq("estado", f.estado);
  return q;
}

const fila = (r: Record<string, unknown>) => ({ ...r, monto: Number(r.monto) }) as FilaAnticipo;

/** Una página del reporte y cuántos anticipos hay en total con el filtro. */
export async function paginaAnticipos(supabase: Supabase, f: FiltrosAnticipos, desde: number, hasta: number) {
  const { data, count, error } = await consulta(supabase, f, true).range(desde, hasta);
  return { filas: (data ?? []).map(fila), total: count ?? 0, error: error?.message };
}

/** Todos los anticipos del filtro (para el Excel), en bloques de 1.000. */
export async function todosAnticipos(supabase: Supabase, f: FiltrosAnticipos) {
  const filas: FilaAnticipo[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(supabase, f).range(desde, desde + 999);
    if (error) return { filas, error: error.message };
    filas.push(...(data ?? []).map(fila));
    if (!data || data.length < 1000) return { filas };
  }
}

/** Totales de TODO el filtro por estado (los suma la base). */
export async function totalesAnticipos(supabase: Supabase, f: FiltrosAnticipos): Promise<TotalesAnticipos> {
  const { data } = await supabase.rpc("reporte_anticipos_totales", {
    p_desde: FECHA.test(f.desde) ? f.desde : null, p_hasta: FECHA.test(f.hasta) ? f.hasta : null,
    p_comprador: UUID.test(f.comprador) ? f.comprador : null, p_estado: ESTADOS_ANTICIPO.some(([v]) => v === f.estado) ? f.estado : null,
  });
  const t: TotalesAnticipos = { confirmado: { cantidad: 0, monto: 0 }, pendiente: { cantidad: 0, monto: 0 }, en_disputa: { cantidad: 0, monto: 0 }, cantidad: 0 };
  for (const r of (data ?? []) as { estado: keyof Omit<TotalesAnticipos, "cantidad">; cantidad: number; monto: number }[]) {
    if (t[r.estado]) t[r.estado] = { cantidad: Number(r.cantidad), monto: Number(r.monto) };
    t.cantidad += Number(r.cantidad);
  }
  return t;
}

/** Texto de los filtros para el encabezado del Excel. */
export function textoFiltrosAnticipos(f: FiltrosAnticipos, comprador: string | null) {
  const fecha = (d: string) => d.split("-").reverse().join("/");
  const periodo = f.desde || f.hasta ? `del ${f.desde ? fecha(f.desde) : "inicio"} al ${f.hasta ? fecha(f.hasta) : "hoy"}` : "todas las fechas";
  return [`Periodo (fecha del anticipo): ${periodo}`, `Comprador: ${comprador ?? "todos"}`,
    `Estado: ${ESTADOS_ANTICIPO.find(([v]) => v === f.estado)?.[1] ?? "todos"}`].join("  ·  ");
}
