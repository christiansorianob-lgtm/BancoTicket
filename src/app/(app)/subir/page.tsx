import { exigirComprador } from "@/lib/sesion";
import { SubirTiquete } from "./subir-tiquete";

export default async function PaginaSubir() {
  await exigirComprador();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="titulo">Subir tiquete</h1>
      <SubirTiquete />
    </div>
  );
}
