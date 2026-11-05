import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { FotosAntiguas } from "@/lib/fotos-antiguas";

/** Aviso al desarrollador (solo a él): hay fotos de tiquetes para revisar y limpiar juntos, a mano. */
export function AvisoFotosAntiguas({ fotos, conEnlace = false }: { fotos: FotosAntiguas; conEnlace?: boolean }) {
  return (
    <div className="space-y-1 rounded-xl border-2 border-alerta bg-alerta-suave p-3 text-sm" role="status">
      <p className="flex items-start gap-2 font-semibold text-alerta">
        <ImageOff className="mt-0.5 size-5 shrink-0" aria-hidden />
        Hay {fotos.total} foto{fotos.total === 1 ? "" : "s"} de tiquetes con más de {fotos.meses} meses
        ({fotos.aprobados} de aprobados, {fotos.pendientes} de pendientes o rechazados).
      </p>
      <p className="text-texto">
        No se borra nada sola. Cuando quiera, hacemos la limpieza juntos con Claude: primero un respaldo completo y luego, con su aprobación,
        solo los archivos de las fotos. Ningún registro se toca.
      </p>
      {conEnlace && <Link href="/admin/backups" className="font-semibold text-primario underline">Ver en Backups</Link>}
    </div>
  );
}
