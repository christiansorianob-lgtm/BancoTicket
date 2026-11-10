/**
 * Comprobación de los cálculos de una factura de venta (sin IA y sin dependencias: navegador,
 * servidor y pruebas). Rehace cada cuenta con el PORCENTAJE IMPRESO en la factura (si se leyó) y
 * verifica que sea una tarifa permitida (configuración `tarifas_permitidas_factura`); si no se leyó,
 * prueba con las tarifas permitidas. Dice si coincide con lo facturado.
 */
import type { FacturaLeida } from "./tipos";

/**
 * Tarifas permitidas por impuesto (5 = 5 %). ReteIVA es sobre el IVA; los demás, sobre el subtotal.
 * IVA: 5 % la fruta de palma y 19 % la comisión. Lista vacía = cualquier porcentaje.
 */
export type TarifasFactura = { iva: number[]; retefuente: number[]; reteiva: number[]; reteica: number[] };
export const TARIFAS_PREDETERMINADAS: TarifasFactura = { iva: [5, 19], retefuente: [0, 1.5], reteiva: [15], reteica: [] };

/** «5 % o 19 %»; «cualquiera» si la lista está vacía. */
export const listaTarifas = (l: number[]) => (l.length ? l.map((n) => porcentaje(n)).join(" o ") : "cualquiera");

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

/** Qué porcentaje real es `parte` de `base` (con 2 decimales). */
const realDe = (parte: number, base: number) => Math.round((parte / base) * 100 * 100) / 100;
const mismo = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/**
 * Un impuesto: con el porcentaje impreso si se leyó (y que sea una tarifa permitida); si no, con la
 * tarifa permitida que coincida. Una retención en 0 es que no se aplicó.
 */
function impuesto(nombre: string, base: number | null, nombreBase: string, valor: number | null, impreso: number | null | undefined, permitidas: number[], retencion: boolean): Calculo {
  if (retencion && valor === 0) return { nombre, cuenta: "No se aplicó en esta factura", calculado: 0, facturado: 0, diferencia: 0, ok: true };
  if (base == null || valor == null) return calculo(nombre, `${nombreBase} × porcentaje`, null, null);
  const real = base ? realDe(valor, base) : 0;

  if (impreso != null) {
    const k = calculo(nombre, `${pesos(base)} × ${porcentaje(impreso)} (como dice la factura)`, (base * impreso) / 100, valor);
    if (permitidas.length && !permitidas.some((t) => mismo(t, impreso))) {
      k.ok = false;
      k.nota = `El ${porcentaje(impreso)} que trae la factura no es una tarifa permitida (${listaTarifas(permitidas)}).`;
    } else if (!k.ok) k.nota = `No da el ${porcentaje(impreso)} del ${nombreBase} que dice la factura: equivale al ${porcentaje(real)}.`;
    return k;
  }

  // La factura no trae el porcentaje (o no se leyó): se prueba con cada tarifa permitida.
  const coincide = permitidas.find((t) => Math.abs((base * t) / 100 - valor) <= TOLERANCIA);
  if (coincide != null) {
    const k = calculo(nombre, `${pesos(base)} × ${porcentaje(coincide)}`, (base * coincide) / 100, valor);
    k.nota = `Sin porcentaje leído de la factura: coincide con la tarifa del ${porcentaje(coincide)}.`;
    return k;
  }
  if (!permitidas.length) return { nombre, cuenta: `${pesos(valor)} sobre ${pesos(base)}`, calculado: valor, facturado: valor, diferencia: 0, ok: true, nota: `Sin porcentaje para comprobar: equivale al ${porcentaje(real)} del ${nombreBase}.` };
  const k = calculo(nombre, `${pesos(base)} × ${porcentaje(permitidas[0])}`, (base * permitidas[0]) / 100, valor);
  k.ok = false;
  k.nota = `No coincide con ninguna tarifa permitida (${listaTarifas(permitidas)}): la factura equivale al ${porcentaje(real)} del ${nombreBase}.`;
  return k;
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

  c.push(impuesto("IVA", subtotal, "subtotal", iva, d.iva_pct, t.iva, false));
  // Cada retención se aplica o no según la factura (las reales traen unas sí y otras no).
  c.push(impuesto("ReteFuente", subtotal, "subtotal", rf, d.retefuente_pct, t.retefuente, true));
  c.push(impuesto("ReteIVA", iva, "IVA", ri, d.reteiva_pct, t.reteiva, true));
  c.push(impuesto("ReteICA", subtotal, "subtotal", rc, d.reteica_pct, t.reteica, true));

  c.push(calculo("Total a pagar",
    subtotal != null && iva != null ? `${pesos(subtotal)} + ${pesos(iva)} − ${pesos(rf)} − ${pesos(ri)} − ${pesos(rc)}` : "subtotal + IVA − ReteFuente − ReteIVA − ReteICA",
    subtotal != null && iva != null ? subtotal + iva - rf - ri - rc : null, total));
  return c;
}

/**
 * Lee las tarifas de la configuración (`tarifas_permitidas_factura`; la de 0026, `tarifas_factura`,
 * traía un solo número por impuesto y también se acepta). Si falta un impuesto, usa el predeterminado.
 */
export function tarifasDesde(valor: unknown): TarifasFactura {
  const v = (valor ?? {}) as Partial<Record<keyof TarifasFactura, unknown>>;
  const l = (k: keyof TarifasFactura) => {
    const x = v[k];
    if (Array.isArray(x)) return x.filter((n): n is number => typeof n === "number");
    if (typeof x === "number") return [x];
    return TARIFAS_PREDETERMINADAS[k];
  };
  return { iva: l("iva"), retefuente: l("retefuente"), reteiva: l("reteiva"), reteica: l("reteica") };
}
