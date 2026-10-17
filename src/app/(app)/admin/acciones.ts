"use server";
import { revalidatePath } from "next/cache";
import { exigirAdmin, correoInterno } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { avisar, perfilDestino } from "@/lib/avisos";
import { interpretarFechaTiquete } from "@/lib/fechas";
import { formatoPesos, kilosDesdeTexto, montoDesdeTexto } from "@/lib/numeros";
import { normalizarPlaca } from "@/lib/lectura/controles";

/** whatsapp/correo/asunto: aviso que se abre listo en el dispositivo para enviarlo al comprador. */
export type Resultado = { ok: boolean; error?: string; mensaje?: string; enlace?: string; celular?: string; whatsapp?: string; correo?: string; asunto?: string };

const fallo = (error: string): Resultado => ({ ok: false, error });

function textoODefecto(v: FormDataEntryValue | null) {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

/** Convierte el formulario de edición de un tiquete en el objeto de cambios para SQL. */
function cambiosTiquete(form: FormData): Record<string, unknown> | string {
  const c: Record<string, unknown> = {};
  for (const clave of ["extractora_id", "comprador_id"]) if (form.has(clave)) c[clave] = form.get(clave);
  for (const clave of ["numero", "bascula", "conductor", "proveedor"]) if (form.has(clave)) c[clave] = textoODefecto(form.get(clave));
  if (form.has("numero") && !c.numero) return "El número es obligatorio";
  if (form.has("placa")) c.placa = normalizarPlaca(String(form.get("placa")));
  if (form.has("fecha_entrada")) {
    const f = String(form.get("fecha_entrada"));
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(f) ? `${f}:00-05:00` : interpretarFechaTiquete(f);
    if (!iso) return "Fecha no válida";
    c.fecha_entrada = iso;
  }
  for (const clave of ["peso_bruto_kg", "tara_kg", "neto_impreso_kg"]) {
    if (!form.has(clave)) continue;
    const t = String(form.get(clave)).trim();
    if (t === "" && clave === "neto_impreso_kg") { c[clave] = null; continue; }
    const k = kilosDesdeTexto(t);
    if (k === null) return `Peso no válido: ${t}`;
    c[clave] = k;
  }
  if (typeof c.peso_bruto_kg === "number" && typeof c.tara_kg === "number" && c.peso_bruto_kg <= c.tara_kg) {
    return "El peso bruto debe ser mayor que la tara";
  }
  if (form.has("precio_tonelada")) {
    const t = String(form.get("precio_tonelada")).trim();
    c.precio_tonelada = t === "" ? null : montoDesdeTexto(t);
    if (t !== "" && c.precio_tonelada === null) return "Precio no válido";
  }
  if (form.has("estado")) c.estado = form.get("estado") === "anulado" ? "anulado" : "vigente";
  return c;
}

// ---------------------------------------------------------------------------
// Tiquetes pendientes
// ---------------------------------------------------------------------------
export async function aprobarTiquete(id: string): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await supabaseServidor();
  const { data: tp } = await supabase.from("tiquetes_pendientes").select("numero, comprador_id, extractoras(nombre)").eq("id", id).single();
  const { error } = await supabase.rpc("aprobar_tiquete", { p_id: id });
  if (error) return fallo(error.message);
  const comprador = tp ? await perfilDestino(tp.comprador_id) : null;
  const texto = `Su tiquete N° ${tp?.numero} de ${(tp?.extractoras as { nombre?: string } | null)?.nombre ?? ""} fue aprobado.`;
  if (comprador) await avisar([comprador], "Tiquete aprobado", texto, "/mis-tiquetes?estado=vigente");
  revalidatePath("/admin", "layout");
  return { ok: true, whatsapp: texto, celular: await celularDe(tp?.comprador_id), correo: comprador?.correo, asunto: "BancoTicket: tiquete aprobado" };
}

