# BancoTicket — contexto para continuar en un chat nuevo de Claude Code

> Copia y pega este archivo completo como primer mensaje en el chat nuevo.
> Abre ese chat **en la carpeta `C:\PROYECTOS WEB\BANCOTICKET`**: así carga solo `CLAUDE.md` y `AGENTS.md`.
> Fecha de corte: 2026-10-20. Estado: Fase 1 en producción, en pruebas con datos reales (~90 %).

---

## 1. Qué es

Aplicación web en español, móvil primero, para controlar los **tiquetes de báscula de entrega de fruta de palma de aceite** y llevar la **cuenta de cada comprador como un banco**:
- **Anticipos confirmados suman** al saldo del comprador.
- **Cada tiquete aprobado con precio descuenta** (toneladas netas × precio por tonelada).
- **Saldo = anticipos confirmados − valor de tiquetes vigentes con precio.** Positivo: el comprador tiene fondos. Negativo: se le debe.

Problema que resuelve: los tiquetes son físicos y se podían pagar dos veces. La app evita duplicados (extractora + número de tiquete) y deja control de lo entregado, pagado y pendiente.

Especificación original: `docs/especificacion.pdf` (fuente de verdad del negocio; varias decisiones posteriores la modificaron, ver sección 9).

## 2. Personas y roles

- **Administradores** (mismos permisos): Christian Soriano (usuario `christian`, celular 3182542939, christiansorianob@gmail.com) e Ingrid (usuario `ingrid`). Ven todo, aprueban/rechazan, fijan precios, registran anticipos, enseñan extractoras.
- **Compradores** (intermediarios, sin límite): solo ven lo suyo. Usuario de prueba: `prueba`.
- Ingreso con **usuario y contraseña**. Supabase Auth usa el correo interno `<usuario>@bancoticket.local`; el correo real va en `perfiles.correo`.

## 3. Dónde está todo

| Qué | Dónde |
|---|---|
| Código local | `C:\PROYECTOS WEB\BANCOTICKET` (Windows, ruta con espacio: usar comillas) |
| GitHub (privado) | https://github.com/christiansorianob-lgtm/BancoTicket — rama `main` |
| Producción | https://bancoticket.vercel.app (Vercel, equipo «Christian Alexander's projects», proyecto `bancoticket`, plan Hobby) |
| Despliegue | Cada push a `main` despliega solo (GitHub conectado a Vercel). CLI `vercel` con sesión iniciada (christiansorianob-3056) |
| Base de datos | Supabase creado desde Vercel Storage (plan gratis, Washington). Vercel inyecta sus variables |
| IA | Anthropic API, clave `ANTHROPIC_API_KEY` en Vercel (tipo Secret, no se puede bajar a local) |

## 4. Pila

- **Next.js 16.4** (App Router, TypeScript, Turbopack). ⚠️ Versión nueva: `middleware` se llama `proxy` (`src/proxy.ts`); hay que leer `node_modules/next/dist/docs/` antes de usar APIs que no conozcas. **`cacheComponents` está desactivado** a propósito (casi todo depende de la sesión).
- **Tailwind 4** con loader `@tailwindcss/turbopack`. Las clases propias (`tarjeta`, `boton-primario`, `campo`, `etiqueta`, `titulo`…) son `@utility` en `src/app/globals.css`. Paleta de azules como variables CSS.
- **Supabase** (Postgres + Auth + Storage) con `@supabase/ssr`. RLS en todas las tablas.
- **Anthropic SDK** `@anthropic-ai/sdk`:
  - Lectura de tiquetes: `claude-haiku-5-5`, `messages.parse` con `zodOutputFormat`, effort `medium` (`src/lib/lectura/lector-ia.ts`).
  - Aprender formatos de extractora: `claude-opus-5-5`, `beta.messages.parse` con `betaZodOutputFormat`, `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`, effort `medium` (`src/lib/lectura/aprender.ts`).
- Avisos: **solo WhatsApp** (en celular `whatsapp://send?...` abre la app; en computador `wa.me`) + aviso interno en la campana. Sin correo.

## 5. Estructura de código (lo importante)

