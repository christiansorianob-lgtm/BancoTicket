"use client";
import { AlertTriangle } from "lucide-react";
import type { Resultado } from "@/app/(app)/admin/acciones";
import { FormAccion } from "@/components/form-accion";
import { CamposFactura, type ClienteRegistrado } from "../campos-factura";
import type { FacturaLeida } from "@/lib/facturas/tipos";
import type { TarifasFactura } from "@/lib/facturas/comprobacion";

/** Anular o eliminar con motivo obligatorio y confirmación Sí / No. */
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
export function CorregirFactura({ accion, inicial, tarifas, clientes }: { accion: (form: FormData) => Promise<Resultado>; inicial: FacturaLeida; tarifas: TarifasFactura; clientes: ClienteRegistrado[] }) {
  return (
    <FormAccion accion={accion} boton="Guardar corrección">
      <CamposFactura inicial={inicial} tarifas={tarifas} clientes={clientes} />
    </FormAccion>
  );
}
