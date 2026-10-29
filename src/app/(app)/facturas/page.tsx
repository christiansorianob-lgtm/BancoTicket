import Link from "next/link";
import { FileSpreadsheet, Upload } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Vacio } from "@/components/ui";
import { consultarFacturas, filtrosFacturasDesde } from "@/lib/facturas/consulta";
import { ESTADOS_COBRO, NOMBRE_ESTADO } from "@/lib/facturas/tipos";
import { ChipsFactura } from "./estado";

/** Facturas de venta a las extractoras: estado de cobro, saldo y mora, con filtros, totales y Excel. */
export default async function Facturas({ searchParams }: PageProps<"/facturas">) {
  const sp = await searchParams;
  const f = filtrosFacturasDesde((k) => (typeof sp[k] === "string" ? (sp[k] as string) : ""));
  const supabase = await supabaseServidor();
  const [{ filas, error }, { data: totales }] = await Promise.all([
    consultarFacturas(supabase, f),
    supabase.from("fact_totales").select("dimension, clave, facturas, kilos, facturado, pagado, saldo").order("clave"),
  ]);
  const de = (d: string) => (totales ?? []).filter((t) => t.dimension === d);
  const vigentes = filas.filter((x) => x.estado_cobro !== "ANULADA");
  const suma = (k: "total_cobrar" | "total_aplicado" | "saldo_pendiente") => vigentes.reduce((s, x) => s + x[k], 0);
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

      <form className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
        <label><span className="etiqueta">Estado de cobro</span>
          <select name="estado" defaultValue={f.estado} className="campo"><option value="">Todos</option>{ESTADOS_COBRO.map((e) => <option key={e} value={e}>{NOMBRE_ESTADO[e]}</option>)}</select>
        </label>
        <label><span className="etiqueta">Extractora</span>
          <select name="extractora" defaultValue={f.extractora} className="campo"><option value="">Todas</option>{de("extractora").map((t) => <option key={t.clave} value={t.clave}>{t.clave}</option>)}</select>
        </label>
        <label><span className="etiqueta">Emisor</span>
          <select name="emisor" defaultValue={f.emisor} className="campo"><option value="">Todos</option>{de("emisor").map((t) => <option key={t.clave} value={t.clave}>{t.clave}</option>)}</select>
        </label>
        <label><span className="etiqueta">Mes de emisión</span><input type="month" name="mes" defaultValue={f.mes} className="campo" /></label>
        <label className="flex items-center gap-2 self-end pb-3"><input type="checkbox" name="vencida" value="1" defaultChecked={!!f.vencida} className="size-5" /> Solo vencidas</label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button className="boton-primario">Filtrar</button>
          {hayFiltros && <Link href="/facturas" className="boton-secundario">Limpiar</Link>}
        </div>
      </form>

      {error && <Vacio>No se pudo cargar: {error}</Vacio>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="tarjeta"><p className="text-sm text-suave">Facturas</p><p className="text-lg font-black text-profundo sm:text-2xl">{vigentes.length}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Facturado (subtotal + IVA)</p><p className="text-lg font-black text-profundo sm:text-2xl">{formatoPesos(suma("total_cobrar"))}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Pagado (aplicado)</p><p className="text-lg font-black text-ok sm:text-2xl">{formatoPesos(suma("total_aplicado"))}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Saldo pendiente</p><p className="text-lg font-black text-alerta sm:text-2xl">{formatoPesos(suma("saldo_pendiente"))}</p></div>
      </section>

      {filas.length === 0 ? <Vacio>No hay facturas con estos filtros.</Vacio> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filas.map((x) => (
            <li key={x.id}>
              <Link href={`/facturas/${x.id}`} className={`tarjeta block space-y-2 transition hover:shadow-md ${x.estado_lectura === "PENDIENTE_REVISION" ? "ring-2 ring-error" : ""}`}>
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

      {(totales ?? []).length > 0 && (
        <section className="grid gap-3 lg:grid-cols-3">
          {(["extractora", "emisor", "mes"] as const).map((d) => (
            <div key={d} className="tarjeta overflow-x-auto p-0">
              <p className="p-3 font-bold text-profundo">Totales por {d}</p>
              <table className="w-full text-sm tabular-nums">
                <thead className="bg-profundo text-left text-white"><tr><th className="p-2">{d === "mes" ? "Mes" : d === "emisor" ? "Emisor" : "Extractora"}</th><th className="p-2 text-right">Facturado</th><th className="p-2 text-right">Saldo</th></tr></thead>
                <tbody>
                  {de(d).map((t) => (
                    <tr key={t.clave} className="border-t border-borde/60">
                      <td className="p-2">{t.clave}<span className="block text-xs text-suave">{Number(t.facturas)} factura(s) · {Number(t.kilos ?? 0).toLocaleString("es-CO")} kg</span></td>
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
