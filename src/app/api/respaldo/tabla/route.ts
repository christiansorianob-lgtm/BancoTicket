import { NextResponse, type NextRequest } from "next/server";
import { perfilActual } from "@/lib/sesion";
import { paginaTabla } from "@/lib/respaldo/servidor";
import { TABLAS_RESPALDO, type TablaRespaldo } from "@/lib/respaldo/comun";

export const maxDuration = 60;

/** Respaldo completo: una página de 1.000 filas de una tabla. Solo el desarrollador. */
export async function GET(request: NextRequest) {
  const perfil = await perfilActual();
  if (!perfil || perfil.rol !== "desarrollador") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const nombre = request.nextUrl.searchParams.get("nombre") ?? "";
  const desde = Math.max(0, Number(request.nextUrl.searchParams.get("desde")) || 0);
  if (!TABLAS_RESPALDO.includes(nombre as TablaRespaldo)) return NextResponse.json({ error: "Tabla no válida" }, { status: 400 });
  try {
    return NextResponse.json(await paginaTabla(nombre as TablaRespaldo, desde), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
