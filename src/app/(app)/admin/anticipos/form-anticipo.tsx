"use client";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { Resultado } from "../acciones";
import { FormAccion } from "@/components/form-accion";
import { formatoPesos, montoDesdeTexto } from "@/lib/numeros";

/**
 * Formulario de registrar anticipo con aviso Sí / No antes de enviar (decisión del usuario):
 * recuerda el monto, el comprador y si es positivo (queda a mi favor) o negativo (le debo).
 */
export function FormAnticipo({ accion, compradores, children }: {
  accion: (form: FormData) => Promise<Resultado>;
  compradores: { id: string; nombre: string }[];
  children: ReactNode;
}) {
  return (
    <FormAccion accion={accion} boton="Registrar y avisar" limpiar
      confirmarCon={(datos) => {
        const monto = montoDesdeTexto(String(datos.get("monto") ?? ""), { negativo: true });
        const comprador = compradores.find((c) => c.id === datos.get("comprador"))?.nombre;
        if (!monto || !comprador) return null; // el servidor explica qué falta
        const soporte = datos.get("soporte");
        const conSoporte = soporte instanceof File && soporte.size > 0;
        const negativo = monto < 0;
        return (
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2 font-semibold text-profundo">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-alerta" aria-hidden />
              <span>
                Está a punto de registrar {negativo ? "un valor NEGATIVO" : "un anticipo POSITIVO"} de{" "}
                <span className={negativo ? "text-error" : "text-ok"}>{negativo ? "−" : ""}{formatoPesos(Math.abs(monto))}</span>{" "}
                al comprador <strong>{comprador}</strong>.
              </span>
            </p>
            <p>
              {negativo
                ? <>Recuerde: un valor <strong>negativo</strong> es <strong>saldo a favor del comprador</strong>: dinero que usted le debe. En su cuenta suma a <strong>«Le debo»</strong>.</>
                : <>Recuerde: un valor <strong>positivo</strong> es dinero que usted le entrega al comprador. En su cuenta suma a <strong>«Saldo a mi favor»</strong> hasta que él lo cubra con fruta.</>}
            </p>
            <p className="text-suave">{conSoporte ? "Va con soporte (foto)." : "Va sin soporte (puede subirlo después desde la tarjeta)."} El comprador debe confirmarlo en su app.</p>
            <p className="font-semibold">¿Está seguro de enviarlo?</p>
          </div>
        );
      }}>
      {children}
    </FormAccion>
  );
}
