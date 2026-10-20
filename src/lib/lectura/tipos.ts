import { z } from "zod";

/** Campos estándar tal como los devuelve el lector (texto crudo del tiquete). */
export const LecturaCruda = z.object({
  es_tiquete: z.boolean().describe("true si la imagen es un tiquete de báscula legible"),
  numero_tiquete: z.string().nullable().describe("Número del tiquete, solo dígitos/letras, sin rótulo"),
  fecha_entrada: z.string().nullable().describe("Fecha y hora de entrada tal como aparece impresa"),
  peso_bruto_kg: z.string().nullable().describe("Peso bruto/entrada tal como aparece impreso, en kilos"),
  tara_kg: z.string().nullable().describe("Tara/peso salida tal como aparece impreso, en kilos"),
  peso_neto_impreso_kg: z.string().nullable().describe("Peso neto impreso, si existe"),
  placa: z.string().nullable(),
  conductor: z.string().nullable(),
  proveedor: z.string().nullable().describe("Proveedor impreso (quien vende la fruta), tal como aparece"),
  bascula: z.string().nullable(),
  observaciones: z.string().nullable().describe("Problemas de lectura: borroso, tapado por sello, girado, etc."),
  extractora_impresa: z.string().nullable().describe("Nombre de la extractora (empresa que pesa) según el logo o el encabezado del tiquete"),
  coincide_extractora: z.boolean().describe("true si el tiquete es de la extractora elegida por el comprador (abreviaturas, tildes y sufijos S.A.S. cuentan como coincidencia)"),
  extractora_sugerida: z.string().nullable().describe("Si no coincide: el nombre EXACTO, tal como aparece en la lista de extractoras registradas, de la que corresponde al tiquete; null si ninguna"),
  campos_dudosos: z
    .array(z.enum(["numero_tiquete", "fecha_entrada", "peso_bruto_kg", "tara_kg", "peso_neto_impreso_kg", "placa"]))
    .describe("Campos que no se leyeron con total certeza (cualquier carácter dudoso). Vacío solo si todo es 100 % seguro."),
});
export type LecturaCruda = z.infer<typeof LecturaCruda>;

/** Datos normalizados que se muestran al comprador y se guardan. */
export type DatosTiquete = {
  numero: string;
  fecha_entrada: string; // ISO con zona de Colombia
  peso_bruto_kg: number;
  tara_kg: number;
  neto_impreso_kg: number | null;
  placa: string | null;
  conductor: string | null;
  proveedor: string | null;
  bascula: string | null;
};

/** dudoso: el dato pasó pero el administrador debe verificarlo. */
export type Control = { nombre: string; ok: boolean; mensaje: string; dudoso?: boolean };

export type ResultadoLectura =
  | { ok: true; datos: DatosTiquete; controles: Control[]; cruda: LecturaCruda; dudosos: string[] }
  | { ok: false; motivo: string; controles: Control[]; cruda: LecturaCruda | null };

export type PlantillaExtractora = {
  rotulo_numero?: string;
  sinonimos?: Record<string, string[]>;
  formato_fecha?: string;
  notas?: string;
};

/** Proveedor de lectura intercambiable (IA por API u OCR gratuito). */
export interface LectorTiquete {
  leer(
    imagen: { base64: string; tipo: "image/webp" | "image/jpeg" },
    extractora: { nombre: string; plantilla: PlantillaExtractora },
    registradas: string[],
  ): Promise<LecturaCruda>;
}
