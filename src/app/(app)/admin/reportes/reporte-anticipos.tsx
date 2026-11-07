import Link from "next/link";
import { FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fecha } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { EstadoChip, Vacio } from "@/components/ui";
import { Paginacion } from "@/components/paginacion";
import { leerParametros, paginaDesde } from "@/lib/paginacion";
import { ESTADOS_ANTICIPO, filtrosAnticiposDesde, paginaAnticipos, totalesAnticipos } from "@/lib/informes/anticipos";
import { SelectorReporte } from "./selector";

/**
 * Reporte «Anticipos» (decisión del usuario, 2026-11-06): todos los anticipos con filtros, de a 10
 * por página. Los totales son de TODO el filtro (los suma la base) y el Excel trae todo lo filtrado.
 * Solo lectura: lo ven la administración y el Consultor.
 */
export async function ReporteAnticipos({ sp, base }: { sp: Record<string, string | string[] | undefined>; base: string }) {
  const leer = leerParametros(sp);
  const f = filtrosAnticiposDesde(leer);
  const pagina = paginaDesde(leer);
  const supabase = await supabaseServidor();
  const [{ filas, total, error }, totales, { data: compradores }] = await Promise.all([
    paginaAnticipos(supabase, f, pagina.desde, pagina.hasta),
    totalesAnticipos(supabase, f),
    supabase.from("perfiles").select("id, nombre").eq("rol", "comprador").order("nombre"),
  ]);
  const soportes = await urlsFotos(filas.map((a) => a.soporte_ruta));
  const filtros = Object.fromEntries(Object.entries({ tipo: "anticipos", ...f }).filter(([, v]) => v));
  const exportar = `/api/exportar/anticipos?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`;
  const hayFiltros = Object.values(f).some(Boolean);
  const monto = (n: number) => <span className={n < 0 ? "text-error" : ""}>{n < 0 ? "−" : ""}{formatoPesos(Math.abs(n))}</span>;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Reportes</h1>
        <a href={exportar} className="boton-primario" download><FileSpreadsheet className="size-5" aria-hidden /> Exportar a Excel</a>
      </div>

      <SelectorReporte actual="anticipos" base={base} />

      <form className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
        <input type="hidden" name="tipo" value="anticipos" />
        <label><span className="etiqueta">Desde (fecha del anticipo)</span><input type="date" name="desde" defaultValue={f.desde} className="campo" /></label>
        <label><span className="etiqueta">Hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="campo" /></label>
        <label><span className="etiqueta">Comprador</span>
          <select name="comprador" defaultValue={f.comprador} className="campo"><option value="">Todos</option>{compradores?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        </label>
        <label><span className="etiqueta">Estado</span>
          <select name="estado" defaultValue={f.estado} className="campo"><option value="">Todos</option>{ESTADOS_ANTICIPO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        </label>
        <div className="flex items-end gap-2">
          <button className="boton-primario flex-1">Filtrar</button>
          {hayFiltros && <Link href={`${base}?tipo=anticipos`} className="boton-secundario">Limpiar</Link>}
        </div>
        <p className="text-xs text-suave sm:col-span-2 lg:col-span-5">
          Solo los confirmados suman al saldo del comprador. Los montos negativos son saldo a favor del comprador. «Exportar a Excel» descarga todo lo filtrado.
        </p>
      </form>

      {error && <Vacio>No se pudo cargar el reporte: {error}</Vacio>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="tarjeta"><p className="text-sm text-suave">Anticipos</p><p className="text-lg font-black text-profundo sm:text-2xl">{totales.cantidad.toLocaleString("es-CO")}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Confirmados ({totales.confirmado.cantidad}) · suman</p><p className="text-lg font-black text-ok sm:text-2xl">{monto(totales.confirmado.monto)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Pendientes ({totales.pendiente.cantidad})</p><p className="text-lg font-black text-alerta sm:text-2xl">{monto(totales.pendiente.monto)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">En disputa ({totales.en_disputa.cantidad})</p><p className="text-lg font-black text-error sm:text-2xl">{monto(totales.en_disputa.monto)}</p></div>
      </section>

      {total === 0 ? <Vacio>No hay anticipos con estos filtros.</Vacio> : (
        <div className="space-y-3">
          <div className="tarjeta overflow-x-auto p-0">
            <table className="w-full min-w-[48rem] text-sm">
              <thead className="bg-profundo text-left text-white">
                <tr><th className="p-3">Fecha</th><th className="p-3">Comprador</th><th className="p-3 text-right">Monto</th><th className="p-3">Estado</th><th className="p-3">Nota</th><th className="p-3">Registrado por</th><th className="p-3 text-center">Soporte</th></tr>
              </thead>
              <tbody>
                {filas.map((a, i) => (
                  <tr key={a.id} className={`border-t border-borde/60 ${i % 2 ? "bg-primario-suave/40" : ""}`}>
                    <td className="p-3 whitespace-nowrap">{fecha(a.fecha)}</td>
                    <td className="p-3 font-semibold text-profundo">{a.comprador}</td>
                    <td className="p-3 text-right whitespace-nowrap font-semibold">{monto(a.monto)}</td>
                    <td className="p-3"><EstadoChip estado={a.estado} /></td>
                    <td className="p-3">{a.nota ?? "—"}{a.estado === "en_disputa" && a.motivo_disputa && <span className="block text-xs text-error">Disputa: {a.motivo_disputa}</span>}</td>
                    <td className="p-3">{a.registrador}</td>
                    <td className="p-2 text-center">
                      {a.soporte_ruta && soportes[a.soporte_ruta] ? (
                        <a href={soportes[a.soporte_ruta]} target="_blank" rel="noopener noreferrer" title="Ver soporte"
                          className="inline-flex size-9 items-center justify-center rounded-lg text-primario hover:bg-primario-suave"><ImageIcon className="size-5" aria-label="Ver soporte" /></a>
                      ) : <span className="text-suave">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion total={total} pagina={pagina} base={base} parametros={filtros} />
        </div>
      )}
    </>
  );
}
