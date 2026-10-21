-- Decisión del usuario: el correo del usuario es opcional (el ingreso usa usuario y contraseña;
-- los avisos van por la campana y WhatsApp).
alter table perfiles alter column correo drop not null;
update perfiles set correo = null where btrim(correo) = '';
