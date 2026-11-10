import { Chip } from "@/components/ui";
import { NOMBRE_TIPO, type TipoFactura } from "@/lib/facturas/tipos";

/** Los dos estados de una factura (decisión del usuario): Aprobada o Anulada (no suma). */
export function ChipsFactura({ f }: { f: { anulada: boolean } }) {
  return f.anulada ? <Chip tono="error">Anulada · no suma</Chip> : <Chip tono="ok">Aprobada</Chip>;
}

/** Colores por tipo: verde la compra de fruta, morado la comisión, gris lo demás. */
const COLOR_TIPO: Record<TipoFactura, string> = {
  FRUTA: "bg-emerald-100 text-emerald-800", COMISION: "bg-violet-100 text-violet-800", OTRO: "bg-slate-100 text-slate-600",
};

/** Tipo de factura (decisión del usuario): Compra de fruta, Comisión u Otro. */
export function ChipTipo({ tipo }: { tipo: TipoFactura | null }) {
  if (!tipo) return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Sin clasificar</span>;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${COLOR_TIPO[tipo]}`}>{NOMBRE_TIPO[tipo]}</span>;
}

