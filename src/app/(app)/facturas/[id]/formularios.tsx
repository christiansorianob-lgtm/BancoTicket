"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Resultado } from "@/app/(app)/admin/acciones";
import { FormAccion } from "@/components/form-accion";
import { montoDesdeTexto } from "@/lib/numeros";
import { textoMonto } from "@/lib/monto";
import { hoyColombia } from "@/lib/fechas";
import { CamposFactura } from "../campos-factura";
import type { FacturaLeida } from "@/lib/facturas/tipos";

/** Anular (o revertir) con motivo obligatorio y confirmación Sí / No. */
export function ConMotivo({ accion, boton, pregunta, placeholder }: {
  accion: (form: FormData) => Promise<Resultado>; boton: string; pregunta: string; placeholder: string;
}) {
  return (
    <FormAccion accion={accion} boton={boton} tonoBoton="peligro" textoSi="Sí, continuar"
      confirmarCon={(d) => String(d.get("motivo") ?? "").trim()
        ? <p className="flex items-start gap-2 text-sm font-semibold text-error"><AlertTriangle className="mt-0.5 size-5 shrink-0" />{pregunta} ¿Desea continuar?</p>
        : null}>
      <label className="block"><span className="etiqueta">Motivo (obligatorio)</span><input name="motivo" required className="campo" placeholder={placeholder} /></label>
    </FormAccion>
  );
}

/** Corregir los datos de la factura (las validaciones se ven en vivo). */
export function CorregirFactura({ accion, inicial }: { accion: (form: FormData) => Promise<Resultado>; inicial: FacturaLeida }) {
  return (
    <FormAccion accion={accion} boton="Guardar corrección">
      <CamposFactura inicial={inicial} />
    </FormAccion>
  );
}

/** Registrar un abono: valor recibido en banco + retenciones = valor aplicado (se ve en vivo). */
export function FormAbono({ accion, saldo }: { accion: (form: FormData) => Promise<Resultado>; saldo: number }) {
  const [aplicado, setAplicado] = useState(0);
  const [certificado, setCertificado] = useState(false);
  return (
    <FormAccion accion={accion} boton="Registrar abono" limpiar
      confirmarCon={(d) => {
        const n = (k: string) => montoDesdeTexto(String(d.get(k) ?? "")) ?? 0;
        const total = n("valor_recibido") + n("retefuente") + n("reteiva") + n("reteica") + n("otros_descuentos");
        if (total <= 0) return null;
        return (
          <p className="text-sm font-semibold text-profundo">
            Se aplicarán {textoMonto(total)} a la factura (saldo actual {textoMonto(saldo)}).
            {total > saldo + 1 && <span className="block text-alerta">Supera el saldo: la factura quedará pagada con alerta de sobrepago.</span>} ¿Registrar el abono?
          </p>
        );
      }}>
      <div className="grid gap-3 sm:grid-cols-2"
        onInput={(e) => {
          const f = (e.currentTarget.closest("form") as HTMLFormElement);
          const d = new FormData(f);
          const n = (k: string) => montoDesdeTexto(String(d.get(k) ?? "")) ?? 0;
          setAplicado(n("valor_recibido") + n("retefuente") + n("reteiva") + n("reteica") + n("otros_descuentos"));
        }}>
        <label><span className="etiqueta">Fecha del pago</span><input name="fecha_pago" type="date" required defaultValue={hoyColombia()} className="campo" /></label>
        <label><span className="etiqueta">Valor recibido (neto en banco)</span><input name="valor_recibido" inputMode="decimal" required className="campo tabular-nums" placeholder="Ej.: 70.000.000" /></label>
        <label><span className="etiqueta">Retefuente</span><input name="retefuente" inputMode="decimal" className="campo tabular-nums" placeholder="0" /></label>
        <label><span className="etiqueta">ReteIVA</span><input name="reteiva" inputMode="decimal" className="campo tabular-nums" placeholder="0" /></label>
        <label><span className="etiqueta">ReteICA</span><input name="reteica" inputMode="decimal" className="campo tabular-nums" placeholder="0" /></label>
        <label><span className="etiqueta">Otros descuentos</span><input name="otros_descuentos" inputMode="decimal" className="campo tabular-nums" placeholder="0" /></label>
        <label><span className="etiqueta">Forma de pago</span><input name="forma_pago" className="campo" placeholder="Transferencia, cheque…" /></label>
        <label><span className="etiqueta">Referencia</span><input name="referencia" className="campo" /></label>
        <label className="flex items-center gap-2"><input type="checkbox" name="certificado_recibido" className="size-5" checked={certificado} onChange={(e) => setCertificado(e.target.checked)} /> Certificado de retención recibido</label>
        {certificado && <label><span className="etiqueta">Fecha del certificado</span><input name="fecha_certificado" type="date" className="campo" /></label>}
        <label className="sm:col-span-2"><span className="etiqueta">Observaciones</span><input name="observaciones" className="campo" /></label>
      </div>
      <p className="rounded-lg bg-primario-suave px-3 py-2 text-sm font-semibold text-profundo">
        Valor aplicado (recibido + retenciones + descuentos): {textoMonto(aplicado)}
      </p>
    </FormAccion>
  );
}
