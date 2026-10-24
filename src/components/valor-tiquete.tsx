import { formatoPesos, formatoToneladas } from "@/lib/numeros";

/**
 * Cuenta del tiquete en las tarjetas (decisión del usuario: ordenada y con el peso neto y el precio
 * por tonelada como protagonistas): Peso neto × Precio por tonelada = Valor del tiquete.
 * `conPrecio = false` (tiquete aún no aprobado): solo el peso. `verPeso = false`: el comprador no ve
 * las toneladas de un tiquete sin precio (configuración).
 */
export function ValorTiquete({ toneladas, precio, valor, conPrecio = true, verPeso = true }: {
  toneladas: number | null; precio?: number | null; valor?: number | null; conPrecio?: boolean; verPeso?: boolean;
}) {
  const sinPrecio = precio == null;
  return (
    <dl className="mt-3 overflow-hidden rounded-xl border border-borde text-sm tabular-nums">
      {verPeso && (
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <dt className="text-suave">Peso neto</dt>
          <dd className="text-lg font-black text-profundo">{formatoToneladas(toneladas)}</dd>
        </div>
      )}
      {conPrecio && (
        <>
          <div className="flex items-baseline justify-between gap-3 border-t border-borde px-3 py-2">
            <dt className="text-suave"><span aria-hidden>× </span>Precio por tonelada</dt>
            <dd className={`text-lg font-black ${sinPrecio ? "text-alerta" : "text-profundo"}`}>{sinPrecio ? "Sin precio" : formatoPesos(precio)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t-2 border-profundo/20 bg-primario-suave/60 px-3 py-2">
            <dt className="font-semibold text-profundo"><span aria-hidden>= </span>Valor del tiquete</dt>
            <dd className={`text-xl font-black ${sinPrecio ? "text-suave" : "text-ok"}`}>{sinPrecio ? "—" : formatoPesos(valor)}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
