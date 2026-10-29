"use server";
import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { montoDesdeTexto } from "@/lib/numeros";
import { completarPrecio, validarFactura } from "@/lib/facturas/validar";
import { facturaDesde } from "@/lib/facturas/formulario";
import { anotarConsumo } from "@/lib/lectura/consumo";
import type { Resultado } from "@/app/(app)/admin/acciones";

const fallo = (error: string): Resultado => ({ ok: false, error });
const errorDe = (m: string) => m.replace(/^.*FACTURA_DUPLICADA: /, "Duplicada: ");

/** Datos del formulario + estado: CONFIRMADA si todas las validaciones pasan; si no, PENDIENTE_REVISION. */
function prepararFactura(form: FormData) {
  const datos = completarPrecio(facturaDesde((k) => form.get(k) as string | null));
  const fallas = validarFactura(datos).filter((v) => !v.ok);
  const estado = fallas.length ? "PENDIENTE_REVISION" : "CONFIRMADA";
  return { datos, estado, motivo: fallas.length ? fallas.map((f) => `${f.nombre}: ${f.mensaje}`).join(" · ") : null };
}

export async function guardarFactura(form: FormData): Promise<Resultado & { id?: string }> {
  await exigirAdmin();
  const { datos, estado, motivo } = prepararFactura(form);
  if (!datos.numero_factura) return fallo("Escriba el número de la factura");
  const archivo_path = String(form.get("archivo_path") ?? "") || null;
  const tipo_archivo = form.get("tipo_archivo") === "imagen" ? "imagen" : "pdf";
  const supabase = await supabaseServidor();
  const { data: id, error } = await supabase.rpc("fact_guardar_factura", { p: { ...datos, motivo_revision: motivo, archivo_path, tipo_archivo }, p_estado: estado });
  if (error) return fallo(errorDe(error.message));
  await anotarConsumo(Number(form.get("consumo_id")) || null, { referencia_id: id as string });
  revalidatePath("/facturas");
  return { ok: true, id: id as string, mensaje: estado === "CONFIRMADA" ? "Factura guardada y confirmada." : "Factura guardada en PENDIENTE DE REVISIÓN: corrija lo marcado." };
}

export async function actualizarFactura(id: string, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const { datos, estado, motivo } = prepararFactura(form);
  if (!datos.numero_factura) return fallo("Escriba el número de la factura");
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc("fact_actualizar_factura", { p_id: id, p: { ...datos, motivo_revision: motivo }, p_estado: estado });
  if (error) return fallo(errorDe(error.message));
  revalidatePath("/facturas", "layout");
  return estado === "CONFIRMADA" ? { ok: true, mensaje: "Factura corregida y confirmada." } : { ok: true, aviso: `Guardada, sigue en revisión: ${motivo}` };
}

/** Lectura cancelada antes de guardar: se borra el archivo subido (nunca llegó a ser un registro). */
export async function descartarArchivo(ruta: string): Promise<void> {
  await exigirAdmin();
  if (!/^\d{4}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(ruta)) return;
  const db = supabaseAdmin();
  const { data: usado } = await db.from("fact_facturas").select("id").eq("archivo_path", ruta).maybeSingle();
  if (!usado) await db.storage.from("facturas").remove([ruta]);
}

export async function registrarAbono(facturaId: string, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const n = (k: string) => montoDesdeTexto(String(form.get(k) ?? "")) ?? 0;
  const fecha = String(form.get("fecha_pago") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fallo("Fecha de pago no válida");
  const valor = montoDesdeTexto(String(form.get("valor_recibido") ?? ""));
  if (valor === null) return fallo("Escriba el valor recibido (neto en banco)");
  const certificado = form.get("certificado_recibido") === "on";
  const p = {
    fecha_pago: fecha, valor_recibido: valor, forma_pago: String(form.get("forma_pago") ?? "").trim() || null,
    referencia: String(form.get("referencia") ?? "").trim() || null,
    retefuente: n("retefuente"), reteiva: n("reteiva"), reteica: n("reteica"), otros_descuentos: n("otros_descuentos"),
    certificado_recibido: certificado, fecha_certificado: certificado ? String(form.get("fecha_certificado") ?? "") || null : null,
    observaciones: String(form.get("observaciones") ?? "").trim() || null,
  };
  if (p.valor_recibido + p.retefuente + p.reteiva + p.reteica + p.otros_descuentos <= 0) return fallo("El abono debe tener algún valor");
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc("fact_registrar_abono", { p_factura: facturaId, p });
  if (error) return fallo(error.message);
  revalidatePath("/facturas", "layout");
  return { ok: true, mensaje: "Abono registrado." };
}

async function conMotivo(funcion: string, id: string, form: FormData, mensaje: string): Promise<Resultado> {
  await exigirAdmin();
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!motivo) return fallo("Escriba el motivo");
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc(funcion, { p_id: id, p_motivo: motivo });
  if (error) return fallo(error.message);
  revalidatePath("/facturas", "layout");
  return { ok: true, mensaje };
}

export async function anularAbono(id: string, form: FormData) { return conMotivo("fact_anular_abono", id, form, "Abono anulado."); }
export async function anularFactura(id: string, form: FormData) { return conMotivo("fact_anular_factura", id, form, "Factura anulada."); }
export async function revertirAnulacion(id: string, form: FormData) { return conMotivo("fact_revertir_anulacion", id, form, "Anulación revertida."); }
