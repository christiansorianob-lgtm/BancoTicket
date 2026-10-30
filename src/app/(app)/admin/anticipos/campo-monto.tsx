"use client";
import { useEffect, useId, useRef, useState } from "react";
import { montoDesdeTexto } from "@/lib/numeros";
import { formatearMonto, montoEnLetras, textoMonto } from "@/lib/monto";

/** Posición del cursor tras dar formato: después del mismo número de dígitos y comas. */
function posicionTras(formateado: string, cifras: number): number {
  if (cifras === 0) return formateado.startsWith("-") ? 1 : 0;
  let vistos = 0;
  for (let i = 0; i < formateado.length; i++) {
    if (/[\d,]/.test(formateado[i]) && ++vistos === cifras) return i + 1;
  }
  return formateado.length;
}

/**
 * Campo «Monto» del anticipo (decisión del usuario: didáctico y seguro). Pone puntos de miles y
 * coma decimal mientras se escribe; arriba dice en verde si es positivo (suma a «Saldo a mi
 * favor») o en rojo si es negativo (saldo a favor del comprador, suma a «Le debo»); abajo lo
 * muestra en letras. El botón ± cambia el signo (algunos teclados del celular no tienen «-»).
 */
export function CampoMonto({ inicial }: { inicial?: number } = {}) {
  const ref = useRef<HTMLInputElement>(null);
  const idEtiqueta = useId();
  // Valor inicial (al corregir un anticipo): la coma decimal es la colombiana.
  const [valor, setValor] = useState(inicial == null ? "" : formatearMonto(String(inicial).replace(".", ",")));
  const monto = montoDesdeTexto(valor.replace(/,$/, ""), { negativo: true });
  const negativo = valor.startsWith("-");

  useEffect(() => {
    const form = ref.current?.form;
    const limpiar = () => setValor("");
    form?.addEventListener("reset", limpiar);
    return () => form?.removeEventListener("reset", limpiar);
  }, []);

  return (
    <div className="sm:col-span-2">
      <span className="etiqueta" id={idEtiqueta}>Monto (COP)</span>
      {!monto ? (
        <p className="mb-2 rounded-lg bg-primario-suave px-3 py-2 text-sm text-suave">
          Escriba el valor. <strong className="text-ok">Positivo</strong>: dinero que le entrego al comprador.{" "}
          <strong className="text-error">Negativo</strong> (con −): dinero que le debo.
        </p>
      ) : negativo ? (
        <p className="mb-2 rounded-lg border-2 border-error bg-error-suave px-3 py-2 text-sm font-semibold text-error" aria-live="polite">
          NEGATIVO · Es una deuda: saldo a favor del comprador, dinero que usted le debe. Suma a «Le debo».
        </p>
      ) : (
        <p className="mb-2 rounded-lg border-2 border-ok bg-ok-suave px-3 py-2 text-sm font-semibold text-ok" aria-live="polite">
          POSITIVO · Es un anticipo: dinero que usted le entrega al comprador. Suma a «Saldo a mi favor».
        </p>
      )}
      <div className="flex gap-2">
        <input ref={ref} name="monto" inputMode="decimal" autoComplete="off" required aria-labelledby={idEtiqueta}
          placeholder="Ej.: 5.000.000 o -2.000.000" value={valor}
          className={`campo flex-1 text-lg font-bold tabular-nums ${!monto ? "" : negativo ? "border-error text-error" : "border-ok text-ok"}`}
          onChange={(e) => {
            const input = e.currentTarget;
            const cursor = input.selectionStart ?? input.value.length;
            const cifras = input.value.slice(0, cursor).replace(/[^\d,]/g, "").length;
            const nuevo = formatearMonto(input.value);
            setValor(nuevo);
            requestAnimationFrame(() => { const p = posicionTras(nuevo, cifras); input.setSelectionRange(p, p); });
          }}
          onBlur={() => setValor((v) => v.replace(/,$/, ""))} />
        <button type="button" className="boton-secundario min-w-14 px-3 text-lg font-black" title="Cambiar el signo (positivo / negativo)"
          aria-label="Cambiar el signo del monto"
          onClick={() => setValor((v) => (v.startsWith("-") ? v.slice(1) : `-${v}`))}>±</button>
      </div>
      {monto ? (
        <p className={`mt-1 text-sm font-semibold ${negativo ? "text-error" : "text-ok"}`}>
          {textoMonto(monto)} · {montoEnLetras(monto)}{negativo ? " (negativo)" : ""}
        </p>
      ) : null}
    </div>
  );
}
