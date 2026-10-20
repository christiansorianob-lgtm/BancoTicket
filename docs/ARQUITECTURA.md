# BancoTicket — Propuesta de arquitectura

Fecha: 2026-10-15. Basada en el documento «Sistema de Control de Tiquetes y Cuentas de Compradores – Fruta de Palma» (secciones 2 a 12). Esta propuesta se revisa antes de escribir código de la aplicación.

## 1. Pila

| Pieza | Elección | Motivo |
|---|---|---|
| Aplicación | Next.js (App Router, TypeScript), Tailwind CSS 4, lucide-react | Misma pila que ACOPIOLACUATRO; responsiva y móvil primero |
| Base de datos, login y archivos | Supabase (Postgres + Auth + Storage), capa gratuita | Unicidad en base de datos y reglas de seguridad por fila (RLS) |
| Cliente Supabase en Next | `@supabase/ssr` (cookies) | La sesión funciona en páginas de servidor y en rutas API |
| Lectura de tiquetes | Ruta de servidor `/api/leer-tiquete` → Claude Haiku 5.5 con salida estructurada | La clave nunca llega al navegador; el proveedor queda detrás de una interfaz `LectorTiquete` |
| Alternativa de lectura | Tesseract.js + plantilla por extractora (fase 2) | Configurable con `LECTOR_TIQUETES=ia|ocr` |
| Correo automático | Ver sección 5 (depende de si hay dominio propio) | — |
| WhatsApp | Enlace `https://wa.me/57<celular>?text=...` | Gratis; no se usa la API de Meta |
| Exportación (fase 2) | `xlsx` para Excel, impresión del navegador para PDF | Ya usado en ACOPIOLACUATRO |
| Alojamiento | Vercel Hobby, conectado al repositorio privado de GitHub | Push a `main` = producción; ramas = vista previa |

Zona horaria: todas las fechas se guardan en UTC (`timestamptz`) y se muestran con `America/Bogota` y `es-CO`, igual que en ACOPIOLACUATRO, centralizado en `src/lib/fechas.ts`.

## 2. Estructura de carpetas

```
BANCOTICKET/
├─ CLAUDE.md                     guía para Claude en este repo
├─ docs/                         especificación, arquitectura, notas de desarrollo
├─ tiquetes-ejemplo/             fotos reales de prueba (en .gitignore)
├─ supabase/migrations/          SQL versionado (esquema, RLS, funciones)
└─ src/
   ├─ app/
   │  ├─ (auth)/ingresar         inicio de sesión
   │  ├─ (comprador)/            inicio, subir tiquete (cámara), mis tiquetes, extracto, anticipos
   │  ├─ (admin)/                pendientes, tiquetes, precios, anticipos, compradores,
   │  │                          extractoras, plantillas, historial
   │  ├─ anticipo/[token]        confirmación de anticipo (exige sesión)
   │  └─ api/                    leer-tiquete, correo, usuarios (alta con service role)
   ├─ components/                UI compartida (tabla→tarjetas, semáforo, botón WhatsApp)
   ├─ lib/
   │  ├─ supabase/               clientes navegador/servidor/admin
   │  ├─ lectura/                interfaz LectorTiquete, lector IA, lector OCR, controles
   │  ├─ numeros.ts              "2,070" / "26.500" / "10680" → kilos enteros
   │  ├─ fechas.ts               fechas de tiquete (dd/mm/aaaa, "27 de julio de 2026"...) y Bogotá
   │  ├─ camara/                 análisis en vivo: enfoque, luz, reflejos, encuadre
   │  └─ imagen.ts               reducción a ~1280 px WebP/JPEG (80–150 KB)
   └─ middleware.ts              refresca sesión y separa rutas por rol
```

## 3. Modelo de datos

Detalle completo en [`supabase/migrations/0001_esquema.sql`](../supabase/migrations/0001_esquema.sql).

| Tabla | Para qué |
|---|---|
| `perfiles` | Usuario de la app (1:1 con `auth.users`): nombre, usuario, celular, correo, rol, activo |
| `extractoras` | Nombre, activa, `plantilla` (jsonb: sinónimos, formato de fecha y números) |
| `anticipos` | Monto, fecha, nota, estado (pendiente/confirmado/en disputa) y enlace de confirmación (hash del código, vencimiento, uso) |
| `tiquetes_pendientes` | Tabla provisional: datos leídos, foto, origen (cámara/galería), marca de revisión, estado (pendiente/rechazado) |
| `tiquetes` | Tabla principal: aprobados, con precio por tonelada y valor calculado; estado vigente/anulado |
| `historial` | Quién, cuándo, tabla, registro, acción, valor anterior, valor nuevo, motivo |
| `formatos_no_reconocidos` | Cola de lecturas fallidas: foto, texto leído, estado |
| `notificaciones` | Avisos dentro de la app |
| vista `saldos` | Anticipos confirmados − valores de tiquetes vigentes con precio (no se guarda) |

