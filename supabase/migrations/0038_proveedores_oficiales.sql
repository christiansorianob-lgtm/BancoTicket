-- Decisión del usuario (2026-11-25): el nombre del PROVEEDOR de los tiquetes nuevos se guarda
-- estandarizado. Cada extractora lo imprime distinto («S.A.S» / «S.A.S.» / «SAS»; Oleoflores le
-- antepone «SAF - » o «IND - » y lo corta: «SAF - SOCIEDAD AGROVASPALMA S»). Al leer, la app (sin IA)
-- quita esos prefijos, compara sin puntos, espacios ni mayúsculas y, si coincide, guarda el nombre
-- oficial de esta lista. Si no coincide, lo guarda como venga (sin prefijo) y avisa «proveedor nuevo».
-- Los tiquetes ya guardados NO se tocan (el usuario los corrige a mano con «Editar datos»).
-- Solo agrega una fila de configuración: no cambia tablas ni datos.
insert into configuracion (clave, valor) values ('proveedores_oficiales', '[
  "CONSORCIO AGROPALMA S.A.S.",
  "GL PALMA ASOCIADOS S.A.S.",
  "INVERSIONES AGROPALNORT S.A.S.",
  "OLEUM FOODS S.A.S.",
  "PALMALI ASOCIADOS S.A.S.",
  "SOCIEDAD AGROVASPALMA S.A.S."
]')
on conflict (clave) do nothing;
