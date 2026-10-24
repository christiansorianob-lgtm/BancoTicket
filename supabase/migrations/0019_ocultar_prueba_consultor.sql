-- Decisión del usuario: el Consultor no ve al comprador de pruebas («prueba»). La lista de usuarios
-- ocultos va en `configuracion` (se puede ampliar sin migración). Se ajustan las políticas de
-- lectura del Consultor (ALTER POLICY: no se borra nada). La administración sigue viendo todo.
-- Al ocultarse el perfil, también sale de las vistas `saldos` y `extracto` para el Consultor.

insert into configuracion (clave, valor) values ('compradores_ocultos_consultor', '["prueba"]')
  on conflict (clave) do nothing;

-- p_id en texto: también se usa con la carpeta de las fotos (que puede no ser un uuid, ej. «formatos»).
create or replace function oculto_para_consultor(p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles p join configuracion c on c.clave = 'compradores_ocultos_consultor'
     where p.id::text = p_id and c.valor ? p.usuario
  );
$$;

alter policy perfiles_consultor  on perfiles  using (es_consultor() and not oculto_para_consultor(id::text));
alter policy anticipos_consultor on anticipos using (es_consultor() and not oculto_para_consultor(comprador_id::text));
alter policy tiquetes_consultor  on tiquetes  using (es_consultor() and not oculto_para_consultor(comprador_id::text));
alter policy fotos_consultor on storage.objects
  using (bucket_id = 'tiquetes' and public.es_consultor() and not public.oculto_para_consultor((storage.foldername(name))[1]));
