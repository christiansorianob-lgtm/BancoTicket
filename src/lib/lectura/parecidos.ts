/**
 * Números de tiquete parecidos (decisión del usuario): cuando el N° quedó dudoso, la administradora
 * ve los de la misma extractora que difieren en un solo dígito (cambiado, de más o de menos), por si
 * el dudoso es en realidad uno de ellos (ej. 16754 leído en vez de 16764): duplicado disfrazado.
 */
export function sonParecidos(a: string, b: string): boolean {
  if (a === b) return false;
  if (a.length === b.length) {
    let distintos = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++distintos > 1) return false;
    return distintos === 1;
  }
  if (Math.abs(a.length - b.length) !== 1) return false;
  const [largo, corto] = a.length > b.length ? [a, b] : [b, a];
  for (let i = 0; i < largo.length; i++) if (largo.slice(0, i) + largo.slice(i + 1) === corto) return true;
  return false;
}
