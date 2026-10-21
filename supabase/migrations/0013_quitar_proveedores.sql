-- Decisión del usuario: no se guardan proveedores (ni otros valores) de referencia para comparar
-- la lectura. La IA lee el tiquete y marca «Revisar» lo que no lea 100 % seguro. Se deshace 0012
-- (la tabla solo tenía el proveedor de ejemplo que se cargó en esa migración).
drop table if exists proveedores;
