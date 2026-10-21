import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fechaHora } from "@/lib/fechas";
import { formatoToneladas, netoKg } from "@/lib/numeros";
import { Chip, Dato, Mensaje, Vacio } from "@/components/ui";
import { AccionesPendiente } from "./acciones-pendiente";

/** Campos que la lectura no leyó 100 % segura, guardados como «Verificar: número, tara». */
function camposARevisar(motivo: string | null): Set<string> {
  if (!motivo?.startsWith("Verificar:")) return new Set();
  return new Set(motivo.slice("Verificar:".length).split(",").map((c) => c.trim()).filter(Boolean));
}

export default async function Pendientes() {
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("tiquetes_pendientes")
    .select("*, extractoras(nombre), perfiles!tiquetes_pendientes_comprador_id_fkey(nombre)")
    .eq("estado", "pendiente")
    .order("requiere_revision", { ascending: false })
    .order("cargado_en", { ascending: true });
  const { data: extractoras } = await supabase.from("extractoras").select("id, nombre").order("nombre");
  const filas = data ?? [];
  const fotos = await urlsFotos(filas.map((f) => f.imagen_ruta));

  return (
    <>
      <h1 className="titulo">Tiquetes pendientes ({filas.length})</h1>
      {filas.length === 0 && <Vacio>No hay tiquetes por revisar.</Vacio>}
      <ul className="space-y-4">
        {filas.map((t) => (
          <li key={t.id} className={`tarjeta grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] ${t.requiere_revision ? "ring-2 ring-alerta" : ""}`}>
            <div>
              {t.imagen_ruta && fotos[t.imagen_ruta] ? (
                <a href={fotos[t.imagen_ruta]} target="_blank" rel="noopener noreferrer">
                  <img src={fotos[t.imagen_ruta]} alt={`Tiquete ${t.numero}`} className="max-h-[28rem] w-full rounded-xl border border-borde object-contain" />
                </a>
              ) : <Vacio>Sin foto</Vacio>}
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold text-profundo">{t.extractoras?.nombre} · N° {t.numero}</p>
                {/* El proveedor es la empresa de la administración a la que se le entregó la fruta. */}
                {camposARevisar(t.requiere_revision ? t.motivo_revision : null).has("proveedor") ? (
                  <span className="rounded-lg border-2 border-alerta bg-alerta-suave px-2.5 py-1 text-sm font-bold uppercase tracking-wide text-alerta">
                    Proveedor: {t.proveedor ?? "no leído"} · Revisar
                  </span>
                ) : (
                  <span className="rounded-lg bg-profundo px-2.5 py-1 text-sm font-bold uppercase tracking-wide text-white">
                    Proveedor: {t.proveedor ?? "no leído"}
                  </span>
                )}
                {t.requiere_revision && <Chip tono="alerta">{t.motivo_revision ?? "Revisar"}</Chip>}
                <Chip tono={t.origen === "camara" ? "primario" : "alerta"}>{t.origen === "camara" ? "Cámara" : "Galería"}</Chip>
              </div>
              {(() => {
                const r = camposARevisar(t.requiere_revision ? t.motivo_revision : null);
                // «peso neto impreso» es el nombre que usaban los tiquetes marcados antes del 2026-10-21.
                const netoRevisar = r.has("peso neto") || r.has("peso neto impreso");
                return (
                  <>
                    {r.size > 0 && (
                      <Mensaje tono="alerta">
                        Compare con la foto antes de aprobar: la lectura no fue 100 % segura en {[...r].join(", ")}. Si algo no coincide, use «Corregir datos».
                      </Mensaje>
                    )}
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Dato etiqueta="N° tiquete" revisar={r.has("número")}>{t.numero}</Dato>
                      <Dato etiqueta="Comprador">{t.perfiles?.nombre}</Dato>
                      <Dato etiqueta="Fecha de entrada" revisar={r.has("fecha")}>{fechaHora(t.fecha_entrada)}</Dato>
                      <Dato etiqueta="Placa" revisar={r.has("placa")}>{t.placa ?? "—"}</Dato>
                      <Dato etiqueta="Bruto" revisar={r.has("peso bruto")}>{formatoToneladas(t.peso_bruto_kg / 1000)}</Dato>
                      <Dato etiqueta="Tara" revisar={r.has("tara")}>{formatoToneladas(t.tara_kg / 1000)}</Dato>
                      <Dato etiqueta="Peso neto (impreso, se cobra)" revisar={netoRevisar}>{formatoToneladas(netoKg(t) / 1000)}</Dato>
                      {t.neto_impreso_kg != null && t.neto_impreso_kg !== t.peso_bruto_kg - t.tara_kg && (
                        <Dato etiqueta="Bruto − tara (no cuadra)" revisar>{formatoToneladas((t.peso_bruto_kg - t.tara_kg) / 1000)}</Dato>
                      )}
                      {(t.conductor || r.has("conductor")) && <Dato etiqueta="Conductor" revisar={r.has("conductor")}>{t.conductor ?? "—"}</Dato>}
                      {t.bascula && <Dato etiqueta="Báscula" revisar={r.has("báscula")}>{t.bascula}</Dato>}
                      <Dato etiqueta="Subido">{fechaHora(t.cargado_en)}</Dato>
                    </dl>
                  </>
                );
              })()}
              <AccionesPendiente tiquete={t} extractoras={extractoras ?? []} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
