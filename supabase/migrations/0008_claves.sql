-- Contraseñas: cada usuario cambia la suya; si la olvida pide restablecerla y el desarrollador
-- aprueba. Al crear un usuario o restablecer, la contraseña queda en la clave por defecto y
-- el usuario debe cambiarla al ingresar (cambiar_clave).

alter table perfiles add column if not exists cambiar_clave boolean not null default false;

create or replace function es_desarrollador() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'desarrollador' and activo
  );
$$;

create table solicitudes_clave (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references perfiles (id),
  estado       text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  creado_en    timestamptz not null default now(),
  resuelta_por uuid references perfiles (id),
  resuelta_en  timestamptz
);
-- Una sola solicitud pendiente por usuario (evita repetirlas).
create unique index solicitudes_clave_una_pendiente on solicitudes_clave (usuario_id) where estado = 'pendiente';
create index on solicitudes_clave (estado, creado_en);

create trigger h_solicitudes_clave after insert or update or delete on solicitudes_clave
  for each row execute function registrar_historial();

-- Solo el desarrollador las ve y las resuelve. Se crean desde el servidor (service_role),
-- porque quien la pide no tiene sesión.
alter table solicitudes_clave enable row level security;
create policy solicitudes_clave_dev on solicitudes_clave for all
  using (es_desarrollador()) with check (es_desarrollador());
