import { fechaHora } from "@/lib/fechas";
import { formatoToneladas } from "@/lib/numeros";

export type DetalleTiquete = {
  extractora?: string | null;
  numero: string;
  fecha_entrada?: string | null;
  proveedor?: string | null;
  peso_bruto_kg: number;
  tara_kg: number;
  placa?: string | null;
};

/** Detalle del tiquete para los mensajes de WhatsApp, correo y avisos (una línea por dato). */
export function detalleTiquete(t: DetalleTiquete): string {
  const netoKg = t.peso_bruto_kg - t.tara_kg;
  return [
    t.extractora && `Extractora: ${t.extractora}`,
    `Tiquete N°: ${t.numero}`,
    t.fecha_entrada && `Fecha: ${fechaHora(t.fecha_entrada)}`,
    t.proveedor && `Proveedor: ${t.proveedor}`,
    `Peso neto: ${formatoToneladas(netoKg / 1000)} (${netoKg.toLocaleString("es-CO")} kg)`,
    t.placa && `Placa: ${t.placa}`,
  ]
    .filter(Boolean)
    .join("\n");
}
