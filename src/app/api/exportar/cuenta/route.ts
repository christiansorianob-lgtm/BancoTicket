import { NextResponse, type NextRequest } from "next/server";
import { perfilActual, puedeConsultar } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";
import { informeCuentaExcel } from "@/lib/informes/cuenta-excel";
import { consultarCuenta, filtrosCuentaDesde, textoFiltrosCuenta } from "@/lib/informes/cuenta";

export const maxDuration = 60;

/** Excel del reporte «Tiquetes y anticipos» con los mismos filtros de la tabla. Administración y consultores. */
export async function GET(request: NextRequest) {
  const perfil = await perfilActual();
  if (!perfil || !puedeConsultar(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const f = filtrosCuentaDesde((k) => request.nextUrl.searchParams.get(k));
  if (!f.comprador) return NextResponse.json({ error: "Falta el comprador" }, { status: 400 });
  const supabase = await supabaseServidor();
  const [{ cuenta, error }, { data: comp }] = await Promise.all([
    consultarCuenta(supabase, f),
    supabase.from("perfiles").select("nombre").eq("id", f.comprador).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error }, { status: 500 });

  const nombre = comp?.nombre ?? "comprador";
  const archivo = await informeCuentaExcel(cuenta, Boolean(f.desde), textoFiltrosCuenta(f, nombre), perfil.nombre);
  const seguro = nombre.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="BancoTicket-tiquetes-anticipos-${seguro}-${hoyColombia()}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
