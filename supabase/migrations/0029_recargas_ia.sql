-- Decisión del usuario (2026-11-06): la tarjeta de IA del Panel la ve solo el desarrollador, con los
-- totales desde el inicio, el mes actual y cuánto queda del crédito cargado en Claude Console.
--  * recargas_ia: cada saldo cargado en Claude Console. Solo se agregan filas (no se editan ni se
--    borran desde la app). La primera, la recarga inicial de US$ 10.
--  * consumo_ia_totales: lo gastado por módulo y tipo, en total y en el mes actual (hora de Colombia),
--    sumado en la base para no traer cada registro.
-- Solo AGREGA una tabla, una fila y una vista: no cambia ningún registro existente.

create table recargas_ia (
  id         uuid primary key default gen_random_uuid(),
  fecha      date not null,
  monto_usd  numeric(10, 2) not null check (monto_usd > 0),
  nota       text,
  creado_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table recargas_ia enable row level security;
create policy recargas_ia_ver     on recargas_ia for select using (es_desarrollador());
create policy recargas_ia_agregar on recargas_ia for insert with check (es_desarrollador());

insert into recargas_ia (fecha, monto_usd, nota) values ('2026-10-20', 10, 'Crédito inicial en Claude Console');

create view consumo_ia_totales with (security_invoker = true) as
select modulo, tipo, count(*) as usos, coalesce(sum(costo_usd), 0) as costo,
       count(*) filter (where creado_en >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota') as usos_mes,
       coalesce(sum(costo_usd) filter (where creado_en >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'), 0) as costo_mes
  from consumo_ia
 group by modulo, tipo;
