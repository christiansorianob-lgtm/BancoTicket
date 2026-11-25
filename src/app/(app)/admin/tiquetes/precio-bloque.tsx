"use client";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { FormAccion } from "@/components/form-accion";
import { CampoPrecio } from "@/components/campo-precio";
import { asignarPrecioBloque } from "../acciones";

const n = (x: number) => x.toLocaleString("es-CO");

/**
 * Precio en bloque (decisión del usuario 2026-11-25, por seguridad): el aviso Sí / No dice el número
 * EXACTO de tiquetes que se van a tocar (`sinPrecio` / `conPrecio`: tiquetes vigentes del filtro, los
 * mismos que usa la base) y, si se desmarca «Solo a los que no tienen precio», advierte en rojo que se
 * cambiará el precio de los que ya lo tienen.
 */
export function PrecioBloque({ filtros, sinPrecio, conPrecio, abierto }: {
  filtros: { desde: string; hasta: string; extractora: string; comprador: string };
  sinPrecio: number; conPrecio: number; abierto: boolean;
}) {
  const [soloSin, setSoloSin] = useState(true);
  return (
    <details className="tarjeta" open={abierto}>
      <summary className="cursor-pointer font-bold text-profundo">Asignar precio en bloque a los tiquetes de este filtro</summary>
      <p className="mt-2 text-sm text-suave">En este filtro: <b className="text-texto">{n(sinPrecio)}</b> tiquete(s) sin precio y <b className="text-texto">{n(conPrecio)}</b> con precio.</p>
      <FormAccion accion={asignarPrecioBloque} boton="Aplicar precio" className="mt-3" textoSi="Sí, asignar precio"
        confirmarCon={(datos) => {
          const precio = String(datos.get("precio") ?? "").trim();
          if (!precio) return null; // el servidor responde «Escriba un precio…»
          const cambia = !soloSin && conPrecio > 0;
          return (
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-profundo">
                Se asignará $ {precio} por tonelada a <b>{n(soloSin ? sinPrecio : sinPrecio + conPrecio)}</b> tiquete(s)
                {soloSin ? <> sin precio. Los {n(conPrecio)} que ya tienen precio no se tocan.</> : "."}
              </p>
              {cambia && (
                <p className="flex items-start gap-2 rounded-lg bg-error-suave p-2 font-bold text-error">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
                  Atención: también se CAMBIARÁ el precio de {n(conPrecio)} tiquete(s) que ya lo tienen.
                </p>
              )}
              <p>¿Continuar?</p>
            </div>
          );
        }}>
        <input type="hidden" name="desde" value={filtros.desde} />
        <input type="hidden" name="hasta" value={filtros.hasta} />
        <input type="hidden" name="extractora" value={filtros.extractora} />
        <input type="hidden" name="comprador" value={filtros.comprador} />
        <div className="grid gap-3 sm:grid-cols-3">
          <CampoPrecio name="precio" />
          <label><span className="etiqueta">Motivo (opcional)</span><input name="motivo" className="campo" /></label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="solo_sin_precio" checked={soloSin} onChange={(e) => setSoloSin(e.target.checked)} className="size-5" /> Solo a los que no tienen precio
          </label>
        </div>
        {!soloSin && conPrecio > 0 && (
          <p className="flex items-start gap-2 rounded-lg border-2 border-error bg-error-suave p-2 text-sm font-bold text-error" role="alert">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            Desmarcó «Solo a los que no tienen precio»: también se cambiará el precio de {n(conPrecio)} tiquete(s) que ya lo tienen.
          </p>
        )}
        <p className="text-xs text-suave">Se aplica a los tiquetes vigentes que cumplen los filtros de arriba (fechas por fecha de entrada, en hora de Colombia), no solo a los de esta página.</p>
      </FormAccion>
    </details>
  );
}
