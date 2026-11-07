-- Decisión del usuario (2026-11-06): reporte de Anticipos y tablas paginadas (de a 10 filas). Para
-- paginar sin traer todas las filas, la base entrega la página ya ordenada (vistas) y los totales de
-- TODO el filtro ya sumados (funciones). Solo LECTURA: no cambia tablas ni registros. Vistas y
-- funciones con los permisos de quien consulta (security invoker): se respetan las mismas reglas de
-- acceso (RLS) de tiquetes, anticipos y perfiles, incluido el comprador oculto para el Consultor.

-- Tiquetes aprobados vigentes con los nombres de comprador y extractora (reporte «Tiquetes»).
create view tiquetes_reporte with (security_invoker = true) as
select t.id, t.numero, t.proveedor, t.imagen_ruta, t.fecha_entrada, t.peso_neto_t, t.precio_tonelada, t.valor,
       t.extractora_id, t.comprador_id, t.peso_bruto_kg, t.tara_kg, t.neto_impreso_kg, t.placa, t.conductor, t.bascula, t.estado,
       coalesce(c.nombre, '') as comprador, c.celular as comprador_celular, coalesce(e.nombre, '') as extractora
  from tiquetes t
  left join perfiles c on c.id = t.comprador_id
  left join extractoras e on e.id = t.extractora_id
 where t.estado = 'vigente';

-- Totales de todo el filtro del reporte «Tiquetes» (fechas: días de Colombia por fecha de entrada).
create function reporte_tiquetes_totales(p_desde date, p_hasta date, p_comprador uuid, p_extractora uuid, p_proveedor text, p_numero text)
returns table (tiquetes bigint, toneladas numeric, total numeric, sin_precio bigint)
language sql stable security invoker set search_path = public as $$
  select count(*), coalesce(sum(peso_neto_t), 0), coalesce(sum(valor), 0), count(*) filter (where precio_tonelada is null)
    from tiquetes_reporte
   where (p_desde is null or fecha_entrada >= (p_desde::timestamp at time zone 'America/Bogota'))
     and (p_hasta is null or fecha_entrada < ((p_hasta + 1)::timestamp at time zone 'America/Bogota'))
     and (p_comprador is null or comprador_id = p_comprador)
     and (p_extractora is null or extractora_id = p_extractora)
     and (p_proveedor is null or proveedor = p_proveedor)
     and (p_numero is null or numero ilike '%' || p_numero || '%')
$$;

-- Anticipos con los nombres de comprador y de quien lo registró (reporte «Anticipos»).
create view anticipos_reporte with (security_invoker = true) as
select a.id, a.fecha, a.monto, a.estado::text as estado, a.nota, a.soporte_ruta, a.registrado_en, a.respondido_en, a.motivo_disputa,
       a.comprador_id, coalesce(c.nombre, '') as comprador, coalesce(r.nombre, '') as registrador
  from anticipos a
  left join perfiles c on c.id = a.comprador_id
  left join perfiles r on r.id = a.registrado_por;

-- Totales del reporte «Anticipos» por estado (fechas: fecha del anticipo).
create function reporte_anticipos_totales(p_desde date, p_hasta date, p_comprador uuid, p_estado text)
returns table (estado text, cantidad bigint, monto numeric)
language sql stable security invoker set search_path = public as $$
  select estado, count(*), coalesce(sum(monto), 0)
    from anticipos_reporte
   where (p_desde is null or fecha >= p_desde)
     and (p_hasta is null or fecha <= p_hasta)
     and (p_comprador is null or comprador_id = p_comprador)
     and (p_estado is null or estado = p_estado)
   group by estado
$$;

revoke execute on function reporte_tiquetes_totales(date, date, uuid, uuid, text, text), reporte_anticipos_totales(date, date, uuid, text) from public, anon;
grant execute on function reporte_tiquetes_totales(date, date, uuid, uuid, text, text), reporte_anticipos_totales(date, date, uuid, text) to authenticated;
