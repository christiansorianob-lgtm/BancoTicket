-- Decisión del usuario: el administrador puede eliminar un tiquete aprobado (con o sin precio).
-- El saldo se ajusta solo (la vista `saldos` se calcula). El registro borrado queda completo en
-- `historial` con el motivo, para auditoría. Devuelve la ruta de la foto para borrarla de Storage.
create or replace function eliminar_tiquete(p_id uuid, p_motivo text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  ruta text;
begin
  if not es_admin() then raise exception 'Solo un administrador puede eliminar tiquetes'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;

  perform fijar_contexto('eliminar', p_motivo);
  delete from tiquetes where id = p_id returning imagen_ruta into ruta;
  if not found then raise exception 'El tiquete no existe'; end if;
  return ruta;
end;
$$;

revoke execute on function eliminar_tiquete from public, anon;
grant execute on function eliminar_tiquete to authenticated;
