import { NextResponse } from "next/server";
import { perfilActual } from "@/lib/sesion";
import { backupExcel } from "@/lib/informes/backup-excel";

export const maxDuration = 60;

/** Descarga manual del backup de la base de datos. Solo el desarrollador. */
export async function GET() {
  const perfil = await perfilActual();
  if (!perfil || perfil.rol !== "desarrollador") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  try {
    const { archivo } = await backupExcel(perfil.nombre);
    const ahora = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }).format(new Date()).replace(/[: ]/g, "-");
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="BancoTicket-backup-${ahora}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
