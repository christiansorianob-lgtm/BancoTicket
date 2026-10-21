import { DatabaseBackup } from "lucide-react";
import { exigirDesarrollador } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Mensaje } from "@/components/ui";
import { TABLAS_BACKUP } from "@/lib/informes/backup-excel";

/** Backups manuales de la base de datos (solo el desarrollador). */
export default async function Backups() {
  await exigirDesarrollador();
  const db = supabaseAdmin();
  const conteos = await Promise.all(
    TABLAS_BACKUP.map(async (t) => ({ tabla: t, filas: (await db.from(t).select("*", { count: "exact", head: true })).count ?? 0 })),
  );

  return (
    <>
      <h1 className="titulo">Backups</h1>
      <section className="tarjeta space-y-4">
        <p className="text-sm text-suave">
          Descarga un archivo de Excel con toda la información de la base de datos: una hoja por tabla, con todas sus filas y columnas, y una hoja «Resumen».
          Guárdelo en un lugar seguro: contiene datos personales de los compradores.
        </p>
        <a href="/api/backup" className="boton-primario" download>
          <DatabaseBackup className="size-5" aria-hidden /> Descargar backup ahora
        </a>
        <Mensaje tono="alerta">No incluye las fotos de los tiquetes ni las contraseñas (Supabase las guarda cifradas).</Mensaje>
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
