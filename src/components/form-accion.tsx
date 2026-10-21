"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import type { Resultado } from "@/app/(app)/admin/acciones";
import { Mensaje } from "@/components/ui";
import { AvisoContacto } from "@/components/contacto";

/** Formulario que llama una acción de servidor y muestra el resultado (y el botón de WhatsApp si aplica). */
export function FormAccion({
  accion, boton, children, className = "", limpiar = false, confirmar, tonoBoton = "primario",
}: {
  accion: (form: FormData) => Promise<Resultado>;
  boton: string;
  children?: ReactNode;
  className?: string;
  limpiar?: boolean;
  confirmar?: string;
  tonoBoton?: "primario" | "secundario" | "peligro";
}) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, iniciar] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      className={`space-y-3 ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmar && !confirm(confirmar)) return;
        const datos = new FormData(e.currentTarget);
        iniciar(async () => {
          const r = await accion(datos);
          setResultado(r);
          if (r.ok && limpiar) ref.current?.reset();
        });
      }}
    >
      {children}
      <button className={`${{ primario: "boton-primario", secundario: "boton-secundario", peligro: "boton-peligro" }[tonoBoton]} w-full sm:w-auto`} disabled={cargando}>{cargando ? "Guardando…" : boton}</button>
      <ResultadoAccion resultado={resultado} />
    </form>
  );
}

export function ResultadoAccion({ resultado }: { resultado: Resultado | null }) {
  if (!resultado) return null;
  if (!resultado.ok) return <Mensaje tono="error">{resultado.error}</Mensaje>;
  return (
    <div className="space-y-2">
      {resultado.mensaje && <Mensaje tono="ok">{resultado.mensaje}</Mensaje>}
      {resultado.whatsapp && (
        <AvisoContacto contacto={{ celular: resultado.celular, mensaje: resultado.whatsapp }} />
      )}
    </div>
  );
}
