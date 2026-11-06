/**
 * Respaldo completo (decisión del usuario, 2026-10-31): datos restaurables + archivos en un .zip que
 * arma el navegador del desarrollador. Sin dependencias de servidor: lo usan la página y las pruebas.
 */
import { strToU8, zipSync, type Zippable } from "fflate";

/** Tablas en el orden en que se restauran (primero las que otras referencian). */
export const TABLAS_RESPALDO = [
  "perfiles", "extractoras", "formatos_extractora", "configuracion", "anticipos", "tiquetes_pendientes",
  "tiquetes", "formatos_no_reconocidos", "notificaciones", "solicitudes_clave", "consumo_ia", "historial",
  "fact_clientes", "fact_facturas", "fact_abonos", "fact_auditoria", "recargas_ia",
] as const;
export type TablaRespaldo = (typeof TABLAS_RESPALDO)[number];

/** Buckets de Storage que entran al respaldo. */
export const BUCKETS_RESPALDO = ["tiquetes", "facturas"] as const;

export type ArchivoIndice = { bucket: string; ruta: string; tamano: number; url: string; tipo: string };
export type UsuarioRespaldo = { id: string; email: string | null; creado: string };
export type IndiceRespaldo = { generado: string; conteos: Record<string, number>; usuarios: UsuarioRespaldo[]; archivos: ArchivoIndice[] };

export type Resumen = {
  app: "BancoTicket"; generado: string; migraciones: string; orden: readonly string[];
  conteos: Record<string, number>; usuarios: number; archivos: { total: number; bytes: number; por_bucket: Record<string, number> };
};

const LEEME = `RESPALDO COMPLETO DE BANCOTICKET
================================
Contiene datos personales (nombres, cédulas, fotos de tiquetes). Guárdelo en una carpeta privada o un disco externo.

- resumen.json        conteos de registros y archivos, y el orden de restauración
- datos/<tabla>.json  todas las filas de cada tabla, tal cual están en la base
- datos/usuarios.json usuarios para ingresar (id y usuario; SIN contraseñas)
- archivos/<bucket>/  fotos de tiquetes, soportes de anticipos, ejemplos de formatos y facturas

Para restaurar: ver docs/RESPALDO.md en el repositorio (scripts/restaurar-respaldo.mjs).
Al restaurar, todos los usuarios quedan con la contraseña 12345678.
`;

/** Arma el .zip. Las fotos ya vienen comprimidas: se guardan sin volver a comprimir. */
export function armarZip(resumen: Resumen, tablas: Record<string, unknown[]>, usuarios: UsuarioRespaldo[], archivos: { bucket: string; ruta: string; datos: Uint8Array }[]): Uint8Array {
  const json = (v: unknown): [Uint8Array, { level: 6 }] => [strToU8(JSON.stringify(v, null, 1)), { level: 6 }];
  const zip: Zippable = { "LEEME.txt": [strToU8(LEEME), { level: 6 }], "resumen.json": json(resumen), "datos/usuarios.json": json(usuarios) };
  for (const [t, filas] of Object.entries(tablas)) zip[`datos/${t}.json`] = json(filas);
  for (const a of archivos) zip[`archivos/${a.bucket}/${a.ruta}`] = [a.datos, { level: 0 }];
  return zipSync(zip);
}
