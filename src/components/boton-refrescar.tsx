"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

/** Recarga la página (útil en el celular, donde no siempre se ve el botón del navegador). */
export function BotonRefrescar() {
  const [cargando, setCargando] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg p-2 hover:bg-white/10"
      aria-label="Refrescar página"
      title="Refrescar página"
      onClick={() => { setCargando(true); window.location.reload(); }}
    >
      <RefreshCw className={`size-5 ${cargando ? "animate-spin" : ""}`} />
    </button>
  );
}
