import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TARIFAS_POR_TIPO_PREDETERMINADAS, tarifasDesde, tarifasPorTipoDesde, type TarifasPorTipo } from "@/lib/facturas/comprobacion";

export type Configuracion = {
  fecha_filtro_precio: "entrada";
  vigencia_enlace_anticipo_horas: number;
  comprador_ve_toneladas_sin_precio: boolean;
  placa_obligatoria: boolean;
  meses_conservacion_fotos: number;
  /** Respaldo completo: avisar si pasan más de estos días sin uno (migración 0024). */
  dias_aviso_respaldo: number;
  /** Fecha ISO del último respaldo completo (la escribe la app). */
  ultimo_respaldo: string | null;
  /** Tarifas permitidas en las facturas de venta según su tipo (migración 0033; antes 0031 y 0026). */
  tarifas_factura: TarifasPorTipo;
};

const PREDETERMINADA: Configuracion = {
  fecha_filtro_precio: "entrada",
  vigencia_enlace_anticipo_horas: 48,
  comprador_ve_toneladas_sin_precio: true,
  placa_obligatoria: true,
  meses_conservacion_fotos: 6,
  dias_aviso_respaldo: 15,
  ultimo_respaldo: null,
  tarifas_factura: TARIFAS_POR_TIPO_PREDETERMINADAS,
};

/** Valores pendientes de decisión: viven en la tabla `configuracion`. */
export async function leerConfiguracion(): Promise<Configuracion> {
  const { data } = await supabaseAdmin().from("configuracion").select("clave, valor");
  const c = { ...PREDETERMINADA } as Record<string, unknown>;
  for (const fila of data ?? []) c[fila.clave] = fila.valor;
  // Tarifas por tipo de factura (0033); si no está, la lista única de 0031 o la de 0026.
  const anterior = c.tarifas_permitidas_factura ?? (c.tarifas_factura !== PREDETERMINADA.tarifas_factura ? c.tarifas_factura : undefined);
  c.tarifas_factura = tarifasPorTipoDesde(c.tarifas_por_tipo_factura, anterior ? tarifasDesde(anterior) : undefined);
  return c as Configuracion;
}
