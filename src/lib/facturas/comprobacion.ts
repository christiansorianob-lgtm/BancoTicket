/**
 * Comprobación de los cálculos de una factura de venta (sin IA y sin dependencias: navegador,
 * servidor y pruebas). Rehace cada cuenta con los datos de la factura y los porcentajes de la
 * configuración (`tarifas_factura`) y dice si coincide con lo facturado.
 */
import type { FacturaLeida } from "./tipos";

/** Porcentajes esperados (5 = 5 %). ReteIVA es sobre el IVA; los demás, sobre el subtotal. */
export type TarifasFactura = { iva: number; retefuente: number; reteiva: number; reteica: number };
export const TARIFAS_PREDETERMINADAS: TarifasFactura = { iva: 5, retefuente: 1.5, reteiva: 15, reteica: 0 };

export type Calculo = {
  nombre: string;
  /** La cuenta tal como se explica: «469.542.120 × 5 %». */
  cuenta: string;
  calculado: number | null;
  facturado: number | null;
  /** Calculado − facturado (null si falta algún dato). */
  diferencia: number | null;
  ok: boolean;
  /** Explicación corta: porcentaje real, dato faltante o tolerancia. */
  nota?: string;
};

/** Diferencia máxima aceptada por redondeo: 1 peso. */
const TOLERANCIA = 1;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Pesos con decimales solo si los tiene: 7043131.8 → «$ 7.043.131,80», 23477106 → «$ 23.477.106». */
export function pesos(n: number): string {
  const v = r2(n);
  const d = Number.isInteger(v) ? 0 : 2;
  return `$ ${v.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: 2 })}`;
}
export const porcentaje = (n: number, decimales = 2) => `${n.toLocaleString("es-CO", { maximumFractionDigits: decimales })} %`;
/** Precio por kilo con hasta 4 decimales (puede venir con fracción de peso). */
const precioKilo = (n: number) => `$ ${n.toLocaleString("es-CO", { maximumFractionDigits: 4 })}`;

function calculo(nombre: string, cuenta: string, calculado: number | null, facturado: number | null, tolerancia = TOLERANCIA): Calculo {
  if (calculado == null || facturado == null) return { nombre, cuenta, calculado, facturado, diferencia: null, ok: false, nota: "Falta un dato para hacer la cuenta." };
  const diferencia = r2(calculado - facturado);
  return { nombre, cuenta, calculado: r2(calculado), facturado, diferencia, ok: Math.abs(diferencia) <= tolerancia };
}

/** Qué porcentaje real es `parte` de `base`; nada si es el mismo (la diferencia es de digitación o redondeo). */
function real(parte: number | null, base: number | null, tasa: number) {
  if (parte == null || !base) return "";
  const p = Math.round((parte / base) * 100 * 100) / 100;
  return p === tasa ? "" : ` La factura equivale al ${porcentaje(p)}.`;
}

export function comprobarFactura(d: FacturaLeida, t: TarifasFactura): Calculo[] {
  const { kilos, precio_kilo: precio, subtotal, iva, total_a_pagar: total } = d;
  const rf = d.retefuente ?? 0, ri = d.reteiva ?? 0, rc = d.reteica ?? 0;
  const c: Calculo[] = [];

  // El precio por kilo puede venir redondeado: tolerancia de 0,1 % del subtotal o 100 pesos.
  const st = calculo("Subtotal", kilos != null && precio != null ? `${kilos.toLocaleString("es-CO")} kg × ${precioKilo(precio)}` : "kilos × precio por kilo",
    kilos != null && precio != null ? kilos * precio : null, subtotal, Math.max(100, Math.abs(subtotal ?? 0) * 0.001));
  if (st.ok && st.diferencia) st.nota = "Diferencia mínima aceptada: el precio por kilo viene redondeado.";
  c.push(st);

  const sobre = (nombre: string, base: number | null, nombreBase: string, tasa: number, valor: number | null) => {
    const k = calculo(nombre, base != null ? `${pesos(base)} × ${porcentaje(tasa)}` : `${nombreBase} × ${porcentaje(tasa)}`, base != null ? (base * tasa) / 100 : null, valor);
    if (k.diferencia != null && !k.ok) k.nota = `Se esperaba el ${porcentaje(tasa)} del ${nombreBase}.${real(valor, base, tasa)}`;
    return k;
  };
  c.push(sobre("IVA", subtotal, "subtotal", t.iva, iva));
  // Cada retención se aplica o no según la factura (las reales traen unas sí y otras no): en 0 no
  // se aplicó y está bien; si trae valor, debe ser exactamente su porcentaje.
  const retencion = (nombre: string, base: number | null, nombreBase: string, tasa: number, valor: number): Calculo =>
    valor === 0 ? { nombre, cuenta: "No se aplicó en esta factura", calculado: 0, facturado: 0, diferencia: 0, ok: true } : sobre(nombre, base, nombreBase, tasa, valor);
  c.push(retencion("ReteFuente", subtotal, "subtotal", t.retefuente, rf));
  c.push(retencion("ReteIVA", iva, "IVA", t.reteiva, ri));
  c.push(retencion("ReteICA", subtotal, "subtotal", t.reteica, rc));

  c.push(calculo("Total a pagar",
    subtotal != null && iva != null ? `${pesos(subtotal)} + ${pesos(iva)} − ${pesos(rf)} − ${pesos(ri)} − ${pesos(rc)}` : "subtotal + IVA − ReteFuente − ReteIVA − ReteICA",
    subtotal != null && iva != null ? subtotal + iva - rf - ri - rc : null, total));
  return c;
}

/** Lee `tarifas_factura` de la configuración; si falta algún valor, usa el predeterminado. */
export function tarifasDesde(valor: unknown): TarifasFactura {
  const v = (valor ?? {}) as Partial<Record<keyof TarifasFactura, unknown>>;
  const n = (k: keyof TarifasFactura) => (typeof v[k] === "number" ? (v[k] as number) : TARIFAS_PREDETERMINADAS[k]);
  return { iva: n("iva"), retefuente: n("retefuente"), reteiva: n("reteiva"), reteica: n("reteica") };
}
