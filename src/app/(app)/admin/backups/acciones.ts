"use server";
import { revalidatePath } from "next/cache";
import { exigirDesarrollador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";

/** Anota la fecha del último respaldo completo (configuración), para el aviso de cada N días. */
export async function registrarRespaldo(): Promise<{ ok: boolean; error?: string }> {
  await exigirDesarrollador();
  const supabase = await supabaseServidor();
  const { error } = await supabase.from("configuracion").upsert({ clave: "ultimo_respaldo", valor: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/backups");
  return { ok: true };
}
