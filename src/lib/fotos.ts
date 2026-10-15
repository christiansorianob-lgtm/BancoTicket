import "server-only";
import { supabaseServidor } from "@/lib/supabase/servidor";

/** URLs firmadas de corta duración; las reglas del bucket deciden quién puede verlas. */
export async function urlsFotos(rutas: (string | null)[]): Promise<Record<string, string>> {
  const validas = [...new Set(rutas.filter((r): r is string => !!r))];
  if (validas.length === 0) return {};
  const supabase = await supabaseServidor();
  const { data } = await supabase.storage.from("tiquetes").createSignedUrls(validas, 60 * 30);
  const mapa: Record<string, string> = {};
  for (const f of data ?? []) if (f.path && f.signedUrl) mapa[f.path] = f.signedUrl;
  return mapa;
}
