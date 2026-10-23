import "server-only";
import type { supabaseServidor } from "@/lib/supabase/servidor";
import { armarCuenta, type AnticipoCuenta, type Cuenta, type TiqueteCuenta } from "./movimientos";

/** Filtros del reporte «Tiquetes y anticipos»: los mismos para la tabla y para el Excel. */
export type FiltrosCuenta = { comprador: string; desde: string; hasta: string };

export function filtrosCuentaDesde(leer: (clave: string) => string | null | undefined): FiltrosCuenta {
  const v = (k: string) => (leer(k) ?? "").trim();
  return { comprador: v("comprador"), desde: v("desde"), hasta: v("hasta") };
}

/**
 * Lee todos los tiquetes aprobados vigentes y los anticipos confirmados del comprador
 * (todos, para que el saldo acumulado parta de cero) y arma la cuenta con el periodo pedido.
 */
export async function consultarCuenta(
  supabase: Awaited<ReturnType<typeof supabaseServidor>>, f: FiltrosCuenta,
): Promise<{ cuenta: Cuenta; error?: string }> {
  const tiquetes: TiqueteCuenta[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("tiquetes")
      .select("id, cargado_en, numero, fecha_entrada, peso_neto_t, precio_tonelada, valor, extractoras(nombre)")
      .eq("comprador_id", f.comprador)
      .eq("estado", "vigente")
      .order("cargado_en", { ascending: true })
      .range(desde, desde + 999);
    if (error) return { cuenta: armarCuenta([], []), error: error.message };
    for (const t of data ?? []) {
      const r = t as unknown as { id: string; cargado_en: string; numero: string; fecha_entrada: string; peso_neto_t: number; precio_tonelada: number | null; valor: number | null; extractoras: { nombre: string } | null };
      tiquetes.push({
        id: r.id, cargado_en: r.cargado_en, extractora: r.extractoras?.nombre ?? "", numero: r.numero, fecha_entrada: r.fecha_entrada,
        peso_neto_t: Number(r.peso_neto_t), precio_tonelada: r.precio_tonelada == null ? null : Number(r.precio_tonelada),
        valor: r.valor == null ? null : Number(r.valor),
      });
    }
    if (!data || data.length < 1000) break;
  }

  const { data: ant, error } = await supabase
    .from("anticipos")
    .select("id, monto, nota, respondido_en, registrado_en")
    .eq("comprador_id", f.comprador)
    .eq("estado", "confirmado")
    .limit(10000);
  if (error) return { cuenta: armarCuenta([], []), error: error.message };
  const anticipos: AnticipoCuenta[] = (ant ?? []).map((a) => ({
    id: a.id, monto: Number(a.monto), nota: a.nota,
    confirmado_en: (a.respondido_en ?? a.registrado_en) as string,
  }));

  return { cuenta: armarCuenta(tiquetes, anticipos, f.desde, f.hasta) };
}

/** Texto de los filtros aplicados para el encabezado del Excel. */
export function textoFiltrosCuenta(f: FiltrosCuenta, comprador: string) {
  const fecha = (d: string) => d.split("-").reverse().join("/");
  const periodo = f.desde || f.hasta ? `del ${f.desde ? fecha(f.desde) : "inicio"} al ${f.hasta ? fecha(f.hasta) : "hoy"}` : "todas las fechas";
  return `Comprador: ${comprador}  ·  Periodo (fecha de registro): ${periodo}`;
}
