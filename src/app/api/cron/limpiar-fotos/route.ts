import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leerConfiguracion } from "@/lib/config";

/** Tarea diaria (Vercel Cron): borra las fotos con más de N meses y conserva los datos del tiquete. */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { meses_conservacion_fotos: meses } = await leerConfiguracion();
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  const db = supabaseAdmin();

  let borradas = 0;
  for (const tabla of ["tiquetes", "tiquetes_pendientes"] as const) {
    const { data } = await db.from(tabla).select("id, imagen_ruta").not("imagen_ruta", "is", null).lt("cargado_en", limite.toISOString()).limit(500);
    const filas = data ?? [];
    if (filas.length === 0) continue;
    await db.storage.from("tiquetes").remove(filas.map((f) => f.imagen_ruta!));
    await db.from(tabla).update({ imagen_ruta: null }).in("id", filas.map((f) => f.id));
    borradas += filas.length;
  }
  return NextResponse.json({ borradas });
}
