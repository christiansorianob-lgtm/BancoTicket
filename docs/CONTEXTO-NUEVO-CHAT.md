# BancoTicket — contexto para continuar en un chat nuevo de Claude Code

> **Cómo usarlo:** abre el chat nuevo **en la carpeta `C:\PROYECTOS WEB\BANCOTICKET`** (así carga `CLAUDE.md` y `AGENTS.md`) y pega este archivo completo como primer mensaje, o escribe: «Lee `docs/CONTEXTO-NUEVO-CHAT.md` y continuemos».
> **Fecha de corte:** 2026-10-21. **Estado:** Fase 1 terminada y **en producción** (el 21-oct se dejó la base en blanco de tiquetes para empezar a operar). Fase 2 iniciada (Reportes + Excel + Backups).
> La bitácora completa de decisiones está en `docs/NOTAS.md` (lo más reciente arriba).

---

## 1. Qué es

App web en español, **móvil primero**, para controlar los **tiquetes de báscula de entrega de fruta de palma de aceite** y llevar la **cuenta de cada comprador como un banco**:
- **Anticipos confirmados suman** al saldo del comprador. Pueden ser **negativos** (dinero que la administración le debe al comprador, ej. saldo inicial).
- **Cada tiquete aprobado con precio descuenta**: **peso neto IMPRESO** (toneladas) × precio por tonelada.
- **Saldo = anticipos confirmados − valor de tiquetes vigentes con precio.** No se guarda: se calcula (vista `saldos`).
- Palabras del estado de cuenta (`src/lib/saldo.ts`): administración **«Saldo a mi favor»** (saldo > 0) / **«Le debo»** (saldo < 0); comprador **«Debo»** / **«Me deben»**; 0 = «Cuenta al día».

Problema que resuelve: los tiquetes son físicos y se podían pagar dos veces. La app evita duplicados (**extractora + número**) y deja control de lo entregado, pagado y pendiente. Especificación original: `docs/especificacion.pdf` (varias decisiones posteriores la cambiaron; ver §9).

## 2. Personas, roles y acceso

| Rol | Quién | Puede |
|---|---|---|
| **Administrador** (uno solo, la base lo impide de otro modo) | Ingrid (`ingrid`) | Todo: aprobar/rechazar, precios, anticipos, extractoras, reportes. **Recibe los avisos de los compradores** (campana). |
| **Desarrollador** (uno solo) | Christian Soriano (`christian`, cel. 3182542939, christiansorianob@gmail.com) | Lo mismo que el admin + **Contraseñas** (`/admin/claves`) y **Backups** (`/admin/backups`). No recibe avisos de compradores. El rol no se asigna desde la app. |
| **Compradores** (varios) | `prueba` (de prueba), `yudidj` (real) | Solo lo suyo: subir tiquetes, ver sus tiquetes, anticipos y extracto. |
| **Consultor** (varios) | los crea la administradora | **Solo ve, no modifica nada** (lo garantiza la base, migración 0018): sección `/consulta` con saldos de todos, cuenta y extracto de cada comprador, Reportes (sin editar/eliminar; fotos y Excel sí) y anticipos con soportes. |

- Ingreso con **usuario y contraseña** (Supabase Auth con correo interno `<usuario>@bancoticket.local`). El **correo real es opcional** (`perfiles.correo`).
- **Contraseñas:** usuario nuevo o restablecido queda con **12345678**; puede seguir trabajando con ella (no se obliga a cambiarla). Cada uno la cambia con la **llave 🔑** del encabezado (`/clave`). «Olvidé mi contraseña» (`/ingresar/olvide`) → solicitud → el desarrollador la aprueba en «Contraseñas».
- Encabezado de **todos los perfiles**: botón **↻ refrescar**, campana de avisos, llave y salir. El **menú resalta la sección abierta** (`EnlaceMenu`).

## 3. Dónde está todo

