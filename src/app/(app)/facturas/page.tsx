import Link from "next/link";
import { Building2, FileSpreadsheet, Search, Upload } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Vacio } from "@/components/ui";
import { consultarFacturas, filtrosFacturasDesde, OPCIONES_ESTADO, totalesPor, type FiltrosFacturas } from "@/lib/facturas/consulta";
import { ChipsFactura } from "./estado";

/** Enlace a la misma página con los filtros cambiados (vacío = se quita el filtro). */
function conFiltros(f: FiltrosFacturas, cambios: Partial<FiltrosFacturas>) {
  const q = new URLSearchParams(Object.entries({ ...f, ...cambios }).filter(([, v]) => v));
  return q.size ? `/facturas?${q}` : "/facturas";
}

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

/**
 * Facturas de venta (módulo aparte de los tiquetes): buscador, resumen, panel por emisor, lista con
 * estado (Aprobada / Anulada) y cobro, y totales. Las anuladas no suman. Todo en la misma pestaña.
 */
export default async function Facturas({ searchParams }: PageProps<"/facturas">) {
  const sp = await searchParams;
  const f = filtrosFacturasDesde((k) => (typeof sp[k] === "string" ? (sp[k] as string) : ""));
  const supabase = await supabaseServidor();
  const [{ filas, error }, { data: opciones }] = await Promise.all([
    consultarFacturas(supabase, f),
    supabase.from("fact_totales").select("dimension, clave").order("clave"),
  ]);
  const de = (d: string) => (opciones ?? []).filter((t) => t.dimension === d).map((t) => t.clave as string);
  const aprobadas = filas.filter((x) => x.estado_cobro !== "ANULADA");
  const suma = (k: "total_cobrar" | "total_aplicado" | "saldo_pendiente") => aprobadas.reduce((s, x) => s + x[k], 0);
  const emisores = totalesPor(filas, "emisor");
  const totalFacturado = suma("total_cobrar");
  const hayFiltros = Object.values(f).some(Boolean);
  const exportar = `/api/exportar/facturas?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Facturas</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/facturas/subir" className="boton-primario"><Upload className="size-5" aria-hidden /> Subir factura</Link>
          <a href={exportar} className="boton-secundario" download><FileSpreadsheet className="size-5" aria-hidden /> Exportar a Excel</a>
        </div>
      </div>

      <form className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <label className="sm:col-span-2"><span className="etiqueta">Buscar N° de factura o CUFE</span>
          <input name="buscar" defaultValue={f.buscar} className="campo" placeholder="Ej.: FEPA 12" />
        </label>
        <label><span className="etiqueta">Estado</span>
          <select name="estado" defaultValue={f.estado} className="campo"><option value="">Todas</option>{OPCIONES_ESTADO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
        <label><span className="etiqueta">Emisor</span>
          <select name="emisor" defaultValue={f.emisor} className="campo"><option value="">Todos</option>{de("emisor").map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label><span className="etiqueta">Extractora</span>
          <select name="extractora" defaultValue={f.extractora} className="campo"><option value="">Todas</option>{de("extractora").map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label><span className="etiqueta">Emitida desde</span><input type="date" name="desde" defaultValue={f.desde} className="campo" /></label>
        <label><span className="etiqueta">Emitida hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="campo" /></label>
        <label className="flex items-center gap-2 self-end pb-3"><input type="checkbox" name="vencida" value="1" defaultChecked={!!f.vencida} className="size-5" /> Solo vencidas</label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
          <button className="boton-primario"><Search className="size-5" aria-hidden /> Buscar</button>
          {hayFiltros && <Link href="/facturas" className="boton-secundario">Limpiar</Link>}
        </div>
      </form>

      {error && <Vacio>No se pudo cargar: {error}</Vacio>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="tarjeta"><p className="text-sm text-suave">Facturas aprobadas</p><p className="text-lg font-black text-profundo sm:text-2xl">{aprobadas.length}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Facturado (subtotal + IVA)</p><p className="text-lg font-black text-profundo sm:text-2xl">{formatoPesos(totalFacturado)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Pagado (aplicado)</p><p className="text-lg font-black text-ok sm:text-2xl">{formatoPesos(suma("total_aplicado"))}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Saldo pendiente</p><p className="text-lg font-black text-alerta sm:text-2xl">{formatoPesos(suma("saldo_pendiente"))}</p></div>
      </section>

      {emisores.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-bold text-profundo"><Building2 className="size-5" aria-hidden /> Por emisor <span className="text-sm font-normal text-suave">· toque uno para ver solo sus facturas</span></h2>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {emisores.map((e) => {
              const elegido = f.emisor === e.clave;
              const participa = porcentaje(e.facturado, totalFacturado);
              const pagado = porcentaje(e.pagado, e.facturado);
              return (
                <li key={e.clave}>
                  <Link href={conFiltros(f, { emisor: elegido ? "" : e.clave })} className={`tarjeta block space-y-2 transition hover:shadow-md ${elegido ? "ring-2 ring-primario" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-profundo">{e.clave}</p>
                      <span className="shrink-0 text-xs text-suave">{e.facturas} factura{e.facturas === 1 ? "" : "s"}</span>
                    </div>
                    <p className="text-xl font-black tabular-nums text-profundo">{formatoPesos(e.facturado)}</p>
                    <div>
                      <div className="flex justify-between text-xs text-suave"><span>Participación en lo facturado</span><span className="font-semibold">{participa} %</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-borde/60"><div className="h-full rounded-full bg-primario" style={{ width: `${participa}%` }} /></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-suave"><span>Pagado</span><span className="font-semibold">{pagado} %</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-borde/60"><div className="h-full rounded-full bg-ok" style={{ width: `${pagado}%` }} /></div>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm tabular-nums">
                      <div><dt className="text-xs text-suave">Kilos</dt><dd className="font-semibold">{e.kilos.toLocaleString("es-CO")}</dd></div>
                      <div><dt className="text-xs text-suave">Pagado</dt><dd className="font-semibold text-ok">{formatoPesos(e.pagado)}</dd></div>
                      <div><dt className="text-xs text-suave">Saldo</dt><dd className={`font-black ${e.saldo > 1 ? "text-alerta" : "text-ok"}`}>{formatoPesos(e.saldo)}</dd></div>
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {filas.length === 0 ? <Vacio>No hay facturas con estos filtros.</Vacio> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filas.map((x) => (
            <li key={x.id}>
              <Link href={`/facturas/${x.id}`} className={`tarjeta block space-y-2 transition hover:shadow-md ${x.estado_cobro === "ANULADA" ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-profundo">{x.numero_factura} · {x.extractora_razon_social ?? "—"}</p>
                    <p className="text-sm text-suave">{x.emisor_razon_social ?? "—"} · emitida {fecha(x.fecha_emision)} · vence {fecha(x.fecha_vencimiento)}</p>
                  </div>
                  <ChipsFactura f={x} />
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm tabular-nums">
                  <div><dt className="text-suave">Facturado</dt><dd className="font-semibold">{formatoPesos(x.total_cobrar)}</dd></div>
                  <div><dt className="text-suave">Pagado</dt><dd className="font-semibold text-ok">{formatoPesos(x.total_aplicado)}</dd></div>
                  <div><dt className="text-suave">Saldo</dt><dd className={`font-black ${x.saldo_pendiente > 1 ? "text-alerta" : "text-ok"}`}>{formatoPesos(x.saldo_pendiente)}</dd></div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {aprobadas.length > 0 && (
        <section className="grid gap-3 lg:grid-cols-2">
          {(["extractora", "mes"] as const).map((d) => (
            <div key={d} className="tarjeta overflow-x-auto p-0">
              <p className="p-3 font-bold text-profundo">Totales por {d}</p>
              <table className="w-full text-sm tabular-nums">
                <thead className="bg-profundo text-left text-white"><tr><th className="p-2">{d === "mes" ? "Mes" : "Extractora"}</th><th className="p-2 text-right">Facturado</th><th className="p-2 text-right">Saldo</th></tr></thead>
                <tbody>
                  {totalesPor(filas, d).map((t) => (
                    <tr key={t.clave} className="border-t border-borde/60">
                      <td className="p-2">{t.clave}<span className="block text-xs text-suave">{t.facturas} factura(s) · {t.kilos.toLocaleString("es-CO")} kg</span></td>
                      <td className="p-2 text-right">{formatoPesos(t.facturado)}</td>
                      <td className="p-2 text-right font-semibold">{formatoPesos(t.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
