"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus } from "lucide-react";
import type { Resultado } from "../acciones";
import { ResultadoAccion } from "@/components/form-accion";
import { imagenDesdeArchivo, reducirImagen } from "@/lib/imagen";

/** Reduce la foto escogida (≤ 500 KB) y la devuelve como archivo listo para enviar. */
async function prepararFoto(archivo: File): Promise<File> {
  const blob = await reducirImagen(await imagenDesdeArchivo(archivo), 2000);
  return new File([blob], blob.type === "image/webp" ? "soporte.webp" : "soporte.jpg", { type: blob.type });
}

/**
 * Campo «Soporte (foto)» del formulario de registrar anticipo: se escoge del dispositivo y se
 * reemplaza por la versión reducida antes de enviar el formulario.
 */
export function CampoSoporte() {
  const ref = useRef<HTMLInputElement>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [estado, setEstado] = useState<"" | "preparando" | "error">("");

  useEffect(() => {
    const form = ref.current?.form;
    const limpiar = () => { setVista(null); setEstado(""); };
    form?.addEventListener("reset", limpiar);
    return () => form?.removeEventListener("reset", limpiar);
  }, []);

  return (
    <label className="block sm:col-span-2 lg:col-span-4">
      <span className="etiqueta">Soporte (foto, opcional)</span>
      <input ref={ref} name="soporte" type="file" accept="image/*" className="campo"
        onChange={async (e) => {
          const input = e.currentTarget;
          const archivo = input.files?.[0];
          setVista(null);
          if (!archivo) return setEstado("");
          setEstado("preparando");
          try {
            const foto = await prepararFoto(archivo);
            const dt = new DataTransfer();
            dt.items.add(foto);
            input.files = dt.files;
            setVista(URL.createObjectURL(foto));
            setEstado("");
          } catch {
            input.value = "";
            setEstado("error");
          }
        }} />
      {estado === "preparando" && <p className="mt-1 text-sm text-suave">Preparando la foto…</p>}
      {estado === "error" && <p className="mt-1 text-sm text-error">No se pudo abrir esa foto. Elija otra.</p>}
      {vista && <img src={vista} alt="Soporte escogido" className="mt-2 max-h-48 rounded-lg border border-borde" />}
      <span className="mt-1 block text-xs text-suave">Una vez registrado, el soporte no se puede cambiar.</span>
    </label>
  );
}

/** Ícono de la tarjeta para subir el soporte a un anticipo pendiente que aún no lo tiene. */
export function SubirSoporte({ accion }: { accion: (form: FormData) => Promise<Resultado> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<{ archivo: File; url: string } | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [cargando, iniciar] = useTransition();

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={async (e) => {
          const archivo = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (!archivo) return;
          setResultado(null);
          try {
            const listo = await prepararFoto(archivo);
            setFoto({ archivo: listo, url: URL.createObjectURL(listo) });
          } catch {
            setResultado({ ok: false, error: "No se pudo abrir esa foto. Elija otra." });
          }
        }} />
      {!foto && !resultado?.ok && (
        <button type="button" onClick={() => ref.current?.click()} title="Subir soporte (foto)"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primario hover:bg-primario-suave">
          <ImagePlus className="size-5" aria-hidden /> Subir soporte
        </button>
      )}
      {foto && (
        <div className="space-y-2 rounded-lg border border-borde p-2">
          <img src={foto.url} alt="Soporte escogido" className="max-h-48 rounded-lg" />
          <p className="text-xs text-suave">Una vez subido, el soporte no se puede cambiar.</p>
          <div className="flex gap-2">
            <button type="button" className="boton-primario min-h-9 text-sm" disabled={cargando}
              onClick={() => iniciar(async () => {
                const datos = new FormData();
                datos.set("soporte", foto.archivo);
                const r = await accion(datos);
                setResultado(r);
                if (r.ok) setFoto(null);
              })}>
              {cargando ? "Subiendo…" : "Subir soporte"}
            </button>
            <button type="button" className="boton-secundario min-h-9 text-sm" disabled={cargando} onClick={() => setFoto(null)}>Cancelar</button>
          </div>
        </div>
      )}
      <ResultadoAccion resultado={resultado} />
    </div>
  );
}