```
src/proxy.ts                         sesión Supabase + redirección a /ingresar; aviso si faltan variables
src/lib/supabase/{servidor,admin,cliente}.ts   cliente con sesión (RLS) / service_role / navegador
src/lib/sesion.ts                    perfilActual, exigirAdmin, exigirComprador, correoInterno
src/lib/fechas.ts                    America/Bogota, es-CO, interpretarFechaTiquete (formatos reales)
src/lib/numeros.ts                   kilosDesdeTexto ("2,070"/"26.500"/"10680"), formatoPesos/Toneladas
src/lib/mensajes.ts                  detalleTiquete() para WhatsApp (extractora, N°, fecha, proveedor, neto, placa, conductor)
src/lib/whatsapp.ts / components/contacto.tsx   enlaces wa.me y whatsapp://, AvisoContacto (abre WhatsApp solo)
src/lib/avisos.ts                    avisar() = notificación en la campana; contactoAdministracion() = celular del admin más antiguo
src/lib/camara/analisis.ts           análisis en vivo (luz, quieto, enfoque, texto impreso) y revisión de la foto final
src/lib/imagen.ts                    reducir foto (2000 px, WebP/JPEG ≤ 500 KB)
src/lib/lectura/
  tipos.ts                           esquema Zod LecturaCruda, LectorTiquete, ExtractoraParaLeer
  lector-ia.ts                       lectura con Haiku (detecta extractora + lee campos + campos_dudosos)
  controles.ts                       bruto=mayor, tara=menor, neto impreso, fecha, placa (5–7 alfanum.), dudosos
  firma.ts                           HMAC de la lectura: el comprador no puede alterar datos (FIRMA_LECTURA_SECRETO)
  aprender.ts / aprender-guardar.ts  aprender extractora+formato desde una foto (Opus), guardar, NIT base 9 dígitos
  consumo.ts                         registra tokens y costo de cada llamada en consumo_ia
src/app/api/leer-tiquete/route.ts    comprador sube foto → IA → controles → duplicados → lectura firmada
src/app/api/aprender-formato/route.ts admin sube foto de ejemplo → aprende extractora/formato
src/app/api/cron/limpiar-fotos       borra fotos > 6 meses (vercel.json, diario; usa CRON_SECRET)
src/app/(app)/subir/                 cámara guiada pantalla completa, foto automática, galería, confirmación
src/app/(app)/{mis-tiquetes,anticipos,extracto,avisos}   comprador
src/app/(app)/anticipo/[codigo]/     confirmar anticipo por enlace (y componente ResponderAnticipo reutilizado)
src/app/(app)/admin/                 saldos+consumo IA, pendientes, tiquetes y precios, anticipos, compradores,
                                     extractoras (enseñar con foto), formatos no reconocidos, historial
src/app/(app)/admin/acciones.ts      server actions del admin (aprobar, rechazar, precios, anticipos, usuarios, extractoras)
scripts/                             aplicar-sql, crear-admin, perfil-admin, prueba-lectura (npm run prueba),
                                     vaciar-datos, vaciar-tiquetes, vaciar-pruebas
docs/                                ARQUITECTURA.md (decisiones), NOTAS.md (bitácora), DESPLIEGUE.md, especificacion.pdf
```

## 6. Base de datos (migraciones aplicadas: 0001 a 0005)

**Nunca editar una migración ya aplicada; crear la siguiente (`0006_...sql`) y aplicarla con:**
```
node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/0006_nombre.sql
```
(corre en una transacción; usa `POSTGRES_URL_NON_POOLING` de `.env.local`).

Tablas:
- `perfiles` (1:1 con auth.users): nombre, usuario, celular, correo, rol `admin|comprador`, activo.
- `extractoras`: nombre (interno, editable), activa, `nit`, `nombres_impresos text[]` (índice único por 9 dígitos del NIT).
- `formatos_extractora`: varios por extractora; `plantilla jsonb` aprendida por la IA, descripcion, imagen_ruta (ejemplo en `formatos/`).
- `anticipos`: comprador, monto, fecha, nota, estado `pendiente|confirmado|en_disputa`, enlace (hash, vence 48 h, un uso). Columna `tipo` existe pero ya no se usa (siempre `anticipo`).
- `tiquetes_pendientes` (provisional) y `tiquetes` (aprobados): extractora, numero, comprador, fecha_entrada, peso_bruto_kg, tara_kg (enteros), neto_impreso_kg, placa, conductor, **proveedor**, bascula, imagen_ruta, origen `camara|galeria`. Pendientes: requiere_revision, motivo_revision, estado `pendiente|rechazado`, motivo_rechazo. Aprobados: `peso_neto_t` y `valor` **calculados**, precio_tonelada, estado `vigente|anulado`.
- `historial` (disparadores en todas las tablas de negocio; motivo con `fijar_contexto(accion, motivo)`).
- `formatos_no_reconocidos`: lecturas fallidas enviadas a revisión (extractora puede ser null).
- `notificaciones` (campana), `configuracion` (valores pendientes de decisión), `consumo_ia` (tokens y costo por llamada).
- Vistas `saldos` y `extracto` (security_invoker). Bucket privado `tiquetes`: `<comprador_id>/...` y `formatos/...`.

