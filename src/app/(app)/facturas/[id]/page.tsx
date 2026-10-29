import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Chip, Dato, Mensaje, Vacio } from "@/components/ui";
import type { EstadoCobro, FacturaLeida } from "@/lib/facturas/tipos";
import { actualizarFactura, anularAbono, anularFactura, registrarAbono, revertirAnulacion } from "../acciones";
import { ChipsFactura } from "../estado";
import { ConMotivo, CorregirFactura, FormAbono } from "./formularios";

/** Detalle de una factura: datos, cobro, abonos (con retenciones) y anulaciones con motivo. */
export default async function DetalleFactura({ params }: PageProps<"/facturas/[id]">) {
  const { id } = await params;
  const supabase = await supabaseServidor();
  const [{ data: f }, { data: pagos }] = await Promise.all([
    supabase.from("fact_facturas_estado").select("*").eq("id", id).maybeSingle(),
    supabase.from("fact_pagos").select("*").eq("factura_id", id).order("fecha_pago").order("created_at"),
  ]);
  if (!f) notFound();
  const abonos = pagos ?? [];
  const { data: auditoria } = await supabase.from("fact_auditoria").select("*")
    .in("entidad_id", [id, ...abonos.map((p) => p.id)]).order("fecha", { ascending: false });
  const historia = auditoria ?? [];
  const vigentes = abonos.filter((p) => p.estado === "VIGENTE");
  const { data: archivo } = f.archivo_path ? await supabase.storage.from("facturas").createSignedUrl(f.archivo_path, 60 * 30) : { data: null };
  const n = (x: unknown) => Number(x ?? 0);
  const datos: FacturaLeida = {
    numero_factura: f.numero_factura, cufe: f.cufe, emisor_razon_social: f.emisor_razon_social, emisor_nit: f.emisor_nit,
    extractora_razon_social: f.extractora_razon_social, extractora_nit: f.extractora_nit, fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento, periodo_desde: f.periodo_desde, periodo_hasta: f.periodo_hasta,
    kilos: f.kilos == null ? null : n(f.kilos), precio_kilo: f.precio_kilo == null ? null : n(f.precio_kilo), subtotal: n(f.subtotal), iva: n(f.iva),
    total_retenciones_esperadas: n(f.total_retenciones_esperadas), total_a_pagar: n(f.total_a_pagar),
  };
  const enRevision = f.estado_lectura === "PENDIENTE_REVISION";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Factura {f.numero_factura}</h1>
        <Link href="/facturas" className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a facturas</Link>
      </div>
      <ChipsFactura f={{ ...f, estado_cobro: f.estado_cobro as EstadoCobro, dias_mora: n(f.dias_mora) }} />
      {f.anulada && <Mensaje tono="error">Factura ANULADA el {fechaHora(f.anulada_at)}. Motivo: {f.anulada_motivo}</Mensaje>}
      {enRevision && <Mensaje tono="error">Pendiente de revisión: {f.motivo_revision ?? "verifique los datos"}. Corrija abajo y guarde.</Mensaje>}
      {f.alerta_sobrepago && <Mensaje tono="alerta">Sobrepago: lo aplicado ({formatoPesos(f.total_aplicado)}) supera el subtotal + IVA ({formatoPesos(f.total_cobrar)}).</Mensaje>}
      {f.alerta_retenciones && <Mensaje tono="alerta">Retenciones practicadas ({formatoPesos(f.retenciones_practicadas)}) distintas de las esperadas ({formatoPesos(f.total_retenciones_esperadas)}).</Mensaje>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="tarjeta"><p className="text-sm text-suave">Subtotal + IVA</p><p className="text-lg font-black text-profundo sm:text-2xl">{formatoPesos(f.total_cobrar)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Aplicado</p><p className="text-lg font-black text-ok sm:text-2xl">{formatoPesos(f.total_aplicado)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Saldo pendiente</p><p className={`text-lg font-black sm:text-2xl ${n(f.saldo_pendiente) > 1 ? "text-alerta" : "text-ok"}`}>{formatoPesos(f.saldo_pendiente)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Total a pagar (neto)</p><p className="text-lg font-black text-profundo sm:text-2xl">{formatoPesos(f.total_a_pagar)}</p></div>
      </section>

      <section className="tarjeta space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-profundo">Datos de la factura</h2>
          {archivo?.signedUrl && <a href={archivo.signedUrl} target="_blank" rel="noopener noreferrer" className="boton-secundario min-h-9 text-sm"><FileText className="size-4" aria-hidden /> Ver archivo ({f.tipo_archivo})</a>}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Dato etiqueta="Emisor">{f.emisor_razon_social ?? "—"}<span className="block text-xs text-suave">NIT {f.emisor_nit ?? "—"}</span></Dato>
          <Dato etiqueta="Extractora">{f.extractora_razon_social ?? "—"}<span className="block text-xs text-suave">NIT {f.extractora_nit ?? "—"}</span></Dato>
          <Dato etiqueta="Emisión / vencimiento">{fecha(f.fecha_emision)} · {fecha(f.fecha_vencimiento)}</Dato>
          <Dato etiqueta="Periodo">{fecha(f.periodo_desde)} al {fecha(f.periodo_hasta)}</Dato>
          <Dato etiqueta="Kilos × precio">{n(f.kilos).toLocaleString("es-CO")} kg × {formatoPesos(f.precio_kilo)}</Dato>
          <Dato etiqueta="Subtotal · IVA">{formatoPesos(f.subtotal)} · {formatoPesos(f.iva)}</Dato>
          <Dato etiqueta="Retenciones esperadas">{formatoPesos(f.total_retenciones_esperadas)}<span className="block text-xs text-suave">practicadas {formatoPesos(f.retenciones_practicadas)}</span></Dato>
          <Dato etiqueta="Estado de la lectura">{enRevision ? "Pendiente de revisión" : "Confirmada"}</Dato>
        </dl>
        <p className="break-all text-xs text-suave">CUFE: {f.cufe ?? "—"}</p>
        {!f.anulada && (
          <details open={enRevision}>
            <summary className="cursor-pointer font-semibold text-primario">Corregir datos</summary>
            <div className="mt-3"><CorregirFactura accion={actualizarFactura.bind(null, id)} inicial={datos} /></div>
          </details>
        )}
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="font-bold text-profundo">Abonos ({vigentes.length} vigente{vigentes.length === 1 ? "" : "s"})</h2>
        {abonos.length === 0 && <Vacio>Aún no hay abonos.</Vacio>}
        <ul className="space-y-3">
          {abonos.map((p) => (
            <li key={p.id} className={`rounded-xl border p-3 ${p.estado === "ANULADO" ? "border-borde bg-white/40 opacity-70" : "border-borde"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-profundo">{formatoPesos(p.valor_aplicado)} aplicado · {fecha(p.fecha_pago)}</p>
                  <p className="text-sm text-suave">
                    Recibido {formatoPesos(p.valor_recibido)} · Retefuente {formatoPesos(p.retefuente)} · ReteIVA {formatoPesos(p.reteiva)} · ReteICA {formatoPesos(p.reteica)}
                    {n(p.otros_descuentos) > 0 && ` · Otros ${formatoPesos(p.otros_descuentos)}`}
                  </p>
                  <p className="text-xs text-suave">{[p.forma_pago, p.referencia, p.certificado_recibido ? `certificado recibido ${fecha(p.fecha_certificado)}` : "sin certificado", p.observaciones].filter(Boolean).join(" · ")}</p>
                </div>
                <Chip tono={p.estado === "VIGENTE" ? "ok" : "neutro"}>{p.estado === "VIGENTE" ? "Vigente" : "Anulado"}</Chip>
              </div>
              {p.estado === "ANULADO" ? <p className="mt-1 text-xs text-error">Anulado {fechaHora(p.anulado_at)}: {p.anulado_motivo}</p> : (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-error">Anular abono</summary>
                  <div className="mt-2"><ConMotivo accion={anularAbono.bind(null, p.id)} boton="Anular abono" placeholder="Ej.: valor mal digitado"
                    pregunta={`Va a anular el abono de ${formatoPesos(p.valor_aplicado)}. El saldo se recalcula solo.`} /></div>
                </details>
              )}
            </li>
          ))}
        </ul>
        {!f.anulada && (
          <details>
            <summary className="cursor-pointer font-semibold text-primario">Registrar abono</summary>
            <div className="mt-3"><FormAbono accion={registrarAbono.bind(null, id)} saldo={n(f.saldo_pendiente)} /></div>
          </details>
        )}
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="font-bold text-profundo">{f.anulada ? "Revertir anulación" : "Anular factura"}</h2>
        {f.anulada ? (
          <ConMotivo accion={revertirAnulacion.bind(null, id)} boton="Revertir anulación" placeholder="Ej.: se anuló por error"
            pregunta="La factura volverá a estar activa y su estado de cobro se recalculará." />
        ) : vigentes.length > 0 ? (
          <p className="text-sm text-suave">Para anular la factura, primero anule sus {vigentes.length} abono(s) vigente(s).</p>
        ) : (
          <ConMotivo accion={anularFactura.bind(null, id)} boton="Anular factura" placeholder="Ej.: factura mal emitida"
            pregunta={`Va a anular la factura ${f.numero_factura}. No podrá recibir abonos (se puede revertir con motivo).`} />
        )}
      </section>

      {historia.length > 0 && (
        <section className="tarjeta space-y-2">
          <h2 className="font-bold text-profundo">Auditoría</h2>
          <ul className="space-y-1 text-sm">
            {historia.map((a) => (
              <li key={a.id} className="text-suave"><span className="font-semibold text-texto">{fechaHora(a.fecha)}</span> · {a.entidad} · {a.accion.replace("_", " ")}{a.motivo ? ` · ${a.motivo}` : ""}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
