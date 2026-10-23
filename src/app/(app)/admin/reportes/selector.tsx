import Link from "next/link";

const TIPOS = [
  { valor: "tiquetes", texto: "Tiquetes", consulta: "" },
  { valor: "cuenta", texto: "Tiquetes y anticipos", consulta: "?tipo=cuenta" },
] as const;

/** Elegir el tipo de reporte dentro de la misma pestaña «Reportes». */
export function SelectorReporte({ actual, base }: { actual: (typeof TIPOS)[number]["valor"]; base: string }) {
  return (
    <nav className="tarjeta flex flex-wrap items-center gap-2 py-3" aria-label="Tipo de reporte">
      <span className="etiqueta mb-0 mr-1">Tipo de reporte:</span>
      {TIPOS.map((t) => (
        <Link key={t.valor} href={`${base}${t.consulta}`} aria-current={t.valor === actual ? "page" : undefined}
          className={t.valor === actual ? "boton-primario" : "boton-secundario"}>
          {t.texto}
        </Link>
      ))}
    </nav>
  );
}