Funciones SQL clave: `registrar_pendiente` (solo service_role), `aprobar_tiquete`, `rechazar_tiquete`, `asignar_precio_bloque`, `editar_tiquete`, `editar_pendiente`, `generar_enlace_anticipo`, `ver_anticipo_por_enlace`, `responder_anticipo` (por enlace), `responder_anticipo_id` (desde la app), `buscar_duplicado`, `posibles_duplicados`, `es_admin`.

## 7. Flujos actuales

**Comprador sube un tiquete**
1. «Subir tiquete» abre la **cámara a pantalla completa** (no elige extractora). Marco que ocupa casi toda la pantalla; botón de galería y «Usar cámara normal».
2. En vivo, en el celular y sin IA: **bloquean** texto impreso (`textoMin 0,15`), luz, quietud (`movimientoMax 10`) y enfoque (`nitidezMin 120` a 640 px); distancia, encuadre y reflejos son solo consejos. Con 3 cuadros en verde, **la foto se toma sola**.
3. Revisión final en el celular: la foto (del sensor, recortada al marco) debe parecer documento y tener nitidez ≥ 200 a 1000 px; si no, reintenta sola. La galería pasa por las mismas revisiones. **No se gira la foto** (la regla automática fallaba).
4. Servidor: la IA (Haiku) recibe la foto + todas las extractoras activas (NIT, nombres impresos, plantillas). Detecta la extractora (**primero por NIT**, luego por nombre) y lee los campos. Controles + duplicados. Si la IA duda de algún carácter → se puede enviar pero queda **«Verificar: …»** para el admin.
5. El comprador ve los datos solo lectura → «Coincide, enviar» → se abre WhatsApp al admin con el detalle y la pantalla **vuelve a «Subir tiquete»**.
6. Si no se reconoce la extractora o falla la lectura → «Tomar otra foto» o «Enviar a revisión» (va a «Formatos no reconocidos»).

**Administrador**
- **Pendientes**: aprobar / rechazar con motivo / corregir datos. Abre WhatsApp al comprador con el detalle.
- **Tiquetes y precios**: filtros por fechas (de entrada), extractora, comprador; precio en bloque o individual; editar cualquier dato con motivo; anular.
- **Anticipos**: registrar → genera enlace → WhatsApp al comprador. El comprador confirma **por el enlace o desde su app** («Anticipos» / «Revisar y confirmar» en inicio).
- **Extractoras**: «Enseñar un tiquete»: sube una foto → la IA (Opus) valida que sea tiquete, identifica la extractora (NIT, razón social), le pone nombre (editable), aprende el formato. Varios formatos por extractora. Se puede eliminar un formato.
- **Formatos no reconocidos**: «Aprender este formato» con la misma foto + registrar el tiquete a mano.
- **Panel**: saldos, indicadores y **«Consumo de IA este mes»**.

## 8. Extractoras aprendidas (en la base hoy)

| Nombre en la app | NIT | Nota |
|---|---|---|
| Babú Palm | 901249632 | número en rojo «N° Tiquete» |
| Palnorte | 900486803-8 | «ENTRADA DE MATERIA PRIMA No.», coma de miles, hora en columna aparte |
| Oleoflores | 8901021101 | **número = GUÍA TRANSPORTE VEHICULO**; el CODIGO INTERNO identifica al proveedor (ignorar) |
| Agrovaspalma | 901.666.764-5 | el usuario la llama **NodoLa4** (puede renombrarla; se reconoce por NIT) |
| Lukeoil | (sin NIT) | Extractora Lukeoil SAS ZOMAC; papel térmico, suele venir girado |

