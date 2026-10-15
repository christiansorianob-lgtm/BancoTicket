"use server";
import { revalidatePath } from "next/cache";
import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** El comprador solo elimina sus tiquetes rechazados (lo garantiza RLS); libera el número. */
export async function eliminarRechazado(id: string) {
  await exigirComprador();
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("tiquetes_pendientes").delete().eq("id", id).eq("estado", "rechazado").select("imagen_ruta");
  const ruta = data?.[0]?.imagen_ruta;
  if (ruta) await supabaseAdmin().storage.from("tiquetes").remove([ruta]);
  revalidatePath("/mis-tiquetes");
}
