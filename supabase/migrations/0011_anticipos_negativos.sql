-- Decisión del usuario: se permiten anticipos negativos. Un anticipo negativo es dinero que la
-- administración le debe al comprador (por ejemplo, el saldo con el que se empieza con él).
-- Saldo = anticipos confirmados − tiquetes: positivo = el comprador tiene dinero de anticipos
-- (saldo a favor de la administración); negativo = la administración le debe al comprador.

alter table anticipos drop constraint anticipos_monto_check;
alter table anticipos add constraint anticipos_monto_check check (monto <> 0);

-- En el extracto, un anticipo negativo es un movimiento que resta (como un tiquete), con su detalle.
create or replace view extracto with (security_invoker = true) as
select comprador_id, fecha::timestamptz as fecha, tipo::text as tipo, id as referencia_id,
       coalesce(nota, case when monto < 0 then 'Saldo a favor del comprador' else initcap(tipo::text) end) as detalle,
       greatest(monto, 0) as credito, greatest(-monto, 0) as debito
  from anticipos where estado = 'confirmado'
union all
select t.comprador_id, t.fecha_entrada, 'tiquete', t.id,
       e.nombre || ' N° ' || t.numero || ' — ' || t.peso_neto_t || ' t × $' || t.precio_tonelada,
       0, t.valor
  from tiquetes t join extractoras e on e.id = t.extractora_id
 where t.estado = 'vigente' and t.valor is not null;
