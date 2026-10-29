"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { Mensaje } from "@/components/ui";
import { MAX_BYTES_FACTURA, type Validacion } from "@/lib/facturas/validar";
import type { FacturaLeida } from "@/lib/facturas/tipos";
import { descartarArchivo, guardarFactura } from "../acciones";
import { CamposFactura } from "../campos-factura";

type Lectura =
  | { duplicado: { id: string; numero_factura: string }; datos: FacturaLeida }
  | { duplicado?: undefined; datos: FacturaLeida; validaciones: Validacion[]; archivo_path: string; tipo_archivo: "pdf" | "imagen"; consumoId: number | null };

/**
 * Subir una factura (decisión del usuario): se ELIGE el archivo de la galería o de los archivos del
 * celular o computador. Sin cámara: el selector no lleva «capture» ni se usa getUserMedia.
 */
export function SubirFactura() {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<{ url: string; tipo: string } | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function reiniciar() {
    if (archivo) URL.revokeObjectURL(archivo.url);
    setArchivo(null); setLectura(null); setError(null);
  }

  async function leer(f: File | undefined) {
    if (!f) return;
    reiniciar();
    if (f.size > MAX_BYTES_FACTURA) return setError("El archivo pesa más de 4 MB.");
    setArchivo({ url: URL.createObjectURL(f), tipo: f.type });
    setLeyendo(true);
    const form = new FormData();
    form.set("archivo", f);
    try {
      const r = await fetch("/api/facturas/leer", { method: "POST", body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "No se pudo leer la factura");
      setLectura(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="tarjeta space-y-3">
        <input ref={entrada} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { leer(e.target.files?.[0]); e.target.value = ""; }} />
        <button type="button" className="boton-primario w-full py-4" disabled={leyendo || guardando} onClick={() => entrada.current?.click()}>
          <FileUp className="size-6" aria-hidden /> {lectura || archivo ? "Elegir otro archivo" : "Elegir la factura (PDF o imagen)"}
        </button>
        <p className="text-center text-xs text-suave">PDF, JPG, PNG o WebP de máximo 4 MB, desde la galería o los archivos.</p>
      </div>

      {error && <Mensaje tono="error">{error}</Mensaje>}
      {leyendo && <p className="flex items-center justify-center gap-2 font-semibold text-primario"><Loader2 className="size-5 animate-spin" /> Leyendo la factura…</p>}

      {lectura?.duplicado && (
        <Mensaje tono="error">
          Esta factura ya está registrada (mismo CUFE): <Link className="underline" href={`/facturas/${lectura.duplicado.id}`}>{lectura.duplicado.numero_factura}</Link>. No se guardó de nuevo.
        </Mensaje>
      )}

      {lectura && !lectura.duplicado && (
        <form className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
          onSubmit={(e) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            iniciar(async () => {
              const r = await guardarFactura(datos);
              if (!r.ok) return setError(r.error ?? "No se pudo guardar");
              router.push(`/facturas/${r.id}`);
            });
          }}>
          <div className="tarjeta">
            {archivo && (archivo.tipo === "application/pdf"
              ? <object data={archivo.url} type="application/pdf" className="h-[32rem] w-full rounded-xl"><a href={archivo.url} target="_blank" rel="noopener noreferrer" className="boton-secundario w-full">Abrir el PDF</a></object>
              : <img src={archivo.url} alt="Factura" className="w-full rounded-xl border border-borde" />)}
          </div>
          <div className="tarjeta space-y-3">
            <input type="hidden" name="archivo_path" value={lectura.archivo_path} />
            <input type="hidden" name="tipo_archivo" value={lectura.tipo_archivo} />
            <input type="hidden" name="consumo_id" value={lectura.consumoId ?? ""} />
            <Mensaje tono="alerta">Compare los datos con la factura y corrija lo que haga falta antes de guardar.</Mensaje>
            <CamposFactura inicial={lectura.datos} />
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="boton-primario" disabled={guardando}>{guardando ? "Guardando…" : "Confirmar y guardar"}</button>
              <button type="button" className="boton-secundario" disabled={guardando}
                onClick={() => iniciar(async () => { await descartarArchivo(lectura.archivo_path); reiniciar(); })}>Cancelar</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
