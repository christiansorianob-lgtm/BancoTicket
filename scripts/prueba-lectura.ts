// Prueba rápida de normalización con los formatos reales del documento: npx tsx scripts/prueba-lectura.ts
import { kilosDesdeTexto, montoDesdeTexto } from "../src/lib/numeros";
import { interpretarFechaTiquete } from "../src/lib/fechas";
import { aplicarControles } from "../src/lib/lectura/controles";
import type { LecturaCruda } from "../src/lib/lectura/tipos";
import { textoSaldo } from "../src/lib/saldo";

let fallos = 0;
const igual = (nombre: string, real: unknown, esperado: unknown) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? "OK " : "MAL"} ${nombre}: ${JSON.stringify(real)}${ok ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
};

igual("anticipo negativo", montoDesdeTexto("-2.000.000", { negativo: true }), -2000000);
igual("negativo con $ y guion largo", montoDesdeTexto("−$ 1.500.000", { negativo: true }), -1500000);
igual("precio negativo no se acepta", montoDesdeTexto("-1.000"), null);
igual("admin: saldo positivo", textoSaldo(5000000, "admin").titulo, "Saldo a mi favor");
igual("admin: saldo negativo", textoSaldo(-2000000, "admin").titulo, "Le debo");
igual("comprador: saldo positivo", textoSaldo(5000000, "comprador").titulo, "Debo");
igual("comprador: saldo negativo", textoSaldo(-2000000, "comprador").titulo, "Me deben");

igual("2,070", kilosDesdeTexto("2,070"), 2070);
igual("Lukeoil 7,990 Kg", kilosDesdeTexto("7,990 Kg"), 7990);
igual("con punto final 7,990 kg.", kilosDesdeTexto("7,990 kg."), 7990);
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
igual("resta no da el neto impreso: pasa con bruto y tara marcados", r3.ok && r3.dudosos, ["peso bruto", "tara"]);
igual("se cobra el neto impreso, no la resta", r3.ok && r3.datos.neto_impreso_kg, 3100);
const r10 = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["peso_neto_impreso_kg"] }, { placaObligatoria: true });
igual("neto impreso dudoso: no pasa", r10.ok, false);
const r4 = aplicarControles({ ...base, placa: null, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("placa no leída: pasa marcada", r4.ok && r4.dudosos, ["placa"]);
const r9 = aplicarControles({ ...base, numero_tiquete: null, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("sin número: se rechaza", r9.ok, false);
const pesos = { peso_bruto_kg: "16,280", tara_kg: "8,290", peso_neto_impreso_kg: "7,990" };
const p1 = aplicarControles({ ...base, ...pesos, proveedor: "GLEUM FOODS S.A.S.", campos_dudosos: ["proveedor"] }, { placaObligatoria: true });
igual("proveedor con letra dudosa: marcado", p1.ok && p1.dudosos, ["proveedor"]);
const p4 = aplicarControles({ ...base, ...pesos, proveedor: null }, { placaObligatoria: true });
igual("proveedor no leído: marcado", p4.ok && p4.dudosos, ["proveedor"]);
const p5 = aplicarControles({ ...base, ...pesos, conductor: "DEIVER M", bascula: "B1", campos_dudosos: ["conductor", "bascula"] }, { placaObligatoria: true });
igual("conductor y báscula dudosos: pasan marcados", p5.ok && p5.dudosos, ["conductor", "báscula"]);

const viejo = new Date(); viejo.setMonth(viejo.getMonth() - 7);
const r11 = aplicarControles({ ...base, fecha_entrada: `${viejo.getDate()}/${viejo.getMonth() + 1}/${viejo.getFullYear()}`, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("tiquete de hace 7 meses: fuera de periodo", !r11.ok && r11.fueraDePeriodo, true);
const reciente = new Date(); reciente.setMonth(reciente.getMonth() - 5);
const r12 = aplicarControles({ ...base, fecha_entrada: `${reciente.getDate()}/${reciente.getMonth() + 1}/${reciente.getFullYear()}`, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("tiquete de hace 5 meses: pasa", r12.ok, true);

const r5 = aplicarControles({ ...base, placa: "284DAF", peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("placa 284DAF aceptada sin dudas", r5.ok && r5.dudosos, []);
const r6 = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["numero_tiquete", "tara_kg"] }, { placaObligatoria: true });
igual("número dudoso: no pasa", r6.ok, false);
const r6c = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["tara_kg", "fecha_entrada"] }, { placaObligatoria: true });
igual("fecha dudosa: no pasa (crítica)", r6c.ok, false);
const r6d = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["tara_kg"] }, { placaObligatoria: true });
igual("tara dudosa sigue marcada aunque la resta cuadre", r6d.ok && r6d.dudosos, ["tara"]);
const viejoDudoso = new Date(); viejoDudoso.setMonth(viejoDudoso.getMonth() - 7);
const r6e = aplicarControles({ ...base, fecha_entrada: `${viejoDudoso.getDate()}/${viejoDudoso.getMonth() + 1}/${viejoDudoso.getFullYear()}`, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["fecha_entrada"] }, { placaObligatoria: true });
igual("fecha vieja pero dudosa: ilegible, no fuera de periodo", !r6e.ok && !r6e.fueraDePeriodo, true);
const r6b = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["placa"] }, { placaObligatoria: true });
igual("duda en placa: pasa marcada", r6b.ok && r6b.dudosos, ["placa"]);
const r8 = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: null }, { placaObligatoria: true });
igual("sin neto impreso: no pasa", r8.ok, false);
const r7 = aplicarControles({ ...base, placa: "X1", peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("placa rara: pasa marcada", r7.ok && r7.dudosos, ["placa"]);

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodas las pruebas pasaron");
process.exit(fallos ? 1 : 0);
