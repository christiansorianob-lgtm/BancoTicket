"use client";
import { useState, useTransition } from "react";
import type { Resultado } from "../acciones";
import { ResultadoAccion } from "@/components/form-accion";

/** Genera un enlace nuevo (el anterior deja de servir) y ofrece enviarlo por WhatsApp. */
export function BotonReenviar({ accion }: { accion: () => Promise<Resultado> }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, iniciar] = useTransition();
  return (
    <div className="space-y-2">
      <button className="boton-secundario min-h-9 text-sm" disabled={cargando} onClick={() => iniciar(async () => setResultado(await accion()))}>
        {cargando ? "Generando…" : "Generar enlace y enviar"}
      </button>
      <ResultadoAccion resultado={resultado} />
    </div>
  );
}
