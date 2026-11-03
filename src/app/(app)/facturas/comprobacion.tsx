import { CheckCircle2, Calculator, XCircle } from "lucide-react";
import { Chip } from "@/components/ui";
import { comprobarFactura, pesos, porcentaje, type TarifasFactura } from "@/lib/facturas/comprobacion";
import type { FacturaLeida } from "@/lib/facturas/tipos";

/**
 * «Comprobación de cálculos» (decisión del usuario): cada cuenta de la factura rehecha por la app,
 * paso a paso, con el resultado frente a lo facturado. Sin IA. Sirve en el navegador y el servidor.
 */
export function ComprobacionFactura({ datos, tarifas }: { datos: FacturaLeida; tarifas: TarifasFactura }) {
  const calculos = comprobarFactura(datos, tarifas);
  const fallan = calculos.filter((c) => !c.ok).length;
  const total = calculos[calculos.length - 1];
  const rf = datos.retefuente ?? 0, ri = datos.reteiva ?? 0, rc = datos.reteica ?? 0;

  return (
    <section className={`space-y-3 rounded-xl border-2 p-3 ${fallan ? "border-error/40" : "border-ok/40"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-profundo"><Calculator className="size-5" aria-hidden /> Comprobación de cálculos</h3>
        <Chip tono={fallan ? "error" : "ok"}>{fallan ? `${fallan} no coincide${fallan === 1 ? "" : "n"}` : "Todo coincide"}</Chip>
      </div>
      <p className="text-xs text-suave">
        La app rehízo cada cuenta con los porcentajes vigentes: IVA {porcentaje(tarifas.iva)} y ReteFuente {porcentaje(tarifas.retefuente)} del subtotal,
        ReteIVA {porcentaje(tarifas.reteiva)} del IVA y ReteICA {porcentaje(tarifas.reteica)}. Una retención en $ 0 es que no se aplicó en esa factura.
        Se acepta hasta $ 1 de diferencia por redondeo.
      </p>

      <ol className="space-y-2">
        {calculos.slice(0, -1).map((c) => (
          <li key={c.nombre} className={`rounded-lg p-2 ${c.ok ? "bg-ok-suave" : "bg-error-suave"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className={`flex items-center gap-1.5 font-semibold ${c.ok ? "text-ok" : "text-error"}`}>
                {c.ok ? <CheckCircle2 className="size-4 shrink-0" aria-hidden /> : <XCircle className="size-4 shrink-0" aria-hidden />} {c.nombre}
              </p>
              <span className={`text-right text-xs font-bold ${c.ok ? "text-ok" : "text-error"}`}>
                {c.diferencia == null ? "Sin dato" : c.ok ? "Coincide" : `Diferencia ${pesos(Math.abs(c.diferencia))}`}
              </span>
            </div>
            <p className="mt-1 break-words text-sm tabular-nums">{c.cuenta} = <b>{c.calculado == null ? "—" : pesos(c.calculado)}</b></p>
            <p className="text-xs tabular-nums text-suave">En la factura: {c.facturado == null ? "—" : pesos(c.facturado)}{c.nota ? ` · ${c.nota}` : ""}</p>
          </li>
        ))}
      </ol>

      {/* El total como en un recibo: cada valor con su signo y la suma al final. */}
      <div className={`rounded-lg p-2 ${total.ok ? "bg-ok-suave" : "bg-error-suave"}`}>
        <div className="flex items-start justify-between gap-2">
          <p className={`flex items-center gap-1.5 font-semibold ${total.ok ? "text-ok" : "text-error"}`}>
            {total.ok ? <CheckCircle2 className="size-4 shrink-0" aria-hidden /> : <XCircle className="size-4 shrink-0" aria-hidden />} Total a pagar
          </p>
          <span className={`text-right text-xs font-bold ${total.ok ? "text-ok" : "text-error"}`}>
            {total.diferencia == null ? "Sin dato" : total.ok ? "Coincide" : `Diferencia ${pesos(Math.abs(total.diferencia))}`}
          </span>
        </div>
        <dl className="mt-1 text-sm tabular-nums">
          {([["", "Subtotal", datos.subtotal], ["+", "IVA", datos.iva], ["−", "ReteFuente", rf], ["−", "ReteIVA", ri], ["−", "ReteICA", rc]] as const).map(([signo, nombre, v]) => (
            <div key={nombre} className="flex justify-between gap-2"><dt><span className="inline-block w-4 font-bold">{signo}</span>{nombre}</dt><dd>{v == null ? "—" : pesos(v)}</dd></div>
          ))}
          <div className="mt-1 flex justify-between gap-2 border-t border-borde pt-1 font-bold"><dt><span className="inline-block w-4">=</span>Total calculado</dt><dd>{total.calculado == null ? "—" : pesos(total.calculado)}</dd></div>
          <div className="flex justify-between gap-2 text-suave"><dt><span className="inline-block w-4" />En la factura</dt><dd>{total.facturado == null ? "—" : pesos(total.facturado)}</dd></div>
        </dl>
        {total.nota && <p className="text-xs text-suave">{total.nota}</p>}
      </div>
    </section>
  );
}
