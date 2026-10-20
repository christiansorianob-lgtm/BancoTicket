-- BancoTicket — extractoras aprendidas desde una foto de tiquete.
-- La extractora se identifica por su NIT y por los nombres que imprime (razón social,
-- marca del logo, planta o centro de acopio). Puede tener varios formatos de tiquete.

alter table extractoras add column if not exists nit text;
alter table extractoras add column if not exists nombres_impresos text[] not null default '{}';
alter table extractoras drop column if exists plantilla;

-- NIT único comparando solo los 9 dígitos base (con o sin dígito de verificación).
create unique index if not exists extractoras_nit_unico
  on extractoras (left(regexp_replace(nit, '\D', '', 'g'), 9))
  where nit is not null;

create table if not exists formatos_extractora (
  id             uuid primary key default gen_random_uuid(),
  extractora_id  uuid not null references extractoras (id) on delete cascade,
  plantilla      jsonb not null,       -- lo que aprendió la IA: dónde está cada dato y cómo leerlo
  descripcion    text,                 -- resumen corto del formato
  imagen_ruta    text,                 -- foto de ejemplo con la que se aprendió
  creado_por     uuid references perfiles (id) default auth.uid(),
  creado_en      timestamptz not null default now()
);
create index if not exists formatos_extractora_ext_idx on formatos_extractora (extractora_id);

alter table formatos_extractora enable row level security;
drop policy if exists formatos_ext_admin on formatos_extractora;
create policy formatos_ext_admin on formatos_extractora for all using (es_admin()) with check (es_admin());

drop trigger if exists h_formatos_ext on formatos_extractora;
create trigger h_formatos_ext after insert or update or delete on formatos_extractora
  for each row execute function registrar_historial();
