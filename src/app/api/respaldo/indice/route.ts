import { NextResponse } from "next/server";
import { perfilActual } from "@/lib/sesion";
import { indiceRespaldo } from "@/lib/respaldo/servidor";

export const maxDuration = 60;

/** Respaldo completo: índice (conteos, usuarios sin contraseñas, archivos con enlace de 1 h). Solo el desarrollador. */
export async function GET() {
  const perfil = await perfilActual();
  if (!perfil || perfil.rol !== "desarrollador") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  try {
    return NextResponse.json(await indiceRespaldo(), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
