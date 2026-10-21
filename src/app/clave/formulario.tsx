"use client";
import { useActionState } from "react";
import { cambiarClave } from "./acciones";
import { Mensaje } from "@/components/ui";

export function FormularioClave({ obligatorio }: { obligatorio: boolean }) {
  const [estado, accion, cargando] = useActionState(cambiarClave, undefined);
  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="etiqueta" htmlFor="actual">{obligatorio ? "Contraseña actual (12345678)" : "Contraseña actual"}</label>
        <input className="campo" id="actual" name="actual" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <label className="etiqueta" htmlFor="nueva">Contraseña nueva (mínimo 8 caracteres)</label>
        <input className="campo" id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <div>
        <label className="etiqueta" htmlFor="repetir">Repita la contraseña nueva</label>
        <input className="campo" id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}
      {estado?.mensaje && <Mensaje tono="ok">{estado.mensaje}</Mensaje>}
      <button className="boton-primario w-full" disabled={cargando}>{cargando ? "Guardando…" : "Cambiar contraseña"}</button>
    </form>
  );
}
