"use client";
import { useState, useTransition } from "react";
import type { Resultado } from "../acciones";
import { ResultadoAccion } from "@/components/form-accion";

/** Vuelve a avisar al comprador (campana y WhatsApp) que tiene un anticipo por confirmar. */
export function BotonReenviar({ accion }: { accion: () => Promise<Resultado> }) {
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, iniciar] = useTransition();
  return (
    <div className="space-y-2">
      <button className="boton-secundario min-h-9 text-sm" disabled={cargando} onClick={() => iniciar(async () => setResultado(await accion()))}>
        {cargando ? "Avisando…" : "Recordarle por WhatsApp"}
      </button>
      <ResultadoAccion resultado={resultado} />
    </div>
  );
}
