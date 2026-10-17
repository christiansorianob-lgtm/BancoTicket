"use client";
import { useEffect, useRef } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { enlaceWhatsApp } from "@/lib/whatsapp";

/** Aviso que se deja listo en WhatsApp y en el correo del dispositivo: solo falta tocar enviar. */
export type Contacto = { celular?: string | null; correos?: string[]; asunto: string; mensaje: string };

export function enlaceCorreo(correos: string[] | undefined, asunto: string, mensaje: string) {
  const para = (correos ?? []).filter(Boolean).join(",");
  return `mailto:${para}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
}

/**
 * Abre WhatsApp con el mensaje escrito y, cuando la persona vuelve a la app, abre el correo
 * predeterminado del dispositivo con el mismo aviso. Si el navegador bloquea la pestaña nueva
 * (pasa en algunos celulares), se navega directo a WhatsApp.
 */
export function abrirContacto(c: Contacto) {
  const tieneCorreo = (c.correos ?? []).some(Boolean);
  if (tieneCorreo) {
    const alVolver = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", alVolver);
      window.location.href = enlaceCorreo(c.correos, c.asunto, c.mensaje);
    };
    document.addEventListener("visibilitychange", alVolver);
  }
  const url = enlaceWhatsApp(c.celular, c.mensaje);
  const ventana = window.open(url, "_blank", "noopener");
  if (!ventana) window.location.href = url;
}

/** Abre WhatsApp y el correo automáticamente una sola vez, y deja los dos botones de respaldo. */
export function AvisoContacto({ contacto, automatico = true }: { contacto: Contacto; automatico?: boolean }) {
  const abierto = useRef(false);
  useEffect(() => {
    if (!automatico || abierto.current) return;
    abierto.current = true;
    abrirContacto(contacto);
  }, [automatico, contacto]);

  const tieneCorreo = (contacto.correos ?? []).some(Boolean);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <a className="boton-whatsapp" href={enlaceWhatsApp(contacto.celular, contacto.mensaje)} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-5" aria-hidden /> WhatsApp
      </a>
      {tieneCorreo && (
        <a className="boton-secundario" href={enlaceCorreo(contacto.correos, contacto.asunto, contacto.mensaje)}>
          <Mail className="size-5" aria-hidden /> Correo
        </a>
      )}
    </div>
  );
}
