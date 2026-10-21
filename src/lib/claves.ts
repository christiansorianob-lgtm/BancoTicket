/** Contraseña con la que queda un usuario nuevo o restablecido. Puede seguir usándola; la cambia cuando quiera con la llave. */
export const CLAVE_POR_DEFECTO = "12345678";

/** Revisa la contraseña nueva; devuelve el error o null. */
export function revisarClaveNueva(clave: string, repetir: string): string | null {
  if (clave.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (clave === CLAVE_POR_DEFECTO) return "Escoja una contraseña distinta a la de por defecto";
  if (clave !== repetir) return "Las dos contraseñas no coinciden";
  return null;
}
