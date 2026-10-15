# Puesta en marcha y despliegue

## 1. Supabase (hecho el 2026-10-15)
Supabase se creó desde Vercel (Storage → Supabase, plan gratis, Washington) y está conectado al proyecto `bancoticket`: Vercel carga solo sus variables.
- Bajar las variables a local: `vercel env pull .env.local --environment=development` y luego volver a agregar al final las propias de la app (ver `.env.example`).
- Aplicar una migración nueva: `node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/000X_nombre.sql` (en una transacción: si falla, no cambia nada).
- En Supabase → **Authentication → Sign In / Providers**: desactivar «Allow new users to sign up» (los usuarios los crea el administrador).

## 2. Variables locales
Copiar `.env.example` a `.env.local` y completar. `FIRMA_LECTURA_SECRETO` y `CRON_SECRET`: textos largos aleatorios, por ejemplo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Primer administrador
```bash
node --env-file=.env.local scripts/crear-admin.mjs usuario "contraseña-larga" "Nombre Apellido" 3001234567 correo@ejemplo.com
```
Luego, desde la app: crear el segundo administrador, las extractoras y los compradores.

## 4. Correr en local
```bash
npm run dev
```
Para probar la cámara desde el celular en la misma red, la página debe abrirse con HTTPS (los navegadores solo permiten la cámara en HTTPS o localhost); lo más simple es probar en la vista previa de Vercel.

## 5. Vercel
1. Subir el repositorio a GitHub (privado) y conectarlo en Vercel (**Add New → Project**).
2. Cargar las mismas variables de `.env.local` en **Settings → Environment Variables**, con `NEXT_PUBLIC_APP_URL` = la URL de producción.
3. Cada push a `main` despliega a producción; cada rama crea una vista previa.
4. `vercel.json` programa el borrado diario de fotos con más de 6 meses (`/api/cron/limpiar-fotos`).

## 6. Anthropic y Brevo
- Anthropic: crear la clave en console.anthropic.com y fijar un **límite de gasto mensual**.
- Brevo: crear cuenta gratuita, verificar el correo remitente (Senders) y crear una API key (SMTP & API).

## Pruebas
```bash
npm run prueba
```
Verifica la lectura de números, fechas y controles con los formatos reales de las cinco extractoras.
