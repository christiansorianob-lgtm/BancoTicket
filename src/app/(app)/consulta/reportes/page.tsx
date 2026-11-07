import { ReporteAnticipos } from "../../admin/reportes/reporte-anticipos";
import { ReporteCuenta } from "../../admin/reportes/cuenta";
import { ReporteTiquetes } from "../../admin/reportes/reporte-tiquetes";

/** Los mismos reportes de la administración, para el Consultor: sin editar ni eliminar; Excel y fotos sí. */
export default async function ReportesConsulta({ searchParams }: PageProps<"/consulta/reportes">) {
  const sp = await searchParams;
  if (sp.tipo === "anticipos") return <ReporteAnticipos sp={sp} base="/consulta/reportes" />;
  if (sp.tipo === "cuenta") return <ReporteCuenta sp={sp} base="/consulta/reportes" />;
  return <ReporteTiquetes sp={sp} base="/consulta/reportes" soloLectura />;
}
