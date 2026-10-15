"use client";
import { useState } from "react";
import { editarTiquete } from "../acciones";
import { FormAccion } from "@/components/form-accion";
import { CamposTiquete } from "@/components/campos-tiquete";

type T = Parameters<typeof CamposTiquete>[0]["t"] & { id: string; precio_tonelada: number | null; comprador_id: string; estado: string };

export function EditarTiquete({ tiquete, extractoras, compradores }: { tiquete: T; extractoras: { id: string; nombre: string }[]; compradores: { id: string; nombre: string }[] }) {
  const [modo, setModo] = useState<"ninguno" | "precio" | "todo">("ninguno");
  return (
    <div className="mt-3 border-t border-borde pt-3">
      <div className="flex flex-wrap gap-2">
        <button className="boton-secundario min-h-9 text-sm" onClick={() => setModo(modo === "precio" ? "ninguno" : "precio")}>Cambiar precio</button>
        <button className="boton-secundario min-h-9 text-sm" onClick={() => setModo(modo === "todo" ? "ninguno" : "todo")}>Editar datos</button>
      </div>
      {modo === "precio" && (
        <FormAccion accion={editarTiquete.bind(null, tiquete.id)} boton="Guardar precio" className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="etiqueta">Precio por tonelada (vacío = sin precio)</span>
              <input name="precio_tonelada" inputMode="decimal" className="campo" defaultValue={tiquete.precio_tonelada ?? ""} />
            </label>
            <label><span className="etiqueta">Motivo</span><input name="motivo" className="campo" /></label>
          </div>
        </FormAccion>
      )}
      {modo === "todo" && (
        <FormAccion accion={editarTiquete.bind(null, tiquete.id)} boton="Guardar cambios" className="mt-3">
          <CamposTiquete t={tiquete} extractoras={extractoras} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="etiqueta">Comprador</span>
              <select name="comprador_id" className="campo" defaultValue={tiquete.comprador_id}>
                {compradores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label><span className="etiqueta">Estado</span>
              <select name="estado" className="campo" defaultValue={tiquete.estado}>
                <option value="vigente">Vigente</option>
                <option value="anulado">Anulado (no cuenta en el saldo)</option>
              </select>
            </label>
          </div>
        </FormAccion>
      )}
    </div>
  );
}
