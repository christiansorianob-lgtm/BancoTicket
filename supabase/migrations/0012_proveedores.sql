-- Decisión del usuario: el proveedor es la empresa (o empresas) de la administración. Se lleva
-- una lista oficial; la lectura de la IA se compara contra ella y lo que no coincide exacto se
-- marca «Revisar» para la administradora.

create table proveedores (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  nit        text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
-- Un nombre no se repite (sin importar mayúsculas ni espacios de más).
create unique index proveedores_nombre_unico on proveedores (upper(regexp_replace(btrim(nombre), '\s+', ' ', 'g')));

create trigger h_proveedores after insert or update or delete on proveedores
  for each row execute function registrar_historial();

alter table proveedores enable row level security;
create policy proveedores_ver   on proveedores for select using (usuario_activo());
create policy proveedores_admin on proveedores for all using (es_admin()) with check (es_admin());

-- Confirmado por el usuario (tiquete Lukeoil 37760: «OLEUM FOODS S.A.S.», NIT 901.419.792).
select fijar_contexto('crear', 'Proveedor confirmado por el usuario');
insert into proveedores (nombre, nit) values ('OLEUM FOODS S.A.S.', '901.419.792');
