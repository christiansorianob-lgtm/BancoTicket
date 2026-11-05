import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leerConfiguracion } from "@/lib/config";

export type FotosAntiguas = { meses: number; aprobados: number; pendientes: number; total: number; proxima: string | null };

/**
 * Fotos de tiquetes con más de `meses_conservacion_fotos` meses (decisión del usuario, 2026-11-04):
 * ya no se borran solas. Esto SOLO CUENTA (no escribe nada) para avisar al desarrollador, y la
 * limpieza se hace a mano con él. `proxima`: cuándo cumple ese tiempo la foto más antigua.
 */
export async function fotosAntiguas(): Promise<FotosAntiguas> {
  const { meses_conservacion_fotos: meses } = await leerConfiguracion();
  const limite = new Date();
  limite.setMonth(limite.getMonth() - meses);
  const db = supabaseAdmin();
  const tablas = ["tiquetes", "tiquetes_pendientes"] as const;
  const [conteos, primeras] = await Promise.all([
    Promise.all(tablas.map(async (t) =>
      (await db.from(t).select("id", { count: "exact", head: true }).not("imagen_ruta", "is", null).lt("cargado_en", limite.toISOString())).count ?? 0)),
    Promise.all(tablas.map(async (t) =>
      (await db.from(t).select("cargado_en").not("imagen_ruta", "is", null).order("cargado_en").limit(1).maybeSingle()).data?.cargado_en as string | undefined)),
  ]);
  const masAntigua = primeras.filter((f): f is string => !!f).sort()[0];
  let proxima: string | null = null;
  if (masAntigua) {
    const d = new Date(masAntigua);
    d.setMonth(d.getMonth() + meses);
    proxima = d.toISOString();
  }
  return { meses, aprobados: conteos[0], pendientes: conteos[1], total: conteos[0] + conteos[1], proxima };
}
