import { exigirConsulta } from "@/lib/sesion";

/** Sección «Consulta» (perfil Consultor): solo lectura. La base de datos tampoco le permite cambiar nada. */
export default async function LayoutConsulta({ children }: LayoutProps<"/consulta">) {
  await exigirConsulta();
  return <div className="space-y-5">{children}</div>;
}
