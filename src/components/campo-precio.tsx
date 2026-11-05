"use client";
import { useId, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { montoDesdeTexto } from "@/lib/numeros";
import { formatearMonto, montoEnLetras, posicionTras, textoMonto } from "@/lib/monto";

/**
 * Pistas para no confundir unidades (solo avisan, no bloquean): un precio por tonelada de fruta de
 * palma ronda los cientos de miles de pesos.
 */
const PARECE_POR_KILO = 10_000;
const PARECE_MUY_ALTO = 5_000_000;

/**
 * Campo «Precio por tonelada» (decisión del usuario: la misma ayuda que el monto del anticipo, solo
 * positivo). Pone puntos de miles mientras se escribe, lo muestra en letras, dice cuánto es por kilo
 * y avisa si parece un precio por kilo o tiene un cero de más. `vacio`: se puede dejar en blanco (sin precio).
 */
export function CampoPrecio({ name, inicial, vacio = false, etiqueta = "Precio por tonelada (COP)" }: {
  name: string; inicial?: number | null; vacio?: boolean; etiqueta?: string;
}) {
  const id = useId();
  const [valor, setValor] = useState(inicial == null ? "" : formatearMonto(String(inicial).replace(".", ",")));
  const precio = montoDesdeTexto(valor.replace(/,$/, "")) ?? 0;

  return (
    <div>
      <label htmlFor={id} className="etiqueta">{etiqueta}{vacio ? " · vacío = sin precio" : ""}</label>
      <input id={id} name={name} inputMode="decimal" autoComplete="off" required={!vacio} value={valor} placeholder="Ej.: 850.000"
        className={`campo text-lg font-bold tabular-nums ${precio > 0 ? "border-ok text-ok" : ""}`}
        onChange={(e) => {
          const input = e.currentTarget;
          const cursor = input.selectionStart ?? input.value.length;
          const cifras = input.value.slice(0, cursor).replace(/[^\d,]/g, "").length;
          const nuevo = formatearMonto(input.value.replace(/[-−–]/g, ""));
          setValor(nuevo);
          requestAnimationFrame(() => { const p = posicionTras(nuevo, cifras); input.setSelectionRange(p, p); });
        }}
        onBlur={() => setValor((v) => v.replace(/,$/, ""))} />
      {precio > 0 ? (
        <div className="mt-1 space-y-1 text-sm">
          <p className="font-semibold text-ok">{textoMonto(precio)} por tonelada · {montoEnLetras(precio)}</p>
          <p className="text-suave">Equivale a {textoMonto(Math.round((precio / 1000) * 100) / 100)} por kilo.</p>
          {precio < PARECE_POR_KILO && (
            <p className="flex items-start gap-1.5 font-semibold text-alerta"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Parece un precio por KILO. Por tonelada son 1.000 kilos: {textoMonto(precio)} por kilo serían {textoMonto(precio * 1000)} por tonelada.</p>
          )}
          {precio > PARECE_MUY_ALTO && (
            <p className="flex items-start gap-1.5 font-semibold text-alerta"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Es un precio muy alto para una tonelada. Revise que no tenga un cero de más.</p>
          )}
        </div>
      ) : vacio && valor === "" ? (
        <p className="mt-1 text-sm text-suave">Sin precio: el tiquete no descuenta del saldo hasta que tenga uno.</p>
      ) : null}
    </div>
  );
}
