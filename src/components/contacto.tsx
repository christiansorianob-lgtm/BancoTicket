"use client";
import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { enlaceWhatsApp, enlaceWhatsAppApp } from "@/lib/whatsapp";

/** Aviso que se deja listo en WhatsApp: solo falta tocar enviar. */
export type Contacto = { celular?: string | null; mensaje: string };

function esCelular() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Abre WhatsApp con el mensaje escrito. En el celular abre directamente la app (no WhatsApp
 * Web); en computador abre WhatsApp Web en otra pestaña.
 */
export function abrirWhatsApp(c: Contacto) {
  if (esCelular()) {
    window.location.href = enlaceWhatsAppApp(c.celular, c.mensaje);
    return;
  }
  const url = enlaceWhatsApp(c.celular, c.mensaje);
  if (!window.open(url, "_blank", "noopener")) window.location.href = url;
}

/** Abre WhatsApp automáticamente una sola vez (si se pide) y deja el botón de respaldo. */
export function AvisoContacto({ contacto, automatico = true }: { contacto: Contacto; automatico?: boolean }) {
  const abierto = useRef(false);
  useEffect(() => {
    if (!automatico || abierto.current) return;
    abierto.current = true;
    abrirWhatsApp(contacto);
  }, [automatico, contacto]);

  return (
    <a
      className="boton-whatsapp w-full"
      href={enlaceWhatsApp(contacto.celular, contacto.mensaje)}
      onClick={(e) => { e.preventDefault(); abrirWhatsApp(contacto); }}
    >
      <MessageCircle className="size-5" aria-hidden /> Enviar por WhatsApp
    </a>
  );
}
