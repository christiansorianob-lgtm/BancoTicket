"use server";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { correoInterno } from "@/lib/sesion";

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

export async function cerrarSesion() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
