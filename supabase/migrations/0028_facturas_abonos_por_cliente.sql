-- Decisión del usuario (2026-11-03), solo módulo de facturas (no toca ninguna tabla de tiquetes):
-- los abonos se hacen al CLIENTE (la empresa a la que se le factura), no a una factura.
--  * fact_clientes: un cliente por NIT (solo dígitos). Cada factura aprobada queda unida a su cliente.
--  * Deuda del cliente = Σ total a pagar de sus facturas aprobadas − Σ abonos vigentes (se calcula,
--    no se guarda). Negativa = saldo a favor del cliente.
--  * fact_abonos reemplaza a fact_pagos (abonos por factura; no tenía datos). Un abono se anula con
--    motivo y, anulado, se elimina (copia en fact_auditoria).
--  * Sin estado de cobro, vencida ni mora por factura; la anulación de una factura ya no depende de abonos.
--  * facturas_vencidas del cliente: facturas con vencimiento pasado que sus abonos aún no cubren
--    (los abonos cubren primero las facturas más antiguas).

-- Solo los dígitos del NIT (901.253.217-5 → 9012532175).
create function fact_nit(p text) returns text language sql immutable as $$
  select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '')
$$;

create table fact_clientes (
  id         uuid primary key default gen_random_uuid(),
  nit        text not null unique check (nit ~ '^\d+$'),
  nombre     text not null,
  created_at timestamptz not null default now()
);

alter table fact_facturas add column cliente_id uuid references fact_clientes (id) on delete restrict;
create index on fact_facturas (cliente_id);

-- Las facturas que ya hay (FEPA 12) quedan unidas a su cliente.
insert into fact_clientes (nit, nombre)
select distinct on (fact_nit(extractora_nit)) fact_nit(extractora_nit), coalesce(extractora_razon_social, 'Sin nombre')
  from fact_facturas where fact_nit(extractora_nit) is not null
 order by fact_nit(extractora_nit), created_at;
update fact_facturas f set cliente_id = c.id from fact_clientes c where c.nit = fact_nit(f.extractora_nit);

