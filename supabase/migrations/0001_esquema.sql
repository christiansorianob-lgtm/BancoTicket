-- BancoTicket — esquema inicial
-- Pesos en kilos enteros; toneladas y valores son columnas calculadas.
-- Fechas en timestamptz (UTC); se muestran en America/Bogota.

-- En Supabase pgcrypto vive en el esquema «extensions».
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type rol_usuario      as enum ('admin', 'comprador');
create type estado_anticipo  as enum ('pendiente', 'confirmado', 'en_disputa');
create type estado_pendiente as enum ('pendiente', 'rechazado');
create type estado_tiquete   as enum ('vigente', 'anulado');
create type origen_foto      as enum ('camara', 'galeria');
create type estado_formato   as enum ('nuevo', 'resuelto', 'descartado');
-- Anticipo: dinero entregado antes de comprar. Pago: dinero que se le paga al comprador
-- cuando su saldo es negativo. Ambos suman al saldo y se confirman igual.
create type tipo_entrega     as enum ('anticipo', 'pago');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table perfiles (
  id         uuid primary key references auth.users (id) on delete restrict,
  nombre     text not null,
  usuario    text not null unique,
  celular    text not null,          -- WhatsApp, solo dígitos con indicativo (57...)
  correo     text not null,
  rol        rol_usuario not null default 'comprador',
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

create table configuracion (
  clave text primary key,
  valor jsonb not null
);

insert into configuracion (clave, valor) values
  ('fecha_filtro_precio', '"entrada"'),
  ('vigencia_enlace_anticipo_horas', '48'),
  ('comprador_ve_toneladas_sin_precio', 'true'),
  ('placa_obligatoria', 'true'),
  ('meses_conservacion_fotos', '6');

create table extractoras (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  activa     boolean not null default true,
  plantilla  jsonb not null default '{}'::jsonb,  -- sinónimos, formato de fecha y números
  creado_en  timestamptz not null default now()
);

create table anticipos (
  id                 uuid primary key default gen_random_uuid(),
  comprador_id       uuid not null references perfiles (id),
  tipo               tipo_entrega not null default 'anticipo',
  fecha              date not null,
  monto              numeric(14, 2) not null check (monto > 0),
  nota               text,
  registrado_por     uuid not null references perfiles (id) default auth.uid(),
  registrado_en      timestamptz not null default now(),
  estado             estado_anticipo not null default 'pendiente',
  respondido_en      timestamptz,
  motivo_disputa     text,
  dispositivo        text,
  -- enlace de confirmación: solo se guarda el hash del código
  enlace_hash        text unique,
  enlace_vence       timestamptz,
  enlace_usado_en    timestamptz
);
create index on anticipos (comprador_id, estado);

-- Tabla provisional
create table tiquetes_pendientes (
  id                     uuid primary key default gen_random_uuid(),
  extractora_id          uuid not null references extractoras (id),
  numero                 text not null check (btrim(numero) <> ''),
  comprador_id           uuid not null references perfiles (id) default auth.uid(),
  bascula                text,
  fecha_entrada          timestamptz not null,
  peso_bruto_kg          integer not null check (peso_bruto_kg > 0),
  tara_kg                integer not null check (tara_kg >= 0),
  neto_impreso_kg        integer,
  placa                  text,
  conductor              text,
  imagen_ruta            text,
  origen                 origen_foto not null default 'camara',
  requiere_revision      boolean not null default false,
  motivo_revision        text,
  datos_leidos           jsonb,          -- respuesta cruda del lector
  confirmado_en          timestamptz,    -- cuándo el comprador tocó «Coincide, enviar»
  cargado_en             timestamptz not null default now(),
  estado                 estado_pendiente not null default 'pendiente',
  motivo_rechazo         text,
  revisado_por           uuid references perfiles (id),
  revisado_en            timestamptz,
  unique (extractora_id, numero),
  check (peso_bruto_kg > tara_kg)
);
create index on tiquetes_pendientes (estado, requiere_revision desc, cargado_en);
create index on tiquetes_pendientes (comprador_id);

-- Tabla principal
create table tiquetes (
  id                 uuid primary key default gen_random_uuid(),
  extractora_id      uuid not null references extractoras (id),
  numero             text not null check (btrim(numero) <> ''),
  comprador_id       uuid not null references perfiles (id),
  bascula            text,
  fecha_entrada      timestamptz not null,
  peso_bruto_kg      integer not null check (peso_bruto_kg > 0),
  tara_kg            integer not null check (tara_kg >= 0),
  neto_impreso_kg    integer,
  peso_neto_t        numeric generated always as ((peso_bruto_kg - tara_kg)::numeric / 1000) stored,
  precio_tonelada    numeric(14, 2) check (precio_tonelada >= 0),
  valor              numeric(16, 2) generated always as
                       (round((peso_bruto_kg - tara_kg)::numeric / 1000 * precio_tonelada, 2)) stored,
  placa              text,
  conductor          text,
  imagen_ruta        text,
  origen             origen_foto not null default 'camara',
  cargado_en         timestamptz not null,
  confirmado_en      timestamptz,
  aprobado_por       uuid not null references perfiles (id),
  aprobado_en        timestamptz not null default now(),
  precio_asignado_por uuid references perfiles (id),
  precio_asignado_en timestamptz,
  estado             estado_tiquete not null default 'vigente',
  unique (extractora_id, numero),
  check (peso_bruto_kg > tara_kg)
);
create index on tiquetes (comprador_id, fecha_entrada);
create index on tiquetes (extractora_id, fecha_entrada);
create index on tiquetes (placa, fecha_entrada);

create table historial (
  id              bigint generated always as identity primary key,
  tabla           text not null,
  registro_id     uuid,
  accion          text not null,     -- crear, editar, eliminar, aprobar, rechazar, precio, confirmar, disputar
  valor_anterior  jsonb,
  valor_nuevo     jsonb,
  motivo          text,
  usuario_id      uuid default auth.uid(),
  creado_en       timestamptz not null default now()
);
create index on historial (tabla, registro_id);
create index on historial (creado_en desc);

create table formatos_no_reconocidos (
  id             uuid primary key default gen_random_uuid(),
  extractora_id  uuid references extractoras (id),
  comprador_id   uuid references perfiles (id) default auth.uid(),
  imagen_ruta    text,
  texto_leido    text,
  datos_leidos   jsonb,
  estado         estado_formato not null default 'nuevo',
  creado_en      timestamptz not null default now()
);

create table notificaciones (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references perfiles (id),
  titulo      text not null,
  cuerpo      text,
  enlace      text,
  leida       boolean not null default false,
  creado_en   timestamptz not null default now()
);
create index on notificaciones (usuario_id, leida, creado_en desc);

-- ---------------------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------------------
create or replace function es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function usuario_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid() and activo);
$$;

