-- BancoTicket — registro del consumo de la IA (tokens y costo estimado por llamada),
-- para que el administrador vea cuánto se gasta al mes.

create table if not exists consumo_ia (
  id              bigint generated always as identity primary key,
  creado_en       timestamptz not null default now(),
  tipo            text not null,          -- 'lectura' (tiquete de comprador) o 'aprendizaje' (formato nuevo)
  modelo          text not null,
  tokens_entrada  integer not null default 0,
  tokens_salida   integer not null default 0,
  costo_usd       numeric(12, 6) not null default 0,
  usuario_id      uuid references perfiles (id)
);
create index if not exists consumo_ia_fecha_idx on consumo_ia (creado_en desc);

alter table consumo_ia enable row level security;
drop policy if exists consumo_ia_ver on consumo_ia;
create policy consumo_ia_ver on consumo_ia for select using (es_admin());
-- Se escribe solo desde el servidor (service_role).
