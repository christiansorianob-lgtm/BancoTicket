import { Chip } from "@/components/ui";

/** Los dos estados de una factura (decisión del usuario): Aprobada o Anulada (no suma). */
export function ChipsFactura({ f }: { f: { anulada: boolean } }) {
  return f.anulada ? <Chip tono="error">Anulada · no suma</Chip> : <Chip tono="ok">Aprobada</Chip>;
}
