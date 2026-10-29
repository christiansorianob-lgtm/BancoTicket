import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fechaHora } from "@/lib/fechas";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { EstadoChip, Vacio } from "@/components/ui";
import { ValorTiquete } from "@/components/valor-tiquete";
import { EnviarFoto } from "@/components/enviar-tiquete";
import { FormAccion } from "@/components/form-accion";
import { asignarPrecioBloque } from "../acciones";
import { EditarTiquete } from "./editar-tiquete";

const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function TiquetesAdmin({ searchParams }: PageProps<"/admin/tiquetes">) {
  const sp = await searchParams;
  const f = {
    desde: texto(sp.desde), hasta: texto(sp.hasta), extractora: texto(sp.extractora),
    comprador: texto(sp.comprador), sinPrecio: texto(sp.sin_precio) === "1", estado: texto(sp.estado) || "vigente",
  };
  const supabase = await supabaseServidor();

  let q = supabase
    .from("tiquetes")
    .select("*, extractoras(nombre), perfiles!tiquetes_comprador_id_fkey(nombre, celular)")
    .eq("estado", f.estado === "anulado" ? "anulado" : "vigente")
    .order("fecha_entrada", { ascending: false })
    .limit(300);
  if (f.desde) q = q.gte("fecha_entrada", `${f.desde}T00:00:00-05:00`);
  if (f.hasta) q = q.lte("fecha_entrada", `${f.hasta}T23:59:59.999-05:00`);
  if (f.extractora) q = q.eq("extractora_id", f.extractora);
  if (f.comprador) q = q.eq("comprador_id", f.comprador);
  if (f.sinPrecio) q = q.is("precio_tonelada", null);

  const [{ data }, { data: extractoras }, { data: compradores }] = await Promise.all([
    q,
    supabase.from("extractoras").select("id, nombre").order("nombre"),
    supabase.from("perfiles").select("id, nombre").eq("rol", "comprador").order("nombre"),
  ]);
  const filas = data ?? [];
  const [fotos, fotosEnlace] = await Promise.all([
    urlsFotos(filas.map((t) => t.imagen_ruta)),
    // Enlace de 7 días para el WhatsApp al comprador (cuando el equipo no puede compartir la foto).
    urlsFotos(filas.map((t) => t.imagen_ruta), 60 * 60 * 24 * 7),
  ]);
  const totalT = filas.reduce((s, t) => s + Number(t.peso_neto_t), 0);
  const totalV = filas.reduce((s, t) => s + Number(t.valor ?? 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Tiquetes aprobados y precios</h1>
        <Link href="/admin/reportes" className="boton-secundario">
          <FileSpreadsheet className="size-5" aria-hidden /> Reportes y Excel
        </Link>
      </div>

      <form className="tarjeta grid gap-3 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <label><span className="etiqueta">Desde (fecha de entrada)</span><input type="date" name="desde" defaultValue={f.desde} className="campo" /></label>
        <label><span className="etiqueta">Hasta</span><input type="date" name="hasta" defaultValue={f.hasta} className="campo" /></label>
        <label><span className="etiqueta">Extractora</span>
          <select name="extractora" defaultValue={f.extractora} className="campo"><option value="">Todas</option>{extractoras?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
        </label>
        <label><span className="etiqueta">Comprador</span>
          <select name="comprador" defaultValue={f.comprador} className="campo"><option value="">Todos</option>{compradores?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        </label>
        <label><span className="etiqueta">Estado</span>
          <select name="estado" defaultValue={f.estado} className="campo"><option value="vigente">Vigentes</option><option value="anulado">Anulados</option></select>
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sin_precio" value="1" defaultChecked={f.sinPrecio} className="size-5" /> Solo sin precio</label>
          <div className="flex gap-2"><button className="boton-primario flex-1">Filtrar</button><Link href="/admin/tiquetes" className="boton-secundario">Limpiar</Link></div>
        </div>
      </form>

      {f.estado === "vigente" && (
        <details className="tarjeta" open={f.sinPrecio}>
          <summary className="cursor-pointer font-bold text-profundo">Asignar precio en bloque a los tiquetes de este filtro</summary>
          <FormAccion accion={asignarPrecioBloque} boton="Aplicar precio" className="mt-3"
            confirmar="¿Asignar este precio a todos los tiquetes del filtro?">
            <input type="hidden" name="desde" value={f.desde} />
            <input type="hidden" name="hasta" value={f.hasta} />
            <input type="hidden" name="extractora" value={f.extractora} />
            <input type="hidden" name="comprador" value={f.comprador} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label><span className="etiqueta">Precio por tonelada (COP)</span><input name="precio" inputMode="decimal" className="campo" required placeholder="Ej.: 850.000" /></label>
              <label><span className="etiqueta">Motivo (opcional)</span><input name="motivo" className="campo" /></label>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="solo_sin_precio" defaultChecked className="size-5" /> Solo a los que no tienen precio</label>
            </div>
            <p className="text-xs text-suave">Se aplica a los tiquetes vigentes que cumplen los filtros de arriba (fechas por fecha de entrada, en hora de Colombia).</p>
          </FormAccion>
        </details>
      )}

      <p className="text-sm text-suave">{filas.length} tiquete(s) · {formatoToneladas(totalT)} · {formatoPesos(totalV)}{filas.length === 300 ? " (se muestran los 300 más recientes)" : ""}</p>
      {filas.length === 0 && <Vacio>No hay tiquetes con estos filtros.</Vacio>}

      <ul className="space-y-3">
        {filas.map((t) => (
          <li key={t.id} className="tarjeta">
            <div className="min-w-0">
              <p className="font-bold text-profundo">{t.extractoras?.nombre} · N° {t.numero} · {t.perfiles?.nombre}</p>
              <p className="mt-1"><span className="inline-block max-w-full rounded-md bg-profundo px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">Proveedor: {t.proveedor ?? "no leído"}</span></p>
              <p className="mt-1 text-sm text-suave">{fechaHora(t.fecha_entrada)} · Placa {t.placa ?? "—"}</p>
            </div>
            <ValorTiquete toneladas={Number(t.peso_neto_t)} precio={t.precio_tonelada} valor={t.valor} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EstadoChip estado={t.estado} />
              {t.imagen_ruta && fotos[t.imagen_ruta] && <>
                <a className="text-sm font-semibold text-primario" href={fotos[t.imagen_ruta]} target="_blank" rel="noopener noreferrer">Ver foto</a>
                <EnviarFoto celular={t.perfiles?.celular ?? null} numero={t.numero} foto={fotos[t.imagen_ruta]} fotoEnlace={fotosEnlace[t.imagen_ruta]} />
              </>}
            </div>
            <EditarTiquete tiquete={t} extractoras={extractoras ?? []} compradores={compradores ?? []} />
          </li>
        ))}
      </ul>
    </>
  );
}
