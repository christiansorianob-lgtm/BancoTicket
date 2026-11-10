-- Decisión del usuario (2026-11-10), solo módulo de facturas: la comprobación usa el PORCENTAJE
-- IMPRESO de cada impuesto (ej. FEIA 673, comisión: «IVA 19%», «ReteIVA 15%»; la fruta de palma lleva
-- IVA del 5 %, la comisión del 19 %). La IA lo lee y se guarda en la factura; la app verifica que sea
-- una tarifa permitida (configuración `tarifas_permitidas_factura`, varias por impuesto).
-- Solo AGREGA: 4 columnas (vacías en las facturas que ya existen), una fila de configuración (la de
-- 0026 no se modifica; la app usa la nueva) y vuelve a crear la vista de facturas para incluir las
-- columnas nuevas. No cambia ningún registro existente.

insert into configuracion (clave, valor)
values ('tarifas_permitidas_factura', '{"iva": [5, 19], "retefuente": [0, 1.5], "reteiva": [15], "reteica": []}')
on conflict (clave) do nothing;

alter table fact_facturas
  add column iva_pct        numeric(6, 3) check (iva_pct between 0 and 100),
  add column retefuente_pct numeric(6, 3) check (retefuente_pct between 0 and 100),
  add column reteiva_pct    numeric(6, 3) check (reteiva_pct between 0 and 100),
  add column reteica_pct    numeric(6, 3) check (reteica_pct between 0 and 100);
comment on column fact_facturas.iva_pct is 'Porcentaje de IVA impreso en la factura (null si no se leyó)';

-- La vista toma f.* al crearse: se vuelve a crear para que incluya las columnas nuevas.
drop view fact_totales;
drop view fact_facturas_estado;

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

create or replace function fact_guardar_factura(p jsonb) returns uuid
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
    retefuente, reteiva, reteica, total_retenciones_esperadas, total_a_pagar, estado_lectura, motivo_revision, archivo_path, tipo_archivo, cliente_id,
    iva_pct, retefuente_pct, reteiva_pct, reteica_pct)
  values (btrim(p->>'numero_factura'), nullif(btrim(p->>'cufe'), ''), p->>'emisor_razon_social', p->>'emisor_nit',
    p->>'extractora_razon_social', p->>'extractora_nit', (p->>'fecha_emision')::date, (p->>'fecha_vencimiento')::date,
    (p->>'periodo_desde')::date, (p->>'periodo_hasta')::date, (p->>'kilos')::numeric, (p->>'precio_kilo')::numeric,
    coalesce((p->>'subtotal')::numeric, 0), coalesce((p->>'iva')::numeric, 0),
    rf, ri, rc, rf + ri + rc, coalesce((p->>'total_a_pagar')::numeric, 0),
    'APROBADA', nullif(p->>'motivo_revision', ''), p->>'archivo_path', p->>'tipo_archivo', cliente,
    (p->>'iva_pct')::numeric, (p->>'retefuente_pct')::numeric, (p->>'reteiva_pct')::numeric, (p->>'reteica_pct')::numeric)
  returning id into nuevo;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', nuevo, 'aprobar', nullif(p->>'motivo_revision', ''));
  return nuevo;
end;
$$;

create or replace function fact_actualizar_factura(p_id uuid, p jsonb) returns void
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
    motivo_revision = nullif(p->>'motivo_revision', ''), cliente_id = cliente,
    iva_pct = (p->>'iva_pct')::numeric, retefuente_pct = (p->>'retefuente_pct')::numeric,
    reteiva_pct = (p->>'reteiva_pct')::numeric, reteica_pct = (p->>'reteica_pct')::numeric
   where id = p_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', p_id, 'editar', nullif(p->>'motivo_revision', ''));
end;
$$;
