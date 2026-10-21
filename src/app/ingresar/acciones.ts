"use server";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { correoInterno } from "@/lib/sesion";
import { avisar, desarrolladores } from "@/lib/avisos";

export async function iniciarSesion(_previo: { error?: string } | undefined, form: FormData) {
  const usuario = String(form.get("usuario") ?? "").trim();
  const clave = String(form.get("clave") ?? "");
  const volver = String(form.get("volver") ?? "/");
  if (!usuario || !clave) return { error: "Escriba su usuario y contraseña" };

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correoInterno(usuario), password: clave });
  if (error) return { error: "Usuario o contraseña incorrectos" };

  // Solo rutas internas para evitar redirecciones abiertas.
  redirect(volver.startsWith("/") && !volver.startsWith("//") ? volver : "/");
}

/**
 * Quien olvidó la contraseña deja una solicitud; el desarrollador la aprueba. La respuesta es
 * la misma exista o no el usuario, para no revelar qué usuarios hay.
 */
export async function solicitarClave(_previo: { error?: string; mensaje?: string } | undefined, form: FormData) {
  const usuario = String(form.get("usuario") ?? "").trim().toLowerCase();
  if (!usuario) return { error: "Escriba su usuario" };

  const db = supabaseAdmin();
  const { data: perfil } = await db.from("perfiles").select("id, nombre, usuario").eq("usuario", usuario).eq("activo", true).maybeSingle();
  if (perfil) {
    // Si ya tiene una pendiente, el índice único la rechaza y no se avisa de nuevo.
    const { error } = await db.from("solicitudes_clave").insert({ usuario_id: perfil.id });
    if (!error) {
      await avisar(await desarrolladores(), "Solicitud de contraseña",
        `${perfil.nombre} (@${perfil.usuario}) pide restablecer su contraseña.`, "/admin/claves");
    }
  }
  return { mensaje: "Solicitud enviada. Cuando sea aprobada le avisarán por WhatsApp para ingresar con la contraseña 12345678. Luego puede cambiarla con el ícono de llave." };
}

export async function cerrarSesion() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
