import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { EstadoChip, Vacio } from "@/components/ui";

export default async function MisAnticipos() {
  await exigirComprador();
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("anticipos").select("*").order("fecha", { ascending: false }).limit(200);
  const filas = data ?? [];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="titulo">Anticipos recibidos</h1>
      <p className="text-sm text-suave">Para confirmar uno pendiente, abra el enlace que le llegó por WhatsApp o correo.</p>
      {filas.length === 0 && <Vacio>No tiene anticipos registrados.</Vacio>}
      <ul className="space-y-3">
        {filas.map((a) => (
          <li key={a.id} className="tarjeta">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold text-profundo">{formatoPesos(a.monto)}</p>
                <p className="text-sm text-suave">Anticipo del {fecha(a.fecha)}</p>
              </div>
              <EstadoChip estado={a.estado} />
            </div>
            {a.nota && <p className="mt-2 text-sm">{a.nota}</p>}
            {a.respondido_en && <p className="mt-1 text-xs text-suave">Respondido: {fechaHora(a.respondido_en)}</p>}
            {a.motivo_disputa && <p className="mt-1 text-sm text-error">Motivo: {a.motivo_disputa}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
