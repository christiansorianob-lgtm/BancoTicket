-- Decisión del usuario (2026-11-03), solo módulo de facturas (no toca tiquetes):
--  * Dos estados: APROBADA (la administradora la aprueba al subirla) y ANULADA (no suma).
--    Desaparecen CONFIRMADA y PENDIENTE_REVISION. motivo_revision guarda, si las hubo, las
--    diferencias de la comprobación de cálculos al momento de aprobar.
--  * Ya no se revierte una anulación: una factura anulada se ELIMINA (registro, abonos anulados y,
--    desde la app, su archivo) y se puede subir de nuevo. Antes de borrar queda una copia completa en
--    fact_auditoria.datos con el motivo.
--  * No se anula ni se elimina una factura con abonos vigentes (Abonada parcial o Pagada).
-- Al aplicarla no hay facturas registradas.

alter table fact_facturas drop constraint fact_facturas_estado_lectura_check;
update fact_facturas set estado_lectura = 'APROBADA';
alter table fact_facturas alter column estado_lectura set default 'APROBADA';
alter table fact_facturas add constraint fact_facturas_estado_lectura_check check (estado_lectura = 'APROBADA');
comment on column fact_facturas.motivo_revision is 'Diferencias de la comprobación de cálculos al aprobar (null si todo coincidía)';

alter table fact_auditoria add column datos jsonb;
comment on column fact_auditoria.datos is 'Copia completa de la factura y sus abonos al eliminarla';

drop function fact_revertir_anulacion(uuid, text);
drop function fact_guardar_factura(jsonb, text);
drop function fact_actualizar_factura(uuid, jsonb, text);

-- Aprobar: guarda la factura ya aprobada (solo existe al aprobarla).
create function fact_guardar_factura(p jsonb) returns uuid
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
    'APROBADA', nullif(p->>'motivo_revision', ''), p->>'archivo_path', p->>'tipo_archivo')
  returning id into nuevo;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', nuevo, 'aprobar', nullif(p->>'motivo_revision', ''));
  return nuevo;
end;
$$;

-- Corregir datos de una factura aprobada (no anulada).
create function fact_actualizar_factura(p_id uuid, p jsonb) returns void
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
    motivo_revision = nullif(p->>'motivo_revision', '')
   where id = p_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('factura', p_id, 'editar', nullif(p->>'motivo_revision', ''));
end;
$$;

-- Eliminar: solo una factura ANULADA y sin abonos vigentes. Devuelve la ruta del archivo para que la
-- app lo borre del bucket. La copia completa queda en fact_auditoria.
create function fact_eliminar_factura(p_id uuid, p_motivo text) returns text
language plpgsql security definer set search_path = public as $$
declare
  f fact_facturas;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  select * into f from fact_facturas where id = p_id for update;
  if not found then raise exception 'La factura no existe'; end if;
  if not f.anulada then raise exception 'Solo se puede eliminar una factura anulada'; end if;
  if exists (select 1 from fact_pagos where factura_id = p_id and estado = 'VIGENTE') then
    raise exception 'La factura tiene abonos vigentes: no se puede eliminar';
  end if;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo, datos)
  values ('factura', p_id, 'eliminar', btrim(p_motivo), jsonb_build_object(
    'factura', to_jsonb(f),
    'abonos', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from fact_pagos x where x.factura_id = p_id)));
  delete from fact_pagos where factura_id = p_id;
  delete from fact_facturas where id = p_id;
  return f.archivo_path;
end;
$$;

revoke execute on function fact_guardar_factura(jsonb), fact_actualizar_factura(uuid, jsonb), fact_eliminar_factura(uuid, text) from public, anon;
grant execute on function fact_guardar_factura(jsonb), fact_actualizar_factura(uuid, jsonb), fact_eliminar_factura(uuid, text) to authenticated;
