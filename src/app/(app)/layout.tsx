import { redirect } from "next/navigation";
import { Marco } from "@/components/marco";
import { exigirSesion } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const perfil = await exigirSesion();
  if (perfil.cambiar_clave) redirect("/clave");
  const supabase = await supabaseServidor();
  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", perfil.id)
    .eq("leida", false);
  return <Marco perfil={perfil} avisosSinLeer={count ?? 0}>{children}</Marco>;
}
