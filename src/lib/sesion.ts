import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";

export type Perfil = {
  id: string;
  nombre: string;
  usuario: string;
  celular: string;
  correo: string;
  rol: Rol;
  activo: boolean;
};

/** Un administrador, un desarrollador (mismos permisos del admin) y varios compradores. */
export type Rol = "admin" | "desarrollador" | "comprador";

export const NOMBRE_ROL: Record<Rol, string> = { admin: "Administrador", desarrollador: "Desarrollador", comprador: "Comprador" };

/** Administrador o desarrollador: ven y gestionan todo. */
export function esGestor(rol: string) {
  return rol === "admin" || rol === "desarrollador";
}

/** Perfil del usuario con sesión, o null. Se lee una vez por petición. */
export const perfilActual = cache(async (): Promise<Perfil | null> => {
  const supabase = await supabaseServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub;
  if (!id) return null;
  const { data } = await supabase.from("perfiles").select("*").eq("id", id).single();
  return data && data.activo ? (data as Perfil) : null;
});

export async function exigirSesion(): Promise<Perfil> {
  const perfil = await perfilActual();
  if (!perfil) redirect("/ingresar");
  return perfil;
}

export async function exigirAdmin(): Promise<Perfil> {
  const perfil = await exigirSesion();
  if (!esGestor(perfil.rol)) redirect("/");
  return perfil;
}

export async function exigirComprador(): Promise<Perfil> {
  const perfil = await exigirSesion();
  if (perfil.rol !== "comprador") redirect("/admin");
  return perfil;
}

/** Correo interno de Supabase Auth para ingresar con usuario y contraseña. */
export function correoInterno(usuario: string) {
  return `${usuario.trim().toLowerCase()}@bancoticket.local`;
}
