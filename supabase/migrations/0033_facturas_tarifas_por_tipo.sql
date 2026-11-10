-- Decisión del usuario (2026-11-10), solo módulo de facturas: las tarifas permitidas dependen del TIPO
-- de factura. Compra de fruta: IVA 5 %, ReteFuente 1,5 %; Comisión: IVA 19 %, ReteFuente 11 %; ReteIVA
-- 15 % del IVA en ambas. Algunas empresas no practican retenciones: una retención en $ 0 es «no se
-- aplicó» y se acepta (lo decide la app, no esta tabla). Otro: cualquiera de las anteriores.
-- Solo AGREGA una fila de configuración (las de 0026 y 0031 no se modifican; la app usa esta).
insert into configuracion (clave, valor) values ('tarifas_por_tipo_factura', '{
  "FRUTA":    {"iva": [5],     "retefuente": [1.5],     "reteiva": [15], "reteica": []},
  "COMISION": {"iva": [19],    "retefuente": [11],      "reteiva": [15], "reteica": []},
  "OTRO":     {"iva": [5, 19], "retefuente": [1.5, 11], "reteiva": [15], "reteica": []}
}')
on conflict (clave) do nothing;
