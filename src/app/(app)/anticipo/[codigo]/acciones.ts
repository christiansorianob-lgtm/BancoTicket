"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { administradores, avisar } from "@/lib/avisos";
import { describirAnticipo } from "@/lib/saldo";

async function dispositivo() {
  const h = await headers();
  return `${h.get("user-agent") ?? "desconocido"} | IP ${h.get("x-forwarded-for")?.split(",")[0] ?? "?"}`;
}

async function avisarAdministracion(nombre: string, acepta: boolean, monto: number | undefined, motivo: string) {
  await avisar(await administradores(), `Anticipo ${acepta ? "confirmado" : "en disputa"}`,
    `${nombre} ${acepta ? "confirmó" : "marcó como no coincide"} el ${describirAnticipo(monto)}${acepta ? "" : `: ${motivo}`}.`,
    "/admin/anticipos");
}

/** Desde el enlace que llegó por WhatsApp. */
export async function responderAnticipo(codigo: string, acepta: boolean, motivo: string) {
  const perfil = await exigirComprador();
  const supabase = await supabaseServidor();
  const { data: antes } = await supabase.rpc("ver_anticipo_por_enlace", { p_codigo: codigo });
  const { error } = await supabase.rpc("responder_anticipo", {
    p_codigo: codigo, p_acepta: acepta, p_motivo: motivo || null, p_dispositivo: await dispositivo(),
  });
  if (error) return { ok: false, error: error.message };
  await avisarAdministracion(perfil.nombre, acepta, antes?.[0]?.monto, motivo);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Desde la app del comprador (Anticipos o Inicio), sin el enlace. */
export async function responderAnticipoPorId(id: string, acepta: boolean, motivo: string) {
  const perfil = await exigirComprador();
  const supabase = await supabaseServidor();
  const { data: antes } = await supabase.from("anticipos").select("monto").eq("id", id).single();
  const { error } = await supabase.rpc("responder_anticipo_id", {
    p_id: id, p_acepta: acepta, p_motivo: motivo || null, p_dispositivo: await dispositivo(),
  });
  if (error) return { ok: false, error: error.message };
  await avisarAdministracion(perfil.nombre, acepta, antes?.monto, motivo);
  revalidatePath("/", "layout");
  return { ok: true };
}
