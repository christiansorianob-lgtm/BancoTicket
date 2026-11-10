import "server-only";
import type { supabaseServidor } from "@/lib/supabase/servidor";
import { numerosCuenta } from "./consulta";
import { nitDigitos, type ClienteSaldo, type CuentaSaldo, type FormaPago } from "./tipos";

type Supabase = Awaited<ReturnType<typeof supabaseServidor>>;

/**
 * Un renglón de la cuenta: una factura (cargo, sube la deuda) o un abono (baja la deuda).
 * Las facturas anuladas y los abonos anulados se muestran pero no cuentan en el saldo.
 */
export type Movimiento = {
  id: string; tipo: "factura" | "abono"; fecha: string | null; creado: string; detalle: string;
  cargo: number; abono: number; vigente: boolean; saldo: number;
  // Factura
  numero?: string; emisor?: string | null; vence?: string | null;
  // Abono
  forma_pago?: FormaPago; referencia?: string | null; realizado_por?: string; observacion?: string | null;
  soporte_path?: string | null; anulado_motivo?: string | null; anulado_at?: string | null;
};

/**
 * El cliente, sus cuentas con cada emisor y, si se elige un emisor, la cuenta de ese cliente con ese
 * emisor (decisión del usuario 2026-11-10: cada una es independiente): movimientos por fecha con el
 * saldo acumulado.
 */
export async function cuentaCliente(supabase: Supabase, id: string, emisorNit?: string): Promise<{
  cliente: ClienteSaldo; cuentas: CuentaSaldo[]; cuenta: CuentaSaldo | null; movimientos: Movimiento[];
} | null> {
  const [{ data: c }, { data: cs }] = await Promise.all([
    supabase.from("fact_clientes_saldo").select("*").eq("id", id).maybeSingle(),
    supabase.from("fact_cuentas_saldo").select("*").eq("cliente_id", id).order("emisor_nombre"),
  ]);
  if (!c) return null;
  const cliente = {
    ...c, facturas: Number(c.facturas), facturado: Number(c.facturado), abonos: Number(c.abonos), abonado: Number(c.abonado),
    deuda: Number(c.deuda), facturas_vencidas: Number(c.facturas_vencidas),
  } as ClienteSaldo;
  const cuentas = (cs ?? []).map(numerosCuenta);
  const cuenta = emisorNit == null ? null : cuentas.find((x) => x.emisor_nit === emisorNit) ?? null;
  if (!cuenta) return { cliente, cuentas, cuenta, movimientos: [] };

  const [{ data: facturas }, { data: abonos }] = await Promise.all([
    supabase.from("fact_facturas").select("id, numero_factura, emisor_razon_social, emisor_nit, fecha_emision, fecha_vencimiento, total_a_pagar, anulada, created_at").eq("cliente_id", id),
    supabase.from("fact_abonos").select("*").eq("cliente_id", id).eq("emisor_nit", cuenta.emisor_nit),
  ]);
  const movimientos: Movimiento[] = [
    ...(facturas ?? []).filter((f) => nitDigitos(f.emisor_nit) === cuenta.emisor_nit).map((f) => ({
      id: f.id, tipo: "factura" as const, fecha: f.fecha_emision, creado: f.created_at, detalle: `Factura ${f.numero_factura}`,
      cargo: Number(f.total_a_pagar), abono: 0, vigente: !f.anulada, saldo: 0,
      numero: f.numero_factura, emisor: f.emisor_razon_social, vence: f.fecha_vencimiento,
    })),
    ...(abonos ?? []).map((a) => ({
      id: a.id, tipo: "abono" as const, fecha: a.fecha, creado: a.created_at, detalle: "Abono",
      cargo: 0, abono: Number(a.monto), vigente: a.estado === "VIGENTE", saldo: 0,
      forma_pago: a.forma_pago, referencia: a.referencia, realizado_por: a.realizado_por, observacion: a.observacion,
      soporte_path: a.soporte_path, anulado_motivo: a.anulado_motivo, anulado_at: a.anulado_at,
    })),
  ].sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "") || a.creado.localeCompare(b.creado));

  let saldo = 0;
  for (const m of movimientos) {
    if (m.vigente) saldo += m.cargo - m.abono;
    m.saldo = saldo;
  }
  return { cliente, cuentas, cuenta, movimientos };
}
