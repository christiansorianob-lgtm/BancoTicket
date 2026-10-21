"use server";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { correoInterno, exigirSesion } from "@/lib/sesion";
import { revisarClaveNueva } from "@/lib/claves";

export type EstadoClave = { error?: string; mensaje?: string } | undefined;

/** Cualquier usuario cambia su propia contraseña; pide la actual para confirmar que es él. */
export async function cambiarClave(_previo: EstadoClave, form: FormData): Promise<EstadoClave> {
  const perfil = await exigirSesion();
  const actual = String(form.get("actual") ?? "");
  const nueva = String(form.get("nueva") ?? "");
  const error = revisarClaveNueva(nueva, String(form.get("repetir") ?? ""));
  if (!actual) return { error: "Escriba su contraseña actual" };
  if (error) return { error };

  const supabase = await supabaseServidor();
  const { error: e1 } = await supabase.auth.signInWithPassword({ email: correoInterno(perfil.usuario), password: actual });
  if (e1) return { error: "La contraseña actual no es correcta" };
  const { error: e2 } = await supabase.auth.updateUser({ password: nueva });
  if (e2) return { error: e2.message };

  if (perfil.cambiar_clave) {
    await supabaseAdmin().from("perfiles").update({ cambiar_clave: false }).eq("id", perfil.id);
    redirect("/");
  }
  return { mensaje: "Contraseña cambiada" };
}
