"use server";
import { revalidatePath } from "next/cache";
import { exigirComprador } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verificar, type LecturaFirmada, type RevisionFirmada } from "@/lib/lectura/firma";
import { administradores, avisar } from "@/lib/avisos";

export type ResultadoEnvio = { ok: true; numero: string; extractora: string } | { ok: false; error: string };

/** El comprador confirmó «Coincide, enviar»: entra a la tabla provisional como pendiente. */
export async function enviarTiquete(token: string): Promise<ResultadoEnvio> {
  const perfil = await exigirComprador();
  let l: LecturaFirmada;
  try {
    l = verificar<LecturaFirmada>(token, "lectura", perfil.id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const db = supabaseAdmin();
  const { error } = await db.rpc("registrar_pendiente", {
    p_usuario: perfil.id,
    p: {
      ...l.datos,
      extractora_id: l.extractora_id,
      imagen_ruta: l.imagen_ruta,
      origen: l.origen,
      // Solo va a revisión si la IA no está 100 % segura de algún dato (no por venir de la galería).
      requiere_revision: l.dudosos.length > 0,
      motivo_revision: l.dudosos.length > 0 ? `Verificar: ${l.dudosos.join(", ")}` : null,
      datos_leidos: l.datos,
    },
  });
  if (error) {
    const msg = error.message.includes("TIQUETE_DUPLICADO") ? error.message.replace(/^.*TIQUETE_DUPLICADO: /, "Este tiquete ya existe: ") : "No se pudo guardar el tiquete";
    return { ok: false, error: msg };
  }

  const { data: ext } = await db.from("extractoras").select("nombre").eq("id", l.extractora_id).single();
  const extractora = ext?.nombre ?? "";
  await avisar(await administradores(), "Tiquete por aprobar",
    `${perfil.nombre} subió el tiquete N° ${l.datos.numero} de ${extractora}${l.dudosos.length ? ` (verificar: ${l.dudosos.join(", ")})` : ""}.`,
    "/admin/pendientes");
  await avisar([{ id: perfil.id, correo: perfil.correo, nombre: perfil.nombre }], "Tiquete recibido",
    `Recibimos su tiquete N° ${l.datos.numero} de ${extractora}. Queda pendiente de aprobación.`, "/mis-tiquetes");

  revalidatePath("/mis-tiquetes");
  return { ok: true, numero: l.datos.numero, extractora };
}

/** La lectura falló y el comprador pide revisión manual: queda en «Formatos no reconocidos». */
export async function enviarARevision(token: string): Promise<{ ok: boolean; error?: string }> {
  const perfil = await exigirComprador();
  let r: RevisionFirmada;
  try {
    r = verificar<RevisionFirmada>(token, "revision", perfil.id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const db = supabaseAdmin();
  const { error } = await db.from("formatos_no_reconocidos").insert({
    extractora_id: r.extractora_id,
    comprador_id: perfil.id,
    imagen_ruta: r.imagen_ruta,
    texto_leido: r.motivo,
    datos_leidos: r.cruda,
  });
  if (error) return { ok: false, error: "No se pudo enviar a revisión" };
  await avisar(await administradores(), "Formato no reconocido",
    `No se pudo leer un tiquete de ${perfil.nombre}: ${r.motivo}`, "/admin/formatos");
  return { ok: true };
}
