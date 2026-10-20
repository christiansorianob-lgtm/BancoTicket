-- Nuevo rol 'desarrollador' (Christian). Va solo en esta migración porque un valor nuevo de
-- un enum no se puede usar en la misma transacción en que se agrega (ver 0007).
alter type rol_usuario add value if not exists 'desarrollador';
