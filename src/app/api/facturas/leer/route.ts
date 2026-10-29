import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { esGestor, perfilActual } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leerFactura } from "@/lib/facturas/lector";
import { completarPrecio, MAX_BYTES_FACTURA, tipoReal, validarFactura } from "@/lib/facturas/validar";
import { anotarConsumo } from "@/lib/lectura/consumo";

export const maxDuration = 60;

/**
 * Módulo de facturas: recibe un archivo (PDF o imagen, máx. 4 MB), revisa su tipo real, lo lee con
 * la IA, lo guarda en el bucket privado y devuelve los datos para que la administración los confirme.
 */
export async function POST(request: Request) {
  const perfil = await perfilActual();
  if (!perfil || !esGestor(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const archivo = (await request.formData()).get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return NextResponse.json({ error: "Elija un archivo" }, { status: 400 });
  if (archivo.size > MAX_BYTES_FACTURA) return NextResponse.json({ error: "El archivo pesa más de 4 MB" }, { status: 400 });
  const bytes = Buffer.from(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo) return NextResponse.json({ error: "El archivo debe ser PDF, JPG, PNG o WebP" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "La lectura automática no está disponible en este momento" }, { status: 503 });

  let lectura;
  try {
    lectura = await leerFactura({ bytes, tipo }, perfil.id);
  } catch (e) {
    console.error("Fallo de lectura de factura", e);
    return NextResponse.json({ error: "No se pudo leer la factura. Intente de nuevo o con un archivo más claro." }, { status: 502 });
  }
  const datos = completarPrecio(lectura.datos);

  const db = supabaseAdmin();
  const cufe = datos.cufe?.trim();
  if (cufe) {
    const { data: existe } = await db.from("fact_facturas").select("id, numero_factura").eq("cufe", cufe).maybeSingle();
    if (existe) {
      await anotarConsumo(lectura.consumoId, { resultado: "duplicada", referencia_id: existe.id });
      return NextResponse.json({ duplicado: existe, datos });
    }
  }

  const ext = { pdf: "pdf", jpeg: "jpg", png: "png", webp: "webp" }[tipo];
  const contentType = { pdf: "application/pdf", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }[tipo];
  const ruta = `${new Date().getFullYear()}/${randomUUID()}.${ext}`;
  const { error } = await db.storage.from("facturas").upload(ruta, bytes, { contentType });
  if (error) return NextResponse.json({ error: "No se pudo guardar el archivo" }, { status: 500 });

  const validaciones = validarFactura(datos);
  if (validaciones.some((v) => !v.ok)) await anotarConsumo(lectura.consumoId, { resultado: "revision" });
  return NextResponse.json({ datos, validaciones, archivo_path: ruta, tipo_archivo: tipo === "pdf" ? "pdf" : "imagen", consumoId: lectura.consumoId });
}
