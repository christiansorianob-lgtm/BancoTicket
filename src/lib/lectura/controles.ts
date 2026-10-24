import { fechaHora, interpretarFechaTiquete } from "@/lib/fechas";
import { kilosDesdeTexto } from "@/lib/numeros";
import type { Control, LecturaCruda, ResultadoLectura } from "./tipos";

/** Antigüedad máxima de un tiquete para poder subirlo. */
export const MESES_MAXIMOS = 6;

// Placa: 5 a 7 letras y números, con al menos una letra y un número (ej. "284DAF").
const PLACA = /^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{5,7}$/;

/**
 * Campos que, si la IA no está 100 % segura, pasan marcados «Revisar» para la administradora.
 * Los vitales (número, peso neto y fecha) también (decisión del usuario, 2026-10-23): con duda pasan
 * a revisión en vez de rechazarse; solo se rechazan si no se pueden leer.
 */
const OTROS: Record<string, string> = {
  placa: "placa", peso_bruto_kg: "peso bruto", tara_kg: "tara", proveedor: "proveedor",
  conductor: "conductor", bascula: "báscula",
};

/** Nombres con que se guardan los vitales dudosos («Verificar: número, peso neto»). */
const VITALES: Record<string, string> = { numero_tiquete: "número", peso_neto_impreso_kg: "peso neto", fecha_entrada: "fecha" };

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
  const dudososIA = new Set(cruda.campos_dudosos ?? []);
  const vitalesDudosos: string[] = [];
  // Fecha dudosa: pasa a revisión. Se revisa antes del límite de 6 meses para que una fecha mal
  // leída no parezca un tiquete viejo: la administradora la confirma con la foto.
  const fechaDudosa = fechaOk && dudososIA.has("fecha_entrada");
  if (fechaDudosa) vitalesDudosos.push(VITALES.fecha_entrada);

  // Decisión del usuario: un tiquete de más de 6 meses es síntoma de fraude y no se puede subir.
  const limite = new Date();
  limite.setMonth(limite.getMonth() - MESES_MAXIMOS);
  const pareceViejo = fechaOk && new Date(fecha!).getTime() < limite.getTime();
  if (pareceViejo && fechaDudosa) {
    controles.push({ nombre: "Periodo permitido", ok: true, dudoso: true,
      mensaje: `La fecha leída (${fechaHora(fecha)}) tiene más de ${MESES_MAXIMOS} meses, pero no es 100 % segura: la administradora la confirma` });
  } else if (pareceViejo) {
    add("Periodo permitido", false, `El tiquete es de ${fechaHora(fecha)}: tiene más de ${MESES_MAXIMOS} meses`);
    return { ok: false, motivo: `Se leyó la fecha ${fechaHora(fecha)}: el tiquete tiene más de ${MESES_MAXIMOS} meses`, controles, cruda, fueraDePeriodo: true };
  }

  const a = kilosDesdeTexto(cruda.peso_bruto_kg);
  const b = kilosDesdeTexto(cruda.tara_kg);
  const pesosOk = a !== null && b !== null;
  add("Formato de pesos", pesosOk, pesosOk ? "Pesos en kilos enteros" : "No se leyeron bien los pesos");

  const bruto = pesosOk ? Math.max(a!, b!) : 0;
  const tara = pesosOk ? Math.min(a!, b!) : 0;
  const neto = bruto - tara;
  if (pesosOk && neto <= 0) add("Bruto y tara", false, "El peso bruto debe ser mayor que la tara");

  // Número y peso neto (neto × precio = valor del tiquete): si no se leyeron, no pasa; si la IA
  // duda de un dígito, pasan a revisión de la administradora con la duda que explicó la IA.
  if (numero && dudososIA.has("numero_tiquete")) vitalesDudosos.push(VITALES.numero_tiquete);
  // El N° y la fecha se muestran en ámbar (pasan, pero con duda).
  for (const c of controles) if ((c.nombre === "Número" && vitalesDudosos.includes("número")) || (c.nombre === "Fecha" && fechaDudosa)) c.dudoso = true;
  // El peso neto que vale es el IMPRESO (con él se cobra), no la resta.
  const netoImpreso = kilosDesdeTexto(cruda.peso_neto_impreso_kg);
  if (netoImpreso === null || netoImpreso <= 0) {
    add("Peso neto legible", false, "No se pudo leer el peso neto impreso");
  } else if (dudososIA.has("peso_neto_impreso_kg")) {
    vitalesDudosos.push(VITALES.peso_neto_impreso_kg);
    controles.push({ nombre: "Peso neto", ok: true, dudoso: true, mensaje: `Peso neto ${netoImpreso.toLocaleString("es-CO")} kg (no 100 % seguro)` });
  } else {
    add("Peso neto", true, `Peso neto ${netoImpreso.toLocaleString("es-CO")} kg`);
  }

  // Filtro 2: los demás campos dudosos no detienen el tiquete; pasan marcados e informados para
  // que la administradora decida.
  const dudosos = new Set([...vitalesDudosos, ...[...dudososIA].filter((c) => OTROS[c]).map((c) => OTROS[c])]);
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

  // Proveedor: sin listas de referencia (decisión del usuario). Si no se leyó, se marca; si la IA
  // dudó de alguna letra, ya viene en los dudosos.
  const proveedor = cruda.proveedor?.trim().replace(/\s+/g, " ") || null;
  if (!proveedor) {
    dudosos.add(OTROS.proveedor);
    controles.push({ nombre: "Proveedor", ok: true, dudoso: true, mensaje: "No se leyó el proveedor" });
  }

  if (vitalesDudosos.length > 0) {
    controles.push({ nombre: "Datos vitales", ok: true, dudoso: true,
      mensaje: `No 100 % seguros: ${vitalesDudosos.join(", ")}${cruda.observaciones ? ` (${cruda.observaciones})` : ""}. La administradora los revisará con la foto antes de aprobar.` });
  }
  const otros = [...dudosos].filter((d) => !vitalesDudosos.includes(d));
  if (otros.length > 0) {
    controles.push({ nombre: "Certeza", ok: true, dudoso: true, mensaje: `Otros datos no 100 % seguros: ${otros.join(", ")}. La administradora los revisará con la foto.` });
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
    // Lo que explicó la IA de sus dudas en los datos vitales, para mostrárselo a la administradora.
    notaIA: vitalesDudosos.length > 0 ? cruda.observaciones?.trim() || null : null,
    datos: {
      numero,
      fecha_entrada: fecha!,
      peso_bruto_kg: bruto,
      tara_kg: tara,
      neto_impreso_kg: netoImpreso,
      placa,
      conductor: cruda.conductor?.trim() || null,
      proveedor,
      bascula: cruda.bascula?.trim() || null,
    },
  };
}
