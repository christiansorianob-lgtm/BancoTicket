"use client";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { eliminarRechazado } from "./acciones";

export function BotonEliminarRechazado({ id }: { id: string }) {
  const [cargando, iniciar] = useTransition();
  return (
    <button
      className="boton-peligro text-sm"
      disabled={cargando}
      onClick={() => {
        if (confirm("¿Eliminar este tiquete rechazado? Podrá volver a subirlo.")) iniciar(() => eliminarRechazado(id));
      }}
    >
      <Trash2 className="size-4" aria-hidden /> {cargando ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
