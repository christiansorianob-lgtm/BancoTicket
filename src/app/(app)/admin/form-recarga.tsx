"use client";
import { useState } from "react";
import { FormAccion } from "@/components/form-accion";
import { montoDesdeTexto } from "@/lib/numeros";
import { formatearMonto } from "@/lib/monto";
import { hoyColombia } from "@/lib/fechas";
import { registrarRecarga } from "./recargas-ia";

const usd = (n: number) => `US$ ${n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** «Registrar recarga»: el saldo que se cargó en Claude Console. Aviso Sí / No antes de guardar. */
export function FormRecarga() {
  const [monto, setMonto] = useState("");
  const valor = montoDesdeTexto(monto.replace(/,$/, "")) ?? 0;
  return (
    <FormAccion accion={registrarRecarga} boton="Registrar recarga" limpiar textoSi="Sí, registrar"
      confirmarCon={() => (valor > 0 ? <p className="text-sm font-semibold text-profundo">¿Registrar una recarga de {usd(valor)} en Claude Console? No se puede editar después.</p> : null)}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="etiqueta">Monto recargado (US$)</span>
          <input name="monto" inputMode="decimal" required value={monto} placeholder="Ej.: 10 o 25,50" className="campo font-bold tabular-nums"
            onChange={(e) => setMonto(formatearMonto(e.target.value.replace(/-/g, "")))} />
          {valor > 0 && <span className="mt-1 block text-xs font-semibold text-ok">{usd(valor)}</span>}
        </label>
        <label><span className="etiqueta">Fecha</span><input name="fecha" type="date" required defaultValue={hoyColombia()} className="campo" /></label>
        <label><span className="etiqueta">Nota (opcional)</span><input name="nota" className="campo" placeholder="Ej.: recarga con tarjeta" /></label>
      </div>
    </FormAccion>
  );
}
