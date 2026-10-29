import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import { FacturaLeida } from "./tipos";
import { registrarConsumo } from "@/lib/lectura/consumo";

/** Modelo configurable (decisión del usuario): Haiku por defecto, el más económico. */
const modelo = () => process.env.FACTURAS_MODELO || "claude-haiku-5-5";

const INSTRUCCIONES = `Lees facturas electrónicas de venta de fruta de palma de aceite en Colombia (normalmente de Siigo: columnas Ítem, Descripción, Cantidad, Vr. Total y un bloque de totales). Puede llegar otro formato: no dependas de posiciones fijas.
Devuelve solo los campos pedidos, como están en el documento:
- Emisor: empresa que vende y emite la factura. Extractora: el cliente/adquiriente.
- Fechas en AAAA-MM-DD. El periodo sale de la descripción del ítem (ej. "del 06 al 19 de octubre de 2026").
- Números como número, sin separadores de miles. Estas facturas suelen usar coma para miles y punto para decimales (ej. 142,060,536.75); si hay duda, interpreta según el formato del documento.
- kilos siempre en kilos, aunque la unidad de medida diga "unidad". precio_kilo: el valor unitario si aparece.
- total_a_pagar es el valor neto final ("Total a Pagar"), NO el "Vr. Total" de la línea del ítem.
- total_retenciones_esperadas = retefuente + ReteIVA (+ ReteICA si aparece); 0 si no hay retenciones.
- La imagen puede venir girada, con sombra o baja resolución. Si un campo no está o no se lee con claridad, devuelve null: no inventes valores.`;

export type ArchivoFactura = { bytes: Buffer; tipo: "pdf" | "jpeg" | "png" | "webp" };

/**
 * Lee la factura con la IA (PDF como documento, imagen como imagen). Registra cada llamada en el
 * contador de IA (módulo «facturas»), también si falla. Devuelve los datos y el id del registro.
 */
export async function leerFactura(a: ArchivoFactura, usuarioId: string): Promise<{ datos: FacturaLeida; consumoId: number | null }> {
  const tipoArchivo = a.tipo === "pdf" ? "pdf" : "imagen";
  let contenido: Anthropic.ContentBlockParam;
  if (a.tipo === "pdf") {
    contenido = { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.bytes.toString("base64") } };
  } else {
    // La imagen se endereza según su EXIF y se limita a 2000 px (menos tokens y dentro del límite de la API).
    const jpg = await sharp(a.bytes).rotate().resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    contenido = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpg.toString("base64") } };
  }

  const cliente = new Anthropic();
  try {
    const r = await cliente.messages.parse({
      model: modelo(),
      max_tokens: 2000,
      output_config: { effort: "medium", format: zodOutputFormat(FacturaLeida) },
      system: INSTRUCCIONES,
      messages: [{ role: "user", content: [contenido, { type: "text", text: "Extrae los campos de esta factura." }] }],
    });
    const consumoId = await registrarConsumo("factura", modelo(), r.usage, usuarioId, { modulo: "facturas", tipo_archivo: tipoArchivo, resultado: "ok" });
    if (r.stop_reason === "refusal" || !r.parsed_output) throw Object.assign(new Error("No se pudo leer la factura"), { registrada: true });
    return { datos: r.parsed_output, consumoId };
  } catch (e) {
    // Las llamadas fallidas también cuentan en el contador (sin tokens si la API no respondió).
    if (!(e as { registrada?: boolean }).registrada) {
      await registrarConsumo("factura", modelo(), null, usuarioId, { modulo: "facturas", tipo_archivo: tipoArchivo, resultado: "error" });
    }
    throw e;
  }
}
