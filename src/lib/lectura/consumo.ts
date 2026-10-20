import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Precio por millón de tokens (USD), tarifa publicada de Anthropic a octubre de 2026. */
const PRECIOS: Record<string, { entrada: number; salida: number }> = {
  "claude-haiku-5-5": { entrada: 0.1, salida: 0.5 },
  "claude-opus-5-5": { entrada: 4, salida: 20 },
};

type Uso = { input_tokens?: number | null; output_tokens?: number | null; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null };

/** Guarda tokens y costo estimado de una llamada a la IA. Nunca hace fallar la operación. */
export async function registrarConsumo(tipo: "lectura" | "aprendizaje", modelo: string, uso: Uso | null | undefined, usuarioId?: string) {
  try {
    const entrada = (uso?.input_tokens ?? 0) + (uso?.cache_creation_input_tokens ?? 0) + (uso?.cache_read_input_tokens ?? 0);
    const salida = uso?.output_tokens ?? 0;
    const p = PRECIOS[modelo] ?? { entrada: 0, salida: 0 };
    const costo = (entrada * p.entrada + salida * p.salida) / 1_000_000;
    await supabaseAdmin().from("consumo_ia").insert({
      tipo, modelo, tokens_entrada: entrada, tokens_salida: salida, costo_usd: costo, usuario_id: usuarioId ?? null,
    });
  } catch (e) {
    console.error("No se registró el consumo de IA", e);
  }
}
