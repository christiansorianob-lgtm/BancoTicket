import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { registrarConsumo } from "./consumo";

// Aprender un formato pasa pocas veces y debe quedar bien: se usa el modelo más capaz.
const MODELO = "claude-opus-5-5";

const Lista = z.array(z.string());

/** Lo que la IA aprende de una foto de ejemplo de un tiquete. */
export const AnalisisFormato = z.object({
  es_tiquete: z.boolean().describe("true solo si la imagen es un tiquete o recibo de báscula de entrada de fruta, legible"),
  motivo_rechazo: z.string().nullable().describe("Si no es un tiquete válido: qué se ve en la imagen y por qué no sirve, en español sencillo"),
  razon_social: z.string().nullable().describe("Razón social de la extractora que emite el tiquete (la que pesa, no el proveedor)"),
  nombre_corto: z.string().nullable().describe("Nombre corto y reconocible para la extractora, sin S.A.S. (ej. 'Babú Palm', 'Palnorte', 'Oleoflores')"),
  nit: z.string().nullable().describe("NIT de la extractora tal como está impreso; null si no aparece. No usar el NIT del proveedor"),
  nombres_impresos: Lista.describe("Todos los nombres de la extractora que aparecen: razón social, marca del logo, planta, centro de acopio, sellos"),
  extractora_existente_id: z.string().nullable().describe("Si el tiquete es de una de las extractoras ya registradas: su id; si no, null"),
  formato_existente_id: z.string().nullable().describe("Si este formato es igual a uno ya aprendido de esa extractora: su id; si es distinto, null"),
  descripcion: z.string().describe("Una línea que describa este formato (ej. 'Tiquete térmico angosto, texto girado, número arriba a la derecha')"),
  plantilla: z.object({
    rotulo_numero: z.string().describe("Rótulo y ubicación del número del tiquete"),
    no_confundir_numero_con: Lista.describe("Otros números del tiquete que no son el número (NIT, cédula, códigos, guías...)"),
    fecha_entrada: z.string().describe("Rótulo y ubicación de la fecha y hora de entrada"),
    peso_bruto: z.string().describe("Rótulo y ubicación del peso bruto o de entrada"),
    tara: z.string().describe("Rótulo y ubicación de la tara o peso de salida"),
    peso_neto: z.string().describe("Rótulo y ubicación del peso neto"),
    proveedor: z.string().describe("Rótulo y ubicación del proveedor, o 'no lo imprime'"),
    placa: z.string().describe("Rótulo y ubicación de la placa"),
    conductor: z.string().describe("Rótulo y ubicación del conductor, o 'no lo imprime'"),
    bascula: z.string().describe("Rótulo y ubicación de la báscula, o 'no la imprime'"),
    formato_fecha: z.string().describe("Cómo escribe la fecha y la hora, con ejemplo"),
    formato_numeros: z.string().describe("Cómo escribe los kilos (separador de miles), con ejemplo"),
    notas: z.string().describe("Lo que hay que ignorar o tener en cuenta: fecha de salida, sellos, firmas, evaluación de calidad, rotación del papel..."),
  }),
  ejemplo: z.object({
    numero: z.string().nullable(),
    fecha_entrada: z.string().nullable(),
    peso_bruto_kg: z.string().nullable(),
    tara_kg: z.string().nullable(),
    peso_neto_kg: z.string().nullable(),
    proveedor: z.string().nullable(),
    placa: z.string().nullable(),
    conductor: z.string().nullable(),
  }).describe("Los valores de esta foto, tal como están impresos, para que el administrador compruebe lo aprendido"),
});
export type AnalisisFormato = z.infer<typeof AnalisisFormato>;

export type ExtractoraConocida = {
  id: string;
  nombre: string;
  nit: string | null;
  nombres_impresos: string[];
  formatos: { id: string; descripcion: string | null; plantilla: unknown }[];
};

const INSTRUCCIONES = `Eres el asistente que enseña a BancoTicket a leer tiquetes de báscula de extractoras de fruta de palma de aceite en Colombia.
El administrador te envía la foto de un tiquete de ejemplo. Debes:
1. Decidir si es un tiquete o recibo de báscula de entrada de fruta. Si es otra cosa (factura, recibo de pago, foto de otra cosa, imagen ilegible o cortada), es_tiquete = false y explica en motivo_rechazo, en español sencillo, qué ves y qué debe revisar.
2. Identificar la extractora que emite el tiquete (la empresa que pesa la fruta, no el proveedor ni el conductor): razón social, NIT, marca del logo y otros nombres (planta, centro de acopio, sellos). Propón un nombre corto reconocible.
3. Compararla con las extractoras ya registradas (por NIT, razón social, logo o nombres). Si es una de ellas, devuelve su id. Una extractora puede tener varios formatos: si el diseño de este tiquete es igual a un formato ya aprendido, devuelve el id de ese formato; si es distinto, deja formato_existente_id en null.
4. Describir cómo leer este formato: dónde está cada dato, cómo escribe fechas y números, y qué ignorar. Las descripciones deben servir para leer OTROS tiquetes del mismo formato, no solo este.
5. Copiar los valores de esta foto en "ejemplo", tal como están impresos. Si algo no se ve, null. Nunca inventes.
La foto puede venir girada, con sellos o firmas encima.`;

export async function analizarFormato(
  imagen: { base64: string; tipo: "image/webp" | "image/jpeg" },
  conocidas: ExtractoraConocida[],
  usuarioId?: string,
): Promise<AnalisisFormato> {
  const cliente = new Anthropic();
  const registradas = conocidas.length
    ? JSON.stringify(conocidas.map((e) => ({ ...e, formatos: e.formatos.map((f) => ({ id: f.id, descripcion: f.descripcion, plantilla: f.plantilla })) })))
    : "Ninguna todavía.";

  const respuesta = await cliente.beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(AnalisisFormato) },
    system: INSTRUCCIONES,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: imagen.tipo, data: imagen.base64 } },
          { type: "text", text: `Extractoras ya registradas:\n${registradas}\n\nAnaliza este tiquete de ejemplo.` },
        ],
      },
    ],
  });
  // Solo guarda los tokens que la IA ya informó: no hace llamadas adicionales.
  await registrarConsumo("aprendizaje", MODELO, respuesta.usage, usuarioId);

  if (respuesta.stop_reason === "refusal") throw new Error("La IA no pudo analizar esta imagen");
  if (respuesta.stop_reason === "max_tokens" || !respuesta.parsed_output) throw new Error("Análisis incompleto; intente de nuevo");
  return respuesta.parsed_output;
}

/** 9 dígitos base del NIT (sin puntos, guion ni dígito de verificación) para comparar. */
export function nitBase(nit: string | null | undefined): string | null {
  const d = (nit ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(0, 9) : null;
}
