-- Decisión del usuario: bruto y tara se leen tal como están impresos; la resta es solo
-- informativa. Las plantillas aprendidas traían «Verificar que bruto − tara = neto…», que
-- empujaba a la IA a ajustar los pesos para que cuadraran. Se quita esa frase de las notas.
select fijar_contexto('editar', 'Quitar «Verificar que bruto − tara = neto» de las plantillas: la resta es solo informativa');
update formatos_extractora
   set plantilla = jsonb_set(plantilla, '{notas}',
         to_jsonb(btrim(regexp_replace(plantilla->>'notas', '\s*Verificar que bruto\s*[−-]\s*tara\s*=\s*neto[^.]*\.', '', 'g'))))
 where plantilla->>'notas' ~ 'Verificar que bruto\s*[−-]\s*tara';
