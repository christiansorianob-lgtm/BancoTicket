import Link from "next/link";
import { FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fechaHora } from "@/lib/fechas";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { EstadoChip, Vacio } from "@/components/ui";
import { ValorTiquete } from "@/components/valor-tiquete";
import { EnviarFoto } from "@/components/enviar-tiquete";
import { EditarTiquete } from "./editar-tiquete";
import { PrecioBloque } from "./precio-bloque";
import { Paginacion } from "@/components/paginacion";
import { leerParametros, paginaDesde } from "@/lib/paginacion";
import { leerConfiguracion } from "@/lib/config";

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
/** Valor del filtro de proveedor para los tiquetes que no tienen proveedor. */
const SIN_PROVEEDOR = "__sin__";

export default async function TiquetesAdmin({ searchParams }: PageProps<"/admin/tiquetes">) {
  const sp = await searchParams;
  const f = {
    desde: texto(sp.desde), hasta: texto(sp.hasta), extractora: texto(sp.extractora),
    comprador: texto(sp.comprador), numero: texto(sp.numero).trim(), proveedor: texto(sp.proveedor),
    // «Solo sin precio» viene MARCADO por defecto (decisión del usuario 2026-11-25). El formulario envía
    // `filtrado=1`: así se distingue «lo desmarcó» de «acaba de entrar».
    sinPrecio: texto(sp.filtrado) === "1" ? texto(sp.sin_precio) === "1" : true, estado: texto(sp.estado) || "vigente",
  };
  const pagina = paginaDesde(leerParametros(sp));
  const supabase = await supabaseServidor();
  const proveedores = (await leerConfiguracion()).proveedores_oficiales;

  const estado = f.estado === "anulado" ? "anulado" : "vigente";
  const desdeISO = f.desde ? `${f.desde}T00:00:00-05:00` : null;
  const hastaISO = f.hasta ? `${f.hasta}T23:59:59.999-05:00` : null;
  // N° de tiquete: todo o parte del número (como en Reportes); se quitan los comodines % y _.
  const numero = f.numero.replace(/[%_]/g, "");

  // Solo la página que se ve (de a 10, con sus fotos).
  let consultaPagina = supabase.from("tiquetes").select("*, extractoras(nombre), perfiles!tiquetes_comprador_id_fkey(nombre, celular)", { count: "exact" }).eq("estado", estado);
  if (desdeISO) consultaPagina = consultaPagina.gte("fecha_entrada", desdeISO);
  if (hastaISO) consultaPagina = consultaPagina.lte("fecha_entrada", hastaISO);
  if (f.extractora) consultaPagina = consultaPagina.eq("extractora_id", f.extractora);
  if (f.comprador) consultaPagina = consultaPagina.eq("comprador_id", f.comprador);
  if (f.sinPrecio) consultaPagina = consultaPagina.is("precio_tonelada", null);
  if (numero) consultaPagina = consultaPagina.ilike("numero", `%${numero}%`);
  if (f.proveedor === SIN_PROVEEDOR) consultaPagina = consultaPagina.is("proveedor", null);
  else if (f.proveedor) consultaPagina = consultaPagina.eq("proveedor", f.proveedor);

  /** Totales de todo el filtro con una consulta liviana (solo peso y valor, sin fotos ni nombres). */
  async function totales() {
    let toneladas = 0, valor = 0;
    for (let d = 0; ; d += 1000) {
      let q = supabase.from("tiquetes").select("peso_neto_t, valor").eq("estado", estado);
      if (desdeISO) q = q.gte("fecha_entrada", desdeISO);
      if (hastaISO) q = q.lte("fecha_entrada", hastaISO);
      if (f.extractora) q = q.eq("extractora_id", f.extractora);
      if (f.comprador) q = q.eq("comprador_id", f.comprador);
      if (f.sinPrecio) q = q.is("precio_tonelada", null);
      if (numero) q = q.ilike("numero", `%${numero}%`);
      if (f.proveedor === SIN_PROVEEDOR) q = q.is("proveedor", null);
      else if (f.proveedor) q = q.eq("proveedor", f.proveedor);
      const { data } = await q.order("id").range(d, d + 999);
      for (const t of data ?? []) { toneladas += Number(t.peso_neto_t); valor += Number(t.valor ?? 0); }
      if (!data || data.length < 1000) return { toneladas, valor };
    }
  }

  /**
   * Para el precio en bloque: cuántos tiquetes VIGENTES del filtro tienen y no tienen precio (mismas
   * condiciones que `asignar_precio_bloque`: fechas, extractora y comprador). Solo cuenta.
   */
  async function conteoPrecios() {
    const base = () => {
      let q = supabase.from("tiquetes").select("id", { count: "exact", head: true }).eq("estado", "vigente");
      if (desdeISO) q = q.gte("fecha_entrada", desdeISO);
      if (hastaISO) q = q.lte("fecha_entrada", hastaISO);
      if (f.extractora) q = q.eq("extractora_id", f.extractora);
      if (f.comprador) q = q.eq("comprador_id", f.comprador);
      return q;
    };
    const [{ count: sin }, { count: con }] = await Promise.all([base().is("precio_tonelada", null), base().not("precio_tonelada", "is", null)]);
    return { sinPrecio: sin ?? 0, conPrecio: con ?? 0 };
  }

  /**
   * Proveedores que tienen los tiquetes (decisión del usuario 2026-11-25): «group by» de la columna
   * proveedor. Se pide SOLO esa columna (liviano) y se agrupa aquí, con cuántos tiquetes tiene cada uno.
   */
  async function proveedoresDeTiquetes() {
    const conteo = new Map<string | null, number>();
    for (let d = 0; ; d += 1000) {
      const { data } = await supabase.from("tiquetes").select("proveedor").eq("estado", estado).order("id").range(d, d + 999);
      for (const t of data ?? []) conteo.set(t.proveedor, (conteo.get(t.proveedor) ?? 0) + 1);
      if (!data || data.length < 1000) break;
    }
    const sin = conteo.get(null) ?? 0;
    conteo.delete(null);
    return { lista: [...conteo].map(([nombre, n]) => ({ nombre: nombre as string, n })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")), sin };
  }

  const [{ data, count }, suma, { data: extractoras }, { data: compradores }, listaProveedores, precios] = await Promise.all([
    consultaPagina.order("fecha_entrada", { ascending: false }).order("id").range(pagina.desde, pagina.hasta),
    totales(),
    supabase.from("extractoras").select("id, nombre").order("nombre"),
    supabase.from("perfiles").select("id, nombre").eq("rol", "comprador").order("nombre"),
    proveedoresDeTiquetes(),
    conteoPrecios(),
  ]);
  const filas = data ?? [];
  const [fotos, fotosEnlace] = await Promise.all([
    urlsFotos(filas.map((t) => t.imagen_ruta)),
    // Enlace de 7 días para el WhatsApp al comprador (cuando el equipo no puede compartir la foto).
    urlsFotos(filas.map((t) => t.imagen_ruta), 60 * 60 * 24 * 7),
  ]);
  const total = count ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Tiquetes aprobados y precios</h1>
        <Link href="/admin/reportes" className="boton-secundario">
          <FileSpreadsheet className="size-5" aria-hidden /> Reportes y Excel
        </Link>
      </div>

      <form className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-4" method="get">
        <input type="hidden" name="filtrado" value="1" />
        <label><span className="etiqueta">Desde (fecha de entrada)</span><input type="date" name="desde" defaultValue={f.desde} className="campo" /></label>
        <label><span className="etiqueta">Hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="campo" /></label>
        <label><span className="etiqueta">Extractora</span>
          <select name="extractora" defaultValue={f.extractora} className="campo"><option value="">Todas</option>{extractoras?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
        </label>
        <label><span className="etiqueta">Comprador</span>
          <select name="comprador" defaultValue={f.comprador} className="campo"><option value="">Todos</option>{compradores?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        </label>
        <label><span className="etiqueta">Proveedor</span>
          <select name="proveedor" defaultValue={f.proveedor} className="campo">
            <option value="">Todos</option>
            {listaProveedores.lista.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre} ({p.n})</option>)}
            {listaProveedores.sin > 0 && <option value={SIN_PROVEEDOR}>Sin proveedor ({listaProveedores.sin})</option>}
          </select>
        </label>
        <label><span className="etiqueta">N° de tiquete</span><input name="numero" defaultValue={f.numero} className="campo" placeholder="Todo o parte del número" /></label>
        <label><span className="etiqueta">Estado</span>
          <select name="estado" defaultValue={f.estado} className="campo"><option value="vigente">Vigentes</option><option value="anulado">Anulados</option></select>
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sin_precio" value="1" defaultChecked={f.sinPrecio} className="size-5" /> Solo sin precio</label>
          <div className="flex gap-2"><button className="boton-primario flex-1">Filtrar</button><Link href="/admin/tiquetes" className="boton-secundario">Limpiar</Link></div>
        </div>
      </form>

      {/* El precio en bloque no filtra por N° de tiquete ni por proveedor: con esos filtros se oculta para
          no aplicar el precio a más tiquetes de los que se ven. Para uno solo, «Cambiar precio» en su tarjeta. */}
      {f.estado === "vigente" && (numero || f.proveedor) && (
        <p className="tarjeta text-sm text-suave">Con el filtro de N° de tiquete o de proveedor no se ofrece el precio en bloque. Use «Cambiar precio» en el tiquete, o quite esos filtros para asignar precio en bloque.</p>
      )}
      {f.estado === "vigente" && !numero && !f.proveedor && (
        <PrecioBloque filtros={{ desde: f.desde, hasta: f.hasta, extractora: f.extractora, comprador: f.comprador }}
          sinPrecio={precios.sinPrecio} conPrecio={precios.conPrecio} abierto={f.sinPrecio} />
      )}

      <p className="text-sm text-suave">{total.toLocaleString("es-CO")} tiquete(s) en el filtro · {formatoToneladas(suma.toneladas)} · {formatoPesos(suma.valor)}</p>
      {total === 0 && <Vacio>No hay tiquetes con estos filtros.</Vacio>}

      <ul className="space-y-3">
        {filas.map((t) => (
          <li key={t.id} className="tarjeta">
            <div className="min-w-0">
              <p className="font-bold text-profundo">{t.extractoras?.nombre} · N° {t.numero} · {t.perfiles?.nombre}</p>
              <p className="mt-1"><span className="inline-block max-w-full rounded-md bg-profundo px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">Proveedor: {t.proveedor ?? "no leído"}</span></p>
              <p className="mt-1 text-sm text-suave">{fechaHora(t.fecha_entrada)} · Placa {t.placa ?? "—"}</p>
            </div>
            <ValorTiquete toneladas={Number(t.peso_neto_t)} precio={t.precio_tonelada} valor={t.valor} />
            {t.observacion && (
              <p className="mt-2 whitespace-pre-line rounded-xl border border-primario/25 bg-primario-suave px-3 py-2 text-sm text-profundo">
                <b>Observación:</b> {t.observacion}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EstadoChip estado={t.estado} />
              {t.imagen_ruta && fotos[t.imagen_ruta] && <>
                {/* Botón azul del mismo tamaño que el de WhatsApp, para encontrarlo fácil. */}
                <a className="boton-primario min-h-9 px-3 text-sm" href={fotos[t.imagen_ruta]} target="_blank" rel="noopener noreferrer"><ImageIcon className="size-4" aria-hidden /> Ver foto</a>
                <EnviarFoto celular={t.perfiles?.celular ?? null} numero={t.numero} foto={fotos[t.imagen_ruta]} fotoEnlace={fotosEnlace[t.imagen_ruta]} />
              </>}
            </div>
            <EditarTiquete tiquete={t} extractoras={extractoras ?? []} compradores={compradores ?? []} proveedores={proveedores} />
          </li>
        ))}
      </ul>
      <Paginacion total={total} pagina={pagina} base="/admin/tiquetes"
        parametros={Object.fromEntries(Object.entries({ desde: f.desde, hasta: f.hasta, extractora: f.extractora, comprador: f.comprador, numero: f.numero, proveedor: f.proveedor, estado: f.estado === "anulado" ? "anulado" : "", filtrado: "1", sin_precio: f.sinPrecio ? "1" : "" }).filter(([, v]) => v))} />
    </>
  );
}
