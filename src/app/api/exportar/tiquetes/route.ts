import { NextResponse, type NextRequest } from "next/server";
import { esGestor, perfilActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";
import { informeTiquetesExcel, type FilaInforme } from "@/lib/informes/tiquetes-excel";

export const maxDuration = 60;

/** Excel de tiquetes aprobados con los mismos filtros de «Tiquetes y precios». Solo administración. */
export async function GET(request: NextRequest) {
  const perfil = await perfilActual();
  if (!perfil || !esGestor(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const f = {
    desde: sp.get("desde") ?? "", hasta: sp.get("hasta") ?? "", extractora: sp.get("extractora") ?? "",
    comprador: sp.get("comprador") ?? "", sinPrecio: sp.get("sin_precio") === "1", anulados: sp.get("estado") === "anulado",
  };
  const supabase = await supabaseServidor();

  // Se lee en bloques de 1.000 (límite de Supabase por consulta).
  const filas: FilaInforme[] = [];
  for (let desde = 0; ; desde += 1000) {
    let q = supabase
      .from("tiquetes")
      .select("numero, fecha_entrada, peso_neto_t, precio_tonelada, valor, extractoras(nombre), perfiles!tiquetes_comprador_id_fkey(nombre)")
      .eq("estado", f.anulados ? "anulado" : "vigente")
      .order("fecha_entrada", { ascending: true })
      .range(desde, desde + 999);
    if (f.desde) q = q.gte("fecha_entrada", `${f.desde}T00:00:00-05:00`);
    if (f.hasta) q = q.lte("fecha_entrada", `${f.hasta}T23:59:59.999-05:00`);
    if (f.extractora) q = q.eq("extractora_id", f.extractora);
    if (f.comprador) q = q.eq("comprador_id", f.comprador);
    if (f.sinPrecio) q = q.is("precio_tonelada", null);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const t of data ?? []) {
      const r = t as unknown as { numero: string; fecha_entrada: string; peso_neto_t: number; precio_tonelada: number | null; valor: number | null; extractoras: { nombre: string } | null; perfiles: { nombre: string } | null };
      filas.push({ comprador: r.perfiles?.nombre ?? "", extractora: r.extractoras?.nombre ?? "", fecha_entrada: r.fecha_entrada,
        numero: r.numero, peso_neto_t: r.peso_neto_t, precio_tonelada: r.precio_tonelada, valor: r.valor });
    }
    if (!data || data.length < 1000) break;
  }
  filas.sort((a, b) => a.comprador.localeCompare(b.comprador, "es") || a.fecha_entrada.localeCompare(b.fecha_entrada));

  // Texto de los filtros aplicados, con nombres (no identificadores).
  const [{ data: ext }, { data: comp }] = await Promise.all([
    f.extractora ? supabase.from("extractoras").select("nombre").eq("id", f.extractora).maybeSingle() : Promise.resolve({ data: null }),
    f.comprador ? supabase.from("perfiles").select("nombre").eq("id", f.comprador).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const fecha = (d: string) => d.split("-").reverse().join("/");
  const periodo = f.desde || f.hasta ? `del ${f.desde ? fecha(f.desde) : "inicio"} al ${f.hasta ? fecha(f.hasta) : "hoy"}` : "todas las fechas";
  const filtros = [
    `Periodo: ${periodo}`,
    `Extractora: ${ext?.nombre ?? "todas"}`,
    `Comprador: ${comp?.nombre ?? "todos"}`,
    f.anulados ? "Tiquetes anulados" : "Tiquetes aprobados",
    f.sinPrecio ? "solo sin precio" : null,
  ].filter(Boolean).join("  ·  ");

  const archivo = await informeTiquetesExcel(filas, filtros, perfil.nombre);
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="BancoTicket-tiquetes-${hoyColombia()}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
