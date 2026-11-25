/**
 * Estandarizar el nombre del PROVEEDOR de un tiquete (decisión del usuario 2026-11-25; sin IA y sin
 * dependencias: servidor, navegador y pruebas). Lista de nombres oficiales en
 * configuracion.proveedores_oficiales (migración 0038).
 *  - Quita los prefijos «SAF - » e «IND - » (Oleoflores los antepone).
 *  - Compara solo letras y números, sin tildes ni mayúsculas, y con la terminación de la sociedad
 *    cortada o no («S.A.S», «S.A.S.», «SAS», «S»: Oleoflores corta el final del nombre).
 */

const PREFIJO = /^\s*(SAF|IND)\s*[-–—:]\s*/i;

/** Solo letras y números en mayúscula, sin tildes. */
const clave = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** El nombre sin la terminación «SAS» (o «SA»): el núcleo con que se compara. */
const nucleo = (k: string) => k.replace(/(SAS|SA)$/, "");

/** Quita los prefijos «SAF - » / «IND - » y los espacios de más. */
export const sinPrefijo = (t: string) => t.replace(PREFIJO, "").trim().replace(/\s+/g, " ");

/**
 * Nombre oficial que corresponde al leído, o null si no coincide con ninguno. Coincide si, sin
 * prefijo, tiene el mismo núcleo y lo que sigue es parte de «SAS» (completa, cortada o ausente).
 */
export function proveedorOficial(leido: string | null | undefined, oficiales: readonly string[]): string | null {
  if (!leido) return null;
  const k = clave(sinPrefijo(leido));
  if (!k) return null;
  for (const oficial of oficiales) {
    const n = nucleo(clave(oficial));
    if (n && k.startsWith(n) && "SAS".startsWith(k.slice(n.length))) return oficial;
  }
  return null;
}

/** Lo que se guarda: el nombre oficial si coincide; si no, el leído sin prefijo. `nuevo` = no está en la lista. */
export function estandarizarProveedor(leido: string | null | undefined, oficiales: readonly string[]): { nombre: string | null; nuevo: boolean } {
  const limpio = leido ? sinPrefijo(leido) : "";
  if (!limpio) return { nombre: null, nuevo: false };
  const oficial = proveedorOficial(limpio, oficiales);
  return oficial ? { nombre: oficial, nuevo: false } : { nombre: limpio, nuevo: oficiales.length > 0 };
}
