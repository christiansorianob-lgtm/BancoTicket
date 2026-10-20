"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ImageUp, Loader2 } from "lucide-react";
import { imagenDesdeArchivo, reducirImagen } from "@/lib/imagen";
import { Mensaje } from "@/components/ui";

type Respuesta =
  | { ok: false; motivo?: string; error?: string }
  | {
      ok: true;
      extractora: { id: string; nombre: string; nueva: boolean };
      formato: { id: string; nuevo: boolean };
      totalFormatos: number;
      descripcion: string;
      nit: string | null;
      ejemplo: Record<string, string | null>;
    };

const ETIQUETAS: Record<string, string> = {
  numero: "N° tiquete", fecha_entrada: "Fecha", peso_bruto_kg: "Peso bruto", tara_kg: "Tara",
  peso_neto_kg: "Peso neto", proveedor: "Proveedor", placa: "Placa",
};

/** El administrador solo sube la foto de un tiquete: el sistema aprende la extractora y su formato. */
export function AprenderFormato() {
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [foto, setFoto] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [r, setR] = useState<Respuesta | null>(null);

  async function aprender(archivo: File | undefined) {
    if (!archivo) return;
    setR(null);
    setCargando(true);
    try {
      const blob = await reducirImagen(await imagenDesdeArchivo(archivo), 2000);
      if (foto) URL.revokeObjectURL(foto);
      setFoto(URL.createObjectURL(blob));
      const form = new FormData();
      form.set("imagen", new File([blob], blob.type === "image/webp" ? "ejemplo.webp" : "ejemplo.jpg", { type: blob.type }));
      const res = await fetch("/api/aprender-formato", { method: "POST", body: form });
      const json = await res.json();
      setR(res.ok ? json : { ok: false, error: json.error ?? "No se pudo analizar la foto" });
      if (json.ok) router.refresh();
    } catch {
      setR({ ok: false, error: "No se pudo abrir la imagen" });
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="tarjeta space-y-3">
      <div>
        <h2 className="font-bold text-profundo">Enseñar un tiquete</h2>
        <p className="text-sm text-suave">
          Tome o suba la foto de un tiquete. El sistema reconoce la extractora, le pone nombre y aprende cómo leer ese formato.
          Si la extractora ya existe y el formato es distinto, lo agrega como otro formato de la misma extractora.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button className="boton-primario" disabled={cargando} onClick={() => camara.current?.click()}>
          <Camera className="size-5" /> Tomar foto
        </button>
        <button className="boton-secundario" disabled={cargando} onClick={() => galeria.current?.click()}>
          <ImageUp className="size-5" /> Subir de la galería
        </button>
      </div>
      <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { aprender(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => { aprender(e.target.files?.[0]); e.target.value = ""; }} />

      {(cargando || r) && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {foto && <img src={foto} alt="Tiquete de ejemplo" className="w-full rounded-xl border border-borde" />}
          <div className="space-y-2">
            {cargando && (
              <p className="flex items-center gap-2 font-semibold text-primario"><Loader2 className="size-5 animate-spin" /> Analizando el tiquete…</p>
            )}
            {r && !r.ok && <Mensaje tono="error">{r.motivo ?? r.error}</Mensaje>}
            {r?.ok && (
              <>
                <Mensaje tono="ok">
                  <span className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                    <span>
                      <b>{r.extractora.nombre}</b> {r.extractora.nueva ? "(extractora nueva)" : "(ya registrada)"}
                      {" · "}
                      {r.formato.nuevo
                        ? r.totalFormatos > 1 ? `formato nuevo: ahora conoce ${r.totalFormatos} formatos` : "formato aprendido"
                        : "este formato ya lo conocía; se actualizó"}
                    </span>
                  </span>
                </Mensaje>
                <p className="text-sm text-suave">{r.descripcion}{r.nit ? ` · NIT ${r.nit}` : ""}</p>
                <p className="text-sm font-semibold text-profundo">Compruebe que leyó bien este tiquete:</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(ETIQUETAS).map(([k, etiqueta]) => (
                    <div key={k}>
                      <dt className="text-xs text-suave">{etiqueta}</dt>
                      <dd className="font-semibold">{r.ejemplo[k] ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-suave">Si algo quedó mal, elimine el formato abajo y suba una foto más nítida. Puede cambiar el nombre de la extractora en «Editar».</p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
