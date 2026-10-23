import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fechaHora } from "@/lib/fechas";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { lineaSaldo, textoSaldo } from "@/lib/saldo";
import { Vacio } from "@/components/ui";
import { consultarCuenta, filtrosCuentaDesde } from "@/lib/informes/cuenta";
import { SelectorReporte } from "./selector";

const colorSaldo = (s: number) => (s > 0 ? "text-ok" : s < 0 ? "text-alerta" : "text-profundo");

/**
 * Reporte «Tiquetes y anticipos»: tiquetes aprobados (fecha de subida) y anticipos confirmados
 * (fecha de confirmación) de un comprador en una sola tabla, con el saldo acumulado. Solo lectura.
 */
export async function ReporteCuenta({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const f = filtrosCuentaDesde((k) => (typeof sp[k] === "string" ? (sp[k] as string) : ""));
  const supabase = await supabaseServidor();
  const [{ data: compradores }, resultado] = await Promise.all([
    supabase.from("perfiles").select("id, nombre").eq("rol", "comprador").order("nombre"),
    f.comprador ? consultarCuenta(supabase, f) : Promise.resolve(null),
  ]);
  const cuenta = resultado?.cuenta;
  const exportar = `/api/exportar/cuenta?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`;
  const final = cuenta ? textoSaldo(cuenta.saldoFinal, "admin") : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Reportes</h1>
        {f.comprador && (
          <a href={exportar} className="boton-primario" download>
            <FileSpreadsheet className="size-5" aria-hidden /> Exportar a Excel
          </a>
        )}
      </div>

      <SelectorReporte actual="cuenta" />

      <form className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <input type="hidden" name="tipo" value="cuenta" />
        <label className="sm:col-span-2 lg:col-span-1"><span className="etiqueta">Comprador</span>
          <select name="comprador" defaultValue={f.comprador} className="campo" required>
            <option value="" disabled>Elija un comprador</option>
            {compradores?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label><span className="etiqueta">Desde (fecha de registro)</span><input type="date" name="desde" defaultValue={f.desde} className="campo" /></label>
        <label><span className="etiqueta">Hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="campo" /></label>
        <div className="flex items-end gap-2">
          <button className="boton-primario flex-1">Ver reporte</button>
          {(f.desde || f.hasta || f.comprador) && <Link href="/admin/reportes?tipo=cuenta" className="boton-secundario">Limpiar</Link>}
        </div>
        <p className="text-xs text-suave sm:col-span-2 lg:col-span-4">
          Tiquetes aprobados por fecha de subida y anticipos confirmados por fecha de confirmación, con el saldo acumulado.
          «Exportar a Excel» descarga lo mismo que ve en la tabla.
        </p>
      </form>

      {resultado?.error && <Vacio>No se pudo cargar el reporte: {resultado.error}</Vacio>}

      {!cuenta ? <Vacio>Elija un comprador y toque «Ver reporte».</Vacio> : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="tarjeta"><p className="text-sm text-suave">Tiquetes con precio</p><p className="text-2xl font-black text-profundo">{formatoPesos(cuenta.totalTiquetes)}</p></div>
            <div className="tarjeta"><p className="text-sm text-suave">Anticipos confirmados</p><p className="text-2xl font-black text-profundo">{formatoPesos(cuenta.totalAnticipos)}</p></div>
            <div className="tarjeta"><p className="text-sm text-suave">{final!.titulo}</p><p className={`text-2xl font-black ${colorSaldo(cuenta.saldoFinal)}`}>{final!.monto}</p></div>
            <div className="tarjeta"><p className="text-sm text-suave">Sin precio</p><p className={`text-2xl font-black ${cuenta.sinPrecio ? "text-alerta" : "text-profundo"}`}>{cuenta.sinPrecio}</p></div>
          </section>

          {cuenta.movimientos.length === 0 && cuenta.saldoInicial === 0 ? <Vacio>No hay tiquetes ni anticipos en este periodo.</Vacio> : (
            <div className="tarjeta overflow-x-auto p-0">
              <table className="w-full min-w-[64rem] text-sm">
                <thead className="bg-profundo text-left text-white">
                  <tr>
                    <th className="p-3">Fecha de registro</th><th className="p-3">Tipo</th><th className="p-3">Detalle</th><th className="p-3">Fecha entrada fruta</th>
                    <th className="p-3 text-right">Peso neto</th><th className="p-3 text-right">Precio / t</th><th className="p-3 text-right">Valor tiquete</th>
                    <th className="p-3 text-right">Anticipo</th><th className="p-3 text-right">Saldo</th><th className="p-3">Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {f.desde && (
                    <tr className="border-t border-borde/60 bg-primario-suave font-semibold text-profundo">
                      <td className="p-3" colSpan={8}>Saldo que traía antes del período</td>
                      <td className={`p-3 text-right whitespace-nowrap ${colorSaldo(cuenta.saldoInicial)}`}>{lineaSaldo(cuenta.saldoInicial, "admin")}</td>
                      <td className="p-3" />
                    </tr>
                  )}
                  {cuenta.movimientos.map((m, i) => (
                    <tr key={`${m.tipo}-${m.id}`} className={`border-t border-borde/60 ${i % 2 ? "bg-primario-suave/40" : ""}`}>
                      <td className="p-3 whitespace-nowrap">{fechaHora(m.fecha)}</td>
                      <td className="p-3"><span className={`font-semibold ${m.tipo === "anticipo" ? "text-ok" : "text-profundo"}`}>{m.tipo === "anticipo" ? "Anticipo" : "Tiquete"}</span></td>
                      <td className="p-3 font-semibold">{m.detalle}</td>
                      <td className="p-3 whitespace-nowrap">{m.fecha_entrada ? fechaHora(m.fecha_entrada) : ""}</td>
                      <td className="p-3 text-right whitespace-nowrap">{m.peso_neto_t == null ? "" : formatoToneladas(m.peso_neto_t)}</td>
                      <td className="p-3 text-right whitespace-nowrap">{m.tipo === "tiquete" ? (m.precio_tonelada == null ? <span className="font-semibold text-alerta">Sin precio</span> : formatoPesos(m.precio_tonelada)) : ""}</td>
                      <td className="p-3 text-right whitespace-nowrap font-semibold">{m.valor == null ? "" : formatoPesos(m.valor)}</td>
                      <td className="p-3 text-right whitespace-nowrap font-semibold">{m.anticipo == null ? "" : formatoPesos(m.anticipo)}</td>
                      <td className={`p-3 text-right whitespace-nowrap font-semibold ${colorSaldo(m.saldo)}`}>{lineaSaldo(m.saldo, "admin")}</td>
                      <td className="p-3 text-alerta">{m.observacion ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-profundo bg-primario-suave font-bold text-profundo">
                    <td className="p-3" colSpan={6}>TOTAL ({cuenta.movimientos.length.toLocaleString("es-CO")} movimiento{cuenta.movimientos.length === 1 ? "" : "s"})</td>
                    <td className="p-3 text-right whitespace-nowrap">{formatoPesos(cuenta.totalTiquetes)}</td>
                    <td className="p-3 text-right whitespace-nowrap">{formatoPesos(cuenta.totalAnticipos)}</td>
                    <td className="p-3 text-right whitespace-nowrap">{lineaSaldo(cuenta.saldoFinal, "admin")}</td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