| Qué | Dónde |
|---|---|
| Código local | `C:\PROYECTOS WEB\BANCOTICKET` (Windows, ruta con espacio: usar comillas) |
| GitHub (privado) | https://github.com/christiansorianob-lgtm/BancoTicket — rama `main` |
| Producción | https://bancoticket.vercel.app (Vercel, equipo `christian-alexanders-projects-b132b23e`, proyecto `bancoticket` id `prj_iejWvEPXl3XhpggwnXzNNz7SzEOC`, plan Hobby) |
| Despliegue | Cada push a `main` despliega solo, **pero a veces llega con mucho retraso**. Por eso se viene desplegando a mano con el MCP de Vercel: `create_deployment` con `gitSource {type:"github", org:"christiansorianob-lgtm", repo:"BancoTicket", ref:"main"}`, `target:"production"`, slug del equipo; luego `vercel ls bancoticket` hasta «Ready». **No** usar `vercel --prod` local (subiría `.env.local` y `tiquetes-ejemplo/`). |
| Base de datos | Supabase creado desde Vercel Storage (plan gratis, Washington). |
| IA | Anthropic API (`ANTHROPIC_API_KEY` solo en Vercel, tipo Secret). Saldo prepagado en la consola (≈ US$ 9,56 el 21-oct). |
| Registros del servidor | Vercel runtime logs (Hobby guarda **1 hora**). Cada lectura escribe `console.info("lectura", {...})` con extractora, número, proveedor, pesos, `dudosos` y `observaciones` de la IA (sin conductor ni cédulas): sirve para diagnosticar por qué la IA marcó algo. Se consulta con el MCP de Vercel `get_runtime_logs` (query `lectura`, `since: "30m"`). |

## 4. Pila

- **Next.js 16.4** (App Router, TypeScript, Turbopack). ⚠️ `middleware` se llama **`proxy`** (`src/proxy.ts`); leer `node_modules/next/dist/docs/` antes de usar APIs nuevas. `cacheComponents` desactivado a propósito. Tras crear una página nueva correr `npx next typegen` (tipos `PageProps<"/ruta">`).
- **Tailwind 4** (`@tailwindcss/turbopack`); clases propias `tarjeta`, `boton-primario`, `boton-secundario`, `boton-peligro`, `boton-whatsapp`, `campo`, `etiqueta`, `titulo` como `@utility` en `src/app/globals.css`.
- **Supabase** (Postgres + Auth + Storage) con `@supabase/ssr`; RLS en todas las tablas.
- **Anthropic SDK** — **la IA se usa SOLO para leer tiquetes** (decisión del usuario):
  - Lectura: `claude-haiku-5-5`, `messages.parse` + `zodOutputFormat`, effort `medium` (`src/lib/lectura/lector-ia.ts`).
  - Aprender formato de extractora (solo admin, a pedido): `claude-opus-5-5`, `beta.messages.parse`, `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"` (`src/lib/lectura/aprender.ts`).
- **sharp** (servidor: revisión de nitidez de la foto antes de la IA) y **exceljs 4.4.0** (Excel de Reportes y Backups).

## 5. Estructura de código (lo importante)

