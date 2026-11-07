import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OPCIONES_POR_PAGINA, type Pagina } from "@/lib/paginacion";

/**
 * « Anterior · Página 2 de 15 · Siguiente », cuántos registros hay y cuántos ver por página.
 * `base`: la ruta de la página; `parametros`: los filtros actuales (se conservan al cambiar de página).
 */
export function Paginacion({ total, pagina, base, parametros }: {
  total: number; pagina: Pagina; base: string; parametros: Record<string, string>;
}) {
  const paginas = Math.max(1, Math.ceil(total / pagina.por));
  const actual = Math.min(pagina.pagina, paginas);
  const enlace = (cambios: Record<string, string | number>) => {
    const q = new URLSearchParams(Object.entries({ ...parametros, ...cambios }).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k, String(v)]));
    if (q.get("pagina") === "1") q.delete("pagina");
    if (q.get("por") === String(OPCIONES_POR_PAGINA[0])) q.delete("por");
    return q.size ? `${base}?${q}` : base;
  };
  if (total === 0) return null;
  const boton = "boton-secundario min-h-10 px-3 text-sm";

  return (
    <nav className="space-y-2 text-sm" aria-label="Páginas">
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        {actual > 1
          ? <Link href={enlace({ pagina: actual - 1, por: pagina.por })} className={boton}><ChevronLeft className="size-4" aria-hidden /> Anterior</Link>
          : <span className={`${boton} opacity-40`} aria-disabled><ChevronLeft className="size-4" aria-hidden /> Anterior</span>}
        <span className="whitespace-nowrap text-suave">Página <b className="text-texto">{actual}</b> de {paginas}</span>
        {actual < paginas
          ? <Link href={enlace({ pagina: actual + 1, por: pagina.por })} className={boton}>Siguiente <ChevronRight className="size-4" aria-hidden /></Link>
          : <span className={`${boton} opacity-40`} aria-disabled>Siguiente <ChevronRight className="size-4" aria-hidden /></span>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-suave sm:justify-start sm:gap-4">
        <span>{total.toLocaleString("es-CO")} registro{total === 1 ? "" : "s"}</span>
        <span className="flex items-center gap-1">
          Ver
          {OPCIONES_POR_PAGINA.map((n) => (
            <Link key={n} href={enlace({ pagina: 1, por: n })} aria-current={n === pagina.por ? "true" : undefined}
              className={`rounded-lg px-2 py-1 font-semibold ${n === pagina.por ? "bg-primario text-white" : "text-primario hover:bg-primario-suave"}`}>{n}</Link>
          ))}
          por página
        </span>
      </div>
    </nav>
  );
}
