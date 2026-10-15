# Notas de desarrollo

| Fecha | Qué se hizo |
|---|---|
| 2026-10-15 | Decisiones: correo con Brevo, IA (Haiku 5.5) para todos los tiquetes, ingreso con usuario y contraseña, pagos como movimiento aparte («Pago»). |
| 2026-10-15 | Se creó el proyecto: propuesta de arquitectura (`docs/ARQUITECTURA.md`), esquema SQL con RLS (`supabase/migrations/0001_esquema.sql`), CLAUDE.md y .gitignore. El comprador no inserta tiquetes directo: pasan por `/api/tiquetes` con lectura firmada. Pendiente: respuestas a las preguntas abiertas y crear el proyecto de Supabase. |
