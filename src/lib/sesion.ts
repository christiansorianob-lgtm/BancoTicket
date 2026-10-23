import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";

export type Perfil = {
  id: string;
  nombre: string;
  usuario: string;
  celular: string;
  correo: string | null;
  rol: Rol;
  activo: boolean;
  /** Tiene la contraseña por defecto (usuario nuevo o restablecido). Solo se usa para recomendarle cambiarla. */
  cambiar_clave: boolean;
};

/** Un administrador, un desarrollador (mismos permisos del admin), varios compradores y varios consultores (solo ven). */
export type Rol = "admin" | "desarrollador" | "comprador" | "consultor";

export const NOMBRE_ROL: Record<Rol, string> = { admin: "Administrador", desarrollador: "Desarrollador", comprador: "Comprador", consultor: "Consultor" };

/** Administrador o desarrollador: ven y gestionan todo. */
export function esGestor(rol: string) {
  return rol === "admin" || rol === "desarrollador";
}

/** Pueden ver estados de cuenta, reportes, Excel, fotos y soportes: administración y consultores. */
export function puedeConsultar(rol: string) {
  return esGestor(rol) || rol === "consultor";
}

/** Página de inicio de cada perfil. */
export function inicioDe(rol: string) {
  return esGestor(rol) ? "/admin" : rol === "consultor" ? "/consulta" : "/";
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

/** Sección «Consulta»: solo lectura (consultores; la administración también puede verla). */
export async function exigirConsulta(): Promise<Perfil> {
  const perfil = await exigirSesion();
  if (!puedeConsultar(perfil.rol)) redirect("/");
  return perfil;
}

export async function exigirDesarrollador(): Promise<Perfil> {
  const perfil = await exigirSesion();
  if (perfil.rol !== "desarrollador") redirect("/");
  return perfil;
}

export async function exigirComprador(): Promise<Perfil> {
  const perfil = await exigirSesion();
  if (perfil.rol !== "comprador") redirect(inicioDe(perfil.rol));
  return perfil;
}

/** Correo interno de Supabase Auth para ingresar con usuario y contraseña. */
export function correoInterno(usuario: string) {
  return `${usuario.trim().toLowerCase()}@bancoticket.local`;
}
