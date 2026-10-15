# Puesta en marcha y despliegue

## 1. Supabase (una vez)
1. En el panel de Supabase: **SQL Editor → New query**, pegar todo `supabase/migrations/0001_esquema.sql` y ejecutar.
2. **Authentication → Sign In / Providers → Email**: dejar activo; desactivar «Allow new users to sign up» (los usuarios los crea el administrador).
3. **Project Settings → API**: copiar URL, `anon` y `service_role` a `.env.local` (ver `.env.example`).

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
