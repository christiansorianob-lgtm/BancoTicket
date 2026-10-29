"use client";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { abrirWhatsApp } from "@/components/contacto";

/**
 * Enviar el tiquete al comprador por WhatsApp (decisión del usuario, 2026-10-28): solo cuando la
 * administradora toca el botón, nunca automático.
 * 1) Donde el celular lo permite, abre «Compartir» con la FOTO y el texto: ella elige WhatsApp y el chat.
 * 2) Si no (algunos computadores), abre el chat del comprador con el texto y un enlace a la foto (7 días).
 */
export function EnviarTiquete({ celular, mensaje, foto, fotoEnlace, numero }: {
  celular: string | null; mensaje: string; foto?: string; fotoEnlace?: string; numero: string;
}) {
  // Si al bajar la foto se pierde el permiso del toque, se pide un segundo toque con la foto lista.
  const [lista, setLista] = useState<File | null>(null);
  const [preparando, setPreparando] = useState(false);

  const porChat = () => abrirWhatsApp({
    celular,
    mensaje: fotoEnlace ? `${mensaje}\n\nFoto del tiquete (enlace válido 7 días):\n${fotoEnlace}` : mensaje,
  });

  async function compartir(archivo: File) {
    try {
      await navigator.share({ files: [archivo], text: mensaje });
      setLista(null);
    } catch (e) {
      const nombre = (e as Error).name;
      if (nombre === "AbortError") { setLista(null); return; } // ella canceló
      if (nombre === "NotAllowedError") { setLista(archivo); return; } // falta un toque nuevo
      setLista(null);
      porChat();
    }
  }

  async function enviar() {
    if (lista) return compartir(lista);
    if (!foto || typeof navigator.canShare !== "function") return porChat();
    setPreparando(true);
    try {
      const blob = await (await fetch(foto)).blob();
      const archivo = new File([blob], `tiquete-${numero}.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type });
      if (!navigator.canShare({ files: [archivo] })) return porChat();
      await compartir(archivo);
    } catch {
      porChat();
    } finally {
      setPreparando(false);
    }
  }

  return (
    <button type="button" onClick={enviar} disabled={preparando} title="Enviar el tiquete y su foto al comprador por WhatsApp"
      className="boton-whatsapp min-h-9 px-3 text-sm">
      <MessageCircle className="size-4" aria-hidden />
      {preparando ? "Preparando foto…" : lista ? "Toque de nuevo para compartir" : "Enviar por WhatsApp"}
    </button>
  );
}
