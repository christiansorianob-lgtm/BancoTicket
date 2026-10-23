/**
 * Ayudas para escribir montos en pesos (formato colombiano: punto de miles, coma decimal).
 * Sin dependencias: se usan en el navegador y en las pruebas.
 */

/**
 * Da formato a lo que se va escribiendo: "-2500000,5" → "-2.500.000,5". Conserva el signo
 * negativo, admite una sola coma decimal con hasta 2 decimales y quita ceros a la izquierda.
 */
export function formatearMonto(texto: string): string {
  const negativo = /^\s*[-−–]/.test(texto);
  const limpio = texto.replace(/[^\d,]/g, "");
  const coma = limpio.indexOf(",");
  let entero = (coma < 0 ? limpio : limpio.slice(0, coma)).replace(/^0+(?=\d)/, "");
  const decimales = coma < 0 ? null : limpio.slice(coma + 1).replace(/,/g, "").slice(0, 2);
  if (decimales !== null && entero === "") entero = "0";
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (negativo ? "-" : "") + conPuntos + (decimales !== null ? `,${decimales}` : "");
}

/** Monto con signo para leer: "$ 5.000.000", "−$ 2.000.000,50". */
export function textoMonto(n: number): string {
  const abs = Math.abs(n).toLocaleString("es-CO", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "−" : ""}$ ${abs}`;
}

const UNIDADES = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce",
  "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiún", "veintidós", "veintitrés", "veinticuatro",
  "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"];
const DECENAS = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function hastaMil(n: number): string {
  if (n === 100) return "cien";
  const r = n % 100;
  const resto = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ` y ${UNIDADES[r % 10]}` : "");
  return [CENTENAS[Math.floor(n / 100)], resto].filter(Boolean).join(" ");
}

function hastaMillon(n: number): string {
  const m = Math.floor(n / 1000), r = n % 1000;
  const miles = m === 0 ? "" : m === 1 ? "mil" : `${hastaMil(m)} mil`;
  return [miles, r ? hastaMil(r) : ""].filter(Boolean).join(" ");
}

/** El monto en letras, para leerlo sin contar ceros: 2500000 → "Dos millones quinientos mil pesos". */
export function montoEnLetras(monto: number): string {
  const n = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - n) * 100);
  const mill = Math.floor(n / 1_000_000), r = n % 1_000_000;
  const millones = mill === 0 ? "" : mill === 1 ? "un millón" : `${hastaMillon(mill)} millones`;
  const palabras = n === 0 ? "cero" : [millones, r ? hastaMillon(r) : ""].filter(Boolean).join(" ");
  const pesos = n >= 1_000_000 && r === 0 ? "de pesos" : n === 1 ? "peso" : "pesos";
  const texto = `${palabras} ${pesos}${centavos ? ` con ${hastaMil(centavos)} centavo${centavos === 1 ? "" : "s"}` : ""}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
