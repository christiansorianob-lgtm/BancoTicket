"use client";
import { useRef } from "react";
import { Trash2, X } from "lucide-react";
import { eliminarTiquete } from "../acciones";
import { FormAccion } from "@/components/form-accion";
import { Mensaje } from "@/components/ui";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import type { FilaReporte } from "@/lib/informes/consulta";

/**
 * Ícono para eliminar un tiquete aprobado desde Reportes. Pide motivo; al eliminar, el saldo del
 * comprador se ajusta solo, se borra la foto y el registro queda en el historial.
 */
export function EliminarFila({ t }: { t: FilaReporte }) {
  const ventana = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ventana.current?.showModal()} title={`Eliminar el tiquete ${t.numero}`}
        className="inline-flex size-9 items-center justify-center rounded-lg text-error hover:bg-error-suave">
        <Trash2 className="size-5" aria-label={`Eliminar el tiquete ${t.numero}`} />
      </button>
      <dialog ref={ventana} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-left text-texto shadow-2xl backdrop:bg-profundo/50">
        <div className="flex items-center justify-between gap-2 border-b border-borde p-4">
          <h2 className="font-bold text-error">Eliminar {t.extractora} · N° {t.numero}</h2>
          <button type="button" onClick={() => ventana.current?.close()} className="rounded-lg p-2 hover:bg-primario-suave" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm">
            <strong>{t.comprador}</strong> · {formatoToneladas(t.peso_neto_t)}
            {t.valor != null ? <> · {formatoPesos(t.valor)}</> : " · sin precio"}
          </p>
          <Mensaje tono="alerta">
            {t.valor != null
              ? `El saldo de ${t.comprador} se ajusta solo: este tiquete deja de descontar ${formatoPesos(t.valor)} de sus anticipos.`
              : "El tiquete no tiene precio, así que el saldo del comprador no cambia."}
            {" "}También se borra la foto. El registro queda en el historial con el motivo y el comprador recibe el aviso.
          </Mensaje>
          <FormAccion accion={eliminarTiquete.bind(null, t.id)} boton="Eliminar tiquete" tonoBoton="peligro"
            confirmar={`¿Eliminar definitivamente el tiquete N° ${t.numero}? No se puede deshacer.`}>
            <label><span className="etiqueta">Motivo (obligatorio)</span>
              <input name="motivo" className="campo" required placeholder="Ej.: tiquete duplicado en otra extractora" />
            </label>
          </FormAccion>
        </div>
      </dialog>
    </>
  );
}
