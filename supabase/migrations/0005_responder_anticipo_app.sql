-- BancoTicket — el comprador confirma (o disputa) un anticipo desde la app, sin el enlace.
-- Misma seguridad que el enlace: exige la sesión del comprador dueño del anticipo.

create or replace function responder_anticipo_id(p_id uuid, p_acepta boolean, p_motivo text, p_dispositivo text)
returns estado_anticipo
language plpgsql security definer set search_path = public as $$
declare
  a anticipos;
  nuevo estado_anticipo := case when p_acepta then 'confirmado' else 'en_disputa' end;
begin
  if auth.uid() is null or not usuario_activo() then raise exception 'Debe iniciar sesión'; end if;

  select * into a from anticipos where id = p_id for update;
  if not found or a.comprador_id <> auth.uid() then raise exception 'Anticipo no válido'; end if;
  if a.estado <> 'pendiente' then raise exception 'El anticipo ya fue respondido'; end if;
  if not p_acepta and coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;

  perform fijar_contexto(case when p_acepta then 'confirmar' else 'disputar' end, p_motivo);
  update anticipos
     set estado = nuevo, respondido_en = now(), enlace_usado_en = coalesce(enlace_usado_en, now()),
         motivo_disputa = case when p_acepta then null else p_motivo end,
         dispositivo = left(p_dispositivo, 300)
   where id = a.id;

  return nuevo;
end;
$$;

revoke execute on function responder_anticipo_id from public, anon;
grant execute on function responder_anticipo_id to authenticated;
