"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { Mensaje } from "@/components/ui";
import { completarPrecio, fallasFactura, MAX_BYTES_FACTURA, type Validacion } from "@/lib/facturas/validar";
import { facturaDesde } from "@/lib/facturas/formulario";
import type { FacturaLeida } from "@/lib/facturas/tipos";
import { pesos, type TarifasFactura } from "@/lib/facturas/comprobacion";
import { aprobarFactura, descartarArchivo } from "../acciones";
import { CamposFactura, type ClienteRegistrado } from "../campos-factura";

type Lectura =
  | { duplicado: { id: string; numero_factura: string }; datos: FacturaLeida }
  | { duplicado?: undefined; datos: FacturaLeida; validaciones: Validacion[]; archivo_path: string; tipo_archivo: "pdf" | "imagen"; consumoId: number | null };

/**
 * Subir una factura (decisión del usuario): se ELIGE el archivo de la galería o de los archivos del
 * celular o computador. Sin cámara: el selector no lleva «capture» ni se usa getUserMedia.
 */
export function SubirFactura({ tarifas, clientes }: { tarifas: TarifasFactura; clientes: ClienteRegistrado[] }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<{ url: string; tipo: string; verPdf: boolean } | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  // Aviso Sí / No antes de aprobar: los datos del formulario y las diferencias encontradas.
  const [confirmar, setConfirmar] = useState<{ form: FormData; datos: FacturaLeida; fallas: string[] } | null>(null);

  function reiniciar() {
    if (archivo) URL.revokeObjectURL(archivo.url);
    setArchivo(null); setLectura(null); setError(null); setConfirmar(null);
  }

  async function leer(f: File | undefined) {
    if (!f) return;
    reiniciar();
    if (f.size > MAX_BYTES_FACTURA) return setError("El archivo pesa más de 4 MB.");
    // El celular no muestra PDF dentro de la página: allí solo va el botón para abrirlo.
    setArchivo({ url: URL.createObjectURL(f), tipo: f.type, verPdf: navigator.pdfViewerEnabled === true });
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

      {error && !lectura && <Mensaje tono="error">{error}</Mensaje>}
      {leyendo && <p className="flex items-center justify-center gap-2 font-semibold text-primario"><Loader2 className="size-5 animate-spin" /> Leyendo la factura…</p>}

      {lectura?.duplicado && (
        <Mensaje tono="error">
          Esta factura ya está registrada (mismo CUFE): <Link className="underline" href={`/facturas/${lectura.duplicado.id}`}>{lectura.duplicado.numero_factura}</Link>. No se guardó de nuevo.
        </Mensaje>
      )}

      {lectura && !lectura.duplicado && (
        <form className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
          // Si cambian un dato mientras se pregunta, se cancela: el aviso ya no corresponde.
          onChange={() => confirmar && setConfirmar(null)}
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const datos = completarPrecio(facturaDesde((k) => form.get(k) as string | null));
            setError(null);
            setConfirmar({ form, datos, fallas: fallasFactura(datos, tarifas) });
          }}>
          <div className="tarjeta">
            {archivo && (archivo.tipo === "application/pdf"
              ? archivo.verPdf
                ? <object data={archivo.url} type="application/pdf" className="h-[32rem] w-full rounded-xl"><a href={archivo.url} target="_blank" rel="noopener noreferrer" className="boton-secundario w-full">Abrir el PDF</a></object>
                : <a href={archivo.url} target="_blank" rel="noopener noreferrer" className="boton-secundario w-full">Abrir el PDF</a>
              :<img src={archivo.url} alt="Factura" className="w-full rounded-xl border border-borde" />)}
          </div>
          <div className="tarjeta space-y-3">
            <input type="hidden" name="archivo_path" value={lectura.archivo_path} />
            <input type="hidden" name="tipo_archivo" value={lectura.tipo_archivo} />
            <input type="hidden" name="consumo_id" value={lectura.consumoId ?? ""} />
            <Mensaje tono="alerta">Compare los datos con la factura y corrija lo que haga falta. La factura solo se guarda al aprobarla.</Mensaje>
            <CamposFactura inicial={lectura.datos} tarifas={tarifas} clientes={clientes} />
            {confirmar ? (
              <div className={`space-y-3 rounded-xl border-2 p-3 ${confirmar.fallas.length ? "border-error bg-error-suave" : "border-alerta bg-alerta-suave"}`} role="alertdialog" aria-label="Confirmar aprobación">
                {confirmar.fallas.length ? (
                  <div className="space-y-1 text-sm text-error">
                    <p className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden /> La comprobación encontró diferencias:</p>
                    <ul className="list-disc pl-9">{confirmar.fallas.map((f) => <li key={f}>{f}</li>)}</ul>
                    <p className="font-semibold">Si la aprueba así, las diferencias quedan anotadas en la factura. ¿Aprobar de todos modos?</p>
                  </div>
                ) : (
                  <p className="flex items-start gap-2 text-sm font-semibold text-profundo">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
                    ¿Aprobar la factura {confirmar.datos.numero_factura} de {confirmar.datos.emisor_razon_social ?? "—"} por {confirmar.datos.total_a_pagar == null ? "—" : pesos(confirmar.datos.total_a_pagar)} (total a pagar)? Todos los cálculos coinciden.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                  <button type="button" className="boton-primario" disabled={guardando}
                    onClick={() => iniciar(async () => {
                      const r = await aprobarFactura(confirmar.form);
                      if (!r.ok) { setConfirmar(null); return setError(r.error ?? "No se pudo aprobar"); }
                      router.push(`/facturas/${r.id}`);
                    })}>{guardando ? "Aprobando…" : "Sí, aprobar"}</button>
                  <button type="button" className="boton-secundario" disabled={guardando} onClick={() => setConfirmar(null)}>No</button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="boton-primario" disabled={guardando}>Aprobar factura</button>
                <button type="button" className="boton-secundario" disabled={guardando}
                  onClick={() => iniciar(async () => { await descartarArchivo(lectura.archivo_path); reiniciar(); })}>Cancelar</button>
              </div>
            )}
            {error && <Mensaje tono="error">{error}</Mensaje>}
          </div>
        </form>
      )}
    </div>
  );
}
