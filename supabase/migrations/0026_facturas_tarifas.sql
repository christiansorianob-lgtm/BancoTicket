-- Decisión del usuario (2026-11-03): la app comprueba los cálculos de cada factura de venta.
-- Porcentajes esperados, iguales para todos los emisores; se cambian aquí si cambia la ley
-- (sin tocar el código). ReteIVA es un porcentaje del IVA; los demás, del subtotal.
-- Solo agrega una fila de configuración: no cambia tablas ni datos (módulo de facturas).
insert into configuracion (clave, valor)
values ('tarifas_factura', '{"iva": 5, "retefuente": 1.5, "reteiva": 15, "reteica": 0}')
on conflict (clave) do nothing;
