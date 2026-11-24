-- Decisión del usuario (2026-11-24), solo módulo de facturas: nuevo tipo de factura TRANSPORTE
-- (servicio de transporte de fruta, ej. FEPA 18 de Palmali a Palnorte). Tarifas: IVA 0 % (el transporte
-- de carga no lleva IVA) y ReteFuente 1 %; ReteIVA y ReteICA en $ 0 = «no se aplicó». Otro acepta
-- cualquiera de las tarifas de los demás tipos.
-- No modifica ninguna factura ni borra datos:
--  * la restricción de `fact_facturas.tipo` se vuelve a crear admitiendo también 'TRANSPORTE' (todas
--    las filas actuales siguen cumpliéndola);
--  * se AGREGA una fila de configuración con las tarifas de los 4 tipos; la de 0033 no se modifica y
--    queda de respaldo (la app prefiere la nueva).
alter table fact_facturas drop constraint fact_facturas_tipo_check;
alter table fact_facturas add constraint fact_facturas_tipo_check check (tipo in ('FRUTA', 'COMISION', 'TRANSPORTE', 'OTRO'));
comment on column fact_facturas.tipo is 'FRUTA = compra de fruta, COMISION = comisión, TRANSPORTE = transporte, OTRO';

insert into configuracion (clave, valor) values ('tarifas_por_tipo_factura_2', '{
  "FRUTA":      {"iva": [5],        "retefuente": [1.5],        "reteiva": [15], "reteica": []},
  "COMISION":   {"iva": [19],       "retefuente": [11],         "reteiva": [15], "reteica": []},
  "TRANSPORTE": {"iva": [0],        "retefuente": [1],          "reteiva": [15], "reteica": []},
  "OTRO":       {"iva": [0, 5, 19], "retefuente": [1, 1.5, 11], "reteiva": [15], "reteica": []}
}')
on conflict (clave) do nothing;
