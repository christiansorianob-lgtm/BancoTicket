import { ReporteCuenta } from "./cuenta";
import { ReporteTiquetes } from "./reporte-tiquetes";

/** Reportes de la administración: se elige el tipo con el selector de arriba. */
export default async function Reportes({ searchParams }: PageProps<"/admin/reportes">) {
  const sp = await searchParams;
  if (sp.tipo === "cuenta") return <ReporteCuenta sp={sp} base="/admin/reportes" />;
  return <ReporteTiquetes sp={sp} base="/admin/reportes" />;
}
