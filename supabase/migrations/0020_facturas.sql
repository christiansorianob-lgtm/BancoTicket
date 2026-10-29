-- Módulo de FACTURAS de venta de fruta (decisión del usuario, 2026-10-29): facturas que las empresas de
-- la administración emiten a las extractoras y los abonos que estas pagan. Independiente del flujo de
-- tiquetes: tablas con prefijo fact_, sin llaves hacia tablas existentes (usuarios guardados como uuid).
-- Solo administradora y desarrollador (es_admin()). Solo agrega: no toca tablas ni datos existentes.
-- Toda escritura pasa por funciones que validan las reglas y escriben en fact_auditoria.

create table fact_facturas (
  id                          uuid primary key default gen_random_uuid(),
  numero_factura              text not null check (btrim(numero_factura) <> ''),
  cufe                        text unique,                 -- llave contra duplicados (null si no se leyó)
  emisor_razon_social         text,
  emisor_nit                  text,
  extractora_razon_social     text,
  extractora_nit              text,
  fecha_emision               date,
  fecha_vencimiento           date,
  periodo_desde               date,
  periodo_hasta               date,
  kilos                       numeric,
  precio_kilo                 numeric,
  subtotal                    numeric(14, 2) not null default 0,
  iva                         numeric(14, 2) not null default 0,
  total_retenciones_esperadas numeric(14, 2) not null default 0,
  total_a_pagar               numeric(14, 2) not null default 0,
  estado_lectura              text not null default 'PENDIENTE_REVISION' check (estado_lectura in ('PENDIENTE_REVISION', 'CONFIRMADA')),
  motivo_revision             text,                        -- validaciones que fallaron
  archivo_path                text,
  tipo_archivo                text check (tipo_archivo in ('pdf', 'imagen')),
  creado_por                  uuid default auth.uid(),
  created_at                  timestamptz not null default now(),
  anulada                     boolean not null default false,
  anulada_motivo              text,
  anulada_por                 uuid,
  anulada_at                  timestamptz
);
create index on fact_facturas (fecha_emision);

-- Abonos: nunca se borran, se anulan.
create table fact_pagos (
  id                   uuid primary key default gen_random_uuid(),
  factura_id           uuid not null references fact_facturas (id) on delete restrict,
  fecha_pago           date not null,
  valor_recibido       numeric(14, 2) not null check (valor_recibido >= 0),   -- neto en banco
  forma_pago           text,
  referencia           text,
  retefuente           numeric(14, 2) not null default 0 check (retefuente >= 0),
  reteiva              numeric(14, 2) not null default 0 check (reteiva >= 0),
  reteica              numeric(14, 2) not null default 0 check (reteica >= 0),
  otros_descuentos     numeric(14, 2) not null default 0 check (otros_descuentos >= 0),
  valor_aplicado       numeric(14, 2) generated always as (valor_recibido + retefuente + reteiva + reteica + otros_descuentos) stored,
  certificado_recibido boolean not null default false,
  fecha_certificado    date,
  observaciones        text,
  creado_por           uuid default auth.uid(),
  created_at           timestamptz not null default now(),
  estado               text not null default 'VIGENTE' check (estado in ('VIGENTE', 'ANULADO')),
  anulado_motivo       text,
  anulado_por          uuid,
  anulado_at           timestamptz,
  check (valor_aplicado > 0)
);
create index on fact_pagos (factura_id);

create table fact_auditoria (
  id         bigint generated always as identity primary key,
  entidad    text not null,           -- 'factura' | 'abono'
  entidad_id uuid not null,
  accion     text not null,           -- crear, editar, confirmar, abonar, anular, revertir_anulacion
  motivo     text,
  usuario    uuid default auth.uid(),
  fecha      timestamptz not null default now()
);
create index on fact_auditoria (entidad_id, fecha);

-- Permisos: solo lectura directa para administración; las escrituras van por las funciones de abajo.
alter table fact_facturas  enable row level security;
alter table fact_pagos     enable row level security;
alter table fact_auditoria enable row level security;
create policy fact_facturas_ver  on fact_facturas  for select using (es_admin());
create policy fact_pagos_ver     on fact_pagos     for select using (es_admin());
create policy fact_auditoria_ver on fact_auditoria for select using (es_admin());

