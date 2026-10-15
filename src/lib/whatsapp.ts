/** Enlace gratuito de WhatsApp con el mensaje escrito (wa.me). Quien lo abre solo toca enviar. */
export function enlaceWhatsApp(celular: string | null | undefined, mensaje: string): string {
  let numero = (celular ?? "").replace(/\D/g, "");
  if (numero.length === 10) numero = "57" + numero; // celular colombiano sin indicativo
  const base = numero ? `https://wa.me/${numero}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(mensaje)}`;
}
