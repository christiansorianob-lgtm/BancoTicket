"use client";
import { useRef, useState, useTransition } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { eliminarTiquete, type Resultado } from "../acciones";
import { ResultadoAccion } from "@/components/form-accion";
import { Mensaje } from "@/components/ui";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import type { FilaReporte } from "@/lib/informes/consulta";

/**
 * Ícono para eliminar un tiquete aprobado desde Reportes. Pide motivo y luego una confirmación
 * Sí / No dentro de la misma ventana. Al eliminar, el saldo del comprador se ajusta solo, se
 * borra la foto y el registro queda en el historial.
 */
export function EliminarFila({ t }: { t: FilaReporte }) {
  const ventana = useRef<HTMLDialogElement>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, iniciar] = useTransition();

  function abrir() {
    setMotivo(""); setConfirmando(false); setResultado(null);
    ventana.current?.showModal();
  }

  function eliminar() {
    const datos = new FormData();
    datos.set("motivo", motivo);
    iniciar(async () => {
      const r = await eliminarTiquete(t.id, datos);
      setResultado(r);
      setConfirmando(false);
    });
  }

  return (
    <>
      <button type="button" onClick={abrir} title={`Eliminar el tiquete ${t.numero}`}
        className="inline-flex size-9 items-center justify-center rounded-lg text-error hover:bg-error-suave">
        <Trash2 className="size-5" aria-label={`Eliminar el tiquete ${t.numero}`} />
      </button>
      {/* whitespace-normal: la ventana vive dentro de una celda «nowrap» de la tabla. */}
      <dialog ref={ventana} className="m-auto w-[min(32rem,calc(100vw-2rem))] whitespace-normal break-words rounded-2xl bg-white p-0 text-left text-texto shadow-2xl backdrop:bg-profundo/50">
        <div className="flex items-center justify-between gap-2 border-b border-borde p-4">
          <h2 className="min-w-0 font-bold text-error">Eliminar {t.extractora} · N° {t.numero}</h2>
          <button type="button" onClick={() => ventana.current?.close()} className="shrink-0 rounded-lg p-2 hover:bg-primario-suave" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          {resultado?.ok ? (
            <>
              <ResultadoAccion resultado={resultado} />
              <button type="button" className="boton-secundario w-full" onClick={() => ventana.current?.close()}>Cerrar</button>
            </>
          ) : (
            <>
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
              <label className="block"><span className="etiqueta">Motivo (obligatorio)</span>
                <input className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={confirmando || cargando}
                  placeholder="Ej.: tiquete duplicado en otra extractora" />
              </label>

              {!confirmando ? (
                <button type="button" className="boton-peligro w-full" disabled={!motivo.trim() || cargando} onClick={() => setConfirmando(true)}>
                  <Trash2 className="size-5" /> Eliminar tiquete
                </button>
              ) : (
                // Confirmación Sí / No (decisión del usuario), dentro de la misma ventana.
                <div className="space-y-3 rounded-xl border-2 border-error bg-error-suave p-3" role="alertdialog" aria-label="Confirmar eliminación">
                  <p className="flex items-start gap-2 text-sm font-semibold text-error">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                    Está a punto de eliminar el tiquete N° {t.numero}. Esta acción no se puede deshacer. ¿Desea continuar?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className="boton-peligro" disabled={cargando} onClick={eliminar}>{cargando ? "Eliminando…" : "Sí, eliminar"}</button>
                    <button type="button" className="boton-secundario" disabled={cargando} onClick={() => setConfirmando(false)}>No</button>
                  </div>
                </div>
              )}
              <ResultadoAccion resultado={resultado} />
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
