-- Decisión del usuario: en la factura, cada retención en su propio campo (como el bloque de totales
-- de Siigo): ReteFuente, ReteIVA y ReteICA (en 0 si no aplica). El IVA ya estaba aparte.
-- total_retenciones_esperadas se conserva y lo calculan las funciones como la suma de las tres.
-- Solo agrega columnas y recrea las vistas y funciones del módulo de facturas (sin datos que convertir).

alter table fact_facturas
  add column retefuente numeric(14, 2) not null default 0 check (retefuente >= 0),
  add column reteiva    numeric(14, 2) not null default 0 check (reteiva >= 0),
  add column reteica    numeric(14, 2) not null default 0 check (reteica >= 0);

-- Vistas: cada retención practicada (abonos vigentes) frente a la esperada.
drop view fact_totales;
drop view fact_facturas_estado;

create view fact_facturas_estado with (security_invoker = true) as
select f.*,
       f.subtotal + f.iva                                                         as total_cobrar,
       coalesce(p.aplicado, 0)                                                    as total_aplicado,
       coalesce(p.retefuente, 0) + coalesce(p.reteiva, 0) + coalesce(p.reteica, 0) as retenciones_practicadas,
       coalesce(p.retefuente, 0)                                                  as retefuente_practicada,
       coalesce(p.reteiva, 0)                                                     as reteiva_practicada,
       coalesce(p.reteica, 0)                                                     as reteica_practicada,
       coalesce(p.abonos, 0)                                                      as abonos_vigentes,
       f.subtotal + f.iva - coalesce(p.aplicado, 0)                               as saldo_pendiente,
       e.estado_cobro,
       e.estado_cobro in ('PENDIENTE_PAGO', 'ABONADA_PARCIAL')
         and f.fecha_vencimiento < (now() at time zone 'America/Bogota')::date   as vencida,
       case when e.estado_cobro in ('PENDIENTE_PAGO', 'ABONADA_PARCIAL') and f.fecha_vencimiento < (now() at time zone 'America/Bogota')::date
            then (now() at time zone 'America/Bogota')::date - f.fecha_vencimiento else 0 end as dias_mora,
       not f.anulada and coalesce(p.aplicado, 0) > f.subtotal + f.iva + 1        as alerta_sobrepago,
       -- Cada retención: al quedar pagada debe coincidir con la esperada; antes, solo si ya se pasó.
       not f.anulada and coalesce(p.abonos, 0) > 0 and (
            (e.estado_cobro = 'PAGADA' and (abs(coalesce(p.retefuente, 0) - f.retefuente) > 1
                                         or abs(coalesce(p.reteiva, 0) - f.reteiva) > 1
                                         or abs(coalesce(p.reteica, 0) - f.reteica) > 1))
         or coalesce(p.retefuente, 0) > f.retefuente + 1
         or coalesce(p.reteiva, 0) > f.reteiva + 1
         or coalesce(p.reteica, 0) > f.reteica + 1)                               as alerta_retenciones
  from fact_facturas f
  left join (select factura_id, sum(valor_aplicado) aplicado, sum(retefuente) retefuente, sum(reteiva) reteiva,
                    sum(reteica) reteica, count(*) abonos
               from fact_pagos where estado = 'VIGENTE' group by factura_id) p on p.factura_id = f.id
  cross join lateral (select case
       when f.anulada then 'ANULADA'
       when f.subtotal + f.iva - coalesce(p.aplicado, 0) <= 1 then 'PAGADA'
       when coalesce(p.abonos, 0) > 0 then 'ABONADA_PARCIAL'
       else 'PENDIENTE_PAGO' end as estado_cobro) e;

create view fact_totales with (security_invoker = true) as
select g.dimension, g.clave, count(*) as facturas, sum(e.kilos) as kilos,
       sum(e.total_cobrar) as facturado, sum(e.total_aplicado) as pagado, sum(e.saldo_pendiente) as saldo
  from fact_facturas_estado e
  cross join lateral (values
    ('extractora', coalesce(e.extractora_razon_social, '—')),
    ('emisor', coalesce(e.emisor_razon_social, '—')),
    ('mes', coalesce(to_char(e.fecha_emision, 'YYYY-MM'), '—'))) g(dimension, clave)
 where not e.anulada
 group by g.dimension, g.clave;

