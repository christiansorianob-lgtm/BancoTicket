import Link from "next/link";
import { FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fechaHora } from "@/lib/fechas";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { Vacio } from "@/components/ui";
import { consultarInforme, filtrosDesde } from "@/lib/informes/consulta";
import { EditarFila } from "./editar-fila";
import { EliminarFila } from "./eliminar-fila";
import { ReporteCuenta } from "./cuenta";
import { SelectorReporte } from "./selector";

/** En pantalla se muestran hasta estas filas; el Excel trae todas las del filtro. */
const MAX_PANTALLA = 500;

/** Reportes de tiquetes aprobados: filtros, tabla y exportación a Excel con los mismos filtros. */
export default async function Reportes({ searchParams }: PageProps<"/admin/reportes">) {
  const sp = await searchParams;
  if (sp.tipo === "cuenta") return <ReporteCuenta sp={sp} />;
  const f =filtrosDesde((k) => (typeof sp[k] === "string" ? (sp[k] as string) : ""));
  const supabase = await supabaseServidor();

  const [{ filas, error }, { data: compradores }, { data: extractoras }, { data: conProveedor }] = await Promise.all([
    consultarInforme(supabase, f),
    supabase.from("perfiles").select("id, nombre").eq("rol", "comprador").order("nombre"),
    supabase.from("extractoras").select("id, nombre").order("nombre"),
    supabase.from("tiquetes").select("proveedor").eq("estado", "vigente").not("proveedor", "is", null).limit(10000),
  ]);
  // Enlaces firmados (30 min) a las fotos de las filas que se ven en pantalla.
  const fotos = await urlsFotos(filas.slice(0, MAX_PANTALLA).map((t) => t.imagen_ruta));
  const proveedores = [...new Set((conProveedor ?? []).map((p) => p.proveedor as string))].sort((a, b) => a.localeCompare(b, "es"));

  const toneladas = filas.reduce((s, t) => s + t.peso_neto_t, 0);
  const total = filas.reduce((s, t) => s + (t.valor ?? 0), 0);
  const sinPrecio = filas.filter((t) => t.precio_tonelada == null).length;
  const hayFiltros = Object.values(f).some(Boolean);
  const exportar = `/api/exportar/tiquetes?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Reportes</h1>
        <a href={exportar} className="boton-primario" download>
          <FileSpreadsheet className="size-5" aria-hidden /> Exportar a Excel
        </a>
      </div>

      <SelectorReporte actual="tiquetes" />

      <form className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <label><span className="etiqueta">Desde (fecha de entrada)</span><input type="date" name="desde" defaultValue={f.desde} className="campo" /></label>
        <label><span className="etiqueta">Hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="campo" /></label>
        <label><span className="etiqueta">Comprador</span>
          <select name="comprador" defaultValue={f.comprador} className="campo"><option value="">Todos</option>{compradores?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        </label>
        <label><span className="etiqueta">Extractora</span>
          <select name="extractora" defaultValue={f.extractora} className="campo"><option value="">Todas</option>{extractoras?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
        </label>
        <label className="lg:col-span-2"><span className="etiqueta">Proveedor</span>
          <select name="proveedor" defaultValue={f.proveedor} className="campo"><option value="">Todos</option>{proveedores.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        </label>
        <label><span className="etiqueta">N° de tiquete</span><input name="numero" defaultValue={f.numero} className="campo" placeholder="Todo o parte del número" /></label>
        <div className="flex items-end gap-2">
          <button className="boton-primario flex-1">Filtrar</button>
          {hayFiltros && <Link href="/admin/reportes" className="boton-secundario">Limpiar</Link>}
        </div>
        <p className="text-xs text-suave sm:col-span-2 lg:col-span-4">
          Tiquetes aprobados vigentes. «Exportar a Excel» descarga exactamente lo que ve en la tabla (los filtros aplicados con «Filtrar»).
        </p>
      </form>

      {error && <Vacio>No se pudo cargar el reporte: {error}</Vacio>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="tarjeta"><p className="text-sm text-suave">Tiquetes</p><p className="text-lg font-black sm:text-2xl text-profundo">{filas.length.toLocaleString("es-CO")}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Peso neto</p><p className="text-lg font-black sm:text-2xl text-profundo">{formatoToneladas(toneladas)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Precio total</p><p className="text-lg font-black sm:text-2xl text-ok">{formatoPesos(total)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Sin precio</p><p className={`text-lg font-black sm:text-2xl ${sinPrecio ? "text-alerta" : "text-profundo"}`}>{sinPrecio}</p></div>
      </section>

      {filas.length === 0 ? <Vacio>No hay tiquetes con estos filtros.</Vacio> : (
        <div className="tarjeta overflow-x-auto p-0">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-profundo text-left text-white">
              <tr>
                <th className="p-3">Comprador</th><th className="p-3">Extractora</th><th className="p-3">Proveedor</th><th className="p-3">Fecha</th>
                <th className="p-3">N° Tiquete</th><th className="p-3 text-right">Peso neto</th><th className="p-3 text-right">Precio / t</th><th className="p-3 text-right">Precio total</th><th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.slice(0, MAX_PANTALLA).map((t, i) => (
                <tr key={t.id} className={`border-t border-borde/60 ${i % 2 ? "bg-primario-suave/40" : ""}`}>
                  <td className="p-3">{t.comprador}</td>
                  <td className="p-3">{t.extractora}</td>
                  <td className="p-3 font-semibold text-profundo">{t.proveedor ?? "—"}</td>
                  <td className="p-3 whitespace-nowrap">{fechaHora(t.fecha_entrada)}</td>
                  <td className="p-3 font-semibold">{t.numero}</td>
                  <td className="p-3 text-right whitespace-nowrap">{formatoToneladas(t.peso_neto_t)}</td>
                  <td className="p-3 text-right whitespace-nowrap">{t.precio_tonelada == null ? <span className="font-semibold text-alerta">Sin precio</span> : formatoPesos(t.precio_tonelada)}</td>
                  <td className="p-3 text-right whitespace-nowrap font-semibold">{t.valor == null ? "—" : formatoPesos(t.valor)}</td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <EditarFila t={t} foto={t.imagen_ruta ? fotos[t.imagen_ruta] : undefined} extractoras={extractoras ?? []} compradores={compradores ?? []} />
                    <EliminarFila t={t} />
                    {t.imagen_ruta && fotos[t.imagen_ruta] ? (
                      <a href={fotos[t.imagen_ruta]} target="_blank" rel="noopener noreferrer" title={`Ver foto del tiquete ${t.numero}`}
                        className="inline-flex size-9 items-center justify-center rounded-lg text-primario hover:bg-primario-suave">
                        <ImageIcon className="size-5" aria-label={`Ver foto del tiquete ${t.numero}`} />
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-profundo bg-primario-suave font-bold text-profundo">
                <td className="p-3" colSpan={5}>TOTAL ({filas.length.toLocaleString("es-CO")} tiquete{filas.length === 1 ? "" : "s"})</td>
                <td className="p-3 text-right whitespace-nowrap">{formatoToneladas(toneladas)}</td>
                <td className="p-3" />
                <td className="p-3 text-right whitespace-nowrap">{formatoPesos(total)}</td>
                <td className="p-3" />
              </tr>
            </tfoot>
          </table>
          {filas.length > MAX_PANTALLA && (
            <p className="p-3 text-sm text-suave">Se muestran los primeros {MAX_PANTALLA} de {filas.length.toLocaleString("es-CO")}. El total y el Excel incluyen todos.</p>
          )}
        </div>
      )}
    </>
  );
}
