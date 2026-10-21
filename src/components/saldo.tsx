import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { textoSaldo, type Vista } from "@/lib/saldo";

export type FilaSaldo = {
  comprador_id: string;
  nombre: string;
  anticipos_confirmados: number;
  valor_tiquetes: number;
  toneladas_valoradas: number;
  saldo: number;
};

/**
 * Estado de cuenta con palabras claras. Administración: «Saldo a mi favor» / «Le debo».
 * Comprador: «Debo» / «Me deben» (ver src/lib/saldo.ts).
 */
export function TarjetaSaldo({ fila, vista }: { fila: FilaSaldo | null; vista: Vista }) {
  const t = textoSaldo(fila?.saldo, vista);
  return (
    <section className="tarjeta overflow-hidden bg-gradient-to-br from-primario to-profundo text-white">
      <p className={`text-sm font-bold uppercase tracking-wide ${t.tono === "favor" ? "text-emerald-200" : t.tono === "debe" ? "text-amber-300" : "text-white/75"}`}>
        {t.titulo}
      </p>
      <p className="mt-1 text-4xl font-black tracking-tight">{t.monto}</p>
      <p className="mt-1 text-sm text-white/85">{t.explicacion}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-sm">
        <div><dt className="text-white/70">Anticipos</dt><dd className="font-semibold">{formatoPesos(fila?.anticipos_confirmados ?? 0)}</dd></div>
        <div><dt className="text-white/70">Fruta entregada</dt><dd className="font-semibold">− {formatoPesos(fila?.valor_tiquetes ?? 0)}</dd></div>
        <div><dt className="text-white/70">Toneladas</dt><dd className="font-semibold">{formatoToneladas(fila?.toneladas_valoradas ?? 0)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-white/60">Anticipos − fruta entregada con precio = saldo.</p>
    </section>
  );
}
