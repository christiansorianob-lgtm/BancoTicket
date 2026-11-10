import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import { z } from "zod";
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
- Retenciones, cada una por separado tal como aparecen en el bloque de totales: retefuente (Retefuente), reteiva (ReteIVA), reteica (ReteICA); 0 la que no aparezca.
- Porcentajes: el que la factura IMPRIME para cada impuesto (ej. "IVA 19%" → iva_pct 19; "ReteIVA 15%" → reteiva_pct 15). La fruta de palma suele llevar IVA del 5 % y la comisión del 19 %, pero devuelve el que diga el documento; 0 si no aparece.
- La imagen puede venir girada, con sombra o baja resolución. Si un campo no está o no se lee con claridad, devuelve null: no inventes valores.`;

/**
 * Esquema que se pide a la IA: la API admite máximo 16 campos que pueden ser null, así que los
 * impuestos van siempre con número (0 si no aparece). Lo demás puede volver null.
 */
const FacturaIA = FacturaLeida.extend({
  iva: z.number().describe("Valor del IVA del bloque de totales; 0 si no aparece"),
  retefuente: z.number().describe("Valor de la línea Retefuente del bloque de totales; 0 si no aparece"),
  reteiva: z.number().describe("Valor de la línea ReteIVA; 0 si no aparece"),
  reteica: z.number().describe("Valor de la línea ReteICA; 0 si no aparece"),
  iva_pct: z.number().describe("Porcentaje de IVA impreso (ej. 19); 0 si no aparece"),
  retefuente_pct: z.number().describe("Porcentaje de Retefuente impreso; 0 si no aparece"),
  reteiva_pct: z.number().describe("Porcentaje de ReteIVA impreso (ej. 15); 0 si no aparece"),
  reteica_pct: z.number().describe("Porcentaje de ReteICA impreso; 0 si no aparece"),
});

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
      output_config: { effort: "medium", format: zodOutputFormat(FacturaIA) },
      system: INSTRUCCIONES,
      messages: [{ role: "user", content: [contenido, { type: "text", text: "Extrae los campos de esta factura." }] }],
    });
    const consumoId = await registrarConsumo("factura", modelo(), r.usage, usuarioId, { modulo: "facturas", tipo_archivo: tipoArchivo, resultado: "ok" });
    if (r.stop_reason === "refusal" || !r.parsed_output) throw Object.assign(new Error("No se pudo leer la factura"), { registrada: true });
    // Un porcentaje en 0 es que la factura no lo imprime: queda «no se leyó» (null).
    const d = r.parsed_output;
    const pct = (n: number) => (n > 0 ? n : null);
    return { datos: { ...d, iva_pct: pct(d.iva_pct), retefuente_pct: pct(d.retefuente_pct), reteiva_pct: pct(d.reteiva_pct), reteica_pct: pct(d.reteica_pct) }, consumoId };
  } catch (e) {
    // Las llamadas fallidas también cuentan en el contador (sin tokens si la API no respondió).
    if (!(e as { registrada?: boolean }).registrada) {
      await registrarConsumo("factura", modelo(), null, usuarioId, { modulo: "facturas", tipo_archivo: tipoArchivo, resultado: "error" });
    }
    throw e;
  }
}
