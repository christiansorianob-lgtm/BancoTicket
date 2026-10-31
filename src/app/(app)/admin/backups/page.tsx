import { DatabaseBackup } from "lucide-react";
import { exigirDesarrollador } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { leerConfiguracion } from "@/lib/config";
import { fechaHora } from "@/lib/fechas";
import { Mensaje } from "@/components/ui";
import { TABLAS_RESPALDO } from "@/lib/respaldo/comun";
import { BotonRespaldo } from "./respaldo";

/** Días completos transcurridos desde una fecha ISO hasta ahora. */
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Backups (solo el desarrollador): respaldo completo restaurable y Excel para consultar. */
export default async function Backups() {
  await exigirDesarrollador();
  const db = supabaseAdmin();
  const [conteos, config] = await Promise.all([
    Promise.all(TABLAS_RESPALDO.map(async (t) => ({ tabla: t, filas: (await db.from(t).select("*", { count: "exact", head: true })).count ?? 0 }))),
    leerConfiguracion(),
  ]);
  const ultimo = config.ultimo_respaldo;
  const dias = ultimo ? diasDesde(ultimo) : null;
  const vencido = dias === null || dias > config.dias_aviso_respaldo;

  return (
    <>
      <h1 className="titulo">Backups</h1>

      <Mensaje tono={vencido ? "error" : "ok"}>
        {ultimo
          ? <>Último respaldo completo: {fechaHora(ultimo)} (hace {dias} día{dias === 1 ? "" : "s"}).{vencido && ` Pasaron más de ${config.dias_aviso_respaldo} días: haga un respaldo nuevo.`}</>
          : <>Aún no hay respaldos completos. Se recomienda uno cada {config.dias_aviso_respaldo} días.</>}
      </Mensaje>

      <section className="tarjeta space-y-4">
        <h2 className="font-bold text-profundo">Respaldo completo (restaurable)</h2>
        <p className="text-sm text-suave">
          Descarga un .zip con todos los datos de la base (en un formato que se puede volver a cargar) y todos los archivos: fotos de los tiquetes,
          soportes de anticipos, ejemplos de formatos y facturas. No incluye contraseñas: al restaurar, los usuarios quedan con 12345678.
          Pesa varios MB: mejor desde un computador con wifi. Para restaurarlo, ver <code>docs/RESPALDO.md</code>.
        </p>
        <BotonRespaldo />
        <Mensaje tono="alerta">Contiene datos personales (nombres, cédulas y fotos). Guárdelo en una carpeta privada o un disco externo, nunca en un sitio compartido.</Mensaje>
      </section>

      <section className="tarjeta space-y-4">
        <h2 className="font-bold text-profundo">Excel para consultar</h2>
        <p className="text-sm text-suave">Una hoja por tabla con todas sus filas, y una hoja «Resumen». Sirve para revisar datos rápido; no incluye fotos ni sirve para restaurar.</p>
        <a href="/api/backup" className="boton-secundario" download>
          <DatabaseBackup className="size-5" aria-hidden /> Descargar Excel
        </a>
      </section>

      <section className="tarjeta p-0">
        <table className="w-full text-sm">
          <thead className="bg-profundo text-left text-white"><tr><th className="p-3">Tabla</th><th className="p-3 text-right">Filas hoy</th></tr></thead>
          <tbody>
            {conteos.map((c) => (
              <tr key={c.tabla} className="border-t border-borde/60"><td className="p-3">{c.tabla}</td><td className="p-3 text-right font-semibold">{c.filas.toLocaleString("es-CO")}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
