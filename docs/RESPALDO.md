# Respaldo completo de BancoTicket

El plan gratis de Supabase **no guarda copias automáticas**. Este respaldo es la copia de seguridad del sistema.

## Cómo hacer el respaldo (cada 15 días)

1. Entrar con el usuario **desarrollador** → menú **Backups**.
2. Tocar **«Descargar respaldo completo»** (mejor desde un computador con wifi; tarda alrededor de un minuto).
3. Guardar el archivo `BancoTicket-respaldo-AAAA-MM-DD.zip` en una carpeta **privada** o un disco externo.
   Contiene nombres, cédulas y fotos: nunca en un sitio compartido.

La página avisa en rojo si pasan más de **15 días** sin respaldo (valor `dias_aviso_respaldo` en la tabla
`configuracion`; se puede cambiar a 7 o 30 sin tocar el código).

**Qué trae el .zip:** todas las tablas (`datos/*.json`, fila por fila), los usuarios **sin contraseñas**
(`datos/usuarios.json`), todos los archivos de Storage (`archivos/tiquetes/…` y `archivos/facturas/…`:
fotos de tiquetes, soportes de anticipos, ejemplos de formatos y facturas) y `resumen.json` con los conteos.

## Comprobar un respaldo (no escribe nada)

```
node scripts/restaurar-respaldo.mjs "C:\ruta\BancoTicket-respaldo-2026-10-31.zip"
```

Verifica que cada tabla, los usuarios y los archivos coincidan con lo anunciado en `resumen.json`.

## Restaurar (solo si se perdió la base)

Se restaura en un proyecto **nuevo y vacío** de Supabase; el script se niega a escribir sobre una base con datos.

1. Crear un proyecto nuevo en Supabase (o desde Vercel → Storage) y copiar sus claves en un archivo
   `.env.destino` (no se sube a GitHub): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `POSTGRES_URL_NON_POOLING` y `RESTAURAR_CONFIRMADO=si`.
2. Aplicar **todas** las migraciones en orden (`0001` a la última) sobre ese proyecto:
   ```
   node --env-file=.env.destino scripts/aplicar-sql.mjs supabase/migrations/0001_esquema.sql
   ```
   (repetir con cada archivo de `supabase/migrations/`, en orden).
3. Restaurar:
   ```
   node --env-file=.env.destino scripts/restaurar-respaldo.mjs "C:\ruta\respaldo.zip" --aplicar
   ```
   Crea los usuarios con su mismo id, carga las tablas en orden (sin disparadores, conservando los ids
   del historial) y sube todos los archivos con sus mismas rutas.
4. Apuntar la app al proyecto nuevo (variables de entorno en Vercel) y volver a desplegar.
5. **Todos los usuarios entran con la contraseña `12345678`** y conviene que la cambien (llave 🔑).

Probado el 2026-10-31 con un respaldo real (47,7 MB, 10 usuarios, 1.974 registros, 205 archivos): el
ensayo pasa y la carga de todas las tablas en copias temporales quedó idéntica a la base.
