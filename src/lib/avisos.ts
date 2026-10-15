import "server-only";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Destino = { id: string; correo: string; nombre: string };

/**
 * Aviso dentro de la app y correo automático en segundo plano (Brevo).
 * El correo nunca bloquea ni hace fallar la operación principal.
 */
export async function avisar(destinos: Destino[], titulo: string, cuerpo: string, enlace?: string) {
  if (destinos.length === 0) return;
  const db = supabaseAdmin();
  await db.from("notificaciones").insert(
    destinos.map((d) => ({ usuario_id: d.id, titulo, cuerpo, enlace: enlace ?? null })),
  );
  after(async () => {
    await Promise.allSettled(destinos.map((d) => enviarCorreo(d, titulo, cuerpo, enlace)));
  });
}

export async function administradores(): Promise<Destino[]> {
  const { data } = await supabaseAdmin().from("perfiles").select("id, correo, nombre").eq("rol", "admin").eq("activo", true);
  return data ?? [];
}

export async function perfilDestino(id: string): Promise<Destino | null> {
  const { data } = await supabaseAdmin().from("perfiles").select("id, correo, nombre").eq("id", id).single();
  return data;
}

function escapar(t: string) {
  return t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

async function enviarCorreo(d: Destino, titulo: string, cuerpo: string, enlace?: string) {
  const clave = process.env.BREVO_API_KEY;
  const remitente = process.env.CORREO_REMITENTE;
  if (!clave || !remitente || !d.correo) return;
  const url = enlace ? new URL(enlace, process.env.NEXT_PUBLIC_APP_URL).toString() : null;
  const html = `<div style="font-family:Arial,sans-serif;color:#1e293b">
    <h2 style="color:#1e3a5f">${escapar(titulo)}</h2>
    <p>Hola ${escapar(d.nombre)},</p><p>${escapar(cuerpo)}</p>
    ${url ? `<p><a href="${url}" style="background:#1e40af;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Abrir en BancoTicket</a></p>` : ""}
    <p style="color:#64748b;font-size:12px">Mensaje automático de BancoTicket.</p></div>`;
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": clave, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: remitente, name: process.env.CORREO_REMITENTE_NOMBRE ?? "BancoTicket" },
      to: [{ email: d.correo, name: d.nombre }],
      subject: `BancoTicket: ${titulo}`,
      htmlContent: html,
    }),
  });
  if (!r.ok) console.error("Correo no enviado", r.status, await r.text());
}
