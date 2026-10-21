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

/** Aviso cuando bruto − tara no da el neto impreso (informativo: se cobra el neto impreso). */
export function textoAvisoResta(bruto: number, tara: number, neto: number) {
  const f = (n: number) => n.toLocaleString("es-CO");
  return `Ojo: bruto − tara = ${f(bruto - tara)} kg, pero el neto impreso es ${f(neto)} kg (diferencia de ${f(Math.abs(bruto - tara - neto))} kg). Revise el bruto y la tara en la foto. Se cobra el neto impreso.`;
}

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