```
src/proxy.ts                          sesión Supabase + redirección a /ingresar (/ingresar/* es público)
src/lib/supabase/{servidor,admin,cliente}.ts   con sesión (RLS) / service_role / navegador
src/lib/sesion.ts                     Perfil, Rol, NOMBRE_ROL, esGestor, exigirAdmin/Desarrollador/Comprador, correoInterno
src/lib/fechas.ts                     America/Bogota, es-CO, interpretarFechaTiquete (formatos reales)
src/lib/numeros.ts                    kilosDesdeTexto, montoDesdeTexto({negativo}), netoKg (neto impreso o bruto−tara), formatos
src/lib/saldo.ts                      textoSaldo/lineaSaldo (palabras del estado de cuenta), describirAnticipo
src/lib/claves.ts                     CLAVE_POR_DEFECTO = "12345678", revisarClaveNueva
src/lib/mensajes.ts                   textoAvisoResta (aviso bruto − tara ≠ neto al corregir)
src/lib/avisos.ts                     avisar() (campana), administradores(), desarrolladores(), contactoAdministracion()
src/lib/whatsapp.ts + components/contacto.tsx   enlaces wa.me / whatsapp://; AvisoContacto = SOLO un botón (no abre solo)
src/lib/camara/analisis.ts            cámara en vivo (luz, quieto, enfoque, texto impreso) + nitidez de la foto final
src/lib/camara/nitidez.ts             varianza del laplaciano compartida navegador/servidor
src/lib/camara/revisar-foto.ts        servidor: nitidez con sharp antes de la IA
src/lib/imagen.ts                     reducirImagen (2000 px, WebP/JPEG ≤ 500 KB)
src/lib/lectura/
  tipos.ts                            esquema Zod LecturaCruda (campos_dudosos: numero, fecha, bruto, tara, neto, placa, proveedor, conductor, bascula)
  lector-ia.ts                        instrucción de lectura (ver §7) + registro de consumo
  controles.ts                        reglas de aceptación (críticos, dudosos, 6 meses) — MESES_MAXIMOS
  firma.ts                            HMAC de la lectura (el comprador no puede alterar datos)
  aprender.ts / aprender-guardar.ts   aprender extractora+formato (quita «Verificar que bruto − tara = neto» de las notas)
  consumo.ts                          tokens y costo por llamada en consumo_ia
src/lib/informes/consulta.ts          consulta de Reportes (filtros) compartida por la tabla y el Excel
src/lib/informes/tiquetes-excel.ts    Excel ejecutivo de Reportes
src/lib/informes/backup-excel.ts      backup: una hoja por tabla + Resumen
src/lib/informes/movimientos.ts       reporte «Tiquetes y anticipos»: orden y saldo acumulado (puro, probado en npm run prueba)
src/lib/informes/cuenta.ts · cuenta-excel.ts   su consulta y su Excel (ruta /api/exportar/cuenta)
src/components/marco.tsx              encabezado, menús (admin arriba, comprador abajo), EnlaceMenu, BotonRefrescar
src/components/{saldo,extracto,campos-tiquete,aviso-resta,form-accion,ui}.tsx
src/app/api/leer-tiquete/route.ts     foto → nitidez (sharp) → IA → controles → duplicados → lectura firmada
src/app/api/aprender-formato/route.ts admin: aprender extractora/formato
src/app/api/exportar/tiquetes/route.ts  Excel de Reportes (admin/desarrollador)
src/app/api/backup/route.ts           backup Excel (solo desarrollador)
src/app/api/cron/limpiar-fotos        borra fotos > 6 meses (vercel.json, diario, CRON_SECRET)
src/app/(app)/subir/                  «Subir tiquete»: elegir cámara o galería → foto → lectura → confirmar
src/app/(app)/{mis-tiquetes,anticipos,extracto,avisos}   comprador
src/app/(app)/anticipo/[codigo]/      confirmación por enlace viejo + ResponderAnticipo (reutilizado en «Anticipos»)
src/app/(app)/admin/                  page (saldos + consumo IA), pendientes, tiquetes (precios), reportes, anticipos,
                                      compradores, extractoras, formatos, historial, claves (dev), backups (dev)
src/app/(app)/admin/acciones.ts       server actions del admin
src/app/clave/ · src/app/ingresar/olvide/   cambiar contraseña · olvidé mi contraseña
scripts/                              aplicar-sql, crear-admin, perfil-admin, prueba-lectura (npm run prueba),
                                      vaciar-pruebas, vaciar-tiquetes, vaciar-datos
docs/                                 NOTAS.md (bitácora), ARQUITECTURA.md, DESPLIEGUE.md, especificacion.pdf, este archivo
tiquetes-ejemplo/                     fotos reales con datos personales + archivos de prueba (en .gitignore, NO se sube)
```

## 6. Base de datos

**Migraciones aplicadas: 0001 a 0019.** Nunca editar una aplicada; crear la siguiente (`0020_nombre.sql`) y aplicarla con:
```
node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/0020_nombre.sql
```
(una transacción; usa `POSTGRES_URL_NON_POOLING` de `.env.local`). Un valor nuevo de un enum no se puede usar en la misma transacción en que se agrega (por eso 0006 y 0007 van separadas).

