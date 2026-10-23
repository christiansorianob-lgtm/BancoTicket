import { NextResponse, type NextRequest } from "next/server";
import { perfilActual, puedeConsultar } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";
import { informeTiquetesExcel } from "@/lib/informes/tiquetes-excel";
import { consultarInforme, filtrosDesde, textoFiltros } from "@/lib/informes/consulta";

export const maxDuration = 60;

/** Excel de «Reportes» con los mismos filtros de la tabla en pantalla. Administración y consultores. */
export async function GET(request: NextRequest) {
  const perfil = await perfilActual();
  if (!perfil || !puedeConsultar(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const f = filtrosDesde((k) => request.nextUrl.searchParams.get(k));
  const supabase = await supabaseServidor();
  const { filas, error } = await consultarInforme(supabase, f);
  if (error) return NextResponse.json({ error }, { status: 500 });

  const [{ data: comp }, { data: ext }] = await Promise.all([
    f.comprador ? supabase.from("perfiles").select("nombre").eq("id", f.comprador).maybeSingle() : Promise.resolve({ data: null }),
    f.extractora ? supabase.from("extractoras").select("nombre").eq("id", f.extractora).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const archivo = await informeTiquetesExcel(filas, textoFiltros(f, { comprador: comp?.nombre, extractora: ext?.nombre }), perfil.nombre);
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="BancoTicket-reporte-${hoyColombia()}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