-- Funciones: reciben retefuente, reteiva y reteica; el total de retenciones es su suma.
create or replace function fact_guardar_factura(p jsonb, p_estado text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo uuid;
  rf numeric := coalesce((p->>'retefuente')::numeric, 0);
  ri numeric := coalesce((p->>'reteiva')::numeric, 0);
  rc numeric := coalesce((p->>'reteica')::numeric, 0);
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if nullif(btrim(p->>'cufe'), '') is not null and exists (select 1 from fact_facturas where cufe = btrim(p->>'cufe')) then
    raise exception 'FACTURA_DUPLICADA: ya existe una factura con ese CUFE';
  end if;
  insert into fact_facturas (numero_factura, cufe, emisor_razon_social, emisor_nit, extractora_razon_social, extractora_nit,
    fecha_emision, fecha_vencimiento, periodo_desde, periodo_hasta, kilos, precio_kilo, subtotal, iva,
    retefuente, reteiva, reteica, total_retenciones_esperadas, total_a_pagar, estado_lectura, motivo_revision, archivo_path, tipo_archivo)
  values (btrim(p->>'numero_factura'), nullif(btrim(p->>'cufe'), ''), p->>'emisor_razon_social', p->>'emisor_nit',
    p->>'extractora_razon_social', p->>'extractora_nit', (p->>'fecha_emision')::date, (p->>'fecha_vencimiento')::date,
    (p->>'periodo_desde')::date, (p->>'periodo_hasta')::date, (p->>'kilos')::numeric, (p->>'precio_kilo')::numeric,
    coalesce((p->>'subtotal')::numeric, 0), coalesce((p->>'iva')::numeric, 0),
    rf, ri, rc, rf + ri + rc, coalesce((p->>'total_a_pagar')::numeric, 0),
    p_estado, p->>'motivo_revision', p->>'archivo_path', p->>'tipo_archivo')
  returning id into nuevo;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', nuevo, 'crear', p_estado);
  return nuevo;
end;
$$;

create or replace function fact_actualizar_factura(p_id uuid, p jsonb, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
declare
  rf numeric := coalesce((p->>'retefuente')::numeric, 0);
  ri numeric := coalesce((p->>'reteiva')::numeric, 0);
  rc numeric := coalesce((p->>'reteica')::numeric, 0);
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if (select anulada from fact_facturas where id = p_id) then raise exception 'La factura está anulada'; end if;
  if nullif(btrim(p->>'cufe'), '') is not null and exists (select 1 from fact_facturas where cufe = btrim(p->>'cufe') and id <> p_id) then
    raise exception 'FACTURA_DUPLICADA: ya existe otra factura con ese CUFE';
  end if;
  update fact_facturas set
    numero_factura = btrim(p->>'numero_factura'), cufe = nullif(btrim(p->>'cufe'), ''),
    emisor_razon_social = p->>'emisor_razon_social', emisor_nit = p->>'emisor_nit',
    extractora_razon_social = p->>'extractora_razon_social', extractora_nit = p->>'extractora_nit',
    fecha_emision = (p->>'fecha_emision')::date, fecha_vencimiento = (p->>'fecha_vencimiento')::date,
    periodo_desde = (p->>'periodo_desde')::date, periodo_hasta = (p->>'periodo_hasta')::date,
    kilos = (p->>'kilos')::numeric, precio_kilo = (p->>'precio_kilo')::numeric,
    subtotal = coalesce((p->>'subtotal')::numeric, 0), iva = coalesce((p->>'iva')::numeric, 0),
    retefuente = rf, reteiva = ri, reteica = rc, total_retenciones_esperadas = rf + ri + rc,
    total_a_pagar = coalesce((p->>'total_a_pagar')::numeric, 0),
    estado_lectura = p_estado, motivo_revision = p->>'motivo_revision'
   where id = p_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo)
  values ('factura', p_id, case when p_estado = 'CONFIRMADA' then 'confirmar' else 'editar' end, p->>'motivo_revision');
end;
$$;
