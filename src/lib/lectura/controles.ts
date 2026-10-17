import { interpretarFechaTiquete } from "@/lib/fechas";
import { kilosDesdeTexto } from "@/lib/numeros";
import type { Control, LecturaCruda, ResultadoLectura } from "./tipos";

// Placa: 5 a 7 letras y números, con al menos una letra y un número. Las impresas
// en los tiquetes no siempre siguen el formato ABC123 (ej. "284DAF").
const PLACA = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,7}$/;

const NOMBRES: Record<string, string> = {
  numero_tiquete: "número", fecha_entrada: "fecha", peso_bruto_kg: "peso bruto", tara_kg: "tara",
  peso_neto_impreso_kg: "peso neto impreso", placa: "placa",
};

export function normalizarPlaca(p: string | null | undefined) {
  const t = (p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return t || null;
}

/**
 * Valida y normaliza la lectura. Bruto = mayor de los dos pesos y tara = menor,
 * así no importa cómo los rotule cada extractora.
 */
export function aplicarControles(cruda: LecturaCruda, opciones: { placaObligatoria: boolean }): ResultadoLectura {
  const controles: Control[] = [];
  const add = (nombre: string, ok: boolean, mensaje: string) => controles.push({ nombre, ok, mensaje });

  if (!cruda.es_tiquete) {
    add("Tiquete", false, "La foto no parece un tiquete legible");
    return { ok: false, motivo: "No se reconoce un tiquete en la foto", controles, cruda };
  }

  const numero = (cruda.numero_tiquete ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  add("Número", numero.length > 0, numero ? `N° ${numero}` : "No se leyó el número de tiquete");

  const fecha = interpretarFechaTiquete(cruda.fecha_entrada);
  const fechaOk = !!fecha && new Date(fecha).getTime() <= Date.now() + 36e5;
  add("Fecha", fechaOk, fechaOk ? "Fecha válida" : `Fecha no válida: "${cruda.fecha_entrada ?? ""}"`);

  const a = kilosDesdeTexto(cruda.peso_bruto_kg);
  const b = kilosDesdeTexto(cruda.tara_kg);
  const pesosOk = a !== null && b !== null;
  add("Formato de pesos", pesosOk, pesosOk ? "Pesos en kilos enteros" : "No se leyeron bien los pesos");

  const bruto = pesosOk ? Math.max(a!, b!) : 0;
  const tara = pesosOk ? Math.min(a!, b!) : 0;
  const neto = bruto - tara;
  add("Peso neto", pesosOk && neto > 0, neto > 0 ? `Neto ${neto.toLocaleString("es-CO")} kg` : "El peso neto debe ser mayor que cero");

  const netoImpreso = kilosDesdeTexto(cruda.peso_neto_impreso_kg);
  if (cruda.peso_neto_impreso_kg) {
    const cuadra = netoImpreso !== null && netoImpreso === neto;
    add("Bruto − tara = neto impreso", cuadra,
      cuadra ? "Coincide con el neto impreso" : `La resta (${neto}) no coincide con el neto impreso (${cruda.peso_neto_impreso_kg})`);
  }

  const dudosos = new Set((cruda.campos_dudosos ?? []).map((c) => NOMBRES[c] ?? c));

  const placa = normalizarPlaca(cruda.placa);
  if (!placa && opciones.placaObligatoria) {
    add("Placa", false, "No se leyó la placa");
  } else if (placa) {
    // Un formato raro no bloquea: se envía y el administrador lo verifica.
    if (!PLACA.test(placa)) dudosos.add("placa");
    controles.push({ nombre: "Placa", ok: true, mensaje: `Placa ${placa}`, dudoso: dudosos.has("placa") });
  }

  if (dudosos.size > 0) {
    controles.push({ nombre: "Certeza", ok: true, dudoso: true, mensaje: `La lectura no es 100 % segura en: ${[...dudosos].join(", ")}. El administrador lo verificará.` });
  }

  const fallos = controles.filter((c) => !c.ok);
  if (fallos.length > 0) {
    return { ok: false, motivo: fallos.map((f) => f.mensaje).join(". "), controles, cruda };
  }
  return {
    ok: true,
    controles,
    cruda,
    dudosos: [...dudosos],
    datos: {
      numero,
      fecha_entrada: fecha!,
      peso_bruto_kg: bruto,
      tara_kg: tara,
      neto_impreso_kg: netoImpreso,
      placa,
      conductor: cruda.conductor?.trim() || null,
      proveedor: cruda.proveedor?.trim().replace(/\s+/g, " ") || null,
      bascula: cruda.bascula?.trim() || null,
    },
  };
}
