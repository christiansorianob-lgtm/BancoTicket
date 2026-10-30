-- Decisión del usuario: un anticipo EN DISPUTA se puede corregir (monto, fecha, nota) con motivo
-- obligatorio y vuelve a PENDIENTE para que el comprador lo vea y lo confirme o dispute de nuevo.
-- No se pierde el registro: el historial guarda el valor anterior, el nuevo y el motivo, y el
-- motivo de la disputa se conserva en la fila hasta que el comprador responda otra vez.
-- Solo agrega una función: no cambia tablas ni datos.
create or replace function corregir_anticipo(p_id uuid, p_monto numeric, p_fecha date, p_nota text, p_motivo text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a anticipos;
begin
  if not es_admin() then raise exception 'Solo la administración puede corregir anticipos'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo de la corrección'; end if;
  if p_monto is null or p_monto = 0 then raise exception 'El monto debe ser distinto de cero'; end if;
  if p_fecha is null then raise exception 'Escriba la fecha'; end if;

  select * into a from anticipos where id = p_id for update;
  if not found then raise exception 'El anticipo no existe'; end if;
  if a.estado <> 'en_disputa' then raise exception 'Solo se corrigen anticipos en disputa'; end if;

  perform fijar_contexto('corregir', btrim(p_motivo));
  update anticipos
     set monto = p_monto, fecha = p_fecha, nota = nullif(btrim(p_nota), ''),
         estado = 'pendiente', respondido_en = null, dispositivo = null
   where id = p_id;
end;
$$;

revoke execute on function corregir_anticipo from public, anon;
grant execute on function corregir_anticipo to authenticated;
