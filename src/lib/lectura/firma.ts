import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { DatosTiquete, LecturaCruda } from "./tipos";

type Base = { comprador_id: string; extractora_id: string; imagen_ruta: string; origen: "camara" | "galeria"; emitida: number };

/** Lectura que pasó los controles: el comprador solo puede confirmarla (no editarla). */
/** extractora_impresa: si no es null, el tiquete parece de otra extractora y el comprador decidió continuar. */
export type LecturaFirmada = Base & { tipo: "lectura"; datos: DatosTiquete; dudosos: string[]; extractora_impresa: string | null };
/** Lectura fallida que el comprador decide mandar a revisión del administrador. */
export type RevisionFirmada = Base & { tipo: "revision"; cruda: LecturaCruda | null; motivo: string };

const VIGENCIA_MS = 30 * 60 * 1000;

function hmac(texto: string) {
  const secreto = process.env.FIRMA_LECTURA_SECRETO;
  if (!secreto) throw new Error("Falta FIRMA_LECTURA_SECRETO");
  return createHmac("sha256", secreto).update(texto).digest("base64url");
}

export function firmar(datos: LecturaFirmada | RevisionFirmada): string {
  const cuerpo = Buffer.from(JSON.stringify(datos)).toString("base64url");
  return `${cuerpo}.${hmac(cuerpo)}`;
}

export function verificar<T extends LecturaFirmada | RevisionFirmada>(token: string, tipo: T["tipo"], compradorId: string): T {
  const [cuerpo, firma] = token.split(".");
  if (!cuerpo || !firma) throw new Error("Lectura no válida");
  const esperada = Buffer.from(hmac(cuerpo));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) throw new Error("Lectura alterada");
  const l = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as T;
  if (l.tipo !== tipo) throw new Error("Lectura no válida");
  if (l.comprador_id !== compradorId) throw new Error("La lectura es de otro usuario");
  if (Date.now() - l.emitida > VIGENCIA_MS) throw new Error("La lectura venció; tome la foto de nuevo");
  return l;
}
