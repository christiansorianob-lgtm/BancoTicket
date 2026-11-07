"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2 } from "lucide-react";
import { Mensaje } from "@/components/ui";
import { armarZip, TABLAS_RESPALDO, type IndiceRespaldo, type Resumen } from "@/lib/respaldo/comun";
import { registrarRespaldo } from "./acciones";

/** Migraciones que debe tener la base donde se restaure (actualizar al crear una nueva). */
const MIGRACIONES = "0001–0030";

const leerJson =async <T,>(url: string): Promise<T> => {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? `Error ${r.status}`);
  return j as T;
};

/**
 * Respaldo completo (solo el desarrollador): el navegador baja los datos por páginas y los archivos
 * directo de Storage, arma un .zip y lo descarga. Así no se supera el límite de respuesta de Vercel.
 */
export function BotonRespaldo() {
  const router = useRouter();
  const [paso, setPaso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ tono: "ok" | "error" | "alerta"; texto: string } | null>(null);

  async function respaldar() {
    setResultado(null);
    try {
      setPaso("Preparando el índice…");
      const indice = await leerJson<IndiceRespaldo>("/api/respaldo/indice");

      const tablas: Record<string, unknown[]> = {};
      for (const t of TABLAS_RESPALDO) {
        setPaso(`Copiando datos: ${t}…`);
        tablas[t] = [];
        for (let desde: number | null = 0; desde !== null;) {
          const p: { filas: unknown[]; siguiente: number | null } = await leerJson(`/api/respaldo/tabla?nombre=${t}&desde=${desde}`);
          tablas[t].push(...p.filas);
          desde = p.siguiente;
        }
      }

      const archivos: { bucket: string; ruta: string; datos: Uint8Array }[] = [];
      const fallidos: string[] = [];
      let hechos = 0;
      // Cuatro descargas a la vez: rápido sin saturar la conexión del celular.
      const cola = [...indice.archivos];
      await Promise.all(Array.from({ length: 4 }, async () => {
        for (let a = cola.shift(); a; a = cola.shift()) {
          try {
            const r = await fetch(a.url);
            if (!r.ok) throw new Error(String(r.status));
            archivos.push({ bucket: a.bucket, ruta: a.ruta, datos: new Uint8Array(await r.arrayBuffer()) });
          } catch {
            fallidos.push(`${a.bucket}/${a.ruta}`);
          }
          setPaso(`Descargando archivos: ${++hechos} de ${indice.archivos.length}…`);
        }
      }));

      setPaso("Armando el archivo .zip…");
      const conteos = Object.fromEntries(TABLAS_RESPALDO.map((t) => [t, tablas[t].length]));
      const porBucket: Record<string, number> = {};
      for (const a of archivos) porBucket[a.bucket] = (porBucket[a.bucket] ?? 0) + 1;
      const resumen: Resumen = {
        app: "BancoTicket", generado: indice.generado, migraciones: MIGRACIONES, orden: TABLAS_RESPALDO, conteos,
        usuarios: indice.usuarios.length, archivos: { total: archivos.length, bytes: archivos.reduce((s, a) => s + a.datos.length, 0), por_bucket: porBucket },
      };
      const zip = armarZip(resumen, tablas, indice.usuarios, archivos);
      const url = URL.createObjectURL(new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }));
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `BancoTicket-respaldo-${indice.generado.slice(0, 10)}.zip`;
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      // Verificación: lo copiado debe coincidir con lo que había en la base al empezar.
      const distintos = TABLAS_RESPALDO.filter((t) => conteos[t] !== indice.conteos[t]);
      if (fallidos.length || distintos.length) {
        setResultado({ tono: "alerta", texto: `Respaldo descargado, pero revise: ${[
          fallidos.length && `${fallidos.length} archivo(s) no se pudieron bajar (${fallidos.slice(0, 3).join(", ")}${fallidos.length > 3 ? "…" : ""})`,
          distintos.length && `cambiaron mientras se copiaba: ${distintos.join(", ")}`,
        ].filter(Boolean).join("; ")}. Conviene repetirlo.` });
      } else {
        const filas = Object.values(conteos).reduce((s, n) => s + n, 0);
        setResultado({ tono: "ok", texto: `Respaldo completo descargado (${(zip.length / 1048576).toFixed(1)} MB): ${filas.toLocaleString("es-CO")} registros, ${archivos.length} archivos y ${indice.usuarios.length} usuarios. Guárdelo en un lugar privado.` });
      }
      await registrarRespaldo();
      router.refresh();
    } catch (e) {
      setResultado({ tono: "error", texto: `No se pudo completar el respaldo: ${(e as Error).message}` });
    } finally {
      setPaso(null);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" className="boton-primario" onClick={respaldar} disabled={!!paso}>
        {paso ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Archive className="size-5" aria-hidden />}
        {paso ? "Generando respaldo…" : "Descargar respaldo completo"}
      </button>
      {paso && <p className="text-sm font-semibold text-primario" aria-live="polite">{paso}</p>}
      {resultado && <Mensaje tono={resultado.tono}>{resultado.texto}</Mensaje>}
    </div>
  );
}
