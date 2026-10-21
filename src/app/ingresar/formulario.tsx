"use client";
import { useActionState } from "react";
import Link from "next/link";
import { iniciarSesion } from "./acciones";
import { Mensaje } from "@/components/ui";

export function FormularioIngreso({ volver }: { volver: string }) {
  const [estado, accion, cargando] = useActionState(iniciarSesion, undefined);
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="volver" value={volver} />
      <div>
        <label className="etiqueta" htmlFor="usuario">Usuario</label>
        <input className="campo" id="usuario" name="usuario" autoComplete="username" autoCapitalize="none" required />
      </div>
      <div>
        <label className="etiqueta" htmlFor="clave">Contraseña</label>
        <input className="campo" id="clave" name="clave" type="password" autoComplete="current-password" required />
      </div>
      {estado?.error && <Mensaje tono="error">{estado.error}</Mensaje>}
      <button className="boton-primario w-full" disabled={cargando}>{cargando ? "Ingresando…" : "Ingresar"}</button>
      <Link href="/ingresar/olvide" className="block text-center text-sm font-semibold text-primario">Olvidé mi contraseña</Link>
    </form>
  );
}
