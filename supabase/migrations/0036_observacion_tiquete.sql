-- Decisión del usuario (2026-11-19): observación opcional de la ADMINISTRACIÓN en cada tiquete aprobado
-- (nota adicional de un tiquete en particular). Sin tablas nuevas: una columna en `tiquetes`.
-- Solo la administración la escribe (el comprador y el Consultor no pueden modificar tiquetes: políticas
-- t_admin y tiquetes_consultor); el historial guarda cada cambio (disparador h_tiquetes).
-- Solo AGREGA: una columna vacía y dos funciones. No cambia ningún registro ni la función aprobar_tiquete.

alter table tiquetes add column observacion text check (observacion is null or (btrim(observacion) <> '' and length(observacion) <= 1000));
comment on column tiquetes.observacion is 'Nota opcional de la administración sobre este tiquete';

-- Aprobar un pendiente y, si se escribió, guardar su observación: todo en una sola transacción.
create or replace function aprobar_tiquete_con_observacion(p_id uuid, p_observacion text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo_id uuid;
  nota text := nullif(btrim(coalesce(p_observacion, '')), '');
begin
  if not es_admin() then raise exception 'Solo un administrador puede aprobar'; end if;
  if length(nota) > 1000 then raise exception 'La observación no puede pasar de 1000 caracteres'; end if;
  nuevo_id := aprobar_tiquete(p_id);
  if nota is not null then
    perform fijar_contexto('observacion', null);
    update tiquetes set observacion = nota where id = nuevo_id;
  end if;
  return nuevo_id;
end;
$$;

-- Poner, cambiar o quitar (texto vacío) la observación de un tiquete aprobado.
create or replace function poner_observacion_tiquete(p_id uuid, p_observacion text) returns void
language plpgsql security definer set search_path = public as $$
declare
  nota text := nullif(btrim(coalesce(p_observacion, '')), '');
begin
  if not es_admin() then raise exception 'Solo la administración'; end if;
  if length(nota) > 1000 then raise exception 'La observación no puede pasar de 1000 caracteres'; end if;
  perform fijar_contexto('observacion', null);
  update tiquetes set observacion = nota where id = p_id;
  if not found then raise exception 'Tiquete no encontrado'; end if;
end;
$$;

revoke execute on function aprobar_tiquete_con_observacion(uuid, text), poner_observacion_tiquete(uuid, text) from public, anon;
grant execute on function aprobar_tiquete_con_observacion(uuid, text), poner_observacion_tiquete(uuid, text) to authenticated;