-- Estado de cobro, saldo, mora y alertas: se CALCULAN (no se guardan), salvo la anulación.
create view fact_facturas_estado with (security_invoker = true) as
select f.*,
       f.subtotal + f.iva                                                         as total_cobrar,
       coalesce(p.aplicado, 0)                                                    as total_aplicado,
       coalesce(p.retenciones, 0)                                                 as retenciones_practicadas,
       coalesce(p.abonos, 0)                                                      as abonos_vigentes,
       f.subtotal + f.iva - coalesce(p.aplicado, 0)                               as saldo_pendiente,
       e.estado_cobro,
       e.estado_cobro in ('PENDIENTE_PAGO', 'ABONADA_PARCIAL')
         and f.fecha_vencimiento < (now() at time zone 'America/Bogota')::date   as vencida,
       case when e.estado_cobro in ('PENDIENTE_PAGO', 'ABONADA_PARCIAL') and f.fecha_vencimiento < (now() at time zone 'America/Bogota')::date
            then (now() at time zone 'America/Bogota')::date - f.fecha_vencimiento else 0 end as dias_mora,
       not f.anulada and coalesce(p.aplicado, 0) > f.subtotal + f.iva + 1        as alerta_sobrepago,
       -- Retenciones: al quedar pagada deben coincidir con las esperadas; antes, solo si ya se pasaron.
       not f.anulada and coalesce(p.abonos, 0) > 0 and (
         (e.estado_cobro = 'PAGADA' and abs(coalesce(p.retenciones, 0) - f.total_retenciones_esperadas) > 1)
         or coalesce(p.retenciones, 0) > f.total_retenciones_esperadas + 1)       as alerta_retenciones
  from fact_facturas f
  left join (select factura_id, sum(valor_aplicado) aplicado, sum(retefuente + reteiva + reteica) retenciones, count(*) abonos
               from fact_pagos where estado = 'VIGENTE' group by factura_id) p on p.factura_id = f.id
  cross join lateral (select case
       when f.anulada then 'ANULADA'
       when f.subtotal + f.iva - coalesce(p.aplicado, 0) <= 1 then 'PAGADA'
       when coalesce(p.abonos, 0) > 0 then 'ABONADA_PARCIAL'
       else 'PENDIENTE_PAGO' end as estado_cobro) e;

-- Totales por extractora, emisor y mes (sin anuladas).
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