-- Unicidad extractora + número entre la tabla provisional y la principal.
-- El bloqueo evita que dos inserciones simultáneas se crucen.
create or replace function validar_numero_unico() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  previo record;
begin
  new.numero := upper(btrim(new.numero));
  perform pg_advisory_xact_lock(hashtext(new.extractora_id::text || '|' || new.numero));

  if tg_table_name = 'tiquetes_pendientes' then
    select t.aprobado_en as cuando, p.nombre as quien into previo
      from tiquetes t join perfiles p on p.id = t.comprador_id
     where t.extractora_id = new.extractora_id and t.numero = new.numero;
  else
    select tp.cargado_en as cuando, p.nombre as quien into previo
      from tiquetes_pendientes tp join perfiles p on p.id = tp.comprador_id
     where tp.extractora_id = new.extractora_id and tp.numero = new.numero
       and tp.id is distinct from new.id;
  end if;

  if found then
    raise exception 'TIQUETE_DUPLICADO: ya lo registró % el %',
      previo.quien, to_char(previo.cuando at time zone 'America/Bogota', 'DD/MM/YYYY HH12:MI AM')
      using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger tp_numero_unico before insert or update of extractora_id, numero on tiquetes_pendientes
  for each row execute function validar_numero_unico();
create trigger t_numero_unico before insert or update of extractora_id, numero on tiquetes
  for each row execute function validar_numero_unico();

