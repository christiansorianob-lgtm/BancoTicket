import { interpretarFechaTiquete } from "@/lib/fechas";
import { kilosDesdeTexto } from "@/lib/numeros";
import type { Control, LecturaCruda, ResultadoLectura } from "./tipos";

// Placa: 5 a 7 letras y números, con al menos una letra y un número (ej. "284DAF").
const PLACA = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,7}$/;

/** Campos del filtro 2: si la IA duda, pasan marcados. */
const OTROS: Record<string, string> = { fecha_entrada: "fecha", placa: "placa", peso_bruto_kg: "peso bruto", tara_kg: "tara" };

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
  if (pesosOk && neto <= 0) add("Bruto y tara", false, "El peso bruto debe ser mayor que la tara");

  // Filtro 1 (decisión del usuario): el número y el peso neto (neto × precio = valor del tiquete)
  // deben ser 100 % legibles; si no, el tiquete no pasa y se pide una foto más legible.
  if (numero && cruda.campos_dudosos?.includes("numero_tiquete")) {
    add("Número 100 % legible", false, `El número del tiquete (${numero}) no es 100 % legible`);
  }
  // El peso neto que vale es el IMPRESO (con él se cobra), no la resta: debe leerse 100 % seguro.
  const netoImpreso = kilosDesdeTexto(cruda.peso_neto_impreso_kg);
  if (netoImpreso === null || netoImpreso <= 0) {
    add("Peso neto 100 % legible", false, "No se pudo leer el peso neto impreso");
  } else if (cruda.campos_dudosos?.includes("peso_neto_impreso_kg")) {
    add("Peso neto 100 % legible", false, `El peso neto impreso (${cruda.peso_neto_impreso_kg}) no es 100 % legible`);
  } else {
    add("Peso neto", true, `Peso neto ${netoImpreso.toLocaleString("es-CO")} kg`);
  }

  // Filtro 2: los demás campos dudosos no detienen el tiquete; pasan marcados e informados para
  // que la administradora decida.
  const dudosos = new Set((cruda.campos_dudosos ?? []).filter((c) => OTROS[c]).map((c) => OTROS[c]));
  // La resta bruto − tara es solo informativa (decisión del usuario): bruto y tara se toman como
  // se leen y nunca se dan por confirmados porque la resta cuadre. Si no da el neto impreso,
  // se marcan para que la administradora los revise.
  if (pesosOk && netoImpreso !== null && netoImpreso > 0) {
    if (netoImpreso === neto) {
      add("Bruto − tara = neto impreso", true, "La resta bruto − tara da el neto impreso (informativo)");
    } else {
      dudosos.add(OTROS.peso_bruto_kg); dudosos.add(OTROS.tara_kg);
      controles.push({ nombre: "Bruto − tara = neto impreso", ok: true, dudoso: true,
        mensaje: `La resta bruto − tara (${neto}) no da el neto impreso (${netoImpreso}): revisar bruto y tara` });
    }
  }
  const placa = normalizarPlaca(cruda.placa);
  if (placa) {
    if (!PLACA.test(placa)) dudosos.add("placa");
    controles.push({ nombre: "Placa", ok: true, mensaje: `Placa ${placa}`, dudoso: dudosos.has("placa") });
  } else if (opciones.placaObligatoria) {
    dudosos.add("placa");
    controles.push({ nombre: "Placa", ok: true, dudoso: true, mensaje: "No se leyó la placa" });
  }

  if (dudosos.size > 0) {
    controles.push({ nombre: "Certeza", ok: true, dudoso: true, mensaje: `Otros datos no 100 % seguros: ${[...dudosos].join(", ")}. La administradora los revisará con la foto.` });
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