-- ---------------------------------------------------------------------------
-- Funciones (solo administración). p: jsonb con los campos de la factura o del abono.
-- ---------------------------------------------------------------------------
create or replace function fact_guardar_factura(p jsonb, p_estado text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo uuid;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if nullif(btrim(p->>'cufe'), '') is not null and exists (select 1 from fact_facturas where cufe = btrim(p->>'cufe')) then
    raise exception 'FACTURA_DUPLICADA: ya existe una factura con ese CUFE';
  end if;
  insert into fact_facturas (numero_factura, cufe, emisor_razon_social, emisor_nit, extractora_razon_social, extractora_nit,
    fecha_emision, fecha_vencimiento, periodo_desde, periodo_hasta, kilos, precio_kilo, subtotal, iva,
    total_retenciones_esperadas, total_a_pagar, estado_lectura, motivo_revision, archivo_path, tipo_archivo)
  values (btrim(p->>'numero_factura'), nullif(btrim(p->>'cufe'), ''), p->>'emisor_razon_social', p->>'emisor_nit',
    p->>'extractora_razon_social', p->>'extractora_nit', (p->>'fecha_emision')::date, (p->>'fecha_vencimiento')::date,
    (p->>'periodo_desde')::date, (p->>'periodo_hasta')::date, (p->>'kilos')::numeric, (p->>'precio_kilo')::numeric,
    coalesce((p->>'subtotal')::numeric, 0), coalesce((p->>'iva')::numeric, 0),
    coalesce((p->>'total_retenciones_esperadas')::numeric, 0), coalesce((p->>'total_a_pagar')::numeric, 0),
    p_estado, p->>'motivo_revision', p->>'archivo_path', p->>'tipo_archivo')
  returning id into nuevo;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', nuevo, 'crear', p_estado);
  return nuevo;
end;
$$;

-- Corregir los datos leídos (por ejemplo una factura en PENDIENTE_REVISION). No en anuladas.
create or replace function fact_actualizar_factura(p_id uuid, p jsonb, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
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
    total_retenciones_esperadas = coalesce((p->>'total_retenciones_esperadas')::numeric, 0),
    total_a_pagar = coalesce((p->>'total_a_pagar')::numeric, 0),
    estado_lectura = p_estado, motivo_revision = p->>'motivo_revision'
   where id = p_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo)
  values ('factura', p_id, case when p_estado = 'CONFIRMADA' then 'confirmar' else 'editar' end, p->>'motivo_revision');
end;
$$;

create or replace function fact_registrar_abono(p_factura uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo uuid;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if not exists (select 1 from fact_facturas where id = p_factura) then raise exception 'Factura no encontrada'; end if;
  if (select anulada from fact_facturas where id = p_factura) then raise exception 'No se pueden registrar abonos en una factura anulada'; end if;
  insert into fact_pagos (factura_id, fecha_pago, valor_recibido, forma_pago, referencia, retefuente, reteiva, reteica,
    otros_descuentos, certificado_recibido, fecha_certificado, observaciones)
  values (p_factura, (p->>'fecha_pago')::date, coalesce((p->>'valor_recibido')::numeric, 0), p->>'forma_pago', p->>'referencia',
    coalesce((p->>'retefuente')::numeric, 0), coalesce((p->>'reteiva')::numeric, 0), coalesce((p->>'reteica')::numeric, 0),
    coalesce((p->>'otros_descuentos')::numeric, 0), coalesce((p->>'certificado_recibido')::boolean, false),
    (p->>'fecha_certificado')::date, p->>'observaciones')
  returning id into nuevo;
  insert into fact_auditoria (entidad, entidad_id, accion) values ('abono', nuevo, 'abonar');
  return nuevo;
end;
$$;

create or replace function fact_anular_abono(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  update fact_pagos set estado = 'ANULADO', anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(), anulado_at = now()
   where id = p_id and estado = 'VIGENTE';
  if not found then raise exception 'El abono no existe o ya está anulado'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('abono', p_id, 'anular', btrim(p_motivo));
end;
$$;

create or replace function fact_anular_factura(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  if exists (select 1 from fact_pagos where factura_id = p_id and estado = 'VIGENTE') then
    raise exception 'La factura tiene abonos vigentes: primero anule los abonos';
  end if;
  update fact_facturas set anulada = true, anulada_motivo = btrim(p_motivo), anulada_por = auth.uid(), anulada_at = now()
   where id = p_id and not anulada;
  if not found then raise exception 'La factura no existe o ya está anulada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', p_id, 'anular', btrim(p_motivo));
end;
$$;

-- ANULADA es terminal; si fue un error, se revierte con motivo (queda en la auditoría).
create or replace function fact_revertir_anulacion(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  update fact_facturas set anulada = false, anulada_motivo = null, anulada_por = null, anulada_at = null
   where id = p_id and anulada;
  if not found then raise exception 'La factura no existe o no está anulada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', p_id, 'revertir_anulacion', btrim(p_motivo));
end;
$$;

revoke execute on function fact_guardar_factura, fact_actualizar_factura, fact_registrar_abono, fact_anular_abono,
  fact_anular_factura, fact_revertir_anulacion from public, anon;
grant execute on function fact_guardar_factura, fact_actualizar_factura, fact_registrar_abono, fact_anular_abono,
  fact_anular_factura, fact_revertir_anulacion to authenticated;

-- Archivos originales: bucket privado, solo administración (el servidor sube con service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facturas', 'facturas', false, 4194304, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
create policy facturas_ver    on storage.objects for select to authenticated using (bucket_id = 'facturas' and public.es_admin());
create policy facturas_subir  on storage.objects for insert to authenticated with check (bucket_id = 'facturas' and public.es_admin());
create policy facturas_borrar on storage.objects for delete to authenticated using (bucket_id = 'facturas' and public.es_admin());
