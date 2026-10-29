"use client";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { abrirWhatsApp } from "@/components/contacto";

/**
 * Enviar la FOTO del tiquete al comprador por WhatsApp (decisión del usuario, 2026-10-28: solo la
 * imagen, sin los datos; solo con botón, nunca automático). Va junto a la imagen del tiquete.
 * 1) Donde el celular lo permite, abre «Compartir» con la foto: WhatsApp pide elegir el chat (una
 *    página web no puede adjuntar una imagen a un chat concreto).
 * 2) Si no (algunos computadores), abre el chat del comprador con un enlace a la foto (7 días).
 */
export function EnviarFoto({ celular, foto, fotoEnlace, numero, compacto = false }: {
  celular: string | null; foto: string; fotoEnlace?: string; numero: string; compacto?: boolean;
}) {
  // Si al bajar la foto se pierde el permiso del toque, se pide un segundo toque con la foto lista.
  const [lista, setLista] = useState<File | null>(null);
  const [preparando, setPreparando] = useState(false);

  const porChat = () => abrirWhatsApp({ celular, mensaje: `Foto del tiquete N° ${numero}:\n${fotoEnlace ?? foto}` });

  async function compartir(archivo: File) {
    try {
      await navigator.share({ files: [archivo] });
      setLista(null);
    } catch (e) {
      const nombre = (e as Error).name;
      if (nombre === "AbortError") { setLista(null); return; } // canceló
      if (nombre === "NotAllowedError") { setLista(archivo); return; } // falta un toque nuevo
      setLista(null);
      porChat();
    }
  }

  async function enviar() {
    if (lista) return compartir(lista);
    if (typeof navigator.canShare !== "function") return porChat();
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

  const texto = preparando ? "Preparando…" : lista ? "Toque de nuevo" : "Enviar foto por WhatsApp";
  return compacto ? (
    <button type="button" onClick={enviar} disabled={preparando} title={`${texto} (tiquete ${numero})`} aria-label={`Enviar la foto del tiquete ${numero} por WhatsApp`}
      className={`inline-flex size-9 items-center justify-center rounded-lg hover:bg-ok-suave ${lista ? "bg-ok-suave text-ok" : "text-ok"}`}>
      <MessageCircle className="size-5" />
    </button>
  ) : (
    <button type="button" onClick={enviar} disabled={preparando} title="Enviar la foto del tiquete por WhatsApp" className="boton-whatsapp min-h-9 px-3 text-sm">
      <MessageCircle className="size-4" aria-hidden /> {texto}
    </button>
  );
}