create table fact_abonos (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references fact_clientes (id) on delete restrict,
  fecha           date not null,
  monto           numeric(14, 2) not null check (monto > 0),
  forma_pago      text not null check (forma_pago in ('TRANSFERENCIA', 'CONSIGNACION', 'CHEQUE', 'EFECTIVO', 'OTRO')),
  referencia      text,
  realizado_por   text not null check (btrim(realizado_por) <> ''),
  observacion     text,
  soporte_path    text,
  estado          text not null default 'VIGENTE' check (estado in ('VIGENTE', 'ANULADO')),
  anulado_motivo  text,
  anulado_por     uuid,
  anulado_at      timestamptz,
  creado_por      uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
create index on fact_abonos (cliente_id, fecha);

alter table fact_clientes enable row level security;
alter table fact_abonos   enable row level security;
create policy fact_clientes_ver on fact_clientes for select using (es_admin());
create policy fact_abonos_ver   on fact_abonos   for select using (es_admin());

-- Fuera lo de los abonos por factura.
drop view fact_totales;
drop view fact_facturas_estado;
drop function fact_registrar_abono(uuid, jsonb);
drop function fact_anular_abono(uuid, text);
drop table fact_pagos;

create view fact_facturas_estado with (security_invoker = true) as
select f.*, case when f.anulada then 'ANULADA' else 'APROBADA' end as estado, c.nombre as cliente_nombre, c.nit as cliente_nit
  from fact_facturas f
  left join fact_clientes c on c.id = f.cliente_id;

-- Para los filtros (emisores y clientes con facturas aprobadas).
create view fact_totales with (security_invoker = true) as
select g.dimension, g.clave, count(*) as facturas, sum(e.total_a_pagar) as total
  from fact_facturas_estado e
  cross join lateral (values ('emisor', coalesce(e.emisor_razon_social, '—')), ('extractora', coalesce(e.extractora_razon_social, '—'))) g(dimension, clave)
 where not e.anulada
 group by g.dimension, g.clave;

-- La cuenta de cada cliente.
create view fact_clientes_saldo with (security_invoker = true) as
with fac as (
  select cliente_id, count(*) as facturas, sum(total_a_pagar) as facturado, max(fecha_emision) as ultima_factura
    from fact_facturas where not anulada and cliente_id is not null group by cliente_id),
ab as (
  select cliente_id, count(*) as abonos, sum(monto) as abonado, max(fecha) as ultimo_abono
    from fact_abonos where estado = 'VIGENTE' group by cliente_id),
cubiertas as (
  select f.cliente_id, f.fecha_vencimiento,
         sum(f.total_a_pagar) over (partition by f.cliente_id order by f.fecha_emision nulls last, f.created_at) as acumulado
    from fact_facturas f where not f.anulada and f.cliente_id is not null)
select c.id, c.nit, c.nombre,
       coalesce(fac.facturas, 0)                               as facturas,
       coalesce(fac.facturado, 0)                              as facturado,
       coalesce(ab.abonos, 0)                                  as abonos,
       coalesce(ab.abonado, 0)                                 as abonado,
       coalesce(fac.facturado, 0) - coalesce(ab.abonado, 0)    as deuda,
       fac.ultima_factura, ab.ultimo_abono,
       (select count(*) from cubiertas x
         where x.cliente_id = c.id and x.acumulado > coalesce(ab.abonado, 0) + 1
           and x.fecha_vencimiento < (now() at time zone 'America/Bogota')::date) as facturas_vencidas
  from fact_clientes c
  left join fac on fac.cliente_id = c.id
  left join ab  on ab.cliente_id = c.id;

-- Busca el cliente por NIT o lo crea con el nombre de la factura.
create function fact_cliente_de(p_nit text, p_nombre text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  n text := fact_nit(p_nit);
  id_cliente uuid;
begin
  if n is null then raise exception 'Escriba el NIT del cliente (extractora)'; end if;
  select id into id_cliente from fact_clientes where nit = n;
  if id_cliente is null then
    insert into fact_clientes (nit, nombre) values (n, coalesce(nullif(btrim(p_nombre), ''), 'Sin nombre')) returning id into id_cliente;
    insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('cliente', id_cliente, 'crear', p_nombre);
  end if;
  return id_cliente;
end;
$$;
revoke execute on function fact_cliente_de(text, text) from public, anon, authenticated;

drop function fact_guardar_factura(jsonb);
drop function fact_actualizar_factura(uuid, jsonb);

create function fact_guardar_factura(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo uuid;
  cliente uuid;
  rf numeric := coalesce((p->>'retefuente')::numeric, 0);
  ri numeric := coalesce((p->>'reteiva')::numeric, 0);
  rc numeric := coalesce((p->>'reteica')::numeric, 0);
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if nullif(btrim(p->>'cufe'), '') is not null and exists (select 1 from fact_facturas where cufe = btrim(p->>'cufe')) then
    raise exception 'FACTURA_DUPLICADA: ya existe una factura con ese CUFE';
  end if;
  cliente := fact_cliente_de(p->>'extractora_nit', p->>'extractora_razon_social');
  insert into fact_facturas (numero_factura, cufe, emisor_razon_social, emisor_nit, extractora_razon_social, extractora_nit,
    fecha_emision, fecha_vencimiento, periodo_desde, periodo_hasta, kilos, precio_kilo, subtotal, iva,
    retefuente, reteiva, reteica, total_retenciones_esperadas, total_a_pagar, estado_lectura, motivo_revision, archivo_path, tipo_archivo, cliente_id)
  values (btrim(p->>'numero_factura'), nullif(btrim(p->>'cufe'), ''), p->>'emisor_razon_social', p->>'emisor_nit',
    p->>'extractora_razon_social', p->>'extractora_nit', (p->>'fecha_emision')::date, (p->>'fecha_vencimiento')::date,
    (p->>'periodo_desde')::date, (p->>'periodo_hasta')::date, (p->>'kilos')::numeric, (p->>'precio_kilo')::numeric,
    coalesce((p->>'subtotal')::numeric, 0), coalesce((p->>'iva')::numeric, 0),
    rf, ri, rc, rf + ri + rc, coalesce((p->>'total_a_pagar')::numeric, 0),
    'APROBADA', nullif(p->>'motivo_revision', ''), p->>'archivo_path', p->>'tipo_archivo', cliente)
  returning id into nuevo;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', nuevo, 'aprobar', nullif(p->>'motivo_revision', ''));
  return nuevo;
end;
$$;

create function fact_actualizar_factura(p_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  cliente uuid;
  rf numeric := coalesce((p->>'retefuente')::numeric, 0);
  ri numeric := coalesce((p->>'reteiva')::numeric, 0);
  rc numeric := coalesce((p->>'reteica')::numeric, 0);
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if (select anulada from fact_facturas where id = p_id) then raise exception 'La factura está anulada'; end if;
  if nullif(btrim(p->>'cufe'), '') is not null and exists (select 1 from fact_facturas where cufe = btrim(p->>'cufe') and id <> p_id) then
    raise exception 'FACTURA_DUPLICADA: ya existe otra factura con ese CUFE';
  end if;
  cliente := fact_cliente_de(p->>'extractora_nit', p->>'extractora_razon_social');
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
    motivo_revision = nullif(p->>'motivo_revision', ''), cliente_id = cliente
   where id = p_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', p_id, 'editar', nullif(p->>'motivo_revision', ''));
end;
$$;

-- Anular una factura: en cualquier momento, con motivo (deja de sumar a la deuda del cliente).
create or replace function fact_anular_factura(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  update fact_facturas set anulada = true, anulada_motivo = btrim(p_motivo), anulada_por = auth.uid(), anulada_at = now()
   where id = p_id and not anulada;
  if not found then raise exception 'La factura no existe o ya está anulada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', p_id, 'anular', btrim(p_motivo));
end;
$$;

create or replace function fact_eliminar_factura(p_id uuid, p_motivo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  f fact_facturas;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  select * into f from fact_facturas where id = p_id for update;
  if not found then raise exception 'La factura no existe'; end if;
  if not f.anulada then raise exception 'Solo se puede eliminar una factura anulada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo, datos)
  values ('factura', p_id, 'eliminar', btrim(p_motivo), jsonb_build_object('factura', to_jsonb(f)));
  delete from fact_facturas where id = p_id;
  return f.archivo_path;
end;
$$;

-- Registrar un abono al cliente.
create function fact_registrar_abono(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo uuid;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if not exists (select 1 from fact_clientes where id = (p->>'cliente_id')::uuid) then raise exception 'Elija el cliente'; end if;
  if coalesce((p->>'monto')::numeric, 0) <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  if coalesce(btrim(p->>'realizado_por'), '') = '' then raise exception 'Escriba quién realiza el abono'; end if;
  insert into fact_abonos (cliente_id, fecha, monto, forma_pago, referencia, realizado_por, observacion, soporte_path)
  values ((p->>'cliente_id')::uuid, (p->>'fecha')::date, (p->>'monto')::numeric, p->>'forma_pago',
          nullif(btrim(p->>'referencia'), ''), btrim(p->>'realizado_por'), nullif(btrim(p->>'observacion'), ''), nullif(p->>'soporte_path', ''))
  returning id into nuevo;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('abono', nuevo, 'abonar', p->>'monto');
  return nuevo;
end;
$$;

create function fact_anular_abono(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  update fact_abonos set estado = 'ANULADO', anulado_motivo = btrim(p_motivo), anulado_por = auth.uid(), anulado_at = now()
   where id = p_id and estado = 'VIGENTE';
  if not found then raise exception 'El abono no existe o ya está anulado'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('abono', p_id, 'anular', btrim(p_motivo));
end;
$$;

-- Eliminar un abono ANULADO. Devuelve la ruta del soporte para que la app lo borre.
create function fact_eliminar_abono(p_id uuid, p_motivo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  a fact_abonos;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  select * into a from fact_abonos where id = p_id for update;
  if not found then raise exception 'El abono no existe'; end if;
  if a.estado <> 'ANULADO' then raise exception 'Solo se puede eliminar un abono anulado'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo, datos) values ('abono', p_id, 'eliminar', btrim(p_motivo), jsonb_build_object('abono', to_jsonb(a)));
  delete from fact_abonos where id = p_id;
  return a.soporte_path;
end;
$$;

revoke execute on function fact_guardar_factura(jsonb), fact_actualizar_factura(uuid, jsonb), fact_registrar_abono(jsonb),
  fact_anular_abono(uuid, text), fact_eliminar_abono(uuid, text) from public, anon;
grant execute on function fact_guardar_factura(jsonb), fact_actualizar_factura(uuid, jsonb), fact_registrar_abono(jsonb),
  fact_anular_abono(uuid, text), fact_eliminar_abono(uuid, text) to authenticated;
