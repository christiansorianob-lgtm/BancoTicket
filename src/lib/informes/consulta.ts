import "server-only";
import type { supabaseServidor } from "@/lib/supabase/servidor";

/** Filtros de «Reportes»: los mismos para la tabla en pantalla y para el Excel. */
export type FiltrosInforme = {
  desde: string; hasta: string; comprador: string; extractora: string; proveedor: string; numero: string;
};

export type FilaReporte = {
  id: string; comprador: string; comprador_celular: string | null; extractora: string; proveedor: string | null; fecha_entrada: string;
  numero: string; peso_neto_t: number; precio_tonelada: number | null; valor: number | null; imagen_ruta: string | null;
  // Para editar el registro desde Reportes.
  extractora_id: string; comprador_id: string; peso_bruto_kg: number; tara_kg: number; neto_impreso_kg: number | null;
  placa: string | null; conductor: string | null; bascula: string | null; estado: string;
};

export function filtrosDesde(leer: (clave: string) => string | null | undefined): FiltrosInforme {
  const v = (k: string) => (leer(k) ?? "").trim();
  return { desde: v("desde"), hasta: v("hasta"), comprador: v("comprador"), extractora: v("extractora"), proveedor: v("proveedor"), numero: v("numero") };
}

/**
 * Tiquetes aprobados vigentes que cumplen los filtros (fechas por fecha de entrada, en hora de
 * Colombia), ordenados por comprador y fecha. Lee en bloques de 1.000 hasta `maximo`.
 */
