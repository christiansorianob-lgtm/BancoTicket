"use client";
import { AlertTriangle } from "lucide-react";
import type { Resultado } from "../acciones";
import { FormAccion } from "@/components/form-accion";
import { montoDesdeTexto } from "@/lib/numeros";
import { montoEnLetras, textoMonto } from "@/lib/monto";
import { CampoMonto } from "./campo-monto";

/**
 * Corregir un anticipo EN DISPUTA (decisión del usuario): monto, fecha y nota con motivo obligatorio;
 * vuelve a pendiente para que el comprador lo confirme. Confirmación Sí / No antes de enviar.
 */
export function CorregirAnticipo({ accion, monto, fecha, nota }: {
  accion: (form: FormData) => Promise<Resultado>; monto: number; fecha: string; nota: string | null;
}) {
  return (
    <details className="rounded-xl border-2 border-alerta/50 p-3">
      <summary className="cursor-pointer font-semibold text-alerta">Corregir y volver a enviar al comprador</summary>
      <div className="mt-3">
        <FormAccion accion={accion} boton="Corregir y enviar"
          confirmarCon={(d) => {
            const nuevo = montoDesdeTexto(String(d.get("monto") ?? ""), { negativo: true });
            if (!nuevo || !String(d.get("motivo") ?? "").trim()) return null;
            return (
              <div className="space-y-1 text-sm">
                <p className="flex items-start gap-2 font-semibold text-profundo">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-alerta" aria-hidden />
                  <span>El anticipo pasará de {textoMonto(monto)} a <span className={nuevo < 0 ? "text-error" : "text-ok"}>{textoMonto(nuevo)}</span> ({montoEnLetras(nuevo)}).</span>
                </p>
                <p>Vuelve a <strong>pendiente</strong>: no cuenta en el saldo hasta que el comprador lo confirme. ¿Desea continuar?</p>
              </div>
            );
          }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <CampoMonto inicial={monto} />
            <label><span className="etiqueta">Fecha</span><input name="fecha" type="date" required defaultValue={fecha} className="campo" /></label>
            <label><span className="etiqueta">Nota</span><input name="nota" defaultValue={nota ?? ""} className="campo" /></label>
            <label className="sm:col-span-2"><span className="etiqueta">Motivo de la corrección (obligatorio)</span>
              <input name="motivo" required className="campo" placeholder="Ej.: el comprador tenía razón, fueron 4.000.000" />
            </label>
          </div>
        </FormAccion>
      </div>
    </details>
  );
}