-- Consulta de duplicado para el comprador antes de enviar (no expone datos de otros
-- más allá de quién y cuándo, como pide la regla 6).
create or replace function buscar_duplicado(p_extractora uuid, p_numero text)
returns table (quien text, cuando timestamptz, estado text)
language sql stable security definer set search_path = public as $$
  select p.nombre, t.aprobado_en, 'aprobado'
    from tiquetes t join perfiles p on p.id = t.comprador_id
   where t.extractora_id = p_extractora and t.numero = upper(btrim(p_numero))
  union all
  select p.nombre, tp.cargado_en, tp.estado::text
    from tiquetes_pendientes tp join perfiles p on p.id = tp.comprador_id
   where tp.extractora_id = p_extractora and tp.numero = upper(btrim(p_numero));
$$;

-- Posible duplicado por placa y hora de entrada (aviso, no bloqueo).
create or replace function posibles_duplicados(p_placa text, p_fecha timestamptz)
returns table (extractora text, numero text, fecha_entrada timestamptz)
language sql stable security definer set search_path = public as $$
  select e.nombre, x.numero, x.fecha_entrada from (
    select extractora_id, numero, fecha_entrada, placa from tiquetes
    union all
    select extractora_id, numero, fecha_entrada, placa from tiquetes_pendientes where estado = 'pendiente'
  ) x join extractoras e on e.id = x.extractora_id
  where p_placa is not null
    and upper(replace(x.placa, ' ', '')) = upper(replace(p_placa, ' ', ''))
    and x.fecha_entrada between p_fecha - interval '10 minutes' and p_fecha + interval '10 minutes';
$$;

-- ---------------------------------------------------------------------------
-- Historial automático
-- ---------------------------------------------------------------------------
create or replace function registrar_historial() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_accion text := coalesce(nullif(current_setting('app.accion', true), ''), lower(tg_op));
  v_motivo text := nullif(current_setting('app.motivo', true), '');
begin
  if tg_op = 'INSERT' then
    insert into historial (tabla, registro_id, accion, valor_nuevo, motivo)
    values (tg_table_name, new.id, case when v_accion = 'insert' then 'crear' else v_accion end, to_jsonb(new), v_motivo);
    return new;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) = to_jsonb(old) then return new; end if;
    insert into historial (tabla, registro_id, accion, valor_anterior, valor_nuevo, motivo)
    values (tg_table_name, new.id, case when v_accion = 'update' then 'editar' else v_accion end, to_jsonb(old), to_jsonb(new), v_motivo);
    return new;
  else
    insert into historial (tabla, registro_id, accion, valor_anterior, motivo)
    values (tg_table_name, old.id, case when v_accion = 'delete' then 'eliminar' else v_accion end, to_jsonb(old), v_motivo);
    return old;
  end if;
end;
$$;

create trigger h_perfiles    after insert or update or delete on perfiles            for each row execute function registrar_historial();
create trigger h_extractoras after insert or update or delete on extractoras         for each row execute function registrar_historial();
create trigger h_anticipos   after insert or update or delete on anticipos           for each row execute function registrar_historial();
create trigger h_pendientes  after insert or update or delete on tiquetes_pendientes for each row execute function registrar_historial();
create trigger h_tiquetes    after insert or update or delete on tiquetes            for each row execute function registrar_historial();

-- Fija acción y motivo para los disparadores de historial dentro de la transacción.
create or replace function fijar_contexto(p_accion text, p_motivo text) returns void
language sql as $$
  select set_config('app.accion', coalesce(p_accion, ''), true),
         set_config('app.motivo', coalesce(p_motivo, ''), true);
