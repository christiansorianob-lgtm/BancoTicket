import { NextResponse, type NextRequest } from "next/server";
import { esGestor, perfilActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";
import { consultarFacturas, filtrosEnTexto, filtrosFacturasDesde } from "@/lib/facturas/consulta";
import { informeFacturasExcel } from "@/lib/facturas/excel";

export const maxDuration = 60;

/** Excel de la lista de facturas con los mismos filtros de la pantalla. Solo administración. */
export async function GET(request: NextRequest) {
  const perfil = await perfilActual();
  if (!perfil || !esGestor(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const f = filtrosFacturasDesde((k) => request.nextUrl.searchParams.get(k));
  const { filas, error } = await consultarFacturas(await supabaseServidor(), f, 20000);
  if (error) return NextResponse.json({ error }, { status: 500 });
  const filtros = filtrosEnTexto(f, filas.find((x) => x.cliente_id === f.cliente)?.cliente_nombre ?? undefined);
  const archivo = await informeFacturasExcel(filas, filtros, perfil.nombre);
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="BancoTicket-facturas-${hoyColombia()}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
