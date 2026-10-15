import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type Configuracion = {
  fecha_filtro_precio: "entrada";
  vigencia_enlace_anticipo_horas: number;
  comprador_ve_toneladas_sin_precio: boolean;
  placa_obligatoria: boolean;
  meses_conservacion_fotos: number;
};

const PREDETERMINADA: Configuracion = {
  fecha_filtro_precio: "entrada",
  vigencia_enlace_anticipo_horas: 48,
  comprador_ve_toneladas_sin_precio: true,
  placa_obligatoria: true,
  meses_conservacion_fotos: 6,
};

/** Valores pendientes de decisión: viven en la tabla `configuracion`. */
export async function leerConfiguracion(): Promise<Configuracion> {
  const { data } = await supabaseAdmin().from("configuracion").select("clave, valor");
  const c = { ...PREDETERMINADA } as Record<string, unknown>;
  for (const fila of data ?? []) c[fila.clave] = fila.valor;
  return c as Configuracion;
}
