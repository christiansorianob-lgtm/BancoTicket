import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Destino = { id: string; correo: string; nombre: string };

/**
 * Aviso dentro de la app (campana). WhatsApp no se envía desde el servidor: se abre en el
 * dispositivo de quien hace la acción, con el mensaje listo (ver contacto.tsx).
 */
export async function avisar(destinos: Destino[], titulo: string, cuerpo: string, enlace?: string) {
  if (destinos.length === 0) return;
  const db = supabaseAdmin();
  await db.from("notificaciones").insert(
    destinos.map((d) => ({ usuario_id: d.id, titulo, cuerpo, enlace: enlace ?? null })),
  );
}

export async function administradores(): Promise<Destino[]> {
  const { data } = await supabaseAdmin().from("perfiles").select("id, correo, nombre").eq("rol", "admin").eq("activo", true);
  return data ?? [];
}

export async function perfilDestino(id: string): Promise<Destino | null> {
  const { data } = await supabaseAdmin().from("perfiles").select("id, correo, nombre").eq("id", id).single();
  return data;
}

/** A quién escribe un comprador por WhatsApp (abre un solo chat): el administrador más antiguo. */
export async function contactoAdministracion(): Promise<{ celular: string | null }> {
  const { data } = await supabaseAdmin().from("perfiles").select("celular").eq("rol", "admin").eq("activo", true).order("creado_en").limit(1);
  return { celular: data?.[0]?.celular ?? null };
}
