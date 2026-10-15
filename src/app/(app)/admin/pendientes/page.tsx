import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fechaHora } from "@/lib/fechas";
import { formatoToneladas } from "@/lib/numeros";
import { Chip, Dato, Vacio } from "@/components/ui";
import { AccionesPendiente } from "./acciones-pendiente";

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
                {t.requiere_revision && <Chip tono="alerta">{t.motivo_revision ?? "Revisar"}</Chip>}
                <Chip tono={t.origen === "camara" ? "primario" : "alerta"}>{t.origen === "camara" ? "Cámara" : "Galería"}</Chip>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Dato etiqueta="Comprador">{t.perfiles?.nombre}</Dato>
                <Dato etiqueta="Fecha de entrada">{fechaHora(t.fecha_entrada)}</Dato>
                <Dato etiqueta="Placa">{t.placa ?? "—"}</Dato>
                <Dato etiqueta="Bruto">{formatoToneladas(t.peso_bruto_kg / 1000)}</Dato>
                <Dato etiqueta="Tara">{formatoToneladas(t.tara_kg / 1000)}</Dato>
                <Dato etiqueta="Neto">{formatoToneladas((t.peso_bruto_kg - t.tara_kg) / 1000)}</Dato>
                {t.neto_impreso_kg != null && <Dato etiqueta="Neto impreso">{formatoToneladas(t.neto_impreso_kg / 1000)}</Dato>}
                {t.conductor && <Dato etiqueta="Conductor">{t.conductor}</Dato>}
                {t.bascula && <Dato etiqueta="Báscula">{t.bascula}</Dato>}
                <Dato etiqueta="Subido">{fechaHora(t.cargado_en)}</Dato>
              </dl>
              <AccionesPendiente tiquete={t} extractoras={extractoras ?? []} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
