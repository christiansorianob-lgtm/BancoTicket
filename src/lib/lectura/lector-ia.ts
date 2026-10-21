import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LecturaCruda, type ExtractoraParaLeer, type LectorTiquete } from "./tipos";
import { registrarConsumo } from "./consumo";

const MODELO = "claude-haiku-5-5";

const INSTRUCCIONES = `Lees fotos de tiquetes de báscula de extractoras de fruta de palma de aceite en Colombia.
Devuelve los campos exactamente como están impresos (no conviertas unidades ni corrijas números).

Sinónimos de los campos:
- Número de tiquete: "Entrada de materia prima No.", "Entrada de producto No.", "N° Tiquete", "Tiquete N°". No confundir con la cédula, la guía de transporte ni el NIT, salvo que la plantilla de la extractora indique otra cosa.
- Peso bruto (camión con fruta, el mayor): "Peso entrada", "Peso bruto", primera fila de "Pesos (Kg)" o "Peso".
- Tara (camión vacío, el menor): "Peso salida", "Tara", segunda fila de "Pesos (Kg)" o "Peso".
- Peso neto: "Peso neto", "Total kilos".
- Placa: "Placa vehículo", "Placa", "Vehículo".
- Conductor: "Conductor" (puede venir vacío).
- Proveedor: "Proveedor" (empresa o persona que vende la fruta, ej. "INVERSIONES AGROPALNORT S.A.S."). No confundir con la extractora ni con el conductor.
- Fecha: "Fecha de entrada", "Fecha entrada", "Fecha y hora: Entrada", "Fecha". Incluye la hora si aparece.
- Báscula: solo si está impresa.

La foto puede venir girada, con firmas o sellos encima, reflejos u otros papeles debajo: lee solo el tiquete.
Si un campo no se ve, devuélvelo como null. Críticos: número de tiquete y pesos (definen el valor). Márcalos en "campos_dudosos" si algún dígito no es 100 % nítido (borroso, tapado, cortado por un doblez, o 6/8/9, 1/7, 0/8, 3/8, 5/6 que no se distinguen). Texto pequeño o girado no es duda si cada dígito se distingue. Los demás campos son informativos: léelos lo mejor posible sin marcarlos. Da siempre tu mejor lectura; nunca inventes valores; explica los problemas en "observaciones".
Si la imagen no es un tiquete de báscula, es_tiquete = false.

Extractora: primero identifica qué empresa emitió el tiquete (la que pesa la fruta, no el proveedor): copia su NIT en "nit_extractora" y su nombre en "extractora_impresa". Compáralos con las extractoras registradas (NIT, nombres impresos, logo) y devuelve en "extractora" el nombre EXACTO de la lista; el nombre de la lista puede ser distinto al impreso (ej. una extractora registrada como "NodoLa4" imprime "Sociedad Agrovaspalma S.A.S."). Luego lee los campos siguiendo el formato de esa extractora que más se parezca al tiquete (puede tener varios). Si no es ninguna de la lista, "extractora" = null y lee con las reglas generales.`;

export class LectorIA implements LectorTiquete {
  private cliente = new Anthropic();

  async leer(imagen: { base64: string; tipo: "image/webp" | "image/jpeg" }, extractoras: ExtractoraParaLeer[], usuarioId?: string) {
    const lista = JSON.stringify(extractoras);

    const respuesta = await this.cliente.messages.parse({
      model: MODELO,
      max_tokens: 4000,
      output_config: { effort: "medium", format: zodOutputFormat(LecturaCruda) },
      system: INSTRUCCIONES,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: imagen.tipo, data: imagen.base64 } },
            { type: "text", text: `Extractoras registradas:\n${lista}\n\nIdentifica la extractora y extrae los campos del tiquete.` },
          ],
        },
      ],
    });
    // Solo guarda los tokens que la IA ya informó: no hace llamadas adicionales.
    await registrarConsumo("lectura", MODELO, respuesta.usage, usuarioId);

    if (respuesta.stop_reason === "refusal") throw new Error("El lector rechazó la imagen");
    if (respuesta.stop_reason === "max_tokens" || !respuesta.parsed_output) throw new Error("Lectura incompleta");
    return respuesta.parsed_output;
  }
}

export function lectorConfigurado(): LectorTiquete {
  // Fase 2: LECTOR_TIQUETES=ocr usará Tesseract.js con plantillas por extractora.
  return new LectorIA();
}
