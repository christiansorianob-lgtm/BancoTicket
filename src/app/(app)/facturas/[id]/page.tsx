import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Users } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Dato, Mensaje } from "@/components/ui";
import { formatoNit, nitDigitos, NOMBRE_TIPO, type FacturaLeida, type TipoFactura } from "@/lib/facturas/tipos";
import { actualizarFactura, anularFactura, eliminarFactura } from "../acciones";
import { ChipsFactura } from "../estado";
import { ComprobacionFactura } from "../comprobacion";
import { leerConfiguracion } from "@/lib/config";
import { ConMotivo, CorregirFactura } from "./formularios";

/**
 * Detalle de una factura: datos, comprobación de cálculos, corregir y anular / eliminar. Los abonos
 * se hacen al cliente (decisión del usuario), desde su cuenta.
 */
export default async function DetalleFactura({ params }: PageProps<"/facturas/[id]">) {
  const { id } = await params;
  const supabase = await supabaseServidor();
  const [{ data: f }, { data: auditoria }, { data: clientes }] = await Promise.all([
    supabase.from("fact_facturas_estado").select("*").eq("id", id).maybeSingle(),
    supabase.from("fact_auditoria").select("*").eq("entidad_id", id).order("fecha", { ascending: false }),
    supabase.from("fact_clientes").select("nit, nombre"),
  ]);
  if (!f) notFound();
  const historia = auditoria ?? [];
  const { data: archivo } = f.archivo_path ? await supabase.storage.from("facturas").createSignedUrl(f.archivo_path, 60 * 30) : { data: null };
  const n = (x: unknown) => Number(x ?? 0);
  const pct = (x: unknown) => (x == null ? null : Number(x));
  const datos: FacturaLeida = {
    numero_factura: f.numero_factura, cufe: f.cufe, emisor_razon_social: f.emisor_razon_social, emisor_nit: f.emisor_nit,
    extractora_razon_social: f.extractora_razon_social, extractora_nit: f.extractora_nit, fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento, periodo_desde: f.periodo_desde, periodo_hasta: f.periodo_hasta,
    kilos: f.kilos == null ? null : n(f.kilos), precio_kilo: f.precio_kilo == null ? null : n(f.precio_kilo), subtotal: n(f.subtotal), iva: n(f.iva),
    retefuente: n(f.retefuente), reteiva: n(f.reteiva), reteica: n(f.reteica), total_a_pagar: n(f.total_a_pagar),
    iva_pct: pct(f.iva_pct), retefuente_pct: pct(f.retefuente_pct), reteiva_pct: pct(f.reteiva_pct), reteica_pct: pct(f.reteica_pct),
    descripcion: f.descripcion, tipo: f.tipo,
  };
  const { tarifas_factura: tarifas } = await leerConfiguracion();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Factura {f.numero_factura}</h1>
        <div className="flex flex-wrap gap-2">
          {f.cliente_id && <Link href={`/facturas/clientes/${f.cliente_id}?emisor=${nitDigitos(f.emisor_nit)}`} className="boton-primario min-h-9 text-sm"><Users className="size-4" aria-hidden /> Cuenta del cliente</Link>}
          <Link href="/facturas" className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a facturas</Link>
        </div>
      </div>
      <ChipsFactura f={f} />
      {f.anulada && <Mensaje tono="error">Factura ANULADA el {fechaHora(f.anulada_at)}: no suma a la deuda del cliente. Motivo: {f.anulada_motivo}</Mensaje>}
      {!f.anulada && f.motivo_revision && <Mensaje tono="alerta">Aprobada con diferencias en la comprobación: {f.motivo_revision}.</Mensaje>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="tarjeta"><p className="text-sm text-suave">Subtotal + IVA</p><p className="text-lg font-black text-profundo sm:text-2xl">{formatoPesos(n(f.subtotal) + n(f.iva))}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Retenciones</p><p className="text-lg font-black text-profundo sm:text-2xl">{formatoPesos(n(f.retefuente) + n(f.reteiva) + n(f.reteica))}</p></div>
        <div className="tarjeta col-span-2 md:col-span-1"><p className="text-sm text-suave">Total a pagar (suma a la deuda del cliente)</p><p className="text-lg font-black text-alerta sm:text-2xl">{formatoPesos(f.total_a_pagar)}</p></div>
      </section>

      <section className="tarjeta space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-profundo">Datos de la factura</h2>
          {archivo?.signedUrl && <a href={archivo.signedUrl} target="_blank" rel="noopener noreferrer" className="boton-secundario min-h-9 text-sm"><FileText className="size-4" aria-hidden /> Ver archivo ({f.tipo_archivo})</a>}
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Dato etiqueta="Emisor">{f.emisor_razon_social ?? "—"}<span className="block text-xs text-suave">NIT {f.emisor_nit ?? "—"}</span></Dato>
          <Dato etiqueta="Cliente">{f.cliente_nombre ?? f.extractora_razon_social ?? "—"}<span className="block text-xs text-suave">NIT {formatoNit(f.cliente_nit ?? f.extractora_nit)}</span></Dato>
          <Dato etiqueta="Emisión / vencimiento">{fecha(f.fecha_emision)} · {fecha(f.fecha_vencimiento)}</Dato>
          <Dato etiqueta="Periodo">{fecha(f.periodo_desde)} al {fecha(f.periodo_hasta)}</Dato>
          <Dato etiqueta="Kilos × precio">{n(f.kilos).toLocaleString("es-CO")} kg × {formatoPesos(f.precio_kilo)}</Dato>
          <Dato etiqueta="Subtotal (total bruto)">{formatoPesos(f.subtotal)}</Dato>
          <Dato etiqueta="IVA">{formatoPesos(f.iva)}{f.iva_pct != null && <span className="block text-xs text-suave">{Number(f.iva_pct).toLocaleString("es-CO")} % impreso</span>}</Dato>
          <Dato etiqueta="ReteFuente">{formatoPesos(f.retefuente)}{f.retefuente_pct != null && <span className="block text-xs text-suave">{Number(f.retefuente_pct).toLocaleString("es-CO")} % impreso</span>}</Dato>
          <Dato etiqueta="ReteIVA">{formatoPesos(f.reteiva)}{f.reteiva_pct != null && <span className="block text-xs text-suave">{Number(f.reteiva_pct).toLocaleString("es-CO")} % impreso</span>}</Dato>
          <Dato etiqueta="ReteICA">{formatoPesos(f.reteica)}{f.reteica_pct != null && <span className="block text-xs text-suave">{Number(f.reteica_pct).toLocaleString("es-CO")} % impreso</span>}</Dato>
          <Dato etiqueta="Estado">{f.anulada ? "Anulada" : "Aprobada"}</Dato>
          <Dato etiqueta="Tipo">{f.tipo ? NOMBRE_TIPO[f.tipo as TipoFactura] : "Sin clasificar"}</Dato>
        </dl>
        <div className="rounded-xl bg-primario-suave p-3"><p className="text-xs font-semibold text-suave">Descripción</p><p className="font-semibold text-profundo">{f.descripcion ?? "—"}</p></div>
        <p className="break-all text-xs text-suave">CUFE: {f.cufe ?? "—"}</p>
        <ComprobacionFactura datos={datos} tarifas={tarifas} />
        {!f.anulada && (
          <details>
            <summary className="cursor-pointer font-semibold text-primario">Corregir datos</summary>
            <div className="mt-3"><CorregirFactura accion={actualizarFactura.bind(null, id)} inicial={datos} tarifas={tarifas} clientes={clientes ?? []} /></div>
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
        ) : (
          <ConMotivo accion={anularFactura.bind(null, id)} boton="Anular factura" placeholder="Ej.: el contador indicó anularla"
            pregunta={`Va a anular la factura ${f.numero_factura}: dejará de sumar a la deuda del cliente. Después podrá eliminarla.`} />
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
