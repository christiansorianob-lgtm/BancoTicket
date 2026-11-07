import Link from "next/link";

const TIPOS = [
  { valor: "tiquetes", texto: "Tiquetes", consulta: "" },
  { valor: "cuenta", texto: "Tiquetes y anticipos", consulta: "?tipo=cuenta" },
  { valor: "anticipos", texto: "Anticipos", consulta: "?tipo=anticipos" },
] as const;

/**
 * Elegir el tipo de reporte dentro de la misma pestaña «Reportes»: los tres botones del mismo
 * tamaño, en una fila (en el celular, más compactos y con el texto en dos líneas si hace falta).
 */
export function SelectorReporte({ actual, base }: { actual: (typeof TIPOS)[number]["valor"]; base: string }) {
  return (
    <nav className="tarjeta space-y-2 py-3" aria-label="Tipo de reporte">
      <p className="etiqueta mb-0">Tipo de reporte</p>
      <div className="grid grid-cols-3 gap-2">
        {TIPOS.map((t) => (
          <Link key={t.valor} href={`${base}${t.consulta}`} aria-current={t.valor === actual ? "page" : undefined}
            className={`${t.valor === actual ? "boton-primario" : "boton-secundario"} h-full min-h-12 px-2 text-center text-sm leading-tight sm:text-base`}>
            {t.texto}
          </Link>
        ))}
      </div>
    </nav>
  );
}
