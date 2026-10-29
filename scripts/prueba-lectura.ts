// Prueba rápida de normalización con los formatos reales del documento: npx tsx scripts/prueba-lectura.ts
import { kilosDesdeTexto, montoDesdeTexto } from "../src/lib/numeros";
import { antiguedad, interpretarFechaTiquete } from "../src/lib/fechas";
import { aplicarControles } from "../src/lib/lectura/controles";
import type { LecturaCruda } from "../src/lib/lectura/tipos";
import { textoSaldo } from "../src/lib/saldo";
import { sonParecidos } from "../src/lib/lectura/parecidos";
import { armarCuenta } from "../src/lib/informes/movimientos";
import { completarPrecio, tipoReal, validarFactura } from "../src/lib/facturas/validar";
import { facturaDesde, numeroEnCampo } from "../src/lib/facturas/formulario";
import { formatearMonto, montoEnLetras, textoMonto } from "../src/lib/monto";

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

// Facturas de venta: validaciones con las 3 facturas reales y tipo real del archivo.
const fac = (numero: string, kilos: number, precio: number | null, subtotal: number, iva: number, ret: number, total: number) => ({
  numero_factura: numero, cufe: "x", emisor_razon_social: "E", emisor_nit: "1", extractora_razon_social: "X", extractora_nit: "2",
  fecha_emision: "2026-10-19", fecha_vencimiento: "2026-10-20", periodo_desde: "2026-10-06", periodo_hasta: "2026-10-19",
  kilos, precio_kilo: precio, subtotal, iva, total_retenciones_esperadas: ret, total_a_pagar: total });
