import { formatoPesos } from "@/lib/numeros";

/**
 * Palabras del estado de cuenta (decisión del usuario: explícito y didáctico).
 * Saldo = anticipos confirmados − valor de tiquetes.
 *  - Positivo: el comprador aún tiene dinero de anticipos sin cubrir con fruta.
 *    Administración: «Saldo a mi favor». Comprador: «Debo».
 *  - Negativo: entregó más fruta de la que se le anticipó (o se empezó debiéndole).
 *    Administración: «Le debo». Comprador: «Me deben».
 */
export type Vista = "admin" | "comprador";

export type TextoSaldo = { titulo: string; monto: string; explicacion: string; tono: "favor" | "debe" | "cero" };

export function textoSaldo(saldo: number | string | null | undefined, vista: Vista): TextoSaldo {
  const s = Number(saldo ?? 0);
  const monto = formatoPesos(Math.abs(s));
  if (s === 0) return { titulo: "Cuenta al día", monto, explicacion: "Nadie le debe a nadie.", tono: "cero" };
  if (vista === "admin") {
    return s > 0
      ? { titulo: "Saldo a mi favor", monto, explicacion: "El comprador tiene este dinero de anticipos que aún no ha cubierto con fruta.", tono: "favor" }
      : { titulo: "Le debo", monto, explicacion: "Le debo esta plata al comprador por fruta entregada.", tono: "debe" };
  }
  return s > 0
    ? { titulo: "Debo", monto, explicacion: "Tengo este dinero de anticipos que aún debo cubrir con fruta.", tono: "debe" }
    : { titulo: "Me deben", monto, explicacion: "Me deben esta plata por fruta entregada.", tono: "favor" };
}

/** Una línea corta, ej. «Saldo a mi favor: $ 2.000.000». */
export function lineaSaldo(saldo: number | string | null | undefined, vista: Vista): string {
  const t = textoSaldo(saldo, vista);
  return t.tono === "cero" ? t.titulo : `${t.titulo}: ${t.monto}`;
}

/** Cómo se nombra un anticipo: si es negativo es un saldo a favor del comprador. */
export function nombreAnticipo(monto: number | string): string {
  return Number(monto) < 0 ? "saldo a su favor" : "anticipo";
}

/** «anticipo de $ 5.000.000» o «saldo a su favor de $ 2.000.000 (dinero que le debo)». */
export function describirAnticipo(monto: number | string | null | undefined): string {
  const m = Number(monto ?? 0);
  return m < 0
    ? `saldo a su favor de ${formatoPesos(-m)} (dinero que le debo)`
    : `anticipo de ${formatoPesos(m)}`;
}
