import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { esGestor, perfilActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { montoDesdeTexto } from "@/lib/numeros";
import { MAX_BYTES_FACTURA, tipoReal } from "@/lib/facturas/validar";
import { FORMAS_PAGO } from "@/lib/facturas/tipos";

/**
 * Registrar un abono al CLIENTE (decisión del usuario: los abonos bajan la deuda total del cliente,
 * no la de una factura). Es una ruta y no una acción de servidor porque el soporte (foto o PDF)
 * puede pesar hasta 4 MB. Las fotos se enderezan y se reducen a 2000 px.
 */
export async function POST(request: Request) {
  const perfil = await perfilActual();
  if (!perfil || !esGestor(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const form = await request.formData();
  const texto = (k: string) => String(form.get(k) ?? "").trim();

  const monto = montoDesdeTexto(texto("monto"));
  if (!monto || monto <= 0) return NextResponse.json({ error: "Escriba el monto abonado" }, { status: 400 });
  const forma = texto("forma_pago");
  if (!(FORMAS_PAGO as readonly string[]).includes(forma)) return NextResponse.json({ error: "Elija la forma de pago" }, { status: 400 });
  const fecha = texto("fecha");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ error: "Fecha del abono no válida" }, { status: 400 });
  if (!texto("realizado_por")) return NextResponse.json({ error: "Escriba quién realiza el abono" }, { status: 400 });

  // Soporte opcional: se sube primero; si el abono no se registra, se borra.
  let soporte_path: string | null = null;
  const archivo = form.get("soporte");
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > MAX_BYTES_FACTURA) return NextResponse.json({ error: "El soporte pesa más de 4 MB" }, { status: 400 });
    let bytes: Buffer = Buffer.from(await archivo.arrayBuffer());
    const tipo = tipoReal(bytes);
    if (!tipo) return NextResponse.json({ error: "El soporte debe ser foto (JPG, PNG, WebP) o PDF" }, { status: 400 });
    if (tipo !== "pdf") bytes = await sharp(bytes).rotate().resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    soporte_path = `abonos/${new Date().getFullYear()}/${randomUUID()}.${tipo === "pdf" ? "pdf" : "jpg"}`;
    const { error } = await supabaseAdmin().storage.from("facturas").upload(soporte_path, bytes, { contentType: tipo === "pdf" ? "application/pdf" : "image/jpeg" });
    if (error) return NextResponse.json({ error: "No se pudo guardar el soporte" }, { status: 500 });
  }

  const supabase = await supabaseServidor();
  const { data: id, error } = await supabase.rpc("fact_registrar_abono", { p: {
    cliente_id: texto("cliente_id"), fecha, monto, forma_pago: forma, referencia: texto("referencia"),
    realizado_por: texto("realizado_por"), observacion: texto("observacion"), soporte_path,
  } });
  if (error) {
    if (soporte_path) await supabaseAdmin().storage.from("facturas").remove([soporte_path]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  revalidatePath("/facturas", "layout");
  return NextResponse.json({ id });
}
