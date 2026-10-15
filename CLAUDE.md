# BancoTicket

Aplicación web (español, móvil primero) para controlar los tiquetes de entrega de fruta de palma de aceite y la cuenta de cada comprador como un banco: los anticipos confirmados suman, cada tiquete aprobado con precio descuenta.

- Especificación: `docs/especificacion.pdf` (fuente de verdad del negocio).
- Arquitectura y decisiones: `docs/ARQUITECTURA.md`.
- Esquema, RLS y funciones: `supabase/migrations/` (nunca editar una migración ya aplicada; crear una nueva).
- Notas y bitácora de desarrollo: `docs/NOTAS.md`.

## Pila
Next.js (App Router, TypeScript) + Tailwind 4 + Supabase (Postgres, Auth, Storage) + Vercel Hobby. Lectura de tiquetes con Claude Haiku 5.5 desde el servidor, detrás de la interfaz `LectorTiquete`.

## Reglas que no se rompen
- Pesos se guardan en **kilos enteros**; toneladas = kilos / 1000 (columna calculada, sin redondear).
- Unicidad **extractora + número de tiquete** entre pendientes y aprobados (lo garantiza la base de datos).
- El comprador nunca edita datos leídos; solo confirma o repite la foto. Solo elimina tiquetes rechazados.
- Saldo = anticipos confirmados − valores de tiquetes vigentes con precio. No se guarda; se calcula (vista `saldos`).
- Todo cambio queda en `historial` (disparadores). Para dar motivo usar `fijar_contexto(accion, motivo)` dentro de la transacción.
- Claves (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`) solo en variables de entorno del servidor; nunca con prefijo `NEXT_PUBLIC_`.
- Fechas en UTC en la base; se muestran con `America/Bogota` y `es-CO` (usar `src/lib/fechas.ts`).
- Valores pendientes de decisión van en la tabla `configuracion`, no en el código.

## Entorno
Windows; la ruta del proyecto tiene un espacio (`C:\PROYECTOS WEB\BANCOTICKET`): usar comillas en comandos.
`tiquetes-ejemplo/` contiene fotos reales con nombres y cédulas: está en `.gitignore` y no se sube.

@AGENTS.md