const todasOk = (d: Parameters<typeof validarFactura>[0]) => validarFactura(completarPrecio(d)).every((v) => v.ok);
igual("factura FEIA 669 cuadra", todasOk(fac("FEIA 669", 186670, 730, 136269100, 6813455, 1022018.25, 142060536.75)), true);
igual("factura GLFE 8 cuadra (precio calculado)", todasOk(fac("GLFE 8", 11690, null, 8241450, 412072.5, 185432.63, 8468089.87)), true);
igual("factura GLFE 7 cuadra", todasOk(fac("GLFE 7", 22300, 664, 14807200, 740360, 222108, 15325452)), true);
igual("precio por kilo calculado", completarPrecio(fac("GLFE 8", 11690, null, 8241450, 0, 0, 0)).precio_kilo, 705);
igual("total que no cuadra: falla", validarFactura(fac("FEIA 669", 186670, 730, 136269100, 6813455, 1022018.25, 136269100)).find((v) => v.nombre.startsWith("Subtotal"))?.ok, false);
igual("falta el CUFE: falla", validarFactura({ ...fac("A", 1, 1, 1, 0, 0, 1), cufe: null }).find((v) => v.nombre === "Campos completos")?.ok, false);
igual("formulario: número colombiano", facturaDesde((k) => ({ total_a_pagar: "142.060.536,75", kilos: "186.670" } as Record<string, string>)[k]).total_a_pagar, 142060536.75);
igual("formulario: retenciones vacías = 0", facturaDesde(() => "").total_retenciones_esperadas, 0);
igual("formulario: ida y vuelta", montoDesdeTexto(numeroEnCampo(8468089.87)), 8468089.87);
igual("tipo real: pdf / jpeg / png / webp / otro", [
  tipoReal(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), tipoReal(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
  tipoReal(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), tipoReal(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
  tipoReal(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))], ["pdf", "jpeg", "png", "webp", null]);

// Antigüedad del tiquete (días de Colombia).
const hoyP = new Date("2026-10-23T20:00:00-05:00");
igual("antigüedad: mismo día", antiguedad("2026-10-23T06:00:00-05:00", hoyP).texto, "hoy");
igual("antigüedad: días", antiguedad("2026-10-20T16:09:00-05:00", hoyP).texto, "hace 3 días");
igual("antigüedad: meses y días", antiguedad("2026-08-18T10:00:00-05:00", hoyP), { texto: "hace 2 meses y 5 días", meses: 2 });
igual("antigüedad: meses exactos", antiguedad("2026-04-23T10:00:00-05:00", hoyP).texto, "hace 6 meses");
igual("antigüedad: cruza fin de mes", antiguedad("2026-09-30T10:00:00-05:00", hoyP).texto, "hace 23 días");
igual("antigüedad: 1 mes y 1 día", antiguedad("2026-09-22T23:30:00-05:00", hoyP).texto, "hace 1 mes y 1 día");

// Monto del anticipo mientras se escribe y en letras.
igual("formato: miles", formatearMonto("2500000"), "2.500.000");
igual("formato: negativo con decimales", formatearMonto("-2500000,567"), "-2.500.000,56");
igual("formato: puntos escritos a mano", formatearMonto("5.0000.00"), "5.000.000");
igual("formato: coma sola", formatearMonto(",5"), "0,5");
igual("formato: se entiende igual al enviar", montoDesdeTexto(formatearMonto("-2500000,5"), { negativo: true }), -2500000.5);
igual("texto monto", [textoMonto(5000000), textoMonto(-2000000.5)], ["$ 5.000.000", "−$ 2.000.000,50"]);
igual("letras: millones", montoEnLetras(2500000), "Dos millones quinientos mil pesos");
igual("letras: millón exacto", montoEnLetras(-1000000), "Un millón de pesos");
igual("letras: compuesto", montoEnLetras(86796710), "Ochenta y seis millones setecientos noventa y seis mil setecientos diez pesos");
igual("letras: veintiún mil", montoEnLetras(21100), "Veintiún mil cien pesos");
igual("letras: mil millones", montoEnLetras(1001000000), "Mil un millones de pesos");
igual("letras: centavos", montoEnLetras(150.5), "Ciento cincuenta pesos con cincuenta centavos");

// Reporte «Tiquetes y anticipos»: orden por fecha de registro y saldo acumulado.
const tq = (id: string, cargado_en: string, valor: number | null) => ({ id, cargado_en, extractora: "Babú Palm", numero: id, fecha_entrada: cargado_en, peso_neto_t: 1, precio_tonelada: valor, valor });
const cuenta = armarCuenta(
  [tq("t1", "2026-10-01T10:00:00-05:00", 100), tq("t2", "2026-10-03T10:00:00-05:00", 300), tq("t3", "2026-10-06T10:00:00-05:00", null)],
  [{ id: "a1", confirmado_en: "2026-10-05T09:00:00-05:00", monto: 200, nota: null }, { id: "a0", confirmado_en: "2026-09-30T09:00:00-05:00", monto: -50, nota: null }],
);
igual("cuenta: orden por fecha", cuenta.movimientos.map((m) => m.id), ["a0", "t1", "t2", "a1", "t3"]);
igual("cuenta: saldo acumulado", cuenta.movimientos.map((m) => m.saldo), [-50, -150, -450, -250, -250]);
igual("cuenta: sin precio no mueve el saldo", [cuenta.sinPrecio, cuenta.movimientos[4].observacion], [1, "Sin precio aún"]);
igual("cuenta: anticipo negativo", cuenta.movimientos[0].detalle, "Saldo a favor del comprador");
igual("cuenta: totales", [cuenta.totalTiquetes, cuenta.totalAnticipos, cuenta.saldoFinal], [400, 150, -250]);
const periodo = armarCuenta(
  [tq("t1", "2026-10-01T10:00:00-05:00", 100), tq("t2", "2026-10-03T10:00:00-05:00", 300)],
  [{ id: "a1", confirmado_en: "2026-10-05T09:00:00-05:00", monto: 200, nota: "Transferencia" }],
  "2026-10-02", "2026-10-04",
);
igual("cuenta: periodo con saldo inicial", [periodo.saldoInicial, periodo.movimientos.map((m) => m.id), periodo.saldoFinal], [-100, ["t2"], -400]);

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
igual("neto impreso dudoso: pasa a revisión", r10.ok && r10.dudosos, ["peso neto"]);
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
const r6d_sinNota = () => { const r = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", observaciones: "algo", campos_dudosos: ["placa"] }, { placaObligatoria: true }); return r.ok ? r.notaIA : "falló"; };
const r6 = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", observaciones: "número: 4.º dígito 5 o 6", campos_dudosos: ["numero_tiquete", "tara_kg"] }, { placaObligatoria: true });
igual("número dudoso: pasa a revisión", r6.ok && r6.dudosos, ["número", "tara"]);
igual("número dudoso: lleva la duda de la IA", r6.ok && r6.notaIA, "número: 4.º dígito 5 o 6");
igual("sin duda vital: sin nota de la IA", r6d_sinNota(), null);
const r6c = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["tara_kg", "fecha_entrada"] }, { placaObligatoria: true });
igual("fecha dudosa: pasa a revisión", r6c.ok && r6c.dudosos, ["fecha", "tara"]);
const r6d = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["tara_kg"] }, { placaObligatoria: true });
igual("tara dudosa sigue marcada aunque la resta cuadre", r6d.ok && r6d.dudosos, ["tara"]);
const viejoDudoso = new Date(); viejoDudoso.setMonth(viejoDudoso.getMonth() - 7);
const r6e = aplicarControles({ ...base, fecha_entrada: `${viejoDudoso.getDate()}/${viejoDudoso.getMonth() + 1}/${viejoDudoso.getFullYear()}`, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["fecha_entrada"] }, { placaObligatoria: true });
igual("fecha vieja pero dudosa: pasa a revisión, no fuera de periodo", r6e.ok && r6e.dudosos, ["fecha"]);
const r6b = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["placa"] }, { placaObligatoria: true });
igual("duda en placa: pasa marcada", r6b.ok && r6b.dudosos, ["placa"]);
const r8 = aplicarControles({ ...base, peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: null }, { placaObligatoria: true });
igual("sin neto impreso: no pasa", r8.ok, false);
const r8b = aplicarControles({ ...base, fecha_entrada: "99/99/2026", peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990", campos_dudosos: ["fecha_entrada"] }, { placaObligatoria: true });
igual("fecha ilegible: no pasa aunque venga dudosa", r8b.ok, false);
igual("parecidos: un dígito cambiado", sonParecidos("16754", "16764"), true);
igual("parecidos: un dígito de más", sonParecidos("16754", "167540"), true);
igual("parecidos: dos dígitos distintos no", sonParecidos("16754", "16768"), false);
igual("parecidos: el mismo no", sonParecidos("16754", "16754"), false);
const r7 = aplicarControles({ ...base, placa: "X1", peso_bruto_kg: "11630", tara_kg: "6640", peso_neto_impreso_kg: "4990" }, { placaObligatoria: true });
igual("placa rara: pasa marcada", r7.ok && r7.dudosos, ["placa"]);

console.log(fallos ? `\n${fallos} prueba(s) fallaron` : "\nTodas las pruebas pasaron");
process.exit(fallos ? 1 : 0);
