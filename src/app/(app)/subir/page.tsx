import { exigirComprador } from "@/lib/sesion";
import { contactoAdministracion } from "@/lib/avisos";
import { SubirTiquete } from "./subir-tiquete";

export default async function PaginaSubir() {
  const perfil = await exigirComprador();
  // El comprador no ve perfiles ajenos; solo se le pasa el celular de WhatsApp de la administración.
  const admin = await contactoAdministracion();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="titulo">Subir tiquete</h1>
      <SubirTiquete celularAdmin={admin.celular} nombreComprador={perfil.nombre} />
    </div>
  );
}
