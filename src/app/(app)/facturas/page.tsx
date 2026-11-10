import Link from "next/link";
import { Building2, Eye, FileSpreadsheet, FileText, HandCoins, Search, Upload, Users } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Vacio } from "@/components/ui";
import { consultarClientes, consultarCuentas, consultarFacturas, filtrosFacturasDesde, OPCIONES_ESTADO, totalesPor, type FiltrosFacturas } from "@/lib/facturas/consulta";
import { nitDigitos, NOMBRE_TIPO, TIPOS_FACTURA } from "@/lib/facturas/tipos";
import { ChipsFactura, ChipTipo } from "./estado";
import { enlaceCuenta, TarjetaCuenta } from "./tarjeta-cuenta";

/** Enlace a la misma página con los filtros cambiados (vacío = se quita el filtro). */
function conFiltros(f: FiltrosFacturas, cambios: Partial<FiltrosFacturas>) {
  const q = new URLSearchParams(Object.entries({ ...f, ...cambios }).filter(([, v]) => v));
  return q.size ? `/facturas?${q}` : "/facturas";
}

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.min(100, Math.round((parte / total) * 100)) : 0);

/**
 * Facturas de venta (módulo aparte de los tiquetes). Arriba, lo que debe cada CLIENTE a cada EMISOR
 * (cuentas independientes: facturas aprobadas − abonos, decisión del usuario 2026-11-10); luego
 * buscador, panel por emisor, lista y totales por mes.
 */
