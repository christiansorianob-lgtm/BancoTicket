import { exigirAdmin } from "@/lib/sesion";

/** Módulo de facturas: solo administradora y desarrollador (las tablas y funciones también lo exigen). */
export default async function LayoutFacturas({ children }: LayoutProps<"/facturas">) {
  await exigirAdmin();
  return <div className="space-y-5">{children}</div>;
}