Decisiones clave:

- **Pesos en kilos enteros** (`peso_bruto_kg`, `tara_kg`); el peso neto en toneladas es una columna calculada `numeric` (kilos / 1000), así no se pierden decimales.
- **Valor** = `round(peso_neto_t × precio_tonelada, 2)`, columna calculada; vacía mientras no hay precio.
- **Unicidad extractora + número**: restricción única en cada tabla y un disparador con bloqueo que revisa la otra tabla, para que nunca coexistan en pendientes y aprobados.
- **Aprobar** es una función `aprobar_tiquete()` que mueve el registro en una sola transacción.
- **Historial** por disparadores genéricos: nada se cambia sin quedar registrado; el motivo se pasa en las funciones con `set_config('app.motivo', ...)`.
- **Enlace de anticipo**: se guarda solo el hash del código; un solo uso; vence a las 48 h por defecto (configurable).

## 4. Seguridad (RLS)

- Función `es_admin()` (security definer) usada por todas las políticas.
- Comprador: lee solo sus filas en `anticipos`, `tiquetes_pendientes`, `tiquetes`, `notificaciones` y su perfil; **no inserta tiquetes directamente**: la ruta `/api/leer-tiquete` devuelve los datos leídos firmados (HMAC) y `/api/tiquetes` verifica esa firma antes de guardar, así nadie puede mandar pesos escritos a mano saltándose la app; elimina solo sus tiquetes **rechazados**; confirma anticipos solo con la función `responder_anticipo()`, que exige sesión del mismo comprador.
- Administrador: todo. Hay **un solo administrador activo** (Ingrid) y es quien recibe los avisos y los WhatsApp de los compradores.
- Desarrollador: **uno solo** (Christian). Mismos permisos del administrador (`es_admin()` acepta los dos roles), pero no recibe avisos de compradores. El rol no se asigna ni se quita desde la app (índice único `perfiles_un_rol_unico`, migraciones 0006–0007).
- Storage: bucket privado `tiquetes`, ruta `<id_comprador>/<uuid>.webp`; el comprador sube y ve solo su carpeta; el admin ve todo. Las fotos se muestran con URL firmada de corta duración.
- La clave `service_role` y la de la API de lectura solo existen como variables de entorno del servidor en Vercel.

## 5. Límites de las capas gratuitas (a confirmar en las páginas oficiales)

| Servicio | Cupo de referencia | Cómo se cubre |
|---|---|---|
| Supabase Free | 500 MB base de datos, 1 GB archivos; el proyecto se pausa tras ~1 semana sin actividad | Fotos de ~100 KB y borrado a los 6 meses (0,5–0,8 GB). Con 10 compradores el uso diario evita la pausa |
| Vercel Hobby | Uso personal, sin fines comerciales; topes de funciones y ancho de banda | Volumen bajo (≈200 tiquetes/semana) |
| Claude Haiku 5.5 | Pago por uso; estimado ~US$5/año | Límite de gasto mensual en la consola de Anthropic |
| Resend Free | ~3.000 correos/mes, máx. 100/día; **exige dominio verificado** para enviar a cualquier destinatario | Recomendado si hay dominio propio |
| Brevo Free | ~300 correos/día | Alternativa sin dominio propio (remitente verificado por correo); falta confirmar en su documentación |

Volumen esperado de correos: ~200 tiquetes/semana × 2–3 eventos × 2 destinatarios ≈ 170 correos/día en semana alta → **supera los 100/día de Resend Free**. Propuesta: el administrador recibe un **resumen** en lugar de un correo por tiquete subido, o usar Brevo (300/día).

Borrado de fotos a los 6 meses: tarea programada (Vercel Cron diario, permitido en Hobby) que borra los archivos y deja `imagen_ruta = null`.

## 6. Lectura del tiquete

1. Cámara en la página (`getUserMedia`) con análisis en vivo en un `<canvas>`: nitidez (varianza del laplaciano), brillo medio, porcentaje de píxeles saturados (reflejos), detección de bordes del papel (encuadre/distancia). Semáforo rojo/verde y botón de captura habilitado solo en verde.
2. La foto se reduce en el navegador y se envía a `/api/leer-tiquete` con la extractora elegida.
3. El servidor pide a Claude Haiku 5.5 los campos estándar (número, fecha, bruto, tara, neto impreso, placa, conductor, báscula, rotación) en JSON estructurado, con la plantilla de la extractora como pista.
4. Controles: bruto = mayor, tara = menor, bruto − tara = neto impreso, neto > 0, fecha válida, número presente, placa con formato válido. Aviso extra de posible duplicado por placa + hora de entrada.
5. Si todo cuadra: modo lectura → «Coincide, enviar» / «No coincide, tomar otra foto». Si falla: «Formato no reconocido», pasa a revisión del administrador.

