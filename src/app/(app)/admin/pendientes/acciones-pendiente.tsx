"use client";
import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { aprobarTiquete, editarPendiente, rechazarTiquete, type Resultado } from "../acciones";
import { FormAccion, ResultadoAccion } from "@/components/form-accion";
import { CamposTiquete } from "@/components/campos-tiquete";

type Props = {
  tiquete: Parameters<typeof CamposTiquete>[0]["t"] & { id: string };
  extractoras: { id: string; nombre: string }[];
};

export function AccionesPendiente({ tiquete, extractoras }: Props) {
  const [modo, setModo] = useState<"ninguno" | "rechazar" | "editar">("ninguno");
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, iniciar] = useTransition();

  if (resultado?.ok && resultado.whatsapp) return <ResultadoAccion resultado={{ ...resultado, mensaje: "Listo. Avíselo al comprador:" }} />;

  return (
    <div className="space-y-3 border-t border-borde pt-3">
      <div className="flex flex-wrap gap-2">
        <button className="boton-primario" disabled={cargando} onClick={() => iniciar(async () => setResultado(await aprobarTiquete(tiquete.id)))}>
          <Check className="size-5" /> Aprobar
        </button>
        <button className="boton-peligro" onClick={() => setModo(modo === "rechazar" ? "ninguno" : "rechazar")}><X className="size-5" /> Rechazar</button>
        <button className="boton-secundario" onClick={() => setModo(modo === "editar" ? "ninguno" : "editar")}><Pencil className="size-4" /> Corregir datos</button>
      </div>

      {modo === "rechazar" && (
        <div className="space-y-2">
          <label className="etiqueta" htmlFor={`m-${tiquete.id}`}>Motivo del rechazo</label>
          <input id={`m-${tiquete.id}`} className="campo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: la foto no corresponde al tiquete" />
          <button className="boton-peligro" disabled={cargando || !motivo.trim()} onClick={() => iniciar(async () => setResultado(await rechazarTiquete(tiquete.id, motivo)))}>
            Confirmar rechazo
          </button>
        </div>
      )}

      {modo === "editar" && (
        <FormAccion accion={editarPendiente.bind(null, tiquete.id)} boton="Guardar corrección">
          <CamposTiquete t={tiquete} extractoras={extractoras} />
        </FormAccion>
      )}

      <ResultadoAccion resultado={resultado} />
    </div>
  );
}