| Migración | Qué hizo |
|---|---|
| 0006–0007 | rol `desarrollador`; `es_admin()` acepta admin y desarrollador; índice único: un solo admin activo y un solo desarrollador activo |
| 0008 | `perfiles.cambiar_clave`, tabla `solicitudes_clave`, `es_desarrollador()` |
| 0009 | `peso_neto_t` y `valor` de `tiquetes` se calculan con **`coalesce(neto_impreso_kg, bruto − tara)`**; vistas recreadas |
| 0010 | quitó «Verificar que bruto − tara = neto» de las plantillas aprendidas |
| 0011 | anticipos con `monto <> 0` (negativos permitidos); en `extracto` el negativo va como débito («Saldo a favor del comprador») |
| 0012–0013 | se creó y luego se **borró** una tabla `proveedores` (el usuario no quiere listas de referencia) |
| 0014 | `perfiles.correo` admite null |
| 0015 | función `eliminar_tiquete(p_id, p_motivo)` (admin, motivo obligatorio, devuelve la ruta de la foto) |
| 0016 | `anticipos.soporte_ruta` + `poner_soporte_anticipo(p_id, p_ruta)` (admin, solo pendientes) + disparador que impide cambiar o quitar el soporte |
| 0017–0018 | rol `consultor` (varios) y `es_consultor()`: solo lectura de perfiles, anticipos, tiquetes y fotos; políticas restrictivas que le impiden escribir |
| 0019 | el Consultor no ve a los compradores de `configuracion.compradores_ocultos_consultor` (hoy `["prueba"]`) |

Tablas: `perfiles` (rol `admin|desarrollador|comprador`, correo opcional, `cambiar_clave`), `extractoras` (nit, nombres_impresos), `formatos_extractora` (plantilla jsonb, foto de ejemplo en `formatos/`), `anticipos` (monto ≠ 0, estado `pendiente|confirmado|en_disputa`; columnas de enlace ya no se usan), `tiquetes_pendientes` y `tiquetes` (enteros en kilos, `neto_impreso_kg`, proveedor, `requiere_revision` + `motivo_revision` «Verificar: …»), `formatos_no_reconocidos`, `notificaciones`, `configuracion`, `consumo_ia` (tipos `lectura`, `aprendizaje`, `ajuste`), `solicitudes_clave`, `historial` (disparadores; motivo con `fijar_contexto(accion, motivo)`). Vistas `saldos` y `extracto`. Bucket privado `tiquetes`: `<comprador_id>/...` y `formatos/...`.

Funciones clave: `registrar_pendiente` (service_role), `aprobar_tiquete` (borra el pendiente e inserta en `tiquetes`), `rechazar_tiquete`, `asignar_precio_bloque`, `editar_tiquete`, `editar_pendiente`, `eliminar_tiquete`, `responder_anticipo_id`, `buscar_duplicado`, `posibles_duplicados`, `es_admin`, `es_desarrollador`.

## 7. Lectura de tiquetes — reglas pactadas (lo más delicado)

**Filosofía:** la IA lee; lo que lee 100 % seguro se acepta; lo crítico debe ser 100 % seguro o no pasa; lo demás dudoso pasa marcado «Revisar» y la administradora decide. **No se guardan valores de referencia** para comparar (ni listas de proveedores ni lecturas anteriores).

