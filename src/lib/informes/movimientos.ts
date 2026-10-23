/**
 * Reporte «Tiquetes y anticipos» de un comprador: tiquetes aprobados (por fecha de subida) y
 * anticipos confirmados (por fecha de confirmación) en una sola lista, con el saldo acumulado.
 * Saldo = anticipos confirmados − valor de tiquetes con precio (igual que la vista `saldos`).
 * Solo lee: no reparte pagos ni guarda nada.
 */

export type TiqueteCuenta = {
  id: string; cargado_en: string; extractora: string; numero: string; fecha_entrada: string;
  peso_neto_t: number; precio_tonelada: number | null; valor: number | null;
};

export type AnticipoCuenta = { id: string; confirmado_en: string; monto: number; nota: string | null };

export type Movimiento = {
  id: string;
  fecha: string; // ISO: subida del tiquete o confirmación del anticipo
  tipo: "tiquete" | "anticipo";
  detalle: string;
  fecha_entrada: string | null;
  peso_neto_t: number | null;
  precio_tonelada: number | null;
  valor: number | null; // cargo del tiquete (null = sin precio)
  anticipo: number | null; // abono (negativo = saldo a favor del comprador)
  saldo: number; // acumulado después de esta fila
  observacion: string | null;
};

export type Cuenta = {
  saldoInicial: number; // lo que traía antes de «desde»
  movimientos: Movimiento[];
  totalTiquetes: number;
  totalAnticipos: number;
  sinPrecio: number;
  saldoFinal: number;
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** `desde` y `hasta` en "aaaa-mm-dd" (días de Colombia), opcionales. */
export function armarCuenta(tiquetes: TiqueteCuenta[], anticipos: AnticipoCuenta[], desde = "", hasta = ""): Cuenta {
  const todos: Omit<Movimiento, "saldo">[] = [
    ...tiquetes.map((t) => ({
      id: t.id, fecha: t.cargado_en, tipo: "tiquete" as const, detalle: `${t.extractora} N° ${t.numero}`,
      fecha_entrada: t.fecha_entrada, peso_neto_t: t.peso_neto_t, precio_tonelada: t.precio_tonelada,
      valor: t.precio_tonelada == null ? null : t.valor, anticipo: null,
      observacion: t.precio_tonelada == null ? "Sin precio aún" : null,
    })),
    ...anticipos.map((a) => ({
      id: a.id, fecha: a.confirmado_en, tipo: "anticipo" as const,
      detalle: a.nota?.trim() || (a.monto < 0 ? "Saldo a favor del comprador" : "Anticipo"),
      fecha_entrada: null, peso_neto_t: null, precio_tonelada: null, valor: null, anticipo: a.monto,
      observacion: null,
    })),
  ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime() || (a.tipo === b.tipo ? 0 : a.tipo === "anticipo" ? -1 : 1));

  const inicio = desde ? new Date(`${desde}T00:00:00-05:00`).getTime() : -Infinity;
  const fin = hasta ? new Date(`${hasta}T23:59:59.999-05:00`).getTime() : Infinity;
  const efecto = (m: Omit<Movimiento, "saldo">) => (m.anticipo ?? 0) - (m.valor ?? 0);

  let saldo = 0;
  let saldoInicial = 0;
  const movimientos: Movimiento[] = [];
  for (const m of todos) {
    const t = new Date(m.fecha).getTime();
    if (t > fin) break;
    saldo = centavos(saldo + efecto(m));
    if (t < inicio) saldoInicial = saldo;
    else movimientos.push({ ...m, saldo });
  }

  return {
    saldoInicial,
    movimientos,
    totalTiquetes: centavos(movimientos.reduce((s, m) => s + (m.valor ?? 0), 0)),
    totalAnticipos: centavos(movimientos.reduce((s, m) => s + (m.anticipo ?? 0), 0)),
    sinPrecio: movimientos.filter((m) => m.tipo === "tiquete" && m.valor == null).length,
    saldoFinal: saldo,
  };
}
