import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { contactoAdministracion } from "@/lib/avisos";
import { SubirTiquete } from "./subir-tiquete";

export default async function PaginaSubir() {
  const perfil = await exigirComprador();
  const supabase = await supabaseServidor();
  const { data: extractoras } = await supabase.from("extractoras").select("id, nombre").eq("activa", true).order("nombre");
  // El comprador no ve perfiles ajenos; solo se le pasan el celular y los correos de la administración.
  const admin = await contactoAdministracion();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="titulo">Subir tiquete</h1>
      <SubirTiquete extractoras={extractoras ?? []} celularAdmin={admin.celular} correosAdmin={admin.correos} nombreComprador={perfil.nombre} />
    </div>
  );
}
