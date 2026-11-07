import { NextResponse, type NextRequest } from "next/server";
import { perfilActual, puedeConsultar } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";
import { filtrosAnticiposDesde, textoFiltrosAnticipos, todosAnticipos } from "@/lib/informes/anticipos";
import { informeAnticiposExcel } from "@/lib/informes/anticipos-excel";

export const maxDuration = 60;

/** Excel del reporte «Anticipos» con todos los anticipos del filtro. Administración y consultores. */
export async function GET(request: NextRequest) {
  const perfil = await perfilActual();
  if (!perfil || !puedeConsultar(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const f = filtrosAnticiposDesde((k) => request.nextUrl.searchParams.get(k));
  const supabase = await supabaseServidor();
  const { filas, error } = await todosAnticipos(supabase, f);
  if (error) return NextResponse.json({ error }, { status: 500 });
  const { data: comp } = f.comprador ? await supabase.from("perfiles").select("nombre").eq("id", f.comprador).maybeSingle() : { data: null };
  const archivo = await informeAnticiposExcel(filas, textoFiltrosAnticipos(f, comp?.nombre ?? null), perfil.nombre);
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="BancoTicket-anticipos-${hoyColombia()}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
