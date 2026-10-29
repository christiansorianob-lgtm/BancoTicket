/** Aviso cuando bruto − tara no da el neto impreso (informativo: se cobra el neto impreso). */
export function textoAvisoResta(bruto: number, tara: number, neto: number) {
  const f = (n: number) => n.toLocaleString("es-CO");
  return `Ojo: bruto − tara = ${f(bruto - tara)} kg, pero el neto impreso es ${f(neto)} kg (diferencia de ${f(Math.abs(bruto - tara - neto))} kg). Revise el bruto y la tara en la foto. Se cobra el neto impreso.`;
}

/**
 * Mensaje de WhatsApp con lo registrado de un tiquete (decisión del usuario: la administradora se lo
 * envía al comprador con la foto, solo con botón). Con precio va el precio y el valor; sin precio, el estado.
 */
export function mensajeTiquete(t: {
  extractora: string; numero: string; fecha: string; placa: string | null; proveedor: string | null;
  toneladas: number; precio: number | null; valor: number | null; estado: string;
}) {
  const pesos = (n: number) => n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const estado = ({ pendiente: "Pendiente de aprobación", vigente: "Aprobado", anulado: "Anulado", rechazado: "Rechazado" } as Record<string, string>)[t.estado] ?? t.estado;
  return [
    `*Tiquete ${t.extractora} N° ${t.numero}*`,
    `Fecha de entrada: ${t.fecha}`,
    `Placa: ${t.placa ?? "—"}`,
    t.proveedor ? `Proveedor: ${t.proveedor}` : null,
    `Peso neto: ${t.toneladas.toLocaleString("es-CO", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} t`,
    ...(t.precio != null && t.valor != null
      ? [`Precio por tonelada: ${pesos(t.precio)}`, `*Valor: ${pesos(t.valor)}*`, `Estado: ${estado}`]
      : [`Estado: ${estado}${t.estado === "vigente" ? ", sin precio aún" : ""}`]),
  ].filter(Boolean).join("\n");
}
