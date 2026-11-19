-- Decisión del usuario (2026-11-19): algunas extractoras imprimen el AÑO cortado en la fecha de entrada
-- (Oleoflores: «19-noviembre-20 / 06:22:47»; la columna corta «2026»). No es ilegibilidad: faltan
-- cifras. Para las extractoras de esta lista, si el día y el mes se leen pero el año trae menos de 4
-- cifras, la app usa el año actual de Colombia (o el anterior si la fecha quedara en el futuro) y lo
-- avisa. Las reglas de legibilidad no cambian. La lista guarda los id de las extractoras.
-- Solo agrega una fila de configuración: no cambia tablas ni datos.
insert into configuracion (clave, valor)
select 'extractoras_anio_incompleto', jsonb_build_array(id::text) from extractoras where nombre = 'Oleoflores'
on conflict (clave) do nothing;
