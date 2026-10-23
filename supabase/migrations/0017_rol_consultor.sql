-- Decisión del usuario: nuevo perfil «Consultor» (pueden ser varios): solo consulta, no modifica nada.
-- Va solo en esta migración porque un valor nuevo de un enum no se puede usar en la misma
-- transacción en que se agrega (los permisos van en 0018). Solo agrega: no cambia datos.
alter type rol_usuario add value if not exists 'consultor';