export async function consultarInforme(
  supabase: Awaited<ReturnType<typeof supabaseServidor>>, f: FiltrosInforme, maximo = 100_000,
): Promise<{ filas: FilaReporte[]; error?: string }> {
  const filas: FilaReporte[] = [];
  for (let desde = 0; desde < maximo; desde += 1000) {
    let q = supabase
      .from("tiquetes")
      .select("id, numero, proveedor, imagen_ruta, fecha_entrada, peso_neto_t, precio_tonelada, valor, extractora_id, comprador_id, peso_bruto_kg, tara_kg, neto_impreso_kg, placa, conductor, bascula, estado, extractoras(nombre), perfiles!tiquetes_comprador_id_fkey(nombre, celular)")
      .eq("estado", "vigente")
      .order("fecha_entrada", { ascending: true })
      .range(desde, Math.min(desde + 999, maximo - 1));
    if (f.desde) q = q.gte("fecha_entrada", `${f.desde}T00:00:00-05:00`);
    if (f.hasta) q = q.lte("fecha_entrada", `${f.hasta}T23:59:59.999-05:00`);
    if (f.comprador) q = q.eq("comprador_id", f.comprador);
    if (f.extractora) q = q.eq("extractora_id", f.extractora);
    if (f.proveedor) q = q.eq("proveedor", f.proveedor);
    if (f.numero) q = q.ilike("numero", `%${f.numero.replace(/[%_]/g, "")}%`);
    const { data, error } = await q;
    if (error) return { filas, error: error.message };
    for (const t of data ?? []) {
      const r = t as unknown as Omit<FilaReporte, "comprador" | "comprador_celular" | "extractora"> & { extractoras: { nombre: string } | null; perfiles: { nombre: string; celular: string | null } | null };
      filas.push({
        id: r.id, comprador: r.perfiles?.nombre ?? "", comprador_celular: r.perfiles?.celular ?? null, extractora: r.extractoras?.nombre ?? "", proveedor: r.proveedor,
        fecha_entrada: r.fecha_entrada, numero: r.numero, peso_neto_t: Number(r.peso_neto_t),
        precio_tonelada: r.precio_tonelada == null ? null : Number(r.precio_tonelada), valor: r.valor == null ? null : Number(r.valor),
        imagen_ruta: r.imagen_ruta, extractora_id: r.extractora_id, comprador_id: r.comprador_id,
        peso_bruto_kg: r.peso_bruto_kg, tara_kg: r.tara_kg, neto_impreso_kg: r.neto_impreso_kg,
        placa: r.placa, conductor: r.conductor, bascula: r.bascula, estado: r.estado,
      });
    }
    if (!data || data.length < 1000) break;
  }
  filas.sort((a, b) => a.comprador.localeCompare(b.comprador, "es") || a.fecha_entrada.localeCompare(b.fecha_entrada));
  return { filas };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/;
const limpiarNumero = (n: string) => n.replace(/[%_]/g, "");

/**
 * Una página del reporte (vista `tiquetes_reporte`, ordenada por comprador y fecha) y cuántos
 * tiquetes hay en total con el filtro. Solo se traen las filas que se ven.
 */
export async function paginaInforme(
  supabase: Awaited<ReturnType<typeof supabaseServidor>>, f: FiltrosInforme, desde: number, hasta: number,
): Promise<{ filas: FilaReporte[]; total: number; error?: string }> {
  let q = supabase.from("tiquetes_reporte")
    .select("id, numero, proveedor, imagen_ruta, fecha_entrada, peso_neto_t, precio_tonelada, valor, extractora_id, comprador_id, peso_bruto_kg, tara_kg, neto_impreso_kg, placa, conductor, bascula, estado, comprador, comprador_celular, extractora", { count: "exact" })
    .order("comprador").order("fecha_entrada").order("id");
  if (FECHA.test(f.desde)) q = q.gte("fecha_entrada", `${f.desde}T00:00:00-05:00`);
  if (FECHA.test(f.hasta)) q = q.lte("fecha_entrada", `${f.hasta}T23:59:59.999-05:00`);
  if (UUID.test(f.comprador)) q = q.eq("comprador_id", f.comprador);
  if (UUID.test(f.extractora)) q = q.eq("extractora_id", f.extractora);
  if (f.proveedor) q = q.eq("proveedor", f.proveedor);
  if (f.numero) q = q.ilike("numero", `%${limpiarNumero(f.numero)}%`);
  const { data, count, error } = await q.range(desde, hasta);
  const filas = (data ?? []).map((r) => ({
    ...r, peso_neto_t: Number(r.peso_neto_t), precio_tonelada: r.precio_tonelada == null ? null : Number(r.precio_tonelada),
    valor: r.valor == null ? null : Number(r.valor),
  })) as FilaReporte[];
  return { filas, total: count ?? 0, error: error?.message };
}

/** Totales de TODO el filtro (los suma la base con `reporte_tiquetes_totales`). */
export async function totalesInforme(supabase: Awaited<ReturnType<typeof supabaseServidor>>, f: FiltrosInforme) {
  const { data } = await supabase.rpc("reporte_tiquetes_totales", {
    p_desde: FECHA.test(f.desde) ? f.desde : null, p_hasta: FECHA.test(f.hasta) ? f.hasta : null,
    p_comprador: UUID.test(f.comprador) ? f.comprador : null, p_extractora: UUID.test(f.extractora) ? f.extractora : null,
    p_proveedor: f.proveedor || null, p_numero: f.numero ? limpiarNumero(f.numero) : null,
  });
  const t = ((data ?? [])[0] ?? {}) as { tiquetes?: number; toneladas?: number; total?: number; sin_precio?: number };
  return { tiquetes: Number(t.tiquetes ?? 0), toneladas: Number(t.toneladas ?? 0), total: Number(t.total ?? 0), sinPrecio: Number(t.sin_precio ?? 0) };
}

/** Texto de los filtros aplicados, con nombres, para el encabezado del informe. */
export function textoFiltros(f: FiltrosInforme, nombres: { comprador?: string | null; extractora?: string | null }) {
  const fecha = (d: string) => d.split("-").reverse().join("/");
  const periodo = f.desde || f.hasta ? `del ${f.desde ? fecha(f.desde) : "inicio"} al ${f.hasta ? fecha(f.hasta) : "hoy"}` : "todas las fechas";
  return [
    `Periodo: ${periodo}`,
    `Comprador: ${nombres.comprador ?? "todos"}`,
    `Extractora: ${nombres.extractora ?? "todas"}`,
    `Proveedor: ${f.proveedor || "todos"}`,
    f.numero ? `N° tiquete contiene «${f.numero}»` : null,
  ].filter(Boolean).join("  ·  ");
}
