import { fechaHora } from "@/lib/fechas";
import { formatoToneladas, netoKg } from "@/lib/numeros";

export type DetalleTiquete = {
  extractora?: string | null;
  numero: string;
  fecha_entrada?: string | null;
  proveedor?: string | null;
  peso_bruto_kg: number;
  tara_kg: number;
  neto_impreso_kg?: number | null;
  placa?: string | null;
  conductor?: string | null;
};

/** Detalle del tiquete para los mensajes de WhatsApp, correo y avisos (una línea por dato). */
export function detalleTiquete(t: DetalleTiquete): string {
  const neto = netoKg(t);
  return [
    t.extractora && `Extractora: ${t.extractora}`,
    `Tiquete N°: ${t.numero}`,
    t.fecha_entrada && `Fecha: ${fechaHora(t.fecha_entrada)}`,
    t.proveedor && `Proveedor: ${t.proveedor}`,
    `Peso neto: ${formatoToneladas(neto / 1000)} (${neto.toLocaleString("es-CO")} kg)`,
    t.placa && `Placa: ${t.placa}`,
    t.conductor && `Conductor: ${t.conductor}`,
  ]
    .filter(Boolean)
    .join("\n");
}
