import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { contactoAdministracion } from "@/lib/avisos";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { EstadoChip, Vacio } from "@/components/ui";
import { ResponderAnticipo } from "../anticipo/[codigo]/responder";

export default async function MisAnticipos() {
  const perfil = await exigirComprador();
  const supabase = await supabaseServidor();
  const [{ data }, admin] = await Promise.all([
    supabase.from("anticipos").select("*, registrador:perfiles!anticipos_registrado_por_fkey(nombre)").order("fecha", { ascending: false }).limit(200),
    contactoAdministracion(),
  ]);
  const filas = data ?? [];
  const pendientes = filas.filter((a) => a.estado === "pendiente").length;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="titulo">Anticipos recibidos</h1>
      {pendientes > 0 && (
        <p className="text-sm text-suave">Tiene {pendientes} registro{pendientes === 1 ? "" : "s"} por confirmar. Confirme solo si el valor es correcto.</p>
      )}
      {filas.length === 0 && <Vacio>No tiene anticipos registrados.</Vacio>}
      <ul className="space-y-3">
        {filas.map((a) => (
          <li key={a.id} className={`tarjeta space-y-2 ${a.estado === "pendiente" ? "ring-2 ring-alerta" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-bold text-profundo">{formatoPesos(Math.abs(Number(a.monto)))}</p>
                <p className="text-sm text-suave">
                  {Number(a.monto) < 0 ? "Saldo a mi favor (me deben)" : "Anticipo recibido"} del {fecha(a.fecha)}{a.registrador?.nombre ? ` · registrado por ${a.registrador.nombre}` : ""}
                </p>
              </div>
              <EstadoChip estado={a.estado} />
            </div>
            {a.nota && <p className="text-sm">{a.nota}</p>}
            {a.respondido_en && <p className="text-xs text-suave">Respondido: {fechaHora(a.respondido_en)}</p>}
            {a.motivo_disputa && <p className="text-sm text-error">Motivo: {a.motivo_disputa}</p>}
            {a.estado === "pendiente" && (
              <ResponderAnticipo id={a.id} negativo={Number(a.monto) < 0} monto={formatoPesos(Math.abs(Number(a.monto)))} nombre={perfil.nombre} celularAdmin={admin.celular} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