## 7. Fases

- **Fase 1**: acceso por rol, cámara guiada, lectura y confirmación, unicidad, tabla provisional con aprobación, anticipos con confirmación, precio en bloque y por tiquete, saldo y extracto, historial, botón WhatsApp, correos automáticos, imágenes eficientes.
- **Fase 2**: reportes y exportación Excel/PDF, plantillas de OCR gratuito y mejoras de lectura.

## 8. Valores configurables (pendientes del documento)

Se guardan en la tabla `configuracion` para no inventar respuestas:

| Clave | Valor por defecto |
|---|---|
| `fecha_filtro_precio` | `entrada` |
| `vigencia_enlace_anticipo_horas` | `48` |
| `comprador_ve_toneladas_sin_precio` | `true` |
| `placa_obligatoria` | `true` |
| `meses_conservacion_fotos` | `6` |

## 9. Decisiones tomadas (2026-10-15)

| Tema | Decisión |
|---|---|
| Correo automático | **Brevo**, capa gratuita (~300/día), remitente verificado sin dominio propio. Confirmar en la documentación de Brevo antes de activarlo |
| Lectura de tiquetes | **Claude Haiku 5.5 lee todos los tiquetes**; OCR gratuito con plantillas queda para fase 2 |
| Ingreso | **Usuario y contraseña** creados por el administrador (Supabase Auth con correo interno `<usuario>@bancoticket.local`; el correo real del perfil se usa para avisos) |
| Pagos al comprador | **Movimiento aparte «Pago»** (`anticipos.tipo = 'pago'`): suma al saldo y se confirma con enlace igual que un anticipo |

Siguen pendientes (con valor por defecto en `configuracion`): número de tiquete de Oleoflores, nombre exacto de «Lukeoil», efecto de la evaluación de calidad, fecha para filtros de precio (entrada), vigencia del enlace (48 h), si el comprador ve toneladas sin precio (sí), quién crea extractoras (admin) y si la placa es obligatoria (sí).

### Cambio (2026-10-16)
Las fotos subidas por galería **ya no** quedan marcadas para revisión. La marca de revisión la pone solo la lectura: cuando la IA reporta campos con algún carácter dudoso (`campos_dudosos`) o la placa tiene un formato inusual. Los controles duros (número, fecha, pesos, bruto − tara = neto impreso) siguen pidiendo repetir la foto o enviar a revisión manual.

### Cambio (2026-10-16): sin tipo «Pago»
Todo dinero entregado al comprador se registra como **anticipo**; el saldo es la resta (anticipos confirmados − valor de tiquetes). Positivo: el comprador tiene fondos; negativo: se le debe. La columna `anticipos.tipo` queda en la base con valor `anticipo` por defecto, sin uso en la app.

### Cambio (2026-10-17): avisos desde el dispositivo
No hay correo automático (se retiró Brevo). Tras cada acción que avisa a otra persona, la app abre **WhatsApp** con el mensaje escrito y, al volver, el **correo predeterminado del dispositivo** (`mailto:`) con asunto y cuerpo listos; quedan botones de respaldo. El comprador escribe por WhatsApp al administrador más antiguo y por correo a todos los administradores. El aviso dentro de la app (campana) se mantiene.

### Cambio (2026-10-20): el comprador no elige la extractora
Al entrar a «Subir» se abre la cámara de una vez. La IA recibe la lista de extractoras activas con sus plantillas, identifica la extractora por logo y encabezado (`extractora`, nombre exacto de la lista) y lee con la plantilla de esa extractora. El comprador ve la extractora detectada al confirmar. Si no se reconoce, la foto puede ir a «Formatos no reconocidos» con `extractora_id` nulo y el administrador la elige al registrarla.

### Cambio (2026-10-20): extractoras aprendidas desde una foto
El administrador ya no escribe plantillas. En «Extractoras» sube la foto de un tiquete y la IA (Claude Opus 5.5, con respaldo de modelo) valida que sea un tiquete, identifica la extractora (NIT, razón social, nombres impresos) y aprende el formato. Una extractora puede tener varios formatos (`formatos_extractora`, migración 0003). La lectura del comprador reconoce la extractora primero por NIT (9 dígitos base) y luego por el nombre que devuelve la IA. Desde «Formatos no reconocidos» se puede aprender un formato con la misma foto.

### Cambio (2026-10-20): solo WhatsApp
El correo con `mailto:` no abría el cliente de correo en los dispositivos de prueba; por decisión del usuario se quitó. Tras cada acción que avisa a otra persona solo se abre WhatsApp con el mensaje listo (más el aviso dentro de la app).
