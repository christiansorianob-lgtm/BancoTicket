"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Mensaje } from "@/components/ui";
import { AvisoContacto } from "@/components/contacto";
import { responderAnticipo, responderAnticipoPorId } from "./acciones";

/**
 * Confirmar o disputar un anticipo: por el enlace (codigo) o desde la app del comprador (id).
 * negativo: no es dinero recibido sino un saldo a favor del comprador; `monto` llega sin signo.
 */
export function ResponderAnticipo({ codigo, id, negativo = false, monto, nombre, celularAdmin }: {
  codigo?: string; id?: string; negativo?: boolean; monto: string; nombre: string; celularAdmin: string | null;
}) {
  const tipo = negativo ? "saldo a mi favor" : "anticipo";
  const [disputa, setDisputa] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<"confirmado" | "en_disputa" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();

  function responder(acepta: boolean) {
    setError(null);
    iniciar(async () => {
      const r = id ? await responderAnticipoPorId(id, acepta, motivo) : await responderAnticipo(codigo!, acepta, motivo);
      if (r.ok) setResultado(acepta ? "confirmado" : "en_disputa");
      else setError(r.error ?? "Error");
    });
  }

  if (resultado) {
    const texto = resultado === "confirmado"
      ? negativo
        ? `Hola, soy ${nombre}. Confirmé en BancoTicket el saldo a mi favor de ${monto}.`
        : `Hola, soy ${nombre}. Confirmé en BancoTicket que recibí el anticipo de ${monto}.`
      : `Hola, soy ${nombre}. Marqué en BancoTicket que el ${tipo} de ${monto} no coincide: ${motivo}`;
    return (
      <div className="space-y-3">
        <Mensaje tono={resultado === "confirmado" ? "ok" : "alerta"}>
          {resultado === "confirmado"
            ? negativo ? "Listo: confirmó el saldo a su favor." : "Listo: confirmó que recibió este anticipo."
            : "Quedó registrado como «en disputa». La administradora lo revisará."}
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
            <CheckCircle2 className="size-6" /> {negativo ? "Confirmo que este saldo a mi favor es correcto" : "Confirmo que recibí este dinero"}
          </button>
          <button className="boton-secundario w-full" disabled={cargando} onClick={() => setDisputa(true)}>
            <XCircle className="size-5" /> No coincide
          </button>
        </>
      ) : (
        <div className="tarjeta space-y-3">
          <label className="etiqueta" htmlFor={`motivo-${id ?? codigo}`}>¿Qué no coincide?</label>
          <textarea id={`motivo-${id ?? codigo}`} className="campo min-h-24" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button className="boton-secundario" onClick={() => setDisputa(false)}>Atrás</button>
            <button className="boton-peligro" disabled={cargando || !motivo.trim()} onClick={() => responder(false)}>Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}
