import { AlertTriangle } from "lucide-react";
import { Chip } from "@/components/ui";
import { NOMBRE_ESTADO, type EstadoCobro } from "@/lib/facturas/tipos";

const TONO: Record<EstadoCobro, "ok" | "alerta" | "error" | "neutro" | "primario"> = {
  PENDIENTE_PAGO: "primario", ABONADA_PARCIAL: "alerta", PAGADA: "ok", ANULADA: "error",
};

/**
 * Chips de una factura: Aprobada o Anulada (los dos estados, decisión del usuario), el estado de
 * cobro, vencida y alertas.
 */
export function ChipsFactura({ f }: { f: { estado_cobro: EstadoCobro; vencida: boolean; dias_mora: number; alerta_sobrepago: boolean; alerta_retenciones: boolean } }) {
  if (f.estado_cobro === "ANULADA") return <div className="flex flex-wrap items-center gap-1.5"><Chip tono="error">Anulada · no suma</Chip></div>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip tono="ok">Aprobada</Chip>
      <Chip tono={TONO[f.estado_cobro]}>{NOMBRE_ESTADO[f.estado_cobro]}</Chip>
      {f.vencida && <Chip tono="error">Vencida · {f.dias_mora} día{f.dias_mora === 1 ? "" : "s"} de mora</Chip>}
      {f.alerta_sobrepago && <Chip tono="alerta"><AlertTriangle className="inline size-3.5" aria-hidden /> Sobrepago</Chip>}
      {f.alerta_retenciones && <Chip tono="alerta"><AlertTriangle className="inline size-3.5" aria-hidden /> Retenciones no coinciden</Chip>}
    </div>
  );
}