$$;

-- ---------------------------------------------------------------------------
-- Operaciones del administrador
-- ---------------------------------------------------------------------------
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
                        peso_bruto_kg, tara_kg, neto_impreso_kg, placa, conductor,
                        imagen_ruta, origen, cargado_en, confirmado_en, aprobado_por)
  values (tp.extractora_id, tp.numero, tp.comprador_id, tp.bascula, tp.fecha_entrada,
          tp.peso_bruto_kg, tp.tara_kg, tp.neto_impreso_kg, tp.placa, tp.conductor,
          tp.imagen_ruta, tp.origen, tp.cargado_en, tp.confirmado_en, auth.uid())
  returning id into nuevo_id;

  insert into notificaciones (usuario_id, titulo, cuerpo, enlace)
  values (tp.comprador_id, 'Tiquete aprobado', 'Tiquete ' || tp.numero || ' aprobado.', '/mis-tiquetes');

  return nuevo_id;
end;
$$;

create or replace function rechazar_tiquete(p_id uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare
  tp tiquetes_pendientes;
begin
  if not es_admin() then raise exception 'Solo un administrador puede rechazar'; end if;
  if coalesce(btrim(p_motivo), '') = '' then raise exception 'El motivo es obligatorio'; end if;

  perform fijar_contexto('rechazar', p_motivo);
  update tiquetes_pendientes
     set estado = 'rechazado', motivo_rechazo = p_motivo,
         revisado_por = auth.uid(), revisado_en = now()
   where id = p_id and estado = 'pendiente'
  returning * into tp;
  if not found then raise exception 'El tiquete no está pendiente'; end if;

  insert into notificaciones (usuario_id, titulo, cuerpo, enlace)
  values (tp.comprador_id, 'Tiquete rechazado', 'Tiquete ' || tp.numero || ': ' || p_motivo, '/mis-tiquetes');
end;
$$;

-- Precio en bloque: filtros combinables; null = sin filtro. Devuelve cuántos tiquetes cambió.
create or replace function asignar_precio_bloque(
  p_precio numeric, p_desde date, p_hasta date,
  p_extractora uuid default null, p_comprador uuid default null,
  p_solo_sin_precio boolean default true, p_motivo text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if not es_admin() then raise exception 'Solo un administrador puede fijar precios'; end if;
  if p_precio is null or p_precio < 0 then raise exception 'Precio inválido'; end if;

  perform fijar_contexto('precio', p_motivo);
  update tiquetes
     set precio_tonelada = p_precio, precio_asignado_por = auth.uid(), precio_asignado_en = now()
   where estado = 'vigente'
     and (p_desde is null or (fecha_entrada at time zone 'America/Bogota')::date >= p_desde)
     and (p_hasta is null or (fecha_entrada at time zone 'America/Bogota')::date <= p_hasta)
     and (p_extractora is null or extractora_id = p_extractora)
     and (p_comprador is null or comprador_id = p_comprador)
     and (not p_solo_sin_precio or precio_tonelada is null);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Crea el enlace de confirmación; devuelve el código en claro una sola vez.
create or replace function generar_enlace_anticipo(p_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  codigo text := encode(gen_random_bytes(24), 'hex');
  horas integer := (select valor::text::integer from configuracion where clave = 'vigencia_enlace_anticipo_horas');
begin
  if not es_admin() then raise exception 'Solo un administrador'; end if;
  perform fijar_contexto('enlace', null);
  update anticipos
     set enlace_hash = encode(digest(codigo, 'sha256'), 'hex'),
         enlace_vence = now() + make_interval(hours => coalesce(horas, 48)),
         enlace_usado_en = null
   where id = p_id and estado = 'pendiente';
  if not found then raise exception 'El anticipo no está pendiente'; end if;
  return codigo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Operaciones del comprador
-- ---------------------------------------------------------------------------
-- Lee el anticipo del enlace (para mostrar monto, fecha y quién lo registró).
create or replace function ver_anticipo_por_enlace(p_codigo text)
returns table (id uuid, tipo tipo_entrega, monto numeric, fecha date, nota text, registrado_por text,
               estado estado_anticipo, vencido boolean, usado boolean)
language sql stable security definer set search_path = public, extensions as $$
  select a.id, a.tipo, a.monto, a.fecha, a.nota, p.nombre, a.estado,
         a.enlace_vence < now(), a.enlace_usado_en is not null
    from anticipos a join perfiles p on p.id = a.registrado_por
   where a.enlace_hash = encode(digest(p_codigo, 'sha256'), 'hex')
     and a.comprador_id = auth.uid();
$$;

create or replace function responder_anticipo(p_codigo text, p_acepta boolean, p_motivo text, p_dispositivo text)
returns estado_anticipo
language plpgsql security definer set search_path = public, extensions as $$
declare
  a anticipos;
  nuevo estado_anticipo := case when p_acepta then 'confirmado' else 'en_disputa' end;
begin
  if auth.uid() is null or not usuario_activo() then raise exception 'Debe iniciar sesión'; end if;

  select * into a from anticipos
   where enlace_hash = encode(digest(p_codigo, 'sha256'), 'hex') for update;
  if not found or a.comprador_id <> auth.uid() then raise exception 'Enlace no válido'; end if;
  if a.enlace_usado_en is not null then raise exception 'Este enlace ya se usó'; end if;
  if a.enlace_vence < now() then raise exception 'El enlace venció; pida uno nuevo'; end if;
  if a.estado <> 'pendiente' then raise exception 'El anticipo ya fue respondido'; end if;
  if not p_acepta and coalesce(btrim(p_motivo), '') = '' then raise exception 'Escriba el motivo'; end if;

  perform fijar_contexto(case when p_acepta then 'confirmar' else 'disputar' end, p_motivo);
  update anticipos
     set estado = nuevo, respondido_en = now(), enlace_usado_en = now(),
         motivo_disputa = case when p_acepta then null else p_motivo end,
         dispositivo = left(p_dispositivo, 300)
   where id = a.id;

  insert into notificaciones (usuario_id, titulo, cuerpo, enlace)
  select p.id, initcap(a.tipo::text) || ' ' || case when p_acepta then 'confirmado' else 'en disputa' end,
         (select nombre from perfiles where id = a.comprador_id) || ' — $' || a.monto,
         '/admin/anticipos'
    from perfiles p where p.rol = 'admin' and p.activo;

  return nuevo;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saldos (no se guardan: se calculan)
-- ---------------------------------------------------------------------------
create view saldos with (security_invoker = true) as
select p.id as comprador_id, p.nombre,
       coalesce(a.total, 0) as anticipos_confirmados,
       coalesce(t.total, 0) as valor_tiquetes,
       coalesce(t.toneladas, 0) as toneladas_valoradas,
       coalesce(a.total, 0) - coalesce(t.total, 0) as saldo
  from perfiles p
  left join (select comprador_id, sum(monto) total from anticipos
              where estado = 'confirmado' group by comprador_id) a on a.comprador_id = p.id
  left join (select comprador_id, sum(valor) total, sum(peso_neto_t) toneladas from tiquetes
              where estado = 'vigente' and valor is not null group by comprador_id) t on t.comprador_id = p.id
 where p.rol = 'comprador';

-- Extracto: movimientos en orden cronológico.
create view extracto with (security_invoker = true) as
select comprador_id, fecha::timestamptz as fecha, tipo::text as tipo, id as referencia_id,
       coalesce(nota, initcap(tipo::text)) as detalle, monto as credito, 0::numeric as debito
  from anticipos where estado = 'confirmado'
union all
select t.comprador_id, t.fecha_entrada, 'tiquete', t.id,
       e.nombre || ' N° ' || t.numero || ' — ' || t.peso_neto_t || ' t × $' || t.precio_tonelada,
       0, t.valor
  from tiquetes t join extractoras e on e.id = t.extractora_id
 where t.estado = 'vigente' and t.valor is not null;

-- ---------------------------------------------------------------------------
-- Seguridad por fila
-- ---------------------------------------------------------------------------
alter table perfiles                 enable row level security;
alter table configuracion            enable row level security;
alter table extractoras              enable row level security;
alter table anticipos                enable row level security;
alter table tiquetes_pendientes      enable row level security;
alter table tiquetes                 enable row level security;
alter table historial                enable row level security;
alter table formatos_no_reconocidos  enable row level security;
alter table notificaciones           enable row level security;

-- perfiles: cada quien ve el suyo; el admin ve y gestiona todos.
-- El alta de usuarios se hace desde el servidor con service_role (crea auth.users + perfil).
create policy perfiles_ver   on perfiles for select using (id = auth.uid() or es_admin());
create policy perfiles_admin on perfiles for all    using (es_admin()) with check (es_admin());

create policy config_ver   on configuracion for select using (auth.uid() is not null);
create policy config_admin on configuracion for all    using (es_admin()) with check (es_admin());

create policy extractoras_ver   on extractoras for select using (auth.uid() is not null);
create policy extractoras_admin on extractoras for all    using (es_admin()) with check (es_admin());

-- anticipos: el comprador solo lee los suyos; responde con responder_anticipo().
create policy anticipos_ver   on anticipos for select using (comprador_id = auth.uid() or es_admin());
create policy anticipos_admin on anticipos for all    using (es_admin()) with check (es_admin());

-- tiquetes pendientes
create policy tp_ver on tiquetes_pendientes for select
  using (comprador_id = auth.uid() or es_admin());
-- Sin política de inserción para el comprador: el tiquete entra solo por la ruta
-- /api/tiquetes, que verifica la firma de la lectura (el comprador no edita datos)
-- y lo inserta con service_role.
create policy tp_eliminar_rechazado on tiquetes_pendientes for delete
  using (comprador_id = auth.uid() and estado = 'rechazado');
create policy tp_admin on tiquetes_pendientes for all using (es_admin()) with check (es_admin());

-- tiquetes aprobados: el comprador solo lee
create policy t_ver   on tiquetes for select using (comprador_id = auth.uid() or es_admin());
create policy t_admin on tiquetes for all    using (es_admin()) with check (es_admin());

-- historial: solo admin lee; se escribe por disparadores (security definer)
create policy historial_ver on historial for select using (es_admin());

create policy formatos_subir on formatos_no_reconocidos for insert with check (comprador_id = auth.uid());
create policy formatos_admin on formatos_no_reconocidos for all using (es_admin()) with check (es_admin());

create policy notif_ver    on notificaciones for select using (usuario_id = auth.uid());
create policy notif_leer   on notificaciones for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy notif_admin  on notificaciones for insert with check (es_admin());

-- Funciones solo para usuarios con sesión
revoke execute on function aprobar_tiquete, rechazar_tiquete, asignar_precio_bloque,
  generar_enlace_anticipo, ver_anticipo_por_enlace, responder_anticipo,
  buscar_duplicado, posibles_duplicados from public, anon;
grant execute on function aprobar_tiquete, rechazar_tiquete, asignar_precio_bloque,
  generar_enlace_anticipo, ver_anticipo_por_enlace, responder_anticipo,
  buscar_duplicado, posibles_duplicados to authenticated;

-- ---------------------------------------------------------------------------
-- Almacenamiento de fotos: bucket privado, ruta <comprador_id>/<archivo>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tiquetes', 'tiquetes', false, 600000, array['image/webp', 'image/jpeg']);

create policy fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'tiquetes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'tiquetes' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));
create policy fotos_admin on storage.objects for delete to authenticated
  using (bucket_id = 'tiquetes' and public.es_admin());
