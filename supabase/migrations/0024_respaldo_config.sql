-- Decisión del usuario: respaldo completo (datos + archivos) que descarga el desarrollador. Cada
-- cuántos días se avisa que hace falta un respaldo (15, cambiable aquí sin tocar el código).
-- La fecha del último respaldo (clave 'ultimo_respaldo') la escribe la app al terminar uno.
-- Solo agrega una fila de configuración: no cambia tablas ni datos.
insert into configuracion (clave, valor) values ('dias_aviso_respaldo', '15') on conflict (clave) do nothing;