export async function rechazarTiquete(id: string, motivo: string): Promise<Resultado> {
  await exigirAdmin();
  if (!motivo.trim()) return fallo("Escriba el motivo del rechazo");
  const supabase = await supabaseServidor();
  const { data: tp } = await supabase.from("tiquetes_pendientes").select("numero, comprador_id, extractoras(nombre)").eq("id", id).single();
  const { error } = await supabase.rpc("rechazar_tiquete", { p_id: id, p_motivo: motivo.trim() });
  if (error) return fallo(error.message);
  const texto = `Su tiquete N° ${tp?.numero} de ${(tp?.extractoras as { nombre?: string } | null)?.nombre ?? ""} fue rechazado. Motivo: ${motivo.trim()}`;
  const comprador = tp ? await perfilDestino(tp.comprador_id) : null;
  if (comprador) await avisar([comprador], "Tiquete rechazado", texto, "/mis-tiquetes?estado=rechazado");
  revalidatePath("/admin", "layout");
  return { ok: true, whatsapp: texto, celular: await celularDe(tp?.comprador_id), correo: comprador?.correo, asunto: "BancoTicket: tiquete rechazado" };
}

export async function editarPendiente(id: string, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const cambios = cambiosTiquete(form);
  if (typeof cambios === "string") return fallo(cambios);
  const supabase = await supabaseServidor();
  const { error } = await supabase.rpc("editar_pendiente", { p_id: id, p: cambios, p_motivo: textoODefecto(form.get("motivo")) ?? "Corrección del administrador" });
  if (error) return fallo(error.message.replace(/^.*TIQUETE_DUPLICADO: /, "Ya existe: "));
  await supabase.from("tiquetes_pendientes").update({ requiere_revision: false }).eq("id", id);
  revalidatePath("/admin/pendientes");
  return { ok: true, mensaje: "Datos corregidos" };
}

// ---------------------------------------------------------------------------
// Tiquetes aprobados y precios
// ---------------------------------------------------------------------------
export async function editarTiquete(id: string, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const cambios = cambiosTiquete(form);
  if (typeof cambios === "string") return fallo(cambios);
  const supabase = await supabaseServidor();
  const { data: antes } = await supabase.from("tiquetes").select("precio_tonelada, numero, comprador_id").eq("id", id).single();
  const { error } = await supabase.rpc("editar_tiquete", { p_id: id, p: cambios, p_motivo: textoODefecto(form.get("motivo")) });
  if (error) return fallo(error.message.replace(/^.*TIQUETE_DUPLICADO: /, "Ya existe: "));

  if (antes && "precio_tonelada" in cambios && Number(antes.precio_tonelada ?? -1) !== Number(cambios.precio_tonelada ?? -1)) {
    const comprador = await perfilDestino(antes.comprador_id);
    if (comprador) await avisar([comprador], "Tiquete valorado",
      `El tiquete N° ${antes.numero} quedó con precio de ${formatoPesos(cambios.precio_tonelada as number)} por tonelada.`, "/extracto");
  }
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: "Tiquete actualizado" };
}

export async function asignarPrecioBloque(form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const precio = montoDesdeTexto(String(form.get("precio") ?? ""));
  if (precio === null || precio <= 0) return fallo("Escriba un precio por tonelada válido");
  const filtros = {
    p_desde: textoODefecto(form.get("desde")),
    p_hasta: textoODefecto(form.get("hasta")),
    p_extractora: textoODefecto(form.get("extractora")),
    p_comprador: textoODefecto(form.get("comprador")),
  };
  const soloSinPrecio = form.get("solo_sin_precio") === "on";
  const supabase = await supabaseServidor();

  // Compradores afectados, para avisarles.
  let q = supabase.from("tiquetes").select("comprador_id").eq("estado", "vigente");
  if (filtros.p_desde) q = q.gte("fecha_entrada", `${filtros.p_desde}T00:00:00-05:00`);
  if (filtros.p_hasta) q = q.lte("fecha_entrada", `${filtros.p_hasta}T23:59:59.999-05:00`);
  if (filtros.p_extractora) q = q.eq("extractora_id", filtros.p_extractora);
  if (filtros.p_comprador) q = q.eq("comprador_id", filtros.p_comprador);
  if (soloSinPrecio) q = q.is("precio_tonelada", null);
  const { data: afectados } = await q;

  const { data: n, error } = await supabase.rpc("asignar_precio_bloque", {
    p_precio: precio, ...filtros, p_solo_sin_precio: soloSinPrecio, p_motivo: textoODefecto(form.get("motivo")),
  });
  if (error) return fallo(error.message);

  const ids = [...new Set((afectados ?? []).map((a) => a.comprador_id))];
  const destinos = (await Promise.all(ids.map(perfilDestino))).filter((d) => d !== null);
  await avisar(destinos, "Tiquetes valorados", `Se asignó un precio de ${formatoPesos(precio)} por tonelada a sus tiquetes. Revise su extracto.`, "/extracto");
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: `Precio asignado a ${n} tiquete(s)` };
}

