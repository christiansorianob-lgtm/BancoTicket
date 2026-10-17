import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Destino = { id: string; correo: string; nombre: string };

/**
 * Aviso dentro de la app (campana). WhatsApp y correo no se envían desde el servidor:
 * se abren en el dispositivo de quien hace la acción, con el mensaje listo (ver contacto.tsx).
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

/**
 * A quién escribe un comprador: el correo va a todos los administradores (un correo admite
 * varios destinatarios); el WhatsApp, que abre un solo chat, al administrador más antiguo.
 */
export async function contactoAdministracion(): Promise<{ celular: string | null; correos: string[] }> {
  const { data } = await supabaseAdmin().from("perfiles").select("celular, correo").eq("rol", "admin").eq("activo", true).order("creado_en");
  return { celular: data?.[0]?.celular ?? null, correos: (data ?? []).map((a) => a.correo).filter(Boolean) };
}
