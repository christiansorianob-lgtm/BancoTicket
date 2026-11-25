"use client";
import { useState } from "react";

const OTRO = "__otro__";

/**
 * Proveedor como lista desplegable (decisión del usuario 2026-11-25): los nombres oficiales
 * (configuracion.proveedores_oficiales), «Sin proveedor» y «Otro (escribir)…» para uno que aún no está
 * en la lista. Si el tiquete trae un nombre no oficial, aparece marcado «(actual, no oficial)».
 * El valor viaja en el campo oculto `proveedor`, como antes.
 */
export function CampoProveedor({ actual, oficiales }: { actual: string | null | undefined; oficiales: string[] }) {
  const inicial = (actual ?? "").trim();
  const esNoOficial = inicial !== "" && !oficiales.includes(inicial);
  const [eleccion, setEleccion] = useState(inicial);
  const [escrito, setEscrito] = useState("");
  const valor = eleccion === OTRO ? escrito.trim() : eleccion;

  return (
    <label>
      <span className="etiqueta">Proveedor</span>
      <select className="campo" value={eleccion} onChange={(e) => setEleccion(e.target.value)}>
        <option value="">— Sin proveedor —</option>
        {esNoOficial && <option value={inicial}>{inicial} (actual, no oficial)</option>}
        {oficiales.map((p) => <option key={p} value={p}>{p}</option>)}
        <option value={OTRO}>Otro (escribir)…</option>
      </select>
      {eleccion === OTRO && (
        <input className="campo mt-2" value={escrito} onChange={(e) => setEscrito(e.target.value)} placeholder="Nombre del proveedor" autoFocus />
      )}
      <input type="hidden" name="proveedor" value={valor} />
    </label>
  );
}
