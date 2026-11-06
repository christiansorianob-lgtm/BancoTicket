"use server";
import { revalidatePath } from "next/cache";
import { exigirDesarrollador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { montoDesdeTexto } from "@/lib/numeros";
import type { Resultado } from "./acciones";

/** Registrar una recarga de saldo hecha en Claude Console (solo el desarrollador; solo agrega, nunca edita). */
export async function registrarRecarga(form: FormData): Promise<Resultado> {
  await exigirDesarrollador();
  const monto = montoDesdeTexto(String(form.get("monto") ?? ""));
  if (!monto || monto <= 0) return { ok: false, error: "Escriba el monto recargado en dólares" };
  const fecha = String(form.get("fecha") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "Fecha no válida" };
  const supabase = await supabaseServidor();
  const { error } = await supabase.from("recargas_ia").insert({ fecha, monto_usd: monto, nota: String(form.get("nota") ?? "").trim() || null });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true, mensaje: `Recarga de US$ ${monto.toLocaleString("es-CO", { maximumFractionDigits: 2 })} registrada.` };
}
