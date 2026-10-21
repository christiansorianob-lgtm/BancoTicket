import { interpretarFechaTiquete } from "@/lib/fechas";
import { kilosDesdeTexto } from "@/lib/numeros";
import type { Control, LecturaCruda, ResultadoLectura } from "./tipos";

const NOMBRES = { numero_tiquete: "número", peso_neto_impreso_kg: "peso neto" };

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

  // Decisión del usuario: solo el número y el peso neto (el neto × precio es lo que vale el
  // tiquete) exigen legibilidad 100 %; si no la tienen, pasan marcados para la administradora.
  // Los demás campos son informativos: se toleran y no se marcan.
  const dudosos = new Set<string>();
  if (cruda.campos_dudosos?.includes("numero_tiquete")) dudosos.add(NOMBRES.numero_tiquete);

  // El neto se confirma solo con la prueba objetiva: bruto − tara debe dar exacto el neto impreso
  // (un dígito mal leído descuadraría la resta). Sin neto impreso o si no cuadra, se marca.
  const netoImpreso = kilosDesdeTexto(cruda.peso_neto_impreso_kg);
  if (netoImpreso === null) {
    dudosos.add(NOMBRES.peso_neto_impreso_kg);
    controles.push({ nombre: "Peso neto", ok: true, dudoso: true, mensaje: "No se leyó el peso neto impreso para comprobar la resta" });
  } else if (netoImpreso === neto) {
    add("Bruto − tara = neto impreso", true, "Coincide con el neto impreso: peso neto confirmado");
  } else if (pesosOk) {
    dudosos.add(NOMBRES.peso_neto_impreso_kg);
    controles.push({ nombre: "Bruto − tara = neto impreso", ok: true, dudoso: true,
      mensaje: `La resta (${neto}) no coincide con el neto impreso (${cruda.peso_neto_impreso_kg})` });
  }

  const placa = normalizarPlaca(cruda.placa);
  if (placa) controles.push({ nombre: "Placa", ok: true, mensaje: `Placa ${placa}` });
  else if (opciones.placaObligatoria) controles.push({ nombre: "Placa", ok: true, mensaje: "No se leyó la placa (informativo)" });

  if (dudosos.size > 0) {
    controles.push({ nombre: "Certeza", ok: true, dudoso: true, mensaje: `No es 100 % seguro: ${[...dudosos].join(", ")}. La administradora lo revisará con la foto.` });
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
