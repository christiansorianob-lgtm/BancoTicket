"use client";
import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { enlaceWhatsApp } from "@/lib/whatsapp";

/** Aviso que se deja listo en WhatsApp: solo falta tocar enviar. */
export type Contacto = { celular?: string | null; mensaje: string };

/**
 * Abre WhatsApp con el mensaje escrito. Si el navegador bloquea la pestaña nueva
 * (pasa en algunos celulares), se navega directo a WhatsApp.
 */
export function abrirWhatsApp(c: Contacto) {
  const url = enlaceWhatsApp(c.celular, c.mensaje);
  const ventana = window.open(url, "_blank", "noopener");
  if (!ventana) window.location.href = url;
}

/** Abre WhatsApp automáticamente una sola vez y deja el botón de respaldo. */
export function AvisoContacto({ contacto, automatico = true }: { contacto: Contacto; automatico?: boolean }) {
  const abierto = useRef(false);
  useEffect(() => {
    if (!automatico || abierto.current) return;
    abierto.current = true;
    abrirWhatsApp(contacto);
  }, [automatico, contacto]);

  return (
    <a className="boton-whatsapp w-full" href={enlaceWhatsApp(contacto.celular, contacto.mensaje)} target="_blank" rel="noopener noreferrer">
      <MessageCircle className="size-5" aria-hidden /> Enviar por WhatsApp
    </a>
  );
}
