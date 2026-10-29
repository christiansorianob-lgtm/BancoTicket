-- Contador de IA (consumo_ia) para el módulo de facturas: distingue de dónde viene cada lectura.
-- Solo agrega columnas: las filas existentes quedan con modulo = 'tiquetes' y la lógica de tiquetes
-- no cambia. referencia_id: id de la factura creada con esa lectura (sin llave foránea).
alter table consumo_ia add column modulo text not null default 'tiquetes' check (modulo in ('tiquetes', 'facturas'));
alter table consumo_ia add column tipo_archivo text;   -- 'pdf' | 'imagen'
alter table consumo_ia add column resultado text;      -- ok | error | duplicada | revision
alter table consumo_ia add column referencia_id uuid;
