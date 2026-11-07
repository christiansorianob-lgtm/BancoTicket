/**
 * Paginación de las tablas (decisión del usuario, 2026-11-06): de a 10 filas, con opción de 25 o 50.
 * `pagina` y `por` viajan en la dirección junto con los filtros. Sin dependencias de servidor.
 */
export const OPCIONES_POR_PAGINA = [10, 25, 50] as const;

export type Pagina = { pagina: number; por: number; desde: number; hasta: number };

/** Lee `pagina` y `por` de la dirección; `desde`/`hasta` son los índices para `.range()` de Supabase. */
export function paginaDesde(leer: (k: string) => string | null | undefined): Pagina {
  const por = (OPCIONES_POR_PAGINA as readonly number[]).includes(Number(leer("por"))) ? Number(leer("por")) : OPCIONES_POR_PAGINA[0];
  const pagina = Math.max(1, Math.floor(Number(leer("pagina")) || 1));
  const desde = (pagina - 1) * por;
  return { pagina, por, desde, hasta: desde + por - 1 };
}

/** Lee los parámetros de una página de Next («searchParams») como texto. */
export const leerParametros = (sp: Record<string, string | string[] | undefined>) => (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
