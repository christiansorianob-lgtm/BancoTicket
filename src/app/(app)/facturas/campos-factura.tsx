"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { completarPrecio, validarFactura, type Validacion } from "@/lib/facturas/validar";
import { facturaDesde, numeroEnCampo } from "@/lib/facturas/formulario";
import type { FacturaLeida } from "@/lib/facturas/tipos";

const ETIQUETAS: [keyof FacturaLeida, string, "texto" | "fecha" | "numero"][] = [
  ["numero_factura", "N° de factura", "texto"], ["cufe", "CUFE", "texto"],
  ["emisor_razon_social", "Emisor (razón social)", "texto"], ["emisor_nit", "NIT del emisor", "texto"],
  ["extractora_razon_social", "Extractora (razón social)", "texto"], ["extractora_nit", "NIT de la extractora", "texto"],
  ["fecha_emision", "Fecha de emisión", "fecha"], ["fecha_vencimiento", "Fecha de vencimiento", "fecha"],
  ["periodo_desde", "Periodo desde", "fecha"], ["periodo_hasta", "Periodo hasta", "fecha"],
  ["kilos", "Kilos", "numero"], ["precio_kilo", "Precio por kilo", "numero"],
  ["subtotal", "Subtotal", "numero"], ["iva", "IVA", "numero"],
  ["total_retenciones_esperadas", "Retenciones esperadas", "numero"], ["total_a_pagar", "Total a pagar", "numero"],
];

/**
 * Campos editables de la factura con las validaciones en vivo (las mismas que aplica el servidor al
 * guardar). Un campo vacío es «no se leyó»: queda resaltado.
 */
export function CamposFactura({ inicial }: { inicial: FacturaLeida }) {
  const caja = useRef<HTMLDivElement>(null);
  const [validaciones, setValidaciones] = useState<Validacion[]>(() => validarFactura(completarPrecio(inicial)));

  useEffect(() => {
    const form = caja.current?.closest("form");
    if (!form) return;
    const revisar = () => setValidaciones(validarFactura(completarPrecio(facturaDesde((k) => new FormData(form).get(k) as string | null))));
    form.addEventListener("input", revisar);
    return () => form.removeEventListener("input", revisar);
  }, []);

  return (
    <div ref={caja} className="space-y-3">
      <ul className="space-y-1 rounded-xl border border-borde p-3 text-sm">
        {validaciones.map((v) => (
          <li key={v.nombre} className={`flex items-start gap-1.5 ${v.ok ? "text-ok" : "font-semibold text-error"}`}>
            {v.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />} {v.nombre}: {v.mensaje}
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        {ETIQUETAS.map(([k, etiqueta, tipo]) => {
          const valor = inicial[k];
          const vacio = valor == null || valor === "";
          return (
            <label key={k} className={k === "cufe" ? "sm:col-span-2" : ""}>
              <span className={`etiqueta ${vacio ? "text-alerta" : ""}`}>{etiqueta}{vacio ? " · no se leyó" : ""}</span>
              <input name={k} type={tipo === "fecha" ? "date" : "text"} inputMode={tipo === "numero" ? "decimal" : undefined}
                defaultValue={tipo === "numero" ? numeroEnCampo(valor as number | null) : (valor as string | null) ?? ""}
                className={`campo ${vacio ? "border-alerta bg-alerta-suave" : ""} ${tipo === "numero" ? "tabular-nums" : ""} ${k === "cufe" ? "text-xs" : ""}`} />
            </label>
          );
        })}
      </div>
      <p className="text-xs text-suave">Números en formato colombiano: punto de miles y coma decimal (ej. 142.060.536,75). Si todo cuadra queda CONFIRMADA; si no, queda PENDIENTE DE REVISIÓN.</p>
    </div>
  );
}