1. **Valores vitales: N° de tiquete, peso neto IMPRESO y fecha** (decisión 2026-10-23). La IA debe tener certeza total de cada dígito; **ante cualquier duda los marca y pasan a «Revisar»** con la duda que explica la IA (`nota_ia`); la administradora decide con la foto. **Solo se rechaza lo ilegible** (sin N°, sin neto, fecha no válida): «No se puede registrar… Se necesita un tiquete más legible…».
2. **Los demás campos** (placa, proveedor, peso bruto, tara, conductor, báscula): si la IA duda o no se leyó (placa/proveedor) → pasan **marcados «Revisar»**, resaltados en ámbar al comprador y en «Pendientes». **Sin límite** de campos marcados. En Pendientes, un dato vital dudoso sale en un recuadro rojo y, si es el N°, con los **números parecidos** de la misma extractora.
3. **Se cobra el neto impreso**, no la resta. **Bruto y tara se leen tal cual**; la resta bruto − tara es **solo informativa**: si no da el neto impreso, bruto y tara llegan marcados; **una resta que no cuadra nunca hace dudoso un campo** (la IA lo hacía y se corrigió en la instrucción). Al corregir datos, el admin ve un aviso en vivo si la resta no cuadra (no impide guardar).
4. **Tiquete de más de 6 meses → no se puede subir** (síntoma de fraude). Si la fecha es **dudosa**, no se rechaza por periodo: pasa a revisión con el aviso. El aviso muestra la fecha leída y ofrece «Tomar otra foto».
5. Ilegible → **no va a revisión**. Solo un tiquete **legible de una extractora no registrada** puede «Enviar a revisión» (→ «Formatos no reconocidos», donde el admin la aprende).
6. Duplicado (extractora + número) → se avisa quién y cuándo lo registró. Si choca con un **pendiente cuyo N° quedó dudoso**, el comprador ve que está en revisión y que informe a la administración por su cuenta (sin botones); no lo puede subir hasta que se resuelva.
7. **Instrucción de la IA** (`INSTRUCCIONES` en `lector-ia.ts`): críticos número/neto impreso/fecha; marcar solo si un dígito podría leerse como otro (3/9, 6/8/9, 1/7, 0/8, 3/8, 5/6); en nombres una letra confundible (O/G/C/Q, M/N, U/V) es duda; pequeño, girado o con letra a mano cerca no es duda si se distingue; leer cada peso tal cual y la resta nunca hace dudoso un campo. **Regla del usuario: cualquier cambio que aumente tokens se consulta antes** (las últimas versiones se han mantenido igual o más cortas que la anterior).
8. **Antes de la IA (sin IA):** cámara guiada (texto impreso, luz, quietud, enfoque; foto automática) y revisión de nitidez de la foto final; galería con las mismas revisiones; el servidor repite la nitidez con sharp. **Se envía la foto original, sin girar.**

**Probado y descartado (no repetir sin que el usuario lo pida):** exigir resolución mínima (bloqueaba fotos válidas); rechazar si la IA dudaba de bruto/tara; límite de «más de 3 campos dudosos»; lista oficial de proveedores y comparación con proveedores aprobados; **recorte + efecto escaneo** (adelgazaba letras, no mejoró la lectura ni el peso); **giro automático** (reglas propias fallaban la dirección; Tesseract acertó 9/11 y el usuario prefirió no agregarlo); segunda lectura con IA (propuesta, no aprobada: duplica costo). Pendiente de decisión: si la foto llega girada, la IA lee peor los dígitos pequeños (recomendado tomar la foto con el celular horizontal).

## 8. Flujos

**Comprador:** «Subir» → elegir **«Usar la cámara»** o **«Subir desde la galería»** → lectura inmediata → datos solo lectura (campos dudosos resaltados) → «Coincide, enviar» (o «No coincide, tomar otra foto») → vuelve a «Subir tiquete» con «Tiquete N° … enviado». Aviso a la administradora **solo por la campana**. Inicio muestra su estado de cuenta y anticipos por confirmar; «Anticipos» para confirmar o disputar; «Extracto».

