import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { contactoAdministracion } from "@/lib/avisos";
import { fecha } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { Dato, EstadoChip, Mensaje } from "@/components/ui";
import { ResponderAnticipo } from "./responder";

/** El enlace llega por WhatsApp o correo; exige sesión del mismo comprador (el proxy lleva al ingreso). */
export default async function ConfirmarAnticipo({ params }: PageProps<"/anticipo/[codigo]">) {
  const perfil = await exigirComprador();
  const { codigo } = await params;
  const supabase = await supabaseServidor();
  const { data } = await supabase.rpc("ver_anticipo_por_enlace", { p_codigo: codigo });
  const a = data?.[0];
  const admin = await contactoAdministracion();

  if (!a) {
    return (
      <div className="mx-auto max-w-md">
        <Mensaje tono="error">Este enlace no es válido para su usuario. Verifique que ingresó con su propia cuenta.</Mensaje>
      </div>
    );
  }

  const tipo = "anticipo";
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="titulo">Confirmar {tipo}</h1>
      <div className="tarjeta space-y-4">
        <p className="text-4xl font-black text-profundo">{formatoPesos(a.monto)}</p>
        <dl className="grid grid-cols-2 gap-3">
          <Dato etiqueta="Fecha">{fecha(a.fecha)}</Dato>
          <Dato etiqueta="Registrado por">{a.registrado_por}</Dato>
          <Dato etiqueta="Estado"><EstadoChip estado={a.estado} /></Dato>
        </dl>
        {a.nota && <p className="text-sm">{a.nota}</p>}
      </div>
      {a.estado !== "pendiente" ? (
        <Mensaje tono="alerta">Este {tipo} ya fue respondido.</Mensaje>
      ) : a.usado ? (
        <Mensaje tono="alerta">Este enlace ya se usó.</Mensaje>
      ) : a.vencido ? (
        <Mensaje tono="error">Este enlace venció. Pida a la administradora que le envíe uno nuevo.</Mensaje>
      ) : (
        <ResponderAnticipo codigo={codigo} tipo={tipo} monto={formatoPesos(a.monto)} nombre={perfil.nombre} celularAdmin={admin.celular} correosAdmin={admin.correos} />
      )}
    </div>
  );
}
