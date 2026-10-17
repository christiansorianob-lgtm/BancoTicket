import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { LecturaCruda, type LectorTiquete } from "./tipos";

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
- Fecha: "Fecha de entrada", "Fecha entrada", "Fecha y hora: Entrada", "Fecha". Incluye la hora si aparece.
- Báscula: solo si está impresa.

La foto puede venir girada, con firmas o sellos encima, reflejos u otros papeles debajo: lee solo el tiquete.
Si un campo no se ve, devuélvelo como null. Si se ve pero algún carácter es dudoso (borroso, tapado, 6/8/9, 1/7, 0/8, 5/6), da tu mejor lectura y agrega ese campo a "campos_dudosos". "campos_dudosos" solo puede quedar vacío si estás 100 % seguro de cada carácter. Nunca inventes valores; explica los problemas en "observaciones".
Si la imagen no es un tiquete de báscula, es_tiquete = false.`;

export class LectorIA implements LectorTiquete {
  private cliente = new Anthropic();

  async leer(imagen: { base64: string; tipo: "image/webp" | "image/jpeg" }, extractora: { nombre: string; plantilla: object }) {
    const pista = Object.keys(extractora.plantilla).length
      ? `Plantilla conocida de esta extractora: ${JSON.stringify(extractora.plantilla)}`
      : "No hay plantilla guardada para esta extractora.";

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
            { type: "text", text: `Extractora elegida por el comprador: ${extractora.nombre}.\n${pista}\nExtrae los campos del tiquete.` },
          ],
        },
      ],
    });

    if (respuesta.stop_reason === "refusal") throw new Error("El lector rechazó la imagen");
    if (respuesta.stop_reason === "max_tokens" || !respuesta.parsed_output) throw new Error("Lectura incompleta");
    return respuesta.parsed_output;
  }
}

export function lectorConfigurado(): LectorTiquete {
  // Fase 2: LECTOR_TIQUETES=ocr usará Tesseract.js con plantillas por extractora.
  return new LectorIA();
}
