import "server-only";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { analizarFormato, nitBase, type AnalisisFormato, type ExtractoraConocida } from "./aprender";

export type ResultadoAprendizaje =
  | { ok: false; motivo: string }
  | {
      ok: true;
      extractora: { id: string; nombre: string; nueva: boolean };
      formato: { id: string; nuevo: boolean };
      totalFormatos: number;
      descripcion: string;
      nit: string | null;
      ejemplo: AnalisisFormato["ejemplo"];
    };

/** Extractoras activas e inactivas con sus formatos (para que la IA compare). */
export async function extractorasConocidas(): Promise<ExtractoraConocida[]> {
  const db = supabaseAdmin();
  const [{ data: ext }, { data: fmt }] = await Promise.all([
    db.from("extractoras").select("id, nombre, nit, nombres_impresos").order("nombre"),
    db.from("formatos_extractora").select("id, extractora_id, descripcion, plantilla").order("creado_en"),
  ]);
  return (ext ?? []).map((e) => ({
    ...e,
    nombres_impresos: e.nombres_impresos ?? [],
    formatos: (fmt ?? []).filter((f) => f.extractora_id === e.id).map(({ id, descripcion, plantilla }) => ({ id, descripcion, plantilla })),
  }));
}

/**
 * El administrador sube un tiquete de ejemplo: la IA revisa que sea un tiquete, identifica
 * la extractora (por NIT y nombres) y aprende el formato. Crea la extractora si es nueva y
 * agrega el formato si es distinto a los que ya conocía.
 */
export async function aprenderDeFoto(foto: { bytes: Buffer; tipo: "image/webp" | "image/jpeg"; ruta: string }, usuarioId?: string): Promise<ResultadoAprendizaje> {
  const conocidas = await extractorasConocidas();
  const a = await analizarFormato({ base64: foto.bytes.toString("base64"), tipo: foto.tipo }, conocidas, usuarioId);
  if (!a.es_tiquete) {
    return { ok: false, motivo: a.motivo_rechazo ?? "La imagen no parece un tiquete de báscula. Revise que sea la foto correcta." };
  }

  const supabase = await supabaseServidor(); // como el administrador: queda en el historial
  const nit = nitBase(a.nit);

  // 1) ¿Ya existe? Primero por NIT; si no, lo que reconoció la IA.
  let existente = nit ? conocidas.find((e) => nitBase(e.nit) === nit) : undefined;
  existente ??= conocidas.find((e) => e.id === a.extractora_existente_id);

  let extractora: { id: string; nombre: string; nueva: boolean };
  const nombres = [...new Set([...(existente?.nombres_impresos ?? []), ...a.nombres_impresos, a.razon_social].filter((n): n is string => !!n?.trim()))];

  if (existente) {
    const { error } = await supabase.from("extractoras")
      .update({ nit: existente.nit ?? a.nit, nombres_impresos: nombres })
      .eq("id", existente.id);
    if (error) throw new Error(error.message);
    extractora = { id: existente.id, nombre: existente.nombre, nueva: false };
  } else {
    const base = (a.nombre_corto ?? a.razon_social ?? "Extractora nueva").trim();
    const usados = new Set(conocidas.map((e) => e.nombre.toLowerCase()));
    let nombre = base, n = 2;
    while (usados.has(nombre.toLowerCase())) nombre = `${base} ${n++}`;
    const { data, error } = await supabase.from("extractoras")
      .insert({ nombre, nit: a.nit, nombres_impresos: nombres, activa: true })
      .select("id, nombre").single();
    if (error) throw new Error(error.message);
    extractora = { id: data.id, nombre: data.nombre, nueva: true };
  }

  // 2) ¿Formato nuevo o uno que ya conocía de esta extractora?
  const previo = existente?.formatos.find((f) => f.id === a.formato_existente_id);
  let formato: { id: string; nuevo: boolean };
  if (previo) {
    const { data: viejo } = await supabase.from("formatos_extractora").select("imagen_ruta").eq("id", previo.id).single();
    const { error } = await supabase.from("formatos_extractora")
      .update({ plantilla: a.plantilla, descripcion: a.descripcion, imagen_ruta: foto.ruta })
      .eq("id", previo.id);
    if (error) throw new Error(error.message);
    if (viejo?.imagen_ruta && viejo.imagen_ruta !== foto.ruta) await supabaseAdmin().storage.from("tiquetes").remove([viejo.imagen_ruta]);
    formato = { id: previo.id, nuevo: false };
  } else {
    const { data, error } = await supabase.from("formatos_extractora")
      .insert({ extractora_id: extractora.id, plantilla: a.plantilla, descripcion: a.descripcion, imagen_ruta: foto.ruta })
      .select("id").single();
    if (error) throw new Error(error.message);
    formato = { id: data.id, nuevo: true };
  }

  const { count } = await supabase.from("formatos_extractora").select("id", { count: "exact", head: true }).eq("extractora_id", extractora.id);
  return { ok: true, extractora, formato, totalFormatos: count ?? 1, descripcion: a.descripcion, nit: a.nit, ejemplo: a.ejemplo };
}
