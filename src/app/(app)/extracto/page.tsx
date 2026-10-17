import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { Extracto } from "@/components/extracto";
import { TarjetaSaldo, type FilaSaldo } from "@/components/saldo";

export default async function PaginaExtracto() {
  const perfil = await exigirComprador();
  const supabase = await supabaseServidor();
  const { data: saldo } = await supabase.from("saldos").select("*").eq("comprador_id", perfil.id).maybeSingle();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="titulo">Mi extracto</h1>
      <TarjetaSaldo fila={saldo as FilaSaldo | null} />
      <p className="text-sm text-suave">Solo cuentan los anticipos confirmados y los tiquetes aprobados con precio.</p>
      <Extracto compradorId={perfil.id} />
    </div>
  );
}