// ---------------------------------------------------------------------------
// Anticipos
// ---------------------------------------------------------------------------
async function celularDe(id: string | undefined) {
  if (!id) return undefined;
  const { data } = await supabaseAdmin().from("perfiles").select("celular").eq("id", id).single();
  return data?.celular;
}

async function enviarEnlace(anticipoId: string): Promise<Resultado> {
  const supabase = await supabaseServidor();
  const { data: codigo, error } = await supabase.rpc("generar_enlace_anticipo", { p_id: anticipoId });
  if (error) return fallo(error.message);
  const { data: a } = await supabase.from("anticipos").select("monto, fecha, comprador_id").eq("id", anticipoId).single();
  const enlace = `${process.env.NEXT_PUBLIC_APP_URL}/anticipo/${codigo}`;
  const tipo = "anticipo";
  const comprador = a ? await perfilDestino(a.comprador_id) : null;
  if (comprador) {
    await avisar([comprador], `Confirme el ${tipo} recibido`,
      `Se registró un ${tipo} de ${formatoPesos(a!.monto)} a su nombre. Ingrese y confirme si lo recibió.`, `/anticipo/${codigo}`);
  }
  revalidatePath("/admin/anticipos");
  return {
    ok: true,
    enlace,
    celular: await celularDe(a?.comprador_id),
    correo: comprador?.correo,
    asunto: `BancoTicket: confirme el ${tipo} recibido`,
    whatsapp: `Hola ${comprador?.nombre ?? ""}, le registré un ${tipo} de ${formatoPesos(a?.monto)}. Por favor confírmelo en BancoTicket: ${enlace}`,
  };
}

