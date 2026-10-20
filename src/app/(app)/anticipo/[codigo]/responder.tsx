"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Mensaje } from "@/components/ui";
import { AvisoContacto } from "@/components/contacto";
import { responderAnticipo } from "./acciones";

export function ResponderAnticipo({ codigo, tipo, monto, nombre, celularAdmin }: { codigo: string; tipo: string; monto: string; nombre: string; celularAdmin: string | null }) {
  const [disputa, setDisputa] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<"confirmado" | "en_disputa" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  function responder(acepta: boolean) {
    setError(null);
    iniciar(async () => {
      const r = await responderAnticipo(codigo, acepta, motivo);
      if (r.ok) setResultado(acepta ? "confirmado" : "en_disputa");
      else setError(r.error ?? "Error");
    });
  }

  if (resultado) {
    const texto = resultado === "confirmado"
      ? `Hola, soy ${nombre}. Confirmé en BancoTicket que recibí el ${tipo} de ${monto}.`
      : `Hola, soy ${nombre}. Marqué en BancoTicket que el ${tipo} de ${monto} no coincide: ${motivo}`;
    return (
      <div className="space-y-3">
        <Mensaje tono={resultado === "confirmado" ? "ok" : "alerta"}>
          {resultado === "confirmado" ? `Listo: confirmó que recibió este ${tipo}.` : "Quedó registrado como «en disputa». La administradora lo revisará."}
        </Mensaje>
        <AvisoContacto contacto={{ celular: celularAdmin, mensaje: texto }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <Mensaje tono="error">{error}</Mensaje>}
      {!disputa ? (
        <>
          <button className="boton-primario w-full py-4 text-lg" disabled={cargando} onClick={() => responder(true)}>
            <CheckCircle2 className="size-6" /> Confirmo que recibí este dinero
          </button>
          <button className="boton-secundario w-full" disabled={cargando} onClick={() => setDisputa(true)}>
            <XCircle className="size-5" /> No coincide
          </button>
        </>
      ) : (
        <div className="tarjeta space-y-3">
          <label className="etiqueta" htmlFor="motivo">¿Qué no coincide?</label>
          <textarea id="motivo" className="campo min-h-24" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button className="boton-secundario" onClick={() => setDisputa(false)}>Atrás</button>
            <button className="boton-peligro" disabled={cargando || !motivo.trim()} onClick={() => responder(false)}>Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}
