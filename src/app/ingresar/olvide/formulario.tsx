"use client";
import { useActionState } from "react";
import { solicitarClave } from "../acciones";
import { Mensaje } from "@/components/ui";

export function FormularioOlvide() {
  const [estado, accion, cargando] = useActionState(solicitarClave, undefined);
  if (estado?.mensaje) return <Mensaje tono="ok">{estado.mensaje}</Mensaje>;
  return (
    <form action={accion} className="space-y-4">
      <div>
        <label className="etiqueta" htmlFor="usuario">Usuario</label>
        <input className="campo" id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" required />
      </div>
      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}
      <button className="boton-primario w-full" disabled={cargando}>{cargando ? "Enviando…" : "Pedir nueva contraseña"}</button>
    </form>
  );
}
