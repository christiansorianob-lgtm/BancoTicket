-- Tres perfiles: un administrador (Ingrid), un desarrollador (Christian) y varios compradores.
-- El desarrollador tiene los mismos permisos del administrador, pero los avisos y los
-- WhatsApp de los compradores van solo al administrador.

-- Christian pasa de administrador a desarrollador.
select fijar_contexto('cambiar_rol', 'Christian es el desarrollador; Ingrid queda como única administradora');
update perfiles set rol = 'desarrollador' where usuario = 'christian';

-- Permisos: administrador y desarrollador ven y gestionan todo (todas las políticas usan es_admin()).
create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol in ('admin', 'desarrollador') and activo
  );
$$;

-- Solo un administrador activo y solo un desarrollador activo.
create unique index perfiles_un_rol_unico on perfiles (rol)
  where activo and rol in ('admin', 'desarrollador');
