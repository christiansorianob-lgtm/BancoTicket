import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SubirTiquete } from "./subir-tiquete";

export default async function PaginaSubir() {
  const perfil = await exigirComprador();
  const supabase = await supabaseServidor();
  const { data: extractoras } = await supabase.from("extractoras").select("id, nombre").eq("activa", true).order("nombre");
  // El comprador no ve perfiles ajenos; solo se le pasa el celular del administrador para el botón de aviso.
  const { data: admin } = await supabaseAdmin().from("perfiles").select("celular").eq("rol", "admin").eq("activo", true).limit(1).maybeSingle();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="titulo">Subir tiquete</h1>
      <SubirTiquete extractoras={extractoras ?? []} celularAdmin={admin?.celular ?? null} nombreComprador={perfil.nombre} />
    </div>
  );
}
