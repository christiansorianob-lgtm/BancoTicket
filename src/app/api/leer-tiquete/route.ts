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
import { extractorasConocidas } from "@/lib/lectura/aprender-guardar";
import { nitBase } from "@/lib/lectura/aprender";
import { revisarFotoServidor } from "@/lib/camara/revisar-foto";

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
  const { data: activas } = await db.from("extractoras").select("id").eq("activa", true);
  const ids = new Set((activas ?? []).map((e) => e.id));
  const extractoras = (await extractorasConocidas()).filter((e) => ids.has(e.id));
  if (extractoras.length === 0) {
    return NextResponse.json({ error: "Todavía no hay extractoras registradas. Pida al administrador que suba un tiquete de ejemplo." }, { status: 400 });
  }

  const bytes = Buffer.from(await imagen.arrayBuffer());
  const rechazo = await revisarFotoServidor(bytes).catch(() => "No se pudo abrir la foto");
  if (rechazo) return NextResponse.json({ error: rechazo }, { status: 422 });

  // La foto se guarda de una vez en la carpeta del comprador.
  const ruta = `${perfil.id}/${randomUUID()}.${imagen.type === "image/webp" ? "webp" : "jpg"}`;
  const subida = await db.storage.from("tiquetes").upload(ruta, bytes, { contentType: imagen.type });
  if (subida.error) return NextResponse.json({ error: "No se pudo guardar la foto" }, { status: 500 });

  const config = await leerConfiguracion();
  const base = { comprador_id: perfil.id, imagen_ruta: ruta, origen, emitida: Date.now() } as const;

  let cruda: LecturaCruda | null = null;
  const motivoFallo = "No se pudo leer la foto";
  if (!process.env.ANTHROPIC_API_KEY) {
    await db.storage.from("tiquetes").remove([ruta]);
    return NextResponse.json({ error: "La lectura automática no está disponible en este momento. Intente más tarde." }, { status: 503 });
  } else try {
    cruda = await lectorConfigurado().leer(
      { base64: bytes.toString("base64"), tipo: imagen.type as (typeof TIPOS)[number] },
      extractoras.map(({ nombre, nit, nombres_impresos, formatos }) => ({ nombre, nit, nombres_impresos, formatos: formatos.map((f) => f.plantilla) })),
      perfil.id,
    );
  } catch (e) {
    console.error("Fallo de lectura", e);
  }

  // Para diagnosticar marcas de duda (se ve en los registros de Vercel). Sin conductor, proveedor ni cédulas.
  if (cruda) {
    console.info("lectura", JSON.stringify({
      extractora: cruda.extractora, numero: cruda.numero_tiquete, bruto: cruda.peso_bruto_kg, tara: cruda.tara_kg,
      neto: cruda.peso_neto_impreso_kg, dudosos: cruda.campos_dudosos, observaciones: cruda.observaciones,
    }));
  }

  // La extractora debe ser una de las registradas: primero por NIT impreso, luego por el nombre que devolvió la IA.
  const nit = nitBase(cruda?.nit_extractora);
  const extractora =
    (nit ? extractoras.find((e) => nitBase(e.nit) === nit) : undefined) ??
    (cruda?.extractora ? extractoras.find((e) => e.nombre.trim().toLowerCase() === cruda!.extractora!.trim().toLowerCase()) : undefined);
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

  // Proveedores de tiquetes ya aprobados (empresas de la administración) para confirmar el leído.
  const { data: aprobados } = await db.from("tiquetes").select("proveedor").eq("estado", "vigente").not("proveedor", "is", null).limit(5000);
  const proveedoresConocidos = [...new Set((aprobados ?? []).map((t) => t.proveedor as string))];
  const resultado = cruda
    ? aplicarControles(cruda, { placaObligatoria: config.placa_obligatoria, proveedoresConocidos })
    : { ok: false as const, motivo: motivoFallo, controles: [], cruda: null };
  const detectada = extractora ? { id: extractora.id, nombre: extractora.nombre } : null;

  // Ilegible (o no es un tiquete, o los datos no cuadran): no va a revisión del administrador.
  // El comprador debe conseguir una foto clara; la foto no se guarda.
  if (!resultado.ok) {
    await db.storage.from("tiquetes").remove([ruta]);
    return NextResponse.json({
      ok: false,
      ilegible: true,
      fueraDePeriodo: resultado.fueraDePeriodo ?? false,
      motivo: resultado.motivo,
      controles: resultado.controles,
      extractora: detectada,
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
