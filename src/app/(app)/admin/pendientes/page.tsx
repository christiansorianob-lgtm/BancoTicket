import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { antiguedad, fechaHora } from "@/lib/fechas";
import { MESES_MAXIMOS } from "@/lib/lectura/controles";
import { formatoToneladas, netoKg } from "@/lib/numeros";
import { Chip, Dato, Mensaje, Vacio } from "@/components/ui";
import { AccionesPendiente } from "./acciones-pendiente";
import { sonParecidos } from "@/lib/lectura/parecidos";
import { EnviarTiquete } from "@/components/enviar-tiquete";
import { mensajeTiquete } from "@/lib/mensajes";

/** Campos que la lectura no leyó 100 % segura, guardados como «Verificar: número, tara». */
function camposARevisar(motivo: string | null): Set<string> {
  if (!motivo?.startsWith("Verificar:")) return new Set();
  return new Set(motivo.slice("Verificar:".length).split(",").map((c) => c.trim()).filter(Boolean));
}

/**
 * Cuánto lleva el tiquete desde la entrada (decisión del usuario): al aprobar se ve cuántos meses van
 * y, si la fecha es dudosa, se contrasta. Rojo: pasa del límite de 6 meses; ámbar: le falta menos de un mes.
 */
function EtiquetaAntiguedad({ fecha }: { fecha: string }) {
  const a = antiguedad(fecha);
  const tono = a.meses >= MESES_MAXIMOS ? "bg-error text-white" : a.meses >= MESES_MAXIMOS - 1 ? "bg-alerta text-white" : "bg-primario-suave text-profundo";
  return (
    <span className={`mt-1 block w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${tono}`}>
      {a.texto}{a.meses >= MESES_MAXIMOS ? ` · más de ${MESES_MAXIMOS} meses` : ""}
    </span>
  );
}

export default async function Pendientes() {
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("tiquetes_pendientes")
    .select("*, extractoras(nombre), perfiles!tiquetes_pendientes_comprador_id_fkey(nombre, celular)")
    .eq("estado", "pendiente")
    .order("requiere_revision", { ascending: false })
    .order("cargado_en", { ascending: true });
  const { data: extractoras } = await supabase.from("extractoras").select("id, nombre").order("nombre");
  const filas = data ?? [];
  const [fotos, fotosEnlace] = await Promise.all([
    urlsFotos(filas.map((f) => f.imagen_ruta)),
    // Enlace de 7 días para el WhatsApp al comprador (cuando el equipo no puede compartir la foto).
    urlsFotos(filas.map((f) => f.imagen_ruta), 60 * 60 * 24 * 7),
  ]);

  // N° dudoso: números parecidos ya registrados en la misma extractora (posible duplicado disfrazado).
  const conNumeroDudoso = filas.filter((t) => camposARevisar(t.requiere_revision ? t.motivo_revision : null).has("número"));
  const extIds = [...new Set(conNumeroDudoso.map((t) => t.extractora_id as string))];
  const { data: registrados } = extIds.length
    ? await supabase.from("tiquetes").select("extractora_id, numero").in("extractora_id", extIds).limit(20000)
    : { data: [] };
  const parecidosDe = (t: (typeof filas)[number]) => [
    ...(registrados ?? []).filter((x) => x.extractora_id === t.extractora_id && sonParecidos(x.numero, t.numero)).map((x) => `${x.numero} (aprobado)`),
    ...filas.filter((x) => x.id !== t.id && x.extractora_id === t.extractora_id && sonParecidos(x.numero, t.numero)).map((x) => `${x.numero} (pendiente)`),
  ];

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
                    {(r.has("número") || netoRevisar || r.has("fecha")) && (
                      <div className="space-y-1 rounded-xl border-2 border-error bg-error-suave p-3 text-sm text-error">
                        <p className="font-bold">Dato vital dudoso: {[r.has("número") && "N° de tiquete", netoRevisar && "peso neto", r.has("fecha") && "fecha"].filter(Boolean).join(", ")}. Verifíquelo dígito por dígito en la foto.</p>
                        {(t.datos_leidos as { nota_ia?: string } | null)?.nota_ia && <p>Duda de la lectura: {(t.datos_leidos as { nota_ia: string }).nota_ia}</p>}
                        {r.has("número") && (() => {
                          const p = parecidosDe(t);
                          return p.length > 0
                            ? <p className="font-semibold">Números parecidos ya registrados en {t.extractoras?.nombre}: {p.join(", ")}. Revise que no sea el mismo tiquete.</p>
                            : <p>No hay números parecidos registrados en {t.extractoras?.nombre}.</p>;
                        })()}
                      </div>
                    )}
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Dato etiqueta="N° tiquete" revisar={r.has("número")}>{t.numero}</Dato>
                      <Dato etiqueta="Comprador">{t.perfiles?.nombre}</Dato>
                      <Dato etiqueta="Fecha de entrada" revisar={r.has("fecha")}>
                        {fechaHora(t.fecha_entrada)}
                        <EtiquetaAntiguedad fecha={t.fecha_entrada} />
                      </Dato>
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
              <EnviarTiquete celular={t.perfiles?.celular ?? null} numero={t.numero}
                foto={t.imagen_ruta ? fotos[t.imagen_ruta] : undefined} fotoEnlace={t.imagen_ruta ? fotosEnlace[t.imagen_ruta] : undefined}
                mensaje={mensajeTiquete({ extractora: t.extractoras?.nombre ?? "", numero: t.numero, fecha: fechaHora(t.fecha_entrada), placa: t.placa,
                  proveedor: t.proveedor, toneladas: netoKg(t) / 1000, precio: null, valor: null, estado: "pendiente" })} />
              <AccionesPendiente tiquete={t} extractoras={extractoras ?? []} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
