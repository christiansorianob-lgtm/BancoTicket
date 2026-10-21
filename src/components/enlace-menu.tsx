"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Enlace del menú que se resalta cuando es la sección abierta. Las páginas de inicio («/» y
 * «/admin») solo se resaltan exactas; las demás también en sus subpáginas.
 */
export function EnlaceMenu({ href, variante, children }: { href: string; variante: "superior" | "inferior"; children: ReactNode }) {
  const ruta = usePathname();
  const activo = href === "/" || href === "/admin" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);
  const clases = variante === "superior"
    ? `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 transition ${activo ? "bg-white font-bold text-profundo shadow" : "text-white/90 hover:bg-white/10"}`
    : `flex flex-col items-center gap-0.5 py-2.5 text-xs transition ${activo ? "border-t-2 border-primario font-bold text-primario" : "border-t-2 border-transparent font-medium text-suave hover:text-primario"}`;
  return <Link href={href} className={clases} aria-current={activo ? "page" : undefined}>{children}</Link>;
}
