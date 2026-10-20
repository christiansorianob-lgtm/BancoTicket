import { exigirComprador } from "@/lib/sesion";
import { contactoAdministracion } from "@/lib/avisos";
import { SubirTiquete } from "./subir-tiquete";

export default async function PaginaSubir() {
  const perfil = await exigirComprador();
  // El comprador no ve perfiles ajenos; solo se le pasan el celular y los correos de la administración.
  const admin = await contactoAdministracion();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="titulo">Subir tiquete</h1>
      <SubirTiquete celularAdmin={admin.celular} correosAdmin={admin.correos} nombreComprador={perfil.nombre} />
    </div>
  );
}
