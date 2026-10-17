-- BancoTicket — proveedor impreso en el tiquete (ej. "INVERSIONES AGROPALNORT S.A.S.").
-- Se lee de la foto, se guarda en cada tiquete y el administrador lo puede corregir.

alter table tiquetes_pendientes add column if not exists proveedor text;
alter table tiquetes            add column if not exists proveedor text;
create index if not exists tiquetes_proveedor_idx on tiquetes (proveedor);

create or replace function registrar_pendiente(p jsonb, p_usuario uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nuevo_id uuid;
begin
  perform set_config('app.usuario', p_usuario::text, true);
  insert into tiquetes_pendientes (extractora_id, numero, comprador_id, bascula, fecha_entrada,
      peso_bruto_kg, tara_kg, neto_impreso_kg, placa, conductor, proveedor, imagen_ruta, origen,
      requiere_revision, motivo_revision, datos_leidos, confirmado_en)
  values ((p->>'extractora_id')::uuid, p->>'numero', p_usuario, p->>'bascula', (p->>'fecha_entrada')::timestamptz,
      (p->>'peso_bruto_kg')::integer, (p->>'tara_kg')::integer, (p->>'neto_impreso_kg')::integer,
      p->>'placa', p->>'conductor', p->>'proveedor', p->>'imagen_ruta', (p->>'origen')::origen_foto,
      coalesce((p->>'requiere_revision')::boolean, false), p->>'motivo_revision', p->'datos_leidos', now())
  returning id into nuevo_id;
  return nuevo_id;
end;
$$;

create or replace function aprobar_tiquete(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tp tiquetes_pendientes;
  nuevo_id uuid;
begin
  if not es_admin() then raise exception 'Solo un administrador puede aprobar'; end if;

  select * into tp from tiquetes_pendientes where id = p_id and estado = 'pendiente' for update;
  if not found then raise exception 'El tiquete no está pendiente'; end if;

  perform fijar_contexto('aprobar', null);
  delete from tiquetes_pendientes where id = p_id;

  insert into tiquetes (extractora_id, numero, comprador_id, bascula, fecha_entrada,
                        peso_bruto_kg, tara_kg, neto_impreso_kg, placa, conductor, proveedor,
                        imagen_ruta, origen, cargado_en, confirmado_en, aprobado_por)
  values (tp.extractora_id, tp.numero, tp.comprador_id, tp.bascula, tp.fecha_entrada,
          tp.peso_bruto_kg, tp.tara_kg, tp.neto_impreso_kg, tp.placa, tp.conductor, tp.proveedor,
          tp.imagen_ruta, tp.origen, tp.cargado_en, tp.confirmado_en, auth.uid())
  returning id into nuevo_id;


  return nuevo_id;
end;
$$;

create or replace function editar_tiquete(p_id uuid, p jsonb, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo un administrador'; end if;
  perform fijar_contexto(case when p ? 'precio_tonelada' and (select count(*) from jsonb_object_keys(p)) = 1 then 'precio' else 'editar' end, p_motivo);
  update tiquetes set
         extractora_id = case when p ? 'extractora_id' then (p->>'extractora_id')::uuid else extractora_id end,
         numero = case when p ? 'numero' then (p->>'numero') else numero end,
         comprador_id = case when p ? 'comprador_id' then (p->>'comprador_id')::uuid else comprador_id end,
         bascula = case when p ? 'bascula' then (p->>'bascula') else bascula end,
         fecha_entrada = case when p ? 'fecha_entrada' then (p->>'fecha_entrada')::timestamptz else fecha_entrada end,
         peso_bruto_kg = case when p ? 'peso_bruto_kg' then (p->>'peso_bruto_kg')::integer else peso_bruto_kg end,
         tara_kg = case when p ? 'tara_kg' then (p->>'tara_kg')::integer else tara_kg end,
         neto_impreso_kg = case when p ? 'neto_impreso_kg' then (p->>'neto_impreso_kg')::integer else neto_impreso_kg end,
         placa = case when p ? 'placa' then (p->>'placa') else placa end,
         conductor = case when p ? 'conductor' then (p->>'conductor') else conductor end,
         proveedor = case when p ? 'proveedor' then (p->>'proveedor') else proveedor end,
         precio_tonelada = case when p ? 'precio_tonelada' then (p->>'precio_tonelada')::numeric else precio_tonelada end,
         estado = case when p ? 'estado' then (p->>'estado')::estado_tiquete else estado end,
         precio_asignado_por = case when p ? 'precio_tonelada' then auth.uid() else precio_asignado_por end,
         precio_asignado_en  = case when p ? 'precio_tonelada' then now() else precio_asignado_en end
   where id = p_id;
  if not found then raise exception 'Tiquete no encontrado'; end if;
end;
$$;

create or replace function editar_pendiente(p_id uuid, p jsonb, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_admin() then raise exception 'Solo un administrador'; end if;
  perform fijar_contexto('editar', p_motivo);
  update tiquetes_pendientes set
         extractora_id = case when p ? 'extractora_id' then (p->>'extractora_id')::uuid else extractora_id end,
         numero = case when p ? 'numero' then (p->>'numero') else numero end,
         comprador_id = case when p ? 'comprador_id' then (p->>'comprador_id')::uuid else comprador_id end,
         bascula = case when p ? 'bascula' then (p->>'bascula') else bascula end,
         fecha_entrada = case when p ? 'fecha_entrada' then (p->>'fecha_entrada')::timestamptz else fecha_entrada end,
         peso_bruto_kg = case when p ? 'peso_bruto_kg' then (p->>'peso_bruto_kg')::integer else peso_bruto_kg end,
         tara_kg = case when p ? 'tara_kg' then (p->>'tara_kg')::integer else tara_kg end,
         neto_impreso_kg = case when p ? 'neto_impreso_kg' then (p->>'neto_impreso_kg')::integer else neto_impreso_kg end,
         placa = case when p ? 'placa' then (p->>'placa') else placa end,
         conductor = case when p ? 'conductor' then (p->>'conductor') else conductor end,
         proveedor = case when p ? 'proveedor' then (p->>'proveedor') else proveedor end
   where id = p_id;
  if not found then raise exception 'Tiquete no encontrado'; end if;
end;
$$;
