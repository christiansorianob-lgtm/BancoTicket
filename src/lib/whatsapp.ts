function numeroWhatsApp(celular: string | null | undefined) {
  let numero = (celular ?? "").replace(/\D/g, "");
  if (numero.length === 10) numero = "57" + numero; // celular colombiano sin indicativo
  return numero;
}

/** Enlace web de WhatsApp con el mensaje escrito (wa.me). Sirve en computador. */
export function enlaceWhatsApp(celular: string | null | undefined, mensaje: string): string {
  const numero = numeroWhatsApp(celular);
  const base = numero ? `https://wa.me/${numero}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(mensaje)}`;
}

/** Enlace directo a la app de WhatsApp del celular, con el chat y el mensaje listos para enviar. */
export function enlaceWhatsAppApp(celular: string | null | undefined, mensaje: string): string {
  const numero = numeroWhatsApp(celular);
  return `whatsapp://send?${numero ? `phone=${numero}&` : ""}text=${encodeURIComponent(mensaje)}`;
}
