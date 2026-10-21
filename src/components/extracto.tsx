import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha, ZONA } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Vacio } from "@/components/ui";
import { textoSaldo, type Vista } from "@/lib/saldo";

const diaColombia = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA });

type Movimiento ={ fecha: string; tipo: string; referencia_id: string; detalle: string; credito: number; debito: number };

/** «Saldo a mi favor $ X» / «Le debo $ X» (administración) o «Debo $ X» / «Me deben $ X» (comprador). */
function Saldo({ valor, vista }: { valor: number; vista: Vista }) {
  const t = textoSaldo(valor, vista);
  if (t.tono === "cero") return <>Al día</>;
  return <><span className={t.tono === "favor" ? "text-ok" : "text-alerta"}>{t.titulo}</span> {t.monto}</>;
}

/** Movimientos en orden cronológico con saldo acumulado (RLS limita a lo propio). */
export async function Extracto({ compradorId, desde, hasta, vista }: { compradorId: string; desde?: string; hasta?: string; vista: Vista }) {
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("extracto").select("*").eq("comprador_id", compradorId).order("fecha", { ascending: true });
  const todas = ((data ?? []) as Movimiento[]).reduce<(Movimiento & { saldo: number; dia: string })[]>((acc, m) => {
    const previo = acc.at(-1)?.saldo ?? 0;
    acc.push({ ...m, saldo: previo + Number(m.credito) - Number(m.debito), dia: diaColombia.format(new Date(m.fecha)) });
    return acc;
  }, []);
  const filas = todas.filter((m) => (!desde || m.dia >= desde) && (!hasta || m.dia <= hasta)).reverse();

  if (filas.length === 0) return <Vacio>Todavía no hay movimientos con valor.</Vacio>;

  return (
    <>
      {/* Tarjetas en celular */}
      <ul className="space-y-2 md:hidden">
        {filas.map((m) => (
          <li key={m.tipo + m.referencia_id} className="tarjeta p-3">
            <div className="flex justify-between gap-2 text-sm">
              <span className="text-suave">{fecha(m.fecha)}</span>
              <span className={`font-bold ${Number(m.credito) > 0 ? "text-ok" : "text-error"}`}>
                {Number(m.credito) > 0 ? `+${formatoPesos(m.credito)}` : `−${formatoPesos(m.debito)}`}
              </span>
            </div>
            <p className="text-sm">{m.detalle}</p>
            <p className="text-right text-xs font-semibold text-suave">Queda: <Saldo valor={m.saldo} vista={vista} /></p>
          </li>
        ))}
      </ul>
      {/* Tabla en pantallas medianas y grandes */}
      <div className="tarjeta hidden overflow-x-auto p-0 md:block">
        <table className="w-full text-sm">
          <thead className="bg-primario-suave text-left text-profundo">
            <tr><th className="p-3">Fecha</th><th className="p-3">Detalle</th><th className="p-3 text-right">Suma (anticipos)</th><th className="p-3 text-right">Resta (fruta y saldos a favor)</th><th className="p-3 text-right">Queda</th></tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.tipo + m.referencia_id} className="border-t border-borde/60">
                <td className="p-3 whitespace-nowrap">{fecha(m.fecha)}</td>
                <td className="p-3">{m.detalle}</td>
                <td className="p-3 text-right text-ok">{Number(m.credito) > 0 ? formatoPesos(m.credito) : ""}</td>
                <td className="p-3 text-right text-error">{Number(m.debito) > 0 ? formatoPesos(m.debito) : ""}</td>
                <td className="p-3 text-right font-semibold whitespace-nowrap"><Saldo valor={m.saldo} vista={vista} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
