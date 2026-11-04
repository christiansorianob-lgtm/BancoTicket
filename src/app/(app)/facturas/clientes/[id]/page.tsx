import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet, FileText, HandCoins, Paperclip } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Chip, Vacio } from "@/components/ui";
import { cuentaCliente } from "@/lib/facturas/cuenta";
import { formatoNit, NOMBRE_FORMA_PAGO } from "@/lib/facturas/tipos";
import { anularAbono, eliminarAbono } from "../../acciones";
import { ConMotivo } from "../../[id]/formularios";

/**
 * Cuenta del cliente (decisión del usuario): facturas aprobadas suben la deuda, abonos la bajan.
 * Movimientos por fecha con el saldo acumulado, como un extracto. Los anulados se ven pero no cuentan.
 */
export default async function CuentaCliente({ params }: PageProps<"/facturas/clientes/[id]">) {
  const { id } = await params;
  const supabase = await supabaseServidor();
  const cuenta = await cuentaCliente(supabase, id);
  if (!cuenta) notFound();
  const { cliente: c, movimientos } = cuenta;
  const rutas = movimientos.map((m) => m.soporte_path).filter((r): r is string => !!r);
  const { data: firmadas } = rutas.length ? await supabase.storage.from("facturas").createSignedUrls(rutas, 60 * 30) : { data: [] };
  const urlDe = (ruta: string | null | undefined) => firmadas?.find((x) => x.path === ruta)?.signedUrl;
  const debe = c.deuda > 1, aFavor = c.deuda < -1;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Cuenta del cliente</h1>
        <Link href="/facturas" className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a facturas</Link>
      </div>

      <section className="tarjeta space-y-3">
        <div>
          <p className="text-lg font-black text-profundo">{c.nombre}</p>
          <p className="text-sm text-suave">NIT {formatoNit(c.nit)}</p>
        </div>
        <div className={`rounded-xl p-3 ${debe ? "bg-alerta-suave" : "bg-ok-suave"}`}>
          <p className="text-sm font-semibold text-suave">{debe ? "Le debe" : aFavor ? "Saldo a favor del cliente" : "Cuenta al día"}</p>
          <p className={`text-3xl font-black tabular-nums ${debe ? "text-alerta" : "text-ok"}`}>{formatoPesos(Math.abs(c.deuda))}</p>
          {c.facturas_vencidas > 0 && <p className="mt-1 text-sm font-semibold text-error">{c.facturas_vencidas} factura(s) con vencimiento pasado sin cubrir</p>}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm tabular-nums sm:grid-cols-4">
          <div><dt className="text-suave">Facturas aprobadas</dt><dd className="font-bold">{c.facturas}</dd></div>
          <div><dt className="text-suave">Total facturado</dt><dd className="font-bold">{formatoPesos(c.facturado)}</dd></div>
          <div><dt className="text-suave">Total abonado</dt><dd className="font-bold text-ok">{formatoPesos(c.abonado)}</dd></div>
          <div><dt className="text-suave">Último abono</dt><dd className="font-bold">{c.ultimo_abono ? fecha(c.ultimo_abono) : "—"}</dd></div>
        </dl>
        <div className="grid gap-2 sm:flex">
          <Link href={`/facturas/abonos/nuevo?cliente=${c.id}`} className="boton-primario"><HandCoins className="size-5" aria-hidden /> Registrar abono</Link>
          <a href={`/api/exportar/cuenta-cliente?id=${c.id}`} className="boton-secundario" download><FileSpreadsheet className="size-5" aria-hidden /> Exportar a Excel</a>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-profundo">Movimientos</h2>
        {movimientos.length === 0 ? <Vacio>Sin movimientos.</Vacio> : (
          <ol className="space-y-2">
            {movimientos.map((m) => (
              <li key={m.id} className={`rounded-2xl border-2 p-3 ${m.tipo === "factura" ? "border-primario/25 bg-primario-suave" : "border-ok/30 bg-ok-suave"} ${m.vigente ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-bold text-profundo">
                      {m.tipo === "factura" ? <FileText className="size-4" aria-hidden /> : <HandCoins className="size-4" aria-hidden />}
                      {m.tipo === "factura" ? <Link href={`/facturas/${m.id}`} className="underline">{m.detalle}</Link> : `Abono · ${NOMBRE_FORMA_PAGO[m.forma_pago!]}`}
                    </p>
                    <p className="text-sm text-suave">
                      {fecha(m.fecha)}{m.tipo === "factura" ? ` · ${m.emisor ?? "—"} · vence ${fecha(m.vence)}` : ` · ${m.realizado_por}${m.referencia ? ` · Ref. ${m.referencia}` : ""}`}
                    </p>
                    {m.observacion && <p className="text-sm text-texto">{m.observacion}</p>}
                  </div>
                  <div className="text-right tabular-nums">
                    <p className={`font-black ${m.tipo === "factura" ? "text-profundo" : "text-ok"}`}>{m.tipo === "factura" ? "+" : "−"} {formatoPesos(m.cargo || m.abono)}</p>
                    <p className="text-xs text-suave">Saldo: <b className="text-texto">{formatoPesos(m.saldo)}</b></p>
                  </div>
                </div>
                {!m.vigente && <div className="mt-1"><Chip tono="error">{m.tipo === "factura" ? "Factura anulada · no suma" : `Anulado ${fechaHora(m.anulado_at)}: ${m.anulado_motivo}`}</Chip></div>}
                {m.tipo === "abono" && (
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    {urlDe(m.soporte_path) && <a href={urlDe(m.soporte_path) ?? undefined} target="_blank" rel="noopener noreferrer" className="boton-secundario min-h-9 text-sm"><Paperclip className="size-4" aria-hidden /> Ver soporte</a>}
                    <details className="w-full">
                      <summary className="cursor-pointer text-sm font-semibold text-error">{m.vigente ? "Anular abono" : "Eliminar abono"}</summary>
                      <div className="mt-2">
                        {m.vigente ? (
                          <ConMotivo accion={anularAbono.bind(null, m.id)} boton="Anular abono" placeholder="Ej.: valor mal digitado"
                            pregunta={`Va a anular el abono de ${formatoPesos(m.abono)}: la deuda del cliente sube otra vez. Después podrá eliminarlo.`} />
                        ) : (
                          <ConMotivo accion={eliminarAbono.bind(null, m.id)} boton="Eliminar abono" placeholder="Ej.: se registró de nuevo"
                            pregunta={`Va a eliminar el abono anulado de ${formatoPesos(m.abono)} y su soporte. No se puede deshacer.`} />
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
