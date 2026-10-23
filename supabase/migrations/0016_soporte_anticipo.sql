-- Decisión del usuario: cada anticipo puede llevar un soporte (foto), igual que el tiquete lleva
-- su foto: la columna guarda la ruta del archivo en el bucket privado `tiquetes`
-- (<comprador_id>/anticipos/<archivo>). Solo agrega: no borra ni cambia datos existentes.
-- Lo ven la administración y el comprador. Solo se sube a anticipos pendientes (el comprador lo
-- revisa antes de confirmar) y, una vez puesto, no se cambia ni se quita.
alter table anticipos add column soporte_ruta text;

create or replace function proteger_soporte_anticipo() returns trigger
language plpgsql as $$
begin
  if old.soporte_ruta is not null and new.soporte_ruta is distinct from old.soporte_ruta then
    raise exception 'El soporte del anticipo ya está registrado y no se puede cambiar';
  end if;
  return new;
end;
$$;

create trigger anticipos_soporte_fijo before update of soporte_ruta on anticipos
  for each row execute function proteger_soporte_anticipo();

create or replace function poner_soporte_anticipo(p_id uuid, p_ruta text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a anticipos;
begin
  if not es_admin() then raise exception 'Solo la administración puede subir el soporte'; end if;
  select * into a from anticipos where id = p_id for update;
  if not found then raise exception 'El anticipo no existe'; end if;
  if a.estado <> 'pendiente' then raise exception 'Solo se puede subir el soporte a anticipos pendientes de confirmar'; end if;
  if a.soporte_ruta is not null then raise exception 'Este anticipo ya tiene soporte y no se puede cambiar'; end if;
  if p_ruta is null or p_ruta not like a.comprador_id::text || '/anticipos/%' then raise exception 'Ruta del soporte no válida'; end if;

  perform fijar_contexto('soporte', null);
  update anticipos set soporte_ruta = p_ruta where id = p_id;
end;
$$;

revoke execute on function poner_soporte_anticipo from public, anon;
grant execute on function poner_soporte_anticipo to authenticated;
