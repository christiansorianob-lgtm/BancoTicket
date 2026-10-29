/** Aviso cuando bruto − tara no da el neto impreso (informativo: se cobra el neto impreso). */
export function textoAvisoResta(bruto: number, tara: number, neto: number) {
  const f = (n: number) => n.toLocaleString("es-CO");
  return `Ojo: bruto − tara = ${f(bruto - tara)} kg, pero el neto impreso es ${f(neto)} kg (diferencia de ${f(Math.abs(bruto - tara - neto))} kg). Revise el bruto y la tara en la foto. Se cobra el neto impreso.`;
}

