-- Decisión del usuario (2026-11-25): «CONSORCIO AGROPALMA SAS» no es un proveedor real: la IA lo leyó
-- mal en un tiquete muy borroso (N° 40462 de Lukeoil, pendiente y marcado para revisión). Se quita de
-- la lista oficial creada en 0038. Solo cambia esa fila de configuración (creada hoy); ningún tiquete
-- se toca.
update configuracion set valor = valor - 'CONSORCIO AGROPALMA S.A.S.' where clave = 'proveedores_oficiales';
