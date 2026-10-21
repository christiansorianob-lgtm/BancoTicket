import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export function Chip({ tono, children }: { tono: "ok" | "alerta" | "error" | "neutro" | "primario"; children: ReactNode }) {
  const clases = {
    ok: "bg-ok-suave text-ok",
    alerta: "bg-alerta-suave text-alerta",
    error: "bg-error-suave text-error",
    neutro: "bg-slate-100 text-slate-600",
    primario: "bg-primario-suave text-primario",
  }[tono];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${clases}`}>{children}</span>;
}

const ESTADOS: Record<string, { tono: "ok" | "alerta" | "error" | "neutro" | "primario"; texto: string }> = {
  pendiente: { tono: "alerta", texto: "Pendiente" },
  rechazado: { tono: "error", texto: "Rechazado" },
  vigente: { tono: "ok", texto: "Aprobado" },
  anulado: { tono: "neutro", texto: "Anulado" },
  confirmado: { tono: "ok", texto: "Confirmado" },
  en_disputa: { tono: "error", texto: "En disputa" },
};

export function EstadoChip({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? { tono: "neutro" as const, texto: estado };
  return <Chip tono={e.tono}>{e.texto}</Chip>;
}

export function BotonWhatsApp({ celular, mensaje, texto = "Avisar por WhatsApp" }: { celular?: string | null; mensaje: string; texto?: string }) {
  return (
    <a className="boton-whatsapp" href={enlaceWhatsApp(celular, mensaje)} target="_blank" rel="noopener noreferrer">
      <MessageCircle className="size-5" aria-hidden /> {texto}
    </a>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-borde bg-white/50 p-6 text-center text-suave">{children}</p>;
}

/** revisar: la lectura no fue 100 % segura en este campo; se resalta para compararlo con la foto. */
export function Dato({ etiqueta, children, revisar = false }: { etiqueta: string; children: ReactNode; revisar?: boolean }) {
  return (
    <div className={revisar ? "-m-1.5 rounded-lg border-2 border-alerta bg-alerta-suave p-1.5" : ""}>
      <dt className={`text-xs font-medium uppercase tracking-wide ${revisar ? "text-alerta" : "text-suave"}`}>
        {etiqueta}{revisar && " · Revisar"}
      </dt>
      <dd className="text-base font-semibold text-texto">{children}</dd>
    </div>
  );
}

export function Mensaje({ tono, children }: { tono: "ok" | "error" | "alerta"; children: ReactNode }) {
  const c = { ok: "border-ok/30 bg-ok-suave text-ok", error: "border-error/30 bg-error-suave text-error", alerta: "border-alerta/30 bg-alerta-suave text-alerta" }[tono];
  return <div role={tono === "error" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm font-medium ${c}`}>{children}</div>;
}
