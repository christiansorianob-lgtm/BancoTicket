import Link from "next/link";
import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fechaHora } from "@/lib/fechas";
import { Vacio } from "@/components/ui";

async function marcarLeidos() {
  "use server";
  const perfil = await exigirSesion();
  const supabase = await supabaseServidor();
  await supabase.from("notificaciones").update({ leida: true }).eq("usuario_id", perfil.id).eq("leida", false);
  revalidatePath("/", "layout");
}

export default async function Avisos() {
  const perfil = await exigirSesion();
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("notificaciones").select("*").eq("usuario_id", perfil.id).order("creado_en", { ascending: false }).limit(100);
  const filas = data ?? [];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="titulo">Avisos</h1>
        {filas.some((f) => !f.leida) && (
          <form action={marcarLeidos}><button className="boton-secundario text-sm">Marcar todo como leído</button></form>
        )}
      </div>
      {filas.length === 0 && <Vacio>No tiene avisos.</Vacio>}
      <ul className="space-y-2">
        {filas.map((n) => (
          <li key={n.id} className={`tarjeta p-3 ${n.leida ? "opacity-70" : "border-l-4 border-l-primario"}`}>
            <p className="font-semibold text-profundo">{n.titulo}</p>
            {n.cuerpo && <p className="text-sm">{n.cuerpo}</p>}
            <div className="mt-1 flex items-center justify-between text-xs text-suave">
              <span>{fechaHora(n.creado_en)}</span>
              {n.enlace && <Link href={n.enlace} className="font-semibold text-primario">Abrir</Link>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
