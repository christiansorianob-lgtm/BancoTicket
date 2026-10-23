-- Perfil «Consultor»: ve el estado de cuenta de todos los compradores, los reportes y sus Excel,
-- las fotos de los tiquetes y los anticipos con sus soportes. NO modifica nada: solo se le dan
-- permisos de lectura, y las dos únicas escrituras que la base permitía a cualquier usuario con
-- sesión (reportar un formato no reconocido y subir archivos a su propia carpeta) se le cierran
-- con políticas restrictivas. Solo agrega: no cambia ni borra datos ni políticas existentes.
-- Las vistas `saldos` y `extracto` usan los permisos de quien consulta (security_invoker).

create or replace function es_consultor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and rol = 'consultor' and activo);
$$;

-- Lectura
create policy perfiles_consultor  on perfiles  for select using (es_consultor());
create policy anticipos_consultor on anticipos for select using (es_consultor());
create policy tiquetes_consultor  on tiquetes  for select using (es_consultor());
create policy fotos_consultor on storage.objects for select to authenticated
  using (bucket_id = 'tiquetes' and public.es_consultor());

-- Nunca escribe
create policy formatos_no_consultor on formatos_no_reconocidos as restrictive for insert
  with check (not es_consultor());
create policy fotos_no_consultor on storage.objects as restrictive for insert to authenticated
  with check (not public.es_consultor());