export default async function Facturas({ searchParams }: PageProps<"/facturas">) {
  const sp = await searchParams;
  const f = filtrosFacturasDesde((k) => (typeof sp[k] === "string" ? (sp[k] as string) : ""));
  const supabase = await supabaseServidor();
  const [{ filas, error }, clientes, cuentas, { data: opciones }] = await Promise.all([
    consultarFacturas(supabase, f),
    consultarClientes(supabase),
    consultarCuentas(supabase),
    supabase.from("fact_totales").select("dimension, clave").eq("dimension", "emisor").order("clave"),
  ]);
  // Cada cuenta es independiente: un saldo a favor en una no descuenta la deuda de otra.
  const deudaTotal = cuentas.reduce((s, c) => s + Math.max(0, c.deuda), 0);
  // Abonado y lo que le deben a cada emisor (todas sus cuentas, sin los filtros del buscador).
  const deEmisor = (nombre: string) => {
    const del = cuentas.filter((c) => c.emisor_nombre === nombre);
    return { abonado: del.reduce((s, c) => s + c.abonado, 0), leDeben: del.reduce((s, c) => s + Math.max(0, c.deuda), 0) };
  };
  const aprobadas = filas.filter((x) => !x.anulada);
  const totalFiltrado = aprobadas.reduce((s, x) => s + x.total_a_pagar, 0);
  const emisores = totalesPor(filas, "emisor");
  const porTipo = [...TIPOS_FACTURA, null].map((tipo) => {
    const del = aprobadas.filter((x) => x.tipo === tipo);
    return { tipo, facturas: del.length, total: del.reduce((s, x) => s + x.total_a_pagar, 0) };
  }).filter((t) => t.facturas > 0);
  const hayFiltros = Object.values(f).some(Boolean);
  const exportar = `/api/exportar/facturas?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Facturas</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/facturas/subir" className="boton-primario"><Upload className="size-5" aria-hidden /> Subir factura</Link>
          <Link href="/facturas/abonos/nuevo" className="boton-primario"><HandCoins className="size-5" aria-hidden /> Registrar abono</Link>
          <a href={exportar} className="boton-secundario" download><FileSpreadsheet className="size-5" aria-hidden /> Exportar a Excel</a>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-profundo"><Users className="size-5" aria-hidden /> Lo que me deben los clientes</h2>
            <p className="text-sm text-suave">Una cuenta por cada cliente con cada emisor (independientes): facturas aprobadas menos abonos.</p>
          </div>
          <p className="text-right"><span className="block text-xs text-suave">Total por cobrar</span><span className="text-xl font-black tabular-nums text-alerta">{formatoPesos(deudaTotal)}</span></p>
        </div>
        {cuentas.length === 0 ? <Vacio>Aún no hay cuentas: se crean al aprobar la primera factura.</Vacio> : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cuentas.map((c) => <TarjetaCuenta key={`${c.cliente_id}-${c.emisor_nit}`} c={c} />)}
          </ul>
        )}
      </section>

      <form className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <label className="sm:col-span-2"><span className="etiqueta">Buscar N° de factura o CUFE</span>
          <input name="buscar" defaultValue={f.buscar} className="campo" placeholder="Ej.: FEPA 12" />
        </label>
        <label><span className="etiqueta">Estado</span>
          <select name="estado" defaultValue={f.estado} className="campo"><option value="">Todas</option>{OPCIONES_ESTADO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
        <label><span className="etiqueta">Tipo</span>
          <select name="tipo" defaultValue={f.tipo} className="campo"><option value="">Todos</option>{TIPOS_FACTURA.map((t) => <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>)}</select>
        </label>
        <label><span className="etiqueta">Cliente</span>
          <select name="cliente" defaultValue={f.cliente} className="campo"><option value="">Todos</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        </label>
        <label><span className="etiqueta">Emisor</span>
          <select name="emisor" defaultValue={f.emisor} className="campo"><option value="">Todos</option>{(opciones ?? []).map((o) => <option key={o.clave} value={o.clave}>{o.clave}</option>)}</select>
        </label>
        <label><span className="etiqueta">Emitida desde</span><input type="date" name="desde" defaultValue={f.desde} className="campo" /></label>
        <label><span className="etiqueta">Emitida hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="campo" /></label>
        <div className="flex items-end gap-2">
          <button className="boton-primario"><Search className="size-5" aria-hidden /> Buscar</button>
          {hayFiltros && <Link href="/facturas" className="boton-secundario">Limpiar</Link>}
        </div>
      </form>

      {error && <Vacio>No se pudo cargar: {error}</Vacio>}

      {/* Total a pagar de las facturas aprobadas, por tipo (según los filtros). */}
      {porTipo.length > 0 && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {porTipo.map((t) => (
            <div key={t.tipo ?? "sin"} className="tarjeta space-y-1">
              <ChipTipo tipo={t.tipo} />
              <p className="text-lg font-black tabular-nums text-profundo sm:text-xl">{formatoPesos(t.total)}</p>
              <p className="text-xs text-suave">{t.facturas} factura{t.facturas === 1 ? "" : "s"} aprobada{t.facturas === 1 ? "" : "s"}</p>
            </div>
          ))}
        </section>
      )}

      {emisores.length > 0 && (
        <section className="space-y-2">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-profundo"><Building2 className="size-5" aria-hidden /> Por emisor</h2>
            <p className="text-sm text-suave">Total a pagar de las facturas aprobadas; abonado y «Le deben» suman todas sus cuentas. Toque un emisor para ver solo sus facturas.</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {emisores.map((e) => {
              const elegido = f.emisor === e.clave;
              const participa = porcentaje(e.total, totalFiltrado);
              const { abonado, leDeben } = deEmisor(e.clave);
              return (
                <li key={e.clave}>
                  <Link href={conFiltros(f, { emisor: elegido ? "" : e.clave })} className={`tarjeta block space-y-2 transition hover:shadow-md ${elegido ? "ring-2 ring-primario" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-profundo">{e.clave}</p>
                      <span className="shrink-0 text-xs text-suave">{e.facturas} factura{e.facturas === 1 ? "" : "s"}</span>
                    </div>
                    <p className="text-xl font-black tabular-nums text-profundo">{formatoPesos(e.total)}</p>
                    <div>
                      <div className="flex justify-between text-xs text-suave"><span>Participación · {e.kilos.toLocaleString("es-CO")} kg</span><span className="font-semibold">{participa} %</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-borde/60"><div className="h-full rounded-full bg-primario" style={{ width: `${participa}%` }} /></div>
                    </div>
                    <dl className="space-y-1 text-sm tabular-nums">
                      <div className="flex justify-between gap-2"><dt className="text-suave">Abonado</dt><dd className="font-semibold text-ok">{formatoPesos(abonado)}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-suave">Le deben</dt><dd className="font-semibold text-alerta">{formatoPesos(leDeben)}</dd></div>
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {filas.length === 0 ? <Vacio>No hay facturas con estos filtros.</Vacio> : (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-bold text-profundo"><FileText className="size-5" aria-hidden /> Facturas ({filas.length})</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {/* Fondo azul claro: se distinguen de las tarjetas de clientes y emisores. */}
            {filas.map((x) => (
              <li key={x.id} className={`space-y-3 rounded-2xl border-2 border-primario/25 bg-primario-suave p-4 shadow-sm sm:p-5 ${x.anulada ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-profundo">{x.numero_factura} · {x.cliente_nombre ?? x.extractora_razon_social ?? "—"}</p>
                    <p className="text-sm text-suave">{x.emisor_razon_social ?? "—"} · emitida {fecha(x.fecha_emision)} · vence {fecha(x.fecha_vencimiento)}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5"><ChipTipo tipo={x.tipo} /><ChipsFactura f={x} /></div>
                </div>
                {/* La descripción del ítem, a primera vista (decisión del usuario). */}
                <p className="line-clamp-2 rounded-lg bg-white/60 px-3 py-2 text-sm font-semibold text-profundo">{x.descripcion ?? "Sin descripción"}</p>
                <dl className="space-y-1 rounded-xl bg-white/80 p-3 text-sm tabular-nums">
                  <div className="flex justify-between gap-2"><dt className="text-suave">Subtotal + IVA</dt><dd className="font-semibold">{formatoPesos(x.subtotal + x.iva)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-suave">Retenciones</dt><dd className="font-semibold">− {formatoPesos(x.retefuente + x.reteiva + x.reteica)}</dd></div>
                  <div className="flex justify-between gap-2 border-t border-borde pt-1"><dt className="font-semibold text-profundo">Total a pagar</dt><dd className="font-black text-profundo">{formatoPesos(x.total_a_pagar)}</dd></div>
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/facturas/${x.id}`} className="boton-secundario min-h-10 text-sm"><Eye className="size-4" aria-hidden /> Ver detalle</Link>
                  {x.cliente_id && <Link href={enlaceCuenta({ cliente_id: x.cliente_id, emisor_nit: nitDigitos(x.emisor_nit) })} className="boton-secundario min-h-10 text-sm"><Users className="size-4" aria-hidden /> Cuenta del cliente</Link>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aprobadas.length > 0 && (
        <section className="tarjeta overflow-x-auto p-0">
          <p className="p-3 font-bold text-profundo">Totales por mes de emisión</p>
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-profundo text-left text-white"><tr><th className="p-2">Mes</th><th className="p-2 text-right">Facturas</th><th className="p-2 text-right">Total a pagar</th></tr></thead>
            <tbody>
              {totalesPor(filas, "mes").map((t) => (
                <tr key={t.clave} className="border-t border-borde/60">
                  <td className="p-2">{t.clave}<span className="block text-xs text-suave">{t.kilos.toLocaleString("es-CO")} kg</span></td>
                  <td className="p-2 text-right">{t.facturas}</td>
                  <td className="p-2 text-right font-semibold">{formatoPesos(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
