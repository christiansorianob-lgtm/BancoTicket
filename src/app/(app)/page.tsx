import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, Wallet } from "lucide-react";
import { exigirSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { TarjetaSaldo, type FilaSaldo } from "@/components/saldo";
import { formatoPesos } from "@/lib/numeros";
import { fecha } from "@/lib/fechas";

export default async function InicioComprador() {
  const perfil = await exigirSesion();
  if (perfil.rol === "admin") redirect("/admin");

  const supabase = await supabaseServidor();
  const [{ data: saldo }, { data: porConfirmar }, { count: pendientes }, { count: rechazados }] = await Promise.all([
    supabase.from("saldos").select("*").eq("comprador_id", perfil.id).maybeSingle(),
    supabase.from("anticipos").select("id, monto, fecha").eq("comprador_id", perfil.id).eq("estado", "pendiente"),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("estado", "rechazado"),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="titulo">Hola, {perfil.nombre.split(" ")[0]}</h1>
      <TarjetaSaldo fila={saldo as FilaSaldo | null} />

      <Link href="/subir" className="boton-primario w-full py-4 text-lg">
        <Camera className="size-6" aria-hidden /> Subir tiquete
      </Link>

      {(porConfirmar ?? []).length > 0 && (
        <section className="tarjeta border-alerta/40">
          <h2 className="mb-2 flex items-center gap-2 font-bold text-alerta"><Wallet className="size-5" /> Por confirmar</h2>
          <ul className="space-y-1 text-sm">
            {porConfirmar!.map((a) => (
              <li key={a.id}>Anticipo de {formatoPesos(a.monto)} del {fecha(a.fecha)}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-suave">Ábralo desde el enlace que le llegó por WhatsApp o correo.</p>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Link href="/mis-tiquetes?estado=pendiente" className="tarjeta text-center">
          <p className="text-3xl font-black text-alerta">{pendientes ?? 0}</p>
          <p className="text-sm text-suave">Pendientes de aprobar</p>
        </Link>
        <Link href="/mis-tiquetes?estado=rechazado" className="tarjeta text-center">
          <p className="text-3xl font-black text-error">{rechazados ?? 0}</p>
          <p className="text-sm text-suave">Rechazados</p>
        </Link>
      </section>
    </div>
  );
}
