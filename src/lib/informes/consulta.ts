import "server-only";
import type { supabaseServidor } from "@/lib/supabase/servidor";

/** Filtros de «Reportes»: los mismos para la tabla en pantalla y para el Excel. */
export type FiltrosInforme = {
  desde: string; hasta: string; comprador: string; extractora: string; proveedor: string; numero: string;
};

export type FilaReporte = {
  id: string; comprador: string; extractora: string; proveedor: string | null; fecha_entrada: string;
  numero: string; peso_neto_t: number; precio_tonelada: number | null; valor: number | null; imagen_ruta: string | null;
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
      .select("id, numero, proveedor, imagen_ruta, fecha_entrada, peso_neto_t, precio_tonelada, valor, extractoras(nombre), perfiles!tiquetes_comprador_id_fkey(nombre)")
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
      const r = t as unknown as Omit<FilaReporte, "comprador" | "extractora"> & { extractoras: { nombre: string } | null; perfiles: { nombre: string } | null };
      filas.push({
        id: r.id, comprador: r.perfiles?.nombre ?? "", extractora: r.extractoras?.nombre ?? "", proveedor: r.proveedor,
        fecha_entrada: r.fecha_entrada, numero: r.numero, peso_neto_t: Number(r.peso_neto_t),
        precio_tonelada: r.precio_tonelada == null ? null : Number(r.precio_tonelada), valor: r.valor == null ? null : Number(r.valor),
        imagen_ruta: r.imagen_ruta,
      });
    }
    if (!data || data.length < 1000) break;
  }
  filas.sort((a, b) => a.comprador.localeCompare(b.comprador, "es") || a.fecha_entrada.localeCompare(b.fecha_entrada));
  return { filas };
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
