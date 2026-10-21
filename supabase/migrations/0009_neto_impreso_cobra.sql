-- Decisión del usuario: el peso neto que vale es el IMPRESO en el tiquete, no la resta
-- bruto − tara (la resta solo sirve de comprobación). Toneladas y valor se calculan con el
-- neto impreso; si un tiquete no lo tiene (registro manual antiguo), con la resta.
-- Las columnas calculadas no se pueden alterar: se quitan las vistas que las usan, se
-- recrean las columnas y luego las vistas (mismas definiciones de 0001).

drop view if exists extracto;
drop view if exists saldos;

alter table tiquetes drop column valor;
alter table tiquetes drop column peso_neto_t;
alter table tiquetes add column peso_neto_t numeric generated always as
  (coalesce(neto_impreso_kg, peso_bruto_kg - tara_kg)::numeric / 1000) stored;
alter table tiquetes add column valor numeric(16, 2) generated always as
  (round(coalesce(neto_impreso_kg, peso_bruto_kg - tara_kg)::numeric / 1000 * precio_tonelada, 2)) stored;
alter table tiquetes add constraint tiquetes_neto_impreso_positivo check (neto_impreso_kg is null or neto_impreso_kg > 0);

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
