-- Decisión del usuario: un anticipo EN DISPUTA se puede eliminar (ej. el comprador ya recibió otro
-- registro correcto). Solo en disputa: nunca contó en el saldo, así que eliminarlo no mueve cuentas.
-- Motivo obligatorio; el registro completo queda en `historial` (disparador) con el motivo, como al
-- eliminar un tiquete. Solo agrega una función: no cambia tablas ni datos.
create or replace function eliminar_anticipo(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a anticipos;
begin
  if not es_admin() then raise exception 'Solo la administración puede eliminar anticipos'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;
  select * into a from anticipos where id = p_id for update;
  if not found then raise exception 'El anticipo no existe'; end if;
  if a.estado <> 'en_disputa' then raise exception 'Solo se eliminan anticipos en disputa'; end if;

  perform fijar_contexto('eliminar', btrim(p_motivo));
  delete from anticipos where id = p_id;
end;
$$;

revoke execute on function eliminar_anticipo from public, anon;
grant execute on function eliminar_anticipo to authenticated;