## 9. Decisiones del usuario (no revertir sin consultar)

- El comprador **no elige extractora**: solo toma la foto; la IA la detecta.
- Las extractoras se **aprenden con una foto** (sin JSON manual); pueden tener **varios formatos** con el mismo nombre.
- **Duplicados = extractora + número** (no incluir proveedor).
- **Solo anticipos** (se quitó el tipo «Pago»); el saldo es la resta.
- La **galería no fuerza revisión**; se marca para verificar solo si la IA duda de algún dato.
- **Solo WhatsApp** (se quitaron Brevo y el correo `mailto:`). En celular abre la app de WhatsApp, no WhatsApp Web.
- Tras enviar un tiquete, **volver a «Subir tiquete»**.
- **Consumo de IA crítico**: cualquier cambio que agregue llamadas o tokens de IA **se consulta antes**. Cada llamada se registra en `consumo_ia`. Costo estimado: lectura ≈ US$0,001; aprender un formato ≈ US$0,05–0,10.
- Campo **proveedor** obligatorio en el sistema (opcional en el papel).

## 10. Variables de entorno

En Vercel (Production/Preview, y Development para las de Supabase): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING` (y demás de la integración), `ANTHROPIC_API_KEY` (Secret), `FIRMA_LECTURA_SECRETO`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL=https://bancoticket.vercel.app`.
Local: `.env.local` (en .gitignore) tiene todo **menos `ANTHROPIC_API_KEY`**, así que la lectura con IA solo se prueba en producción. Bajar variables: `vercel env pull .env.local --environment=development` (y volver a agregar al final FIRMA_LECTURA_SECRETO, CRON_SECRET, NEXT_PUBLIC_APP_URL).

## 11. Cómo trabajar

- Verificar siempre antes de subir: `npx tsc --noEmit -p .`, `npx eslint src`, `npm run prueba` (pruebas de números/fechas/controles con formatos reales).
- Subir: commit en español con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `git push origin main`, y revisar `vercel ls bancoticket` hasta «Ready».
- Probar cambios de base con transacciones que se deshacen (patrón usado: script temporal con `pg`, `begin`… `rollback`, y `set_config('request.jwt.claims', …)` para actuar como un usuario).
- Datos de prueba: `node --env-file=.env.local scripts/vaciar-pruebas.mjs --si` borra tiquetes, anticipos, avisos, historial y fotos de compradores (conserva usuarios, extractoras aprendidas y consumo IA). `vaciar-tiquetes.mjs` borra solo tiquetes; `vaciar-datos.mjs` borra también extractoras.
- El usuario prueba en su celular y manda capturas. Explicar en español sencillo, paso a paso cuando sea configuración.
- Registrar decisiones en `docs/NOTAS.md` (bitácora) y cambios de diseño en `docs/ARQUITECTURA.md`.

## 12. Pendientes y cosas a vigilar

- **Fase 2 (no iniciada)**: reportes y exportación a Excel/PDF de extractos y tiquetes.
- **WhatsApp del comprador al admin** va al administrador más antiguo (Christian). Quedó sin responder si prefieren que el comprador elija entre los dos administradores.
- **Lukeoil sin NIT**: enseñar otro tiquete donde se vea el NIT de la extractora.
- **Renombrar Agrovaspalma → NodoLa4** si el usuario lo quiere (Extractoras → Editar).
- **Umbrales de cámara** calibrados con pocas fotos; ajustar en `src/lib/camara/analisis.ts` (`UMBRALES`) si en la práctica cuesta tomar la foto.
- **Fotos huérfanas**: si un comprador lee un tiquete y no lo envía, la foto queda en Storage. Podría agregarse limpieza (sin IA).
- Preguntas abiertas de la especificación: si la evaluación de calidad impresa cambia peso o precio; vigencia del enlace de anticipo (48 h por defecto en `configuracion`); si el comprador ve toneladas sin precio (sí, por defecto).
- Seguridad: confirmar que en Supabase está desactivado «Allow new users to sign up» y que se eliminó la clave de Anthropic que apareció en una captura (`christian-api-key`). `CRON_SECRET` aparece como «Needs Attention» en Vercel (sugiere marcarlo Sensitive).
- La cuenta de Anthropic tiene saldo prepagado; revisar que la recarga automática quedó como el usuario quiso.
