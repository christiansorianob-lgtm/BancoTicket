// Prueba rápida de normalización con los formatos reales del documento: npx tsx scripts/prueba-lectura.ts
import { kilosDesdeTexto, montoDesdeTexto } from "../src/lib/numeros";
import { interpretarFechaTiquete } from "../src/lib/fechas";
import { aplicarControles } from "../src/lib/lectura/controles";
import type { LecturaCruda } from "../src/lib/lectura/tipos";

let fallos = 0;
const igual = (nombre: string, real: unknown, esperado: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? "OK " : "MAL"} ${nombre}: ${JSON.stringify(real)}${ok ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
};

igual("2,070", kilosDesdeTexto("2,070"), 2070);
igual("26.500", kilosDesdeTexto("26.500"), 26500);
igual("10680", kilosDesdeTexto("10680"), 10680);
igual("17.500 kg", kilosDesdeTexto("17.500 kg"), 17500);
igual("2,07 (no entero)", kilosDesdeTexto("2,07"), null);
igual("monto 1.500.000", montoDesdeTexto("1.500.000"), 1500000);
igual("monto 850000", montoDesdeTexto("850000"), 850000);
igual("monto 1.234,50", montoDesdeTexto("1.234,50"), 1234.5);

igual("Palnorte", interpretarFechaTiquete("27 de julio de 2026 10:15"), "2026-07-27T10:15:00-05:00");
igual("Agrovaspalma", interpretarFechaTiquete("2026-10-13 9:41:42 AM"), "2026-10-13T09:41:42-05:00");
igual("BabiPalm", interpretarFechaTiquete("07/10/2026 8:23:59 a. m."), "2026-10-07T08:23:59-05:00");
igual("BabiPalm pm", interpretarFechaTiquete("07/10/2026 1:05:00 p. m."), "2026-10-07T13:05:00-05:00");
igual("Oleoflores", interpretarFechaTiquete("14-octubre-2026 08:34:30"), "2026-10-14T08:34:30-05:00");
igual("Lukeoil", interpretarFechaTiquete("08-09-2026 13:27:50"), "2026-09-08T13:27:50-05:00");
igual("fecha inválida", interpretarFechaTiquete("31/02/2026"), null);

const base = { es_tiquete: true, numero_tiquete: "402909", fecha_entrada: "27 de julio de 2026", placa: "TKL-482", conductor: null, proveedor: "INVERSIONES AGROPALNORT S.A.S.", bascula: null, observaciones: null, extractora_impresa: "Babú Palm", nit_extractora: "901249632", extractora: "Babú Palm", campos_dudosos: [] as LecturaCruda["campos_dudosos"] };
const r1 = aplicarControles({ ...base, peso_bruto_kg: "2,070", tara_kg: "680", peso_neto_impreso_kg: "1,390" }, { placaObligatoria: true });
igual("Palnorte controles ok", r1.ok, true);
igual("Palnorte neto", r1.ok && r1.datos.peso_bruto_kg - r1.datos.tara_kg, 1390);
const r2 = aplicarControles({ ...base, peso_bruto_kg: "9.000", tara_kg: "26.500", peso_neto_impreso_kg: "17.500" }, { placaObligatoria: true });
igual("bruto/tara invertidos se ordenan", r2.ok && [r2.datos.peso_bruto_kg, r2.datos.tara_kg], [26500, 9000]);
const r3 = aplicarControles({ ...base, peso_bruto_kg: "6,320", tara_kg: "3,130", peso_neto_impreso_kg: "3,100" }, { placaObligatoria: true });
igual("neto impreso no cuadra", r3.ok, false);
const r4 = aplicarControles({ ...base, placa: null, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("placa obligatoria faltante", r4.ok, false);

const r5 = aplicarControles({ ...base, placa: "284DAF", peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("placa 284DAF aceptada sin dudas", r5.ok && r5.dudosos, []);
const r6 = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["numero_tiquete", "tara_kg"] }, { placaObligatoria: true });
igual("IA con dudas en número/tara: se rechaza", r6.ok, false);
const r6b = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["placa"] }, { placaObligatoria: true });
igual("IA con duda solo en placa: pasa marcada", r6b.ok && r6b.dudosos, ["placa"]);
const r8 = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: null }, { placaObligatoria: true });
igual("sin neto impreso: se rechaza", r8.ok, false);
const r7 = aplicarControles({ ...base, placa: "X1", peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("placa rara: pasa pero marcada", r7.ok && r7.dudosos, ["placa"]);

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodas las pruebas pasaron");
process.exit(fallos ? 1 : 0);
