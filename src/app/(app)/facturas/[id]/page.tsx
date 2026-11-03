import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, HandCoins } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Chip, Dato, Mensaje, Vacio } from "@/components/ui";
import type { EstadoCobro, FacturaLeida } from "@/lib/facturas/tipos";
import { actualizarFactura, anularAbono, anularFactura, eliminarFactura, registrarAbono } from "../acciones";
import { ChipsFactura } from "../estado";
import { ComprobacionFactura } from "../comprobacion";
import { leerConfiguracion } from "@/lib/config";
import { ConMotivo, CorregirFactura, FormAbono } from "./formularios";

/** Detalle de una factura: datos, cobro, abonos (con retenciones) y anulaciones con motivo. */
export default async function DetalleFactura({ params, searchParams }: PageProps<"/facturas/[id]">) {
  const { id } = await params;
  // ?abonar=1 (botón «Registrar abono» de la lista o de arriba): llega con el formulario abierto.
  const abrirAbono = (await searchParams).abonar === "1";
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
    retefuente: n(f.retefuente), reteiva: n(f.reteiva), reteica: n(f.reteica), total_a_pagar: n(f.total_a_pagar),
  };
  const { tarifas_factura: tarifas } = await leerConfiguracion();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Factura {f.numero_factura}</h1>
        <div className="flex flex-wrap gap-2">
          {!f.anulada && n(f.saldo_pendiente) > 1 && (
            <Link href={`/facturas/${id}?abonar=1#abonos`} className="boton-primario min-h-9 text-sm"><HandCoins className="size-4" aria-hidden /> Registrar abono</Link>
          )}
          <Link href="/facturas" className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a facturas</Link>
        </div>
      </div>
      <ChipsFactura f={{ ...f, estado_cobro: f.estado_cobro as EstadoCobro, dias_mora: n(f.dias_mora) }} />
      {f.anulada && <Mensaje tono="error">Factura ANULADA el {fechaHora(f.anulada_at)}: no suma en los totales. Motivo: {f.anulada_motivo}</Mensaje>}
      {!f.anulada && f.motivo_revision && <Mensaje tono="alerta">Aprobada con diferencias en la comprobación: {f.motivo_revision}.</Mensaje>}
      {f.alerta_sobrepago && <Mensaje tono="alerta">Sobrepago: lo aplicado ({formatoPesos(f.total_aplicado)}) supera el subtotal + IVA ({formatoPesos(f.total_cobrar)}).</Mensaje>}
      {f.alerta_retenciones && (
        <Mensaje tono="alerta">
          Retenciones que no coinciden: {([["ReteFuente", f.retefuente_practicada, f.retefuente], ["ReteIVA", f.reteiva_practicada, f.reteiva], ["ReteICA", f.reteica_practicada, f.reteica]] as const)
            .filter(([, p, e]) => Math.abs(n(p) - n(e)) > 1)
            .map(([nombre, p, e]) => `${nombre} practicada ${formatoPesos(p)}, esperada ${formatoPesos(e)}`).join(" · ")}.
        </Mensaje>
      )}

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
          <Dato etiqueta="Subtotal (total bruto)">{formatoPesos(f.subtotal)}</Dato>
          <Dato etiqueta="IVA">{formatoPesos(f.iva)}</Dato>
          <Dato etiqueta="ReteFuente">{formatoPesos(f.retefuente)}<span className="block text-xs text-suave">practicada {formatoPesos(f.retefuente_practicada)}</span></Dato>
          <Dato etiqueta="ReteIVA">{formatoPesos(f.reteiva)}<span className="block text-xs text-suave">practicada {formatoPesos(f.reteiva_practicada)}</span></Dato>
          <Dato etiqueta="ReteICA">{formatoPesos(f.reteica)}<span className="block text-xs text-suave">practicada {formatoPesos(f.reteica_practicada)}</span></Dato>
          <Dato etiqueta="Estado">{f.anulada ? "Anulada" : "Aprobada"}</Dato>
        </dl>
        <p className="break-all text-xs text-suave">CUFE: {f.cufe ?? "—"}</p>
        <ComprobacionFactura datos={datos} tarifas={tarifas} />
        {!f.anulada && (
          <details>
            <summary className="cursor-pointer font-semibold text-primario">Corregir datos</summary>
            <div className="mt-3"><CorregirFactura accion={actualizarFactura.bind(null, id)} inicial={datos} tarifas={tarifas} /></div>
          </details>
        )}
      </section>

      <section id="abonos" className="tarjeta scroll-mt-4 space-y-3">
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
          <details open={abrirAbono}>
            <summary className="boton-primario w-full cursor-pointer list-none sm:w-auto [&::-webkit-details-marker]:hidden"><HandCoins className="size-5" aria-hidden /> Registrar abono</summary>
            <div className="mt-3"><FormAbono accion={registrarAbono.bind(null, id)} saldo={n(f.saldo_pendiente)} /></div>
          </details>
        )}
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="font-bold text-profundo">{f.anulada ? "Eliminar factura" : "Anular factura"}</h2>
        {f.anulada ? (
          <>
            <p className="text-sm text-suave">Se borra la factura con su archivo para no dejar registros sin uso. Si hace falta, se sube de nuevo. Queda constancia en la auditoría.</p>
            <ConMotivo accion={eliminarFactura.bind(null, id)} boton="Eliminar factura" placeholder="Ej.: se subirá de nuevo corregida"
              pregunta={`Va a eliminar la factura ${f.numero_factura} y su archivo. No se puede deshacer.`} />
          </>
        ) : vigentes.length > 0 ? (
          <p className="text-sm text-suave">
            Esta factura tiene {vigentes.length} abono(s) vigente(s) ({f.estado_cobro === "PAGADA" ? "Pagada" : "Abonada parcial"}): no se puede anular ni eliminar.
            Si un abono fue un error, anúlelo primero.
          </p>
        ) : (
          <ConMotivo accion={anularFactura.bind(null, id)} boton="Anular factura" placeholder="Ej.: el contador indicó anularla"
            pregunta={`Va a anular la factura ${f.numero_factura}: dejará de sumar en los totales. Después podrá eliminarla.`} />
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