**Administrador:**
- **Pendientes:** foto + datos (proveedor resaltado en el título; campos «Revisar» en ámbar); aprobar / rechazar con motivo / corregir datos. El comprador recibe el aviso en la campana (sin WhatsApp).
- **Tiquetes y precios:** filtros, precio en bloque o individual, editar con motivo, anular. Botón «Reportes y Excel».
- **Reportes** (`/admin/reportes`): filtros por fechas, comprador, extractora, proveedor, N° de tiquete; resumen; tabla (hasta 500 filas, totales sobre todo) con **Acciones**: ✏️ editar (ventana con foto y formulario), 🗑️ **eliminar** (motivo obligatorio + confirmación **Sí/No**; borra la foto, avisa al comprador, el saldo se ajusta solo; el historial se conserva) y 🖼️ foto. **«Exportar a Excel»** con los mismos filtros: Comprador, Extractora, Proveedor, Fecha, N° Tiquete, Peso neto (t), Precio/t, Precio total; título, filtros, totales con fórmulas (sin foto).
- **Reportes · «Tiquetes y anticipos»** (`/admin/reportes?tipo=cuenta`, selector «Tipo de reporte» arriba): un comprador + fechas de registro; tiquetes aprobados por fecha de subida y anticipos **confirmados** por fecha de confirmación en una tabla con saldo acumulado; sin precio = «Sin precio aún» (no mueve el saldo); Excel con los mismos filtros. Solo lectura (`src/lib/informes/movimientos.ts`, `cuenta.ts`, `cuenta-excel.ts`). **Todo reporte nuevo debe tener Excel.**
- **Anticipos:** soporte (foto) opcional al registrar o con el ícono «Subir soporte» en la tarjeta (solo pendientes; una vez puesto no se cambia); «Ver soporte» para admin y comprador.
- **Anticipos:** registrar (positivo o negativo) → campana + **botón** «Enviar por WhatsApp» (**sin enlaces**); «Recordarle por WhatsApp»; el comprador confirma en su app.
- **Compradores:** crear (contraseña fija 12345678, correo opcional) / editar; cuenta de cada comprador con estado de cuenta y extracto.
- **Extractoras:** «Enseñar un tiquete» (IA Opus). **Formatos no reconocidos.** **Historial.** **Panel:** saldos («Total saldo a mi favor» / «Total que les debo») y «Consumo de IA este mes».
- **Desarrollador además:** Contraseñas (aprobar/rechazar solicitudes) y **Backups** (botón «Descargar backup ahora»: Excel con una hoja por tabla + Resumen; no incluye fotos ni contraseñas).

**WhatsApp:** nunca se abre solo; siempre es un botón. Se usa para **anticipos** (y bienvenida de usuario nuevo, contraseña restablecida, «Escribir por WhatsApp» en la cuenta del comprador, «Confirmar por WhatsApp» en Contraseñas). **Tiquetes (desde 2026-10-28):** botón «Enviar por WhatsApp» en Pendientes y Tiquetes y precios: comparte la foto real + datos (o abre el chat con enlace a la foto de 7 días).

## 9. Decisiones del usuario (no revertir sin consultar)

- El comprador no elige extractora; la IA la detecta (primero por NIT). Extractoras se aprenden con una foto; varios formatos por extractora.
- Duplicados = extractora + número. Solo anticipos (sin «Pago»); anticipos negativos permitidos; **sin enlaces** de confirmación.
- Reglas de lectura de §7 (críticos: número, neto impreso, fecha). Se cobra el neto impreso.
- La IA solo para leer tiquetes. **Consumo de IA crítico: consultar antes de cualquier cambio que agregue llamadas o tokens.**
- WhatsApp solo con botón (nunca automático): anticipos y, por pedido de la administradora, el envío de un tiquete con su foto (ver §8). Los avisos automáticos de tiquetes siguen solo por la campana.
- Un administrador y un desarrollador; contraseña por defecto 12345678 sin obligar a cambiarla; correo opcional.
- Tras enviar un tiquete, volver a «Subir tiquete». Tiquetes de más de 6 meses no se suben.

## 10. Estado de los datos (21-oct, inicio de producción)

- Se borraron tiquetes (aprobados, pendientes, no reconocidos), sus fotos, sus avisos y el historial salvo anticipos y usuarios.
- Quedan: 4 usuarios (`ingrid` admin, `christian` desarrollador, compradores `prueba` y `yudidj`); **2 anticipos de `yudidj` en estado pendiente** (−86.796.710 del 20-oct y 49.950.000 del 21-oct; no cuentan en el saldo hasta confirmarlos — verificar con el usuario que sean reales); 5 extractoras con sus formatos.
- `configuracion`: fecha_filtro_precio=entrada, vigencia_enlace_anticipo_horas=48 (ya sin uso), comprador_ve_toneladas_sin_precio=true, placa_obligatoria=true, meses_conservacion_fotos=6.
- **Consumo de IA:** el panel se igualó a la consola (US$ 0,44 en octubre) con una fila `consumo_ia` tipo `ajuste`. **Costo real ≈ US$ 0,008 por lectura** (la consola cobra ~3,5× lo estimado por tokens; causa no confirmada). US$ 10 ≈ 1.200 lecturas.

