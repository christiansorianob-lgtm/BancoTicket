import { formatoPesos, formatoToneladas } from "@/lib/numeros";

export type FilaSaldo = {
  comprador_id: string;
  nombre: string;
  anticipos_confirmados: number;
  valor_tiquetes: number;
  toneladas_valoradas: number;
  saldo: number;
};

/** Saldo positivo: le quedan fondos. Negativo: se le debe la diferencia. */
export function TarjetaSaldo({ fila }: { fila: FilaSaldo | null }) {
  const saldo = Number(fila?.saldo ?? 0);
  return (
    <section className="tarjeta overflow-hidden bg-gradient-to-br from-primario to-profundo text-white">
      <p className="text-sm text-white/75">Saldo</p>
      <p className="mt-1 text-4xl font-black tracking-tight">{formatoPesos(saldo)}</p>
      <p className={`mt-1 text-sm font-medium ${saldo < 0 ? "text-amber-300" : "text-emerald-200"}`}>
        {saldo < 0 ? "Se le debe esta diferencia" : saldo > 0 ? "Fondos disponibles de los anticipos" : "Cuenta al día"}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-sm">
        <div><dt className="text-white/70">Anticipos</dt><dd className="font-semibold">{formatoPesos(fila?.anticipos_confirmados ?? 0)}</dd></div>
        <div><dt className="text-white/70">Tiquetes</dt><dd className="font-semibold">{formatoPesos(fila?.valor_tiquetes ?? 0)}</dd></div>
        <div><dt className="text-white/70">Toneladas</dt><dd className="font-semibold">{formatoToneladas(fila?.toneladas_valoradas ?? 0)}</dd></div>
      </dl>
    </section>
  );
}
