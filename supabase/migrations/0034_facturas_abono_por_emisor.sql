-- Decisión del usuario (2026-11-10), solo módulo de facturas (no toca ninguna tabla de tiquetes):
-- cada abono lo hace un CLIENTE (extractora) a UN EMISOR (empresa que le vendió la fruta). La cuenta de
-- un cliente con un emisor es independiente de las demás: sus facturas suben la deuda y sus abonos la
-- bajan. En el abono, cliente y emisor se eligen de dos listas libres (cualquier cliente con cualquier
-- emisor).
-- Solo AGREGA: 2 columnas en fact_abonos (no había abonos al crearla), 2 vistas y reemplaza la función
-- de registrar abono. No cambia ningún registro existente. El emisor se reconoce por los dígitos del
-- NIT que ya trae cada factura (fact_nit(emisor_nit)); las facturas no se modifican.

alter table fact_abonos
  add column emisor_nit    text not null check (emisor_nit ~ '^\d+$'),
  add column emisor_nombre text not null check (btrim(emisor_nombre) <> '');
create index on fact_abonos (cliente_id, emisor_nit);

-- Emisores (las empresas que facturan), sacados de las facturas: uno por NIT con su nombre más reciente.
create view fact_emisores with (security_invoker = true) as
select distinct on (fact_nit(emisor_nit)) fact_nit(emisor_nit) as nit, coalesce(nullif(btrim(emisor_razon_social), ''), 'Sin nombre') as nombre
  from fact_facturas
 where fact_nit(emisor_nit) is not null
 order by fact_nit(emisor_nit), created_at desc;

-- La cuenta de cada CLIENTE con cada EMISOR (independientes entre sí).
-- deuda = Σ total a pagar de sus facturas aprobadas − Σ sus abonos vigentes (negativa = saldo a favor).
-- facturas_vencidas: vencidas que los abonos de esa cuenta aún no cubren (cubren primero las más antiguas).
create view fact_cuentas_saldo with (security_invoker = true) as
with fac as (
  select cliente_id, coalesce(fact_nit(emisor_nit), '') as emisor_nit, count(*) as facturas, sum(total_a_pagar) as facturado,
         max(fecha_emision) as ultima_factura
    from fact_facturas where not anulada and cliente_id is not null group by 1, 2),
ab as (
  select cliente_id, emisor_nit, count(*) as abonos, sum(monto) as abonado, max(fecha) as ultimo_abono
    from fact_abonos where estado = 'VIGENTE' group by 1, 2),
cuentas as (
  select cliente_id, emisor_nit from fac union
  select cliente_id, emisor_nit from fact_abonos),
cubiertas as (
  select f.cliente_id, coalesce(fact_nit(f.emisor_nit), '') as emisor_nit, f.fecha_vencimiento,
         sum(f.total_a_pagar) over (partition by f.cliente_id, coalesce(fact_nit(f.emisor_nit), '') order by f.fecha_emision nulls last, f.created_at) as acumulado
    from fact_facturas f where not f.anulada and f.cliente_id is not null)
select k.cliente_id, c.nit as cliente_nit, c.nombre as cliente_nombre,
       k.emisor_nit, coalesce(e.nombre, (select a.emisor_nombre from fact_abonos a where a.cliente_id = k.cliente_id and a.emisor_nit = k.emisor_nit order by a.created_at desc limit 1), 'Emisor sin NIT') as emisor_nombre,
       coalesce(fac.facturas, 0)                            as facturas,
       coalesce(fac.facturado, 0)                           as facturado,
       coalesce(ab.abonos, 0)                               as abonos,
       coalesce(ab.abonado, 0)                              as abonado,
       coalesce(fac.facturado, 0) - coalesce(ab.abonado, 0) as deuda,
       fac.ultima_factura, ab.ultimo_abono,
       (select count(*) from cubiertas x
         where x.cliente_id = k.cliente_id and x.emisor_nit = k.emisor_nit and x.acumulado > coalesce(ab.abonado, 0) + 1
           and x.fecha_vencimiento < (now() at time zone 'America/Bogota')::date) as facturas_vencidas
  from cuentas k
  join fact_clientes c on c.id = k.cliente_id
  left join fact_emisores e on e.nit = k.emisor_nit
  left join fac on fac.cliente_id = k.cliente_id and fac.emisor_nit = k.emisor_nit
  left join ab  on ab.cliente_id = k.cliente_id and ab.emisor_nit = k.emisor_nit;

-- Registrar un abono de un cliente a un emisor (los dos obligatorios).
create or replace function fact_registrar_abono(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo uuid;
  nit_emisor text := fact_nit(p->>'emisor_nit');
  nombre_emisor text;
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if not exists (select 1 from fact_clientes where id = (p->>'cliente_id')::uuid) then raise exception 'Elija el cliente'; end if;
  select nombre into nombre_emisor from fact_emisores where nit = nit_emisor;
  if nombre_emisor is null then raise exception 'Elija el emisor'; end if;
  if coalesce((p->>'monto')::numeric, 0) <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
  if coalesce(btrim(p->>'realizado_por'), '') = '' then raise exception 'Escriba quién realiza el abono'; end if;
  insert into fact_abonos (cliente_id, emisor_nit, emisor_nombre, fecha, monto, forma_pago, referencia, realizado_por, observacion, soporte_path)
  values ((p->>'cliente_id')::uuid, nit_emisor, nombre_emisor, (p->>'fecha')::date, (p->>'monto')::numeric, p->>'forma_pago',
          nullif(btrim(p->>'referencia'), ''), btrim(p->>'realizado_por'), nullif(btrim(p->>'observacion'), ''), nullif(p->>'soporte_path', ''))
  returning id into nuevo;
  insert into fact_auditoria (entidad, entidad_id, accion, motivo) values ('abono', nuevo, 'abonar', p->>'monto' || ' a ' || nombre_emisor);
  return nuevo;
end;
$$;
