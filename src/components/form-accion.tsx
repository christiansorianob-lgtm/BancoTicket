"use client";
import { useRef, useState, useTransition, type ReactNode } from "react";
import type { Resultado } from "@/app/(app)/admin/acciones";
import { Mensaje } from "@/components/ui";
import { AvisoContacto } from "@/components/contacto";

/**
 * Formulario que llama una acción de servidor y muestra el resultado (y el botón de WhatsApp si aplica).
 * `confirmarCon`: arma con los datos del formulario un aviso que se confirma con Sí / No antes de enviar
 * (si devuelve null, se envía sin preguntar).
 */
export function FormAccion({
  accion, boton, children, className = "", limpiar = false, confirmar, confirmarCon, tonoBoton = "primario",
}: {
  accion: (form: FormData) => Promise<Resultado>;
  boton: string;
  children?: ReactNode;
  className?: string;
  limpiar?: boolean;
  confirmar?: string;
  confirmarCon?: (datos: FormData) => ReactNode | null;
  tonoBoton?: "primario" | "secundario" | "peligro";
}) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pendiente, setPendiente] = useState<{ datos: FormData; aviso: ReactNode } | null>(null);
  const [cargando, iniciar] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  const enviar = (datos: FormData) => iniciar(async () => {
    const r = await accion(datos);
    setResultado(r);
    setPendiente(null);
    if (r.ok && limpiar) ref.current?.reset();
  });

  return (
    <form
      ref={ref}
      className={`space-y-3 ${className}`}
      // Si cambian un dato mientras se pregunta, se cancela: el aviso ya no corresponde.
      onChange={() => pendiente && setPendiente(null)}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmar && !confirm(confirmar)) return;
        const datos = new FormData(e.currentTarget);
        const aviso = confirmarCon?.(datos);
        if (aviso) { setResultado(null); setPendiente({ datos, aviso }); return; }
        enviar(datos);
      }}
    >
      {children}
      {pendiente ? (
        // Confirmación Sí / No dentro del mismo formulario (decisión del usuario).
        <div className="space-y-3 rounded-xl border-2 border-alerta bg-alerta-suave p-3" role="alertdialog" aria-label="Confirmar envío">
          {pendiente.aviso}
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            <button type="button" className="boton-primario" disabled={cargando} onClick={() => enviar(pendiente.datos)}>{cargando ? "Guardando…" : "Sí, enviar"}</button>
            <button type="button" className="boton-secundario" disabled={cargando} onClick={() => setPendiente(null)}>No</button>
          </div>
        </div>
      ) : (
        <button className={`${{ primario: "boton-primario", secundario: "boton-secundario", peligro: "boton-peligro" }[tonoBoton]} w-full sm:w-auto`} disabled={cargando}>{cargando ? "Guardando…" : boton}</button>
      )}
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
      {resultado.aviso && <Mensaje tono="alerta">{resultado.aviso}</Mensaje>}
      {resultado.whatsapp && (
        <AvisoContacto contacto={{ celular: resultado.celular, mensaje: resultado.whatsapp }} />
      )}
    </div>
  );
}
