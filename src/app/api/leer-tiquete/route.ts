import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { perfilActual } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { leerConfiguracion } from "@/lib/config";
import { lectorConfigurado } from "@/lib/lectura/lector-ia";
import { aplicarControles } from "@/lib/lectura/controles";
import { firmar } from "@/lib/lectura/firma";
import type { LecturaCruda } from "@/lib/lectura/tipos";

export const maxDuration = 60;

const TIPOS = ["image/webp", "image/jpeg"] as const;
const MAX_BYTES = 600_000;

/** El comprador solo sube la foto: la IA identifica la extractora entre las registradas y lee el tiquete. */
export async function POST(request: Request) {
  const perfil = await perfilActual();
  if (!perfil || perfil.rol !== "comprador") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const form = await request.formData();
  const imagen = form.get("imagen");
  const origen = form.get("origen") === "galeria" ? "galeria" : "camara";

  if (!(imagen instanceof File) || !TIPOS.includes(imagen.type as (typeof TIPOS)[number])) {
    return NextResponse.json({ error: "La foto debe ser JPEG o WebP" }, { status: 400 });
  }
  if (imagen.size > MAX_BYTES) return NextResponse.json({ error: "La foto es demasiado grande" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: activas } = await db.from("extractoras").select("id, nombre, plantilla").eq("activa", true).order("nombre");
  const extractoras = activas ?? [];
  if (extractoras.length === 0) return NextResponse.json({ error: "No hay extractoras registradas" }, { status: 400 });

  // La foto se guarda de una vez en la carpeta del comprador.
  const bytes = Buffer.from(await imagen.arrayBuffer());
  const ruta = `${perfil.id}/${randomUUID()}.${imagen.type === "image/webp" ? "webp" : "jpg"}`;
  const subida = await db.storage.from("tiquetes").upload(ruta, bytes, { contentType: imagen.type });
  if (subida.error) return NextResponse.json({ error: "No se pudo guardar la foto" }, { status: 500 });

  const config = await leerConfiguracion();
  const base = { comprador_id: perfil.id, imagen_ruta: ruta, origen, emitida: Date.now() } as const;

  let cruda: LecturaCruda | null = null;
  let motivoFallo = "No se pudo leer la foto";
  if (!process.env.ANTHROPIC_API_KEY) {
    motivoFallo = "La lectura automática todavía no está configurada (falta la clave de Anthropic). Envíelo a revisión del administrador";
  } else try {
    cruda = await lectorConfigurado().leer(
      { base64: bytes.toString("base64"), tipo: imagen.type as (typeof TIPOS)[number] },
      extractoras.map((e) => ({ nombre: e.nombre, plantilla: e.plantilla ?? {} })),
    );
  } catch (e) {
    console.error("Fallo de lectura", e);
  }

  // La extractora detectada debe ser una de las registradas.
  const extractora = cruda?.extractora
    ? extractoras.find((e) => e.nombre.trim().toLowerCase() === cruda!.extractora!.trim().toLowerCase())
    : undefined;
  if (cruda?.es_tiquete && !extractora) {
    const dice = cruda.extractora_impresa ? ` (el tiquete dice «${cruda.extractora_impresa}»)` : "";
    const motivo = `No se reconoció la extractora${dice}`;
    return NextResponse.json({
      ok: false,
      motivo,
      controles: [{ nombre: "Extractora", ok: false, mensaje: `${motivo}. Si es una extractora nueva, envíelo a revisión.` }],
      tokenRevision: firmar({ ...base, tipo: "revision", extractora_id: null, cruda, motivo }),
    });
  }

  const resultado = cruda
    ? aplicarControles(cruda, { placaObligatoria: config.placa_obligatoria })
    : { ok: false as const, motivo: motivoFallo, controles: [], cruda: null };
  const detectada = extractora ? { id: extractora.id, nombre: extractora.nombre } : null;

  if (!resultado.ok) {
    return NextResponse.json({
      ok: false,
      motivo: resultado.motivo,
      controles: resultado.controles,
      extractora: detectada,
      tokenRevision: firmar({ ...base, tipo: "revision", extractora_id: detectada?.id ?? null, cruda: resultado.cruda, motivo: resultado.motivo }),
    });
  }
  // Aquí la extractora siempre se detectó (si no, se devolvió arriba).
  const ext = detectada!;

  // Duplicados: extractora + número, contra aprobados y pendientes.
  const supabase = await supabaseServidor();
  const { data: duplicado } = await supabase.rpc("buscar_duplicado", { p_extractora: ext.id, p_numero: resultado.datos.numero });
  if (duplicado && duplicado.length > 0) {
    await db.storage.from("tiquetes").remove([ruta]);
    return NextResponse.json({ ok: false, duplicado: duplicado[0], datos: resultado.datos, controles: resultado.controles, extractora: ext });
  }

  const { data: parecidos } = await supabase.rpc("posibles_duplicados", {
    p_placa: resultado.datos.placa,
    p_fecha: resultado.datos.fecha_entrada,
  });

  return NextResponse.json({
    ok: true,
    datos: resultado.datos,
    controles: resultado.controles,
    dudosos: resultado.dudosos,
    extractora: ext,
    posiblesDuplicados: parecidos ?? [],
    token: firmar({ ...base, tipo: "lectura", extractora_id: ext.id, datos: resultado.datos, dudosos: resultado.dudosos }),
  });
}