export async function registrarAnticipo(form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const monto = montoDesdeTexto(String(form.get("monto") ?? ""));
  const comprador = String(form.get("comprador") ?? "");
  const fecha = String(form.get("fecha") ?? "");
  if (!comprador) return fallo("Elija el comprador");
  if (!monto || monto <= 0) return fallo("Escriba un monto válido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fallo("Fecha no válida");
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.from("anticipos").insert({
    comprador_id: comprador,
    monto, fecha,
    nota: textoODefecto(form.get("nota")),
  }).select("id").single();
  if (error) return fallo(error.message);
  return enviarEnlace(data.id);
}

export async function reenviarEnlace(anticipoId: string): Promise<Resultado> {
  await exigirAdmin();
  return enviarEnlace(anticipoId);
}

// ---------------------------------------------------------------------------
// Compradores y administradores
// ---------------------------------------------------------------------------
export async function guardarUsuario(form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const id = textoODefecto(form.get("id"));
  const nombre = textoODefecto(form.get("nombre"));
  const usuario = String(form.get("usuario") ?? "").trim().toLowerCase();
  const celular = String(form.get("celular") ?? "").replace(/\D/g, "");
  const correo = String(form.get("correo") ?? "").trim().toLowerCase();
  const clave = String(form.get("clave") ?? "");
  const rol = form.get("rol") === "admin" ? "admin" : "comprador";
  const activo = form.get("activo") !== "off";

  if (!nombre) return fallo("Escriba el nombre");
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return fallo("Usuario: 3 a 30 letras minúsculas, números, punto o guion");
  if (celular.length < 10) return fallo("El celular (WhatsApp) es obligatorio");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return fallo("El correo es obligatorio");
  if (!id && clave.length < 8) return fallo("La contraseña debe tener al menos 8 caracteres");
  if (clave && clave.length < 8) return fallo("La contraseña debe tener al menos 8 caracteres");

  const auth = supabaseAdmin().auth.admin;
  const supabase = await supabaseServidor();
  if (!id) {
    const { data, error } = await auth.createUser({ email: correoInterno(usuario), password: clave, email_confirm: true });
    if (error) return fallo(error.message.includes("already") ? "Ese usuario ya existe" : error.message);
    const { error: e2 } = await supabase.from("perfiles").insert({ id: data.user.id, nombre, usuario, celular, correo, rol, activo });
    if (e2) {
      await auth.deleteUser(data.user.id);
      return fallo(e2.message.includes("duplicate") ? "Ese usuario ya existe" : e2.message);
    }
  } else {
    const cambiosAuth: { email?: string; password?: string; ban_duration?: string } = { email: correoInterno(usuario), ban_duration: activo ? "none" : "876000h" };
    if (clave) cambiosAuth.password = clave;
    const { error } = await auth.updateUserById(id, cambiosAuth);
    if (error) return fallo(error.message);
    const { error: e2 } = await supabase.from("perfiles").update({ nombre, usuario, celular, correo, rol, activo }).eq("id", id);
    if (e2) return fallo(e2.message);
  }
  revalidatePath("/admin/compradores");
  return { ok: true, mensaje: "Usuario guardado" };
}

// ---------------------------------------------------------------------------
// Extractoras y formatos
// ---------------------------------------------------------------------------
export async function guardarExtractora(form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const id = textoODefecto(form.get("id"));
  const nombre = textoODefecto(form.get("nombre"));
  if (!nombre) return fallo("Escriba el nombre");
  let plantilla: unknown = {};
  const texto = String(form.get("plantilla") ?? "").trim();
  if (texto) {
    try { plantilla = JSON.parse(texto); } catch { return fallo("La plantilla debe ser JSON válido"); }
  }
  const fila = { nombre, activa: form.get("activa") !== "off", plantilla };
  const supabase = await supabaseServidor();
  const { error } = id ? await supabase.from("extractoras").update(fila).eq("id", id) : await supabase.from("extractoras").insert(fila);
  if (error) return fallo(error.message.includes("duplicate") ? "Ya existe una extractora con ese nombre" : error.message);
  revalidatePath("/admin/extractoras");
  return { ok: true, mensaje: "Extractora guardada" };
}

/** Registra a mano un tiquete cuya lectura falló; queda pendiente para aprobar. */
export async function registrarDesdeFormato(formatoId: string, form: FormData): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await supabaseServidor();
  const { data: f } = await supabase.from("formatos_no_reconocidos").select("*").eq("id", formatoId).single();
  if (!f) return fallo("Formato no encontrado");
  const cambios = cambiosTiquete(form);
  if (typeof cambios === "string") return fallo(cambios);
  if (!cambios.numero || !cambios.fecha_entrada || cambios.peso_bruto_kg == null || cambios.tara_kg == null) {
    return fallo("Número, fecha, peso bruto y tara son obligatorios");
  }
  const { error } = await supabase.from("tiquetes_pendientes").insert({
    ...cambios,
    extractora_id: cambios.extractora_id ?? f.extractora_id,
    comprador_id: f.comprador_id,
    imagen_ruta: f.imagen_ruta,
    origen: "galeria",
    requiere_revision: false,
    motivo_revision: "Registrado a mano por el administrador",
    datos_leidos: f.datos_leidos,
  });
  if (error) return fallo(error.message.replace(/^.*TIQUETE_DUPLICADO: /, "Ya existe: "));
  await supabase.from("formatos_no_reconocidos").update({ estado: "resuelto" }).eq("id", formatoId);

  const plantilla = String(form.get("plantilla") ?? "").trim();
  if (plantilla && f.extractora_id) {
    try {
      await supabase.from("extractoras").update({ plantilla: JSON.parse(plantilla) }).eq("id", f.extractora_id);
    } catch {
      return { ok: true, mensaje: "Tiquete registrado, pero la plantilla no es JSON válido y no se guardó" };
    }
  }
  revalidatePath("/admin", "layout");
  return { ok: true, mensaje: "Tiquete registrado como pendiente" };
}

export async function descartarFormato(formatoId: string): Promise<Resultado> {
  await exigirAdmin();
  const supabase = await supabaseServidor();
  const { error } = await supabase.from("formatos_no_reconocidos").update({ estado: "descartado" }).eq("id", formatoId);
  if (error) return fallo(error.message);
  revalidatePath("/admin/formatos");
  return { ok: true };
}
