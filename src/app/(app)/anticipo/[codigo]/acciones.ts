"use server";
import { headers } from "next/headers";
import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { administradores, avisar } from "@/lib/avisos";
import { formatoPesos } from "@/lib/numeros";

export async function responderAnticipo(codigo: string, acepta: boolean, motivo: string) {
  const perfil = await exigirComprador();
  const supabase = await supabaseServidor();
  const h = await headers();
  const dispositivo = `${h.get("user-agent") ?? "desconocido"} | IP ${h.get("x-forwarded-for")?.split(",")[0] ?? "?"}`;

  const { data: antes } = await supabase.rpc("ver_anticipo_por_enlace", { p_codigo: codigo });
  const { error } = await supabase.rpc("responder_anticipo", {
    p_codigo: codigo, p_acepta: acepta, p_motivo: motivo || null, p_dispositivo: dispositivo,
  });
  if (error) return { ok: false, error: error.message };

  const a = antes?.[0];
  const tipo = a?.tipo === "pago" ? "Pago" : "Anticipo";
  await avisar(await administradores(), `${tipo} ${acepta ? "confirmado" : "en disputa"}`,
    `${perfil.nombre} ${acepta ? "confirmó" : "marcó como no coincide"} el ${tipo.toLowerCase()} de ${formatoPesos(a?.monto)}${acepta ? "" : `: ${motivo}`}.`,
    "/admin/anticipos");
  return { ok: true };
}