### Extractoras aprendidas

| Nombre en la app | NIT | Nota |
|---|---|---|
| Babú Palm | 901249632 | número en rojo «N° Tiquete» |
| Palnorte | 900486803-8 | «ENTRADA DE MATERIA PRIMA No.», coma de miles |
| Oleoflores | 8901021101 | número = GUÍA TRANSPORTE VEHICULO; el CODIGO INTERNO es del proveedor |
| Agrovaspalma | 901.666.764-5 | el usuario la llama NodoLa4 (puede renombrarla) |
| Lukeoil | (sin NIT) | Extractora Lukeoil SAS ZOMAC; papel térmico, suele venir girado; su foto de ejemplo es de baja resolución |

## 11. Variables de entorno

Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING` (+ las de la integración), `ANTHROPIC_API_KEY` (Secret), `FIRMA_LECTURA_SECRETO`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL=https://bancoticket.vercel.app`.
Local: `.env.local` (en .gitignore) tiene todo **menos `ANTHROPIC_API_KEY`** → la lectura con IA solo se prueba en producción (y se diagnostica con los registros de Vercel).

## 12. Cómo trabajar

- Verificar antes de subir: `npx tsc --noEmit -p .`, `npx eslint src`, `npm run prueba` (números, fechas, controles, saldos, proveedor, 6 meses…). Si se agrega una página: `npx next typegen`. Cambios grandes: `npx next build`.
- Subir: commit en español terminado en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `git push origin main`, desplegar (ver §3) y esperar «Ready».
- Probar la base con **transacciones que se deshacen** (script temporal con `pg`: `begin` … `rollback`; `set local role authenticated` + `set_config('request.jwt.claims', …)` para actuar como un usuario). Los scripts temporales van en `scripts/_tmp.*` y se borran.
- En Windows, para ediciones con «°», «ñ» o tildes desde scripts usar archivos Python con `python -X utf8` (el heredoc de bash daña el UTF-8).
- Limpiar datos de prueba: `node --env-file=.env.local scripts/vaciar-pruebas.mjs --si` (borra tiquetes, anticipos, avisos, solicitudes de contraseña, historial y fotos de compradores; conserva usuarios, extractoras y consumo IA). **Ya estamos en producción: no borrar nada sin pedírselo al usuario.**
- El usuario prueba en el celular y manda capturas. Explicar en español sencillo, sin discursos; paso a paso cuando sea configuración.
- Registrar cada decisión en `docs/NOTAS.md` (fila nueva arriba) y mantener este archivo al día.

## 13. Pendientes y cosas a vigilar

- **Confirmar con el usuario los 2 anticipos de `yudidj`** (siguen pendientes de confirmar por el comprador).
- **Foto girada:** la IA lee peor los dígitos pequeños; pedir fotos con el celular horizontal. Si sigue siendo problema, opciones ya evaluadas: segunda lectura enderezando (+US$ ~0,008 por foto girada) o Tesseract (9/11), ambas rechazadas por ahora.
- **Lukeoil:** enseñar un tiquete nítido donde se vea el NIT (el ejemplo actual es de baja resolución). Renombrar Agrovaspalma → NodoLa4 si el usuario quiere.
- **Pendientes no se pueden eliminar** (solo rechazar); los aprobados se eliminan desde Reportes.
- **Fotos huérfanas** (lecturas que no se envían quedan en Storage hasta el cron de 6 meses).
- **Vercel:** el despliegue automático por GitHub llega con retraso; revisar Settings → Git si se quiere que vuelva a ser inmediato.
- Seguridad: confirmar en Supabase «Allow new users to sign up» desactivado; borrar la clave de Anthropic que salió en una captura (`christian-api-key`); marcar `CRON_SECRET` como Sensitive en Vercel. Recarga automática de la consola de Anthropic: desactivada (saldo ≈ US$ 9,56 el 21-oct).
- Fase 2: extractos en PDF/Excel si se piden.
