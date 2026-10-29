import "server-only";
import { supabaseServidor } from "@/lib/supabase/servidor";

/**
 * URLs firmadas (por defecto 30 min); las reglas del bucket deciden quién puede verlas.
 * `segundos`: duración del enlace (ej. 7 días para el enlace que se envía por WhatsApp).
 */
export async function urlsFotos(rutas: (string | null)[], segundos = 60 * 30): Promise<Record<string, string>> {
  const validas = [...new Set(rutas.filter((r): r is string => !!r))];
  if (validas.length === 0) return {};
  const supabase = await supabaseServidor();
  const { data } = await supabase.storage.from("tiquetes").createSignedUrls(validas, segundos);
  const mapa: Record<string, string> = {};
  for (const f of data ?? []) if (f.path && f.signedUrl) mapa[f.path] = f.signedUrl;
  return mapa;
}
