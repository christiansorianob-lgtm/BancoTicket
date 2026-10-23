import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { Vacio } from "@/components/ui";
import type { FilaSaldo } from "@/components/saldo";
import { textoSaldo } from "@/lib/saldo";

/** Estado de cuenta de todos los compradores (Consultor, solo lectura). Mismas palabras de la administración. */
export default async function SaldosConsulta() {
  const supabase = await supabaseServidor();
  const { data: saldos } = await supabase.from("saldos").select("*").order("nombre");
  const filas = (saldos ?? []) as FilaSaldo[];
  const totalFondos = filas.reduce((s, f) => s + Math.max(0, Number(f.saldo)), 0);
  const totalDeuda = filas.reduce((s, f) => s + Math.min(0, Number(f.saldo)), 0);

  return (
    <>
      <h1 className="titulo">Estado de cuenta de los compradores</h1>
      <p className="text-sm text-suave">Perfil de consulta: puede ver la información, pero no modificarla.</p>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="tarjeta">
          <p className="text-sm font-bold text-ok">Total saldo a favor de la administración</p>
          <p className="text-2xl font-bold text-ok">{formatoPesos(totalFondos)}</p>
          <p className="text-xs text-suave">Anticipos que los compradores aún no han cubierto con fruta.</p>
        </div>
        <div className="tarjeta">
          <p className="text-sm font-bold text-error">Total que la administración les debe</p>
          <p className="text-2xl font-bold text-error">{formatoPesos(-totalDeuda)}</p>
          <p className="text-xs text-suave">Fruta entregada que aún no se les ha pagado.</p>
        </div>
      </section>

      {filas.length === 0 ? <Vacio>Aún no hay compradores.</Vacio> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filas.map((f) => {
            const t = textoSaldo(f.saldo, "admin");
            const color = t.tono === "debe" ? "text-error" : t.tono === "favor" ? "text-ok" : "text-profundo";
            return (
              <Link key={f.comprador_id} href={`/consulta/compradores/${f.comprador_id}`} className="tarjeta block transition hover:shadow-md">
                <p className="font-bold text-profundo">{f.nombre}</p>
                <p className={`text-sm font-bold ${color}`}>{t.titulo}</p>
                <p className={`text-2xl font-black ${color}`}>{t.monto}</p>
                <dl className="mt-2 grid grid-cols-3 gap-1 text-xs">
                  <div><dt className="text-suave">Anticipos</dt><dd className="font-semibold">{formatoPesos(f.anticipos_confirmados)}</dd></div>
                  <div><dt className="text-suave">Fruta</dt><dd className="font-semibold">{formatoPesos(f.valor_tiquetes)}</dd></div>
                  <div><dt className="text-suave">Toneladas</dt><dd className="font-semibold">{formatoToneladas(f.toneladas_valoradas)}</dd></div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
