"use client";
import { useRef } from "react";
import { Pencil, X } from "lucide-react";
import { editarTiquete } from "../acciones";
import { FormAccion } from "@/components/form-accion";
import { CamposTiquete } from "@/components/campos-tiquete";
import type { FilaReporte } from "@/lib/informes/consulta";

/**
 * Ícono para corregir un tiquete aprobado desde Reportes (ej. un proveedor mal leído). Abre el
 * mismo formulario de «Tiquetes y precios» en una ventana sobre la tabla; al guardar, la tabla
 * se actualiza y el cambio queda en el historial con su motivo.
 */
export function EditarFila({ t, foto, extractoras, compradores }: {
  t: FilaReporte; foto?: string; extractoras: { id: string; nombre: string }[]; compradores: { id: string; nombre: string }[];
}) {
  const ventana = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ventana.current?.showModal()} title={`Editar el tiquete ${t.numero}`}
        className="inline-flex size-9 items-center justify-center rounded-lg text-primario hover:bg-primario-suave">
        <Pencil className="size-5" aria-label={`Editar el tiquete ${t.numero}`} />
      </button>
      {/* whitespace-normal: la ventana vive dentro de una celda «nowrap» de la tabla. */}
      <dialog ref={ventana} className="m-auto w-[min(56rem,calc(100vw-2rem))] whitespace-normal break-words rounded-2xl bg-white p-0 text-left text-texto shadow-2xl backdrop:bg-profundo/50">
        <div className="flex items-center justify-between gap-2 border-b border-borde p-4">
          <h2 className="font-bold text-profundo">Editar {t.extractora} · N° {t.numero}</h2>
          <button type="button" onClick={() => ventana.current?.close()} className="rounded-lg p-2 hover:bg-primario-suave" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="grid max-h-[80dvh] gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {foto ? (
            <a href={foto} target="_blank" rel="noopener noreferrer">
              <img src={foto} alt={`Tiquete ${t.numero}`} className="w-full rounded-xl border border-borde object-contain" />
            </a>
          ) : <p className="text-sm text-suave">Sin foto</p>}
          <FormAccion accion={editarTiquete.bind(null, t.id)} boton="Guardar cambios">
            <CamposTiquete t={t} extractoras={extractoras} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="etiqueta">Comprador</span>
                <select name="comprador_id" className="campo" defaultValue={t.comprador_id}>
                  {compradores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label><span className="etiqueta">Precio por tonelada (vacío = sin precio)</span>
                <input name="precio_tonelada" inputMode="decimal" className="campo" defaultValue={t.precio_tonelada ?? ""} />
              </label>
              <label><span className="etiqueta">Estado</span>
                <select name="estado" className="campo" defaultValue={t.estado}>
                  <option value="vigente">Vigente</option>
                  <option value="anulado">Anulado (no cuenta en el saldo)</option>
                </select>
              </label>
            </div>
          </FormAccion>
        </div>
      </dialog>
    </>
  );
}
