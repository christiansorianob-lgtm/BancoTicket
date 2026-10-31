import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { BUCKETS_RESPALDO, TABLAS_RESPALDO, type ArchivoIndice, type IndiceRespaldo, type TablaRespaldo } from "./comun";

const POR_PAGINA = 1000;

/** Recorre una carpeta de Storage (y sus subcarpetas) y devuelve las rutas de los archivos. */
async function listarArchivos(bucket: string, prefijo = ""): Promise<{ ruta: string; tamano: number; tipo: string }[]> {
  const almacen = supabaseAdmin().storage.from(bucket);
  const salida: { ruta: string; tamano: number; tipo: string }[] = [];
  for (let offset = 0; ; offset += POR_PAGINA) {
    const { data, error } = await almacen.list(prefijo, { limit: POR_PAGINA, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`${bucket}/${prefijo}: ${error.message}`);
    for (const e of data ?? []) {
      const ruta = prefijo ? `${prefijo}/${e.name}` : e.name;
      if (e.id === null) salida.push(...(await listarArchivos(bucket, ruta))); // carpeta
      else if (e.name !== ".emptyFolderPlaceholder") {
        const m = (e.metadata ?? {}) as { size?: number; mimetype?: string };
        salida.push({ ruta, tamano: m.size ?? 0, tipo: m.mimetype ?? "application/octet-stream" });
      }
    }
    if (!data || data.length < POR_PAGINA) return salida;
  }
}

/**
 * Índice del respaldo: conteo de cada tabla, usuarios (sin contraseñas) y archivos con un enlace
 * firmado de 1 hora para que el navegador los descargue directo de Storage (no pasan por Vercel).
 */
export async function indiceRespaldo(): Promise<IndiceRespaldo> {
  const db = supabaseAdmin();
  const conteos: Record<string, number> = {};
  for (const t of TABLAS_RESPALDO) {
    const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
    if (error) throw new Error(`${t}: ${error.message}`);
    conteos[t] = count ?? 0;
  }

  const usuarios: IndiceRespaldo["usuarios"] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: POR_PAGINA });
    if (error) throw new Error(`usuarios: ${error.message}`);
    usuarios.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null, creado: u.created_at })));
    if (data.users.length < POR_PAGINA) break;
  }

  const archivos: ArchivoIndice[] = [];
  for (const bucket of BUCKETS_RESPALDO) {
    const lista = await listarArchivos(bucket);
    for (let i = 0; i < lista.length; i += 100) {
      const lote = lista.slice(i, i + 100);
      const { data, error } = await db.storage.from(bucket).createSignedUrls(lote.map((a) => a.ruta), 60 * 60);
      if (error) throw new Error(`${bucket}: ${error.message}`);
      lote.forEach((a, j) => { const url = data?.[j]?.signedUrl; if (url) archivos.push({ bucket, ...a, url }); });
    }
  }
  return { generado: new Date().toISOString(), conteos, usuarios, archivos };
}

/** Una página de filas de una tabla (en orden estable), para no superar el límite de respuesta de Vercel. */
export async function paginaTabla(tabla: TablaRespaldo, desde: number): Promise<{ filas: unknown[]; siguiente: number | null }> {
  const orden = tabla === "configuracion" ? "clave" : "id";
  const { data, error } = await supabaseAdmin().from(tabla).select("*").order(orden).range(desde, desde + POR_PAGINA - 1);
  if (error) throw new Error(`${tabla}: ${error.message}`);
  const filas = data ?? [];
  return { filas, siguiente: filas.length < POR_PAGINA ? null : desde + POR_PAGINA };
}
