# BancoTicket — contexto para continuar en un chat nuevo de Claude Code

> **Cómo usarlo:** abre el chat nuevo **en la carpeta `C:\PROYECTOS WEB\BANCOTICKET`** (así carga `CLAUDE.md` y `AGENTS.md`) y escribe: «Lee `docs/CONTEXTO-NUEVO-CHAT.md` y continuemos».
> **Fecha de corte:** 2026-11-03. **Estado:** **en producción** desde el 21-oct (tiquetes, anticipos, reportes, consultor, facturas de venta y respaldo completo). Migraciones aplicadas: **0001 a 0031**.
> La bitácora completa de decisiones está en `docs/NOTAS.md` (lo más reciente arriba). Guía de respaldo y restauración: `docs/RESPALDO.md`.

---

## 1. Qué es

App web en español, **móvil primero**, para controlar los **tiquetes de báscula de entrega de fruta de palma de aceite** y llevar la **cuenta de cada comprador como un banco**:
- **Anticipos confirmados suman** al saldo del comprador. Pueden ser **negativos** (dinero que la administración le debe al comprador, ej. saldo inicial).
- **Cada tiquete aprobado con precio descuenta**: **peso neto IMPRESO** (toneladas) × precio por tonelada.
- **Saldo = anticipos confirmados − valor de tiquetes vigentes con precio.** No se guarda: se calcula (vista `saldos`). Los anticipos pendientes o en disputa **no cuentan**.
- Palabras del estado de cuenta (`src/lib/saldo.ts`): administración **«Saldo a mi favor»** (saldo > 0) / **«Le debo»** (saldo < 0); comprador **«Debo»** / **«Me deben»**; 0 = «Cuenta al día».
- **Módulo aparte de FACTURAS** (desde 2026-10-29): facturas de venta que las empresas de la administración emiten a las extractoras y los abonos que estas pagan (§8).

Problema que resuelve: los tiquetes son físicos y se podían pagar dos veces. La app evita duplicados (**extractora + número**) y deja control de lo entregado, pagado y pendiente. Especificación original: `docs/especificacion.pdf` (varias decisiones posteriores la cambiaron; ver §9).

## 2. Personas, roles y acceso

| Rol | Quién | Puede |
|---|---|---|
| **Administrador** (uno solo) | Ingrid García (`ingrid`) | Todo: aprobar/rechazar, precios, anticipos, extractoras, reportes, facturas. **Recibe los avisos de los compradores** (campana). |
| **Desarrollador** (uno solo) | Christian Soriano (`christian`, cel. 3182542939, christiansorianob@gmail.com) | Lo mismo que el admin + **Contraseñas** (`/admin/claves`) y **Backups** (`/admin/backups`). No recibe avisos de compradores. El rol no se asigna desde la app. |
| **Compradores** (varios) | Gabriel, Javier, Rocío, Yudid Jaime (`yudidj`) y `prueba` (de pruebas) | Solo lo suyo: subir tiquetes, ver sus tiquetes, anticipos y extracto. |
| **Consultor** (varios; hay 1) | los crea la administradora en «Compradores» | **Solo ve, no modifica nada** (lo garantiza la base, migraciones 0017–0019): `/consulta` con saldos, cuenta y extracto de cada comprador, Reportes (sin editar/eliminar; fotos y Excel sí) y anticipos con soportes. **No ve al comprador `prueba`** (`configuracion.compradores_ocultos_consultor`). |

- Ingreso con **usuario y contraseña** (Supabase Auth con correo interno `<usuario>@bancoticket.local`). El **correo real es opcional**.
- **Contraseñas:** usuario nuevo o restablecido queda con **12345678** (no se obliga a cambiarla). Se cambia con la **llave 🔑** (`/clave`). «Olvidé mi contraseña» → solicitud → el desarrollador la aprueba en «Contraseñas».
- Encabezado de **todos los perfiles**: **logo oficial** (`public/logo.webp`; favicon e íconos en `src/app/`), ↻ refrescar, campana, llave y salir. El menú resalta la sección abierta. `inicioDe(rol)` lleva a cada perfil a su inicio.

## 3. Dónde está todo

| Qué | Dónde |
|---|---|
| Código local | `C:\PROYECTOS WEB\BANCOTICKET` (Windows, ruta con espacio: usar comillas) |
| GitHub (privado) | https://github.com/christiansorianob-lgtm/BancoTicket — rama `main` |
| Producción | https://bancoticket.vercel.app (Vercel, equipo `christian-alexanders-projects-b132b23e`, proyecto `bancoticket` id `prj_iejWvEPXl3XhpggwnXzNNz7SzEOC`, plan Hobby) |
| Despliegue | **Cada push a `main` despliega solo y hoy llega en ~1 minuto.** Comprobar con `npx vercel ls bancoticket --scope christian-alexanders-projects-b132b23e` hasta «Ready». Despliegue manual de respaldo: MCP de Vercel `create_deployment` con `gitSource {type:"github", org:"christiansorianob-lgtm", repo:"BancoTicket", ref:"main"}`, `target:"production"` (el modo automático a veces lo bloquea si el usuario no lo pidió explícitamente). **No** usar `vercel --prod` local (subiría `.env.local` y `tiquetes-ejemplo/`). |
| Base de datos | Supabase (desde Vercel Storage), **plan gratis, compute Nano (~0,5 GB RAM)**, us-east-1. 15 MB de 500 MB; Storage ~50 MB de 1 GB. **Sin backups automáticos** → respaldo manual (§8). |
| IA | Anthropic API (`ANTHROPIC_API_KEY` solo en Vercel, Secret). Saldo prepagado en la consola. |
| Registros del servidor | Vercel runtime logs (Hobby guarda **1 hora**). Cada lectura de tiquete escribe `console.info("lectura", {...})` (sin conductor ni cédulas). MCP de Vercel `get_runtime_logs`. |

## 4. Pila

- **Next.js 16.4** (App Router, TypeScript, Turbopack). ⚠️ `middleware` se llama **`proxy`** (`src/proxy.ts`; deja pasar sin sesión `/ingresar/*` y archivos .png/.webp/.ico/.jpg/.svg). Leer `node_modules/next/dist/docs/` antes de usar APIs nuevas. `cacheComponents` desactivado. Tras crear una página: `npx next typegen`.
- **Tailwind 4**; clases propias `tarjeta`, `boton-primario`, `boton-secundario`, `boton-peligro`, `boton-whatsapp`, `campo`, `etiqueta`, `titulo` en `src/app/globals.css`.
- **Supabase** (Postgres + Auth + Storage) con `@supabase/ssr`; RLS en todas las tablas. La app **no usa Realtime ni consultas automáticas**: solo consume recursos cuando alguien hace algo.
- **Anthropic SDK** — **la IA se usa SOLO para leer tiquetes y facturas de venta** (decisión del usuario; cada lectura cuenta en `consumo_ia` con su `modulo`):
  - Tiquetes: `claude-haiku-5-5`, `messages.parse` + `zodOutputFormat`, effort `medium` (`src/lib/lectura/lector-ia.ts`).
  - Facturas: `FACTURAS_MODELO` (por defecto `claude-haiku-5-5`), PDF como documento o imagen enderezada a 2000 px (`src/lib/facturas/lector.ts`).
  - Aprender formato de extractora (solo admin): `claude-opus-5-5` (`src/lib/lectura/aprender.ts`).
- **sharp**, **exceljs 4.4.0** (Excel) y **fflate** (zip del respaldo).

## 5. Estructura de código (lo importante)

```
src/proxy.ts                          sesión + redirección a /ingresar
src/lib/supabase/{servidor,admin}.ts  con sesión (RLS) / service_role
src/lib/sesion.ts                     Rol (admin|desarrollador|comprador|consultor), esGestor, puedeConsultar, inicioDe,
                                      exigirAdmin/Desarrollador/Comprador/Consulta
src/lib/fechas.ts                     America/Bogota, es-CO, interpretarFechaTiquete, antiguedad (meses y días)
src/lib/numeros.ts · monto.ts         kilos/montos colombianos; formatearMonto, textoMonto, montoEnLetras
src/lib/saldo.ts · mensajes.ts · avisos.ts · whatsapp.ts · config.ts · fotos.ts (urlsFotos(rutas, segundos))
src/lib/camara/*                      cámara guiada y nitidez (navegador y servidor)
src/lib/lectura/                      tipos, lector-ia (instrucción §7), controles, firma, aprender, consumo, parecidos
src/lib/informes/                     consulta + tiquetes-excel (Reportes), movimientos + cuenta + cuenta-excel
                                      («Tiquetes y anticipos»), backup-excel (Excel de Backups)
src/lib/facturas/                     tipos, lector, validar, formulario, consulta, excel
src/lib/respaldo/                     comun (tablas, armarZip) y servidor (índice y páginas)
src/components/                       marco (menús), form-accion (Sí/No con confirmarCon/textoSi), valor-tiquete
                                      (peso × precio = valor), enviar-tiquete (EnviarFoto por WhatsApp), ui, saldo, extracto…
src/app/api/leer-tiquete              foto → nitidez → IA → controles → duplicados → lectura firmada
src/app/api/facturas/leer             factura → tipo real por bytes → IA → duplicado CUFE → bucket facturas
src/app/api/exportar/{tiquetes,cuenta,facturas}   Excel (cuenta y tiquetes también para consultores)
src/app/api/respaldo/{indice,tabla}   respaldo completo (solo desarrollador)
src/app/api/backup                    Excel de Backups. (Sin tareas programadas: las fotos ya no se borran solas, ver NOTAS 2026-11-04)
src/app/(app)/subir/                  subir tiquete (cámara o galería) + ventana «Tiquete registrado correctamente»
src/app/(app)/{mis-tiquetes,anticipos,extracto,avisos}   comprador
src/app/(app)/admin/                  panel, pendientes, tiquetes, reportes (selector de tipo), anticipos (registrar,
                                      soporte, corregir/eliminar en disputa), compradores, extractoras, formatos,
                                      historial, claves (dev), backups (dev)
src/app/(app)/facturas/               lista, subir, detalle (abonos, anulaciones, auditoría)
src/app/(app)/consulta/               sección del Consultor (solo lectura)
scripts/                              aplicar-sql, prueba-lectura (npm run prueba), restaurar-respaldo, vaciar-*
docs/                                 NOTAS.md, RESPALDO.md, ARQUITECTURA.md, DESPLIEGUE.md, especificacion.pdf, este archivo
tiquetes-ejemplo/                     fotos reales con datos personales (en .gitignore, NO se sube)
```

## 6. Base de datos

**Migraciones aplicadas: 0001 a 0031.** Nunca editar una aplicada; crear la siguiente (`0032_nombre.sql`) y aplicarla con:
```
node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/0032_nombre.sql
```
(una transacción; usa `POSTGRES_URL_NON_POOLING`). Al crear una migración, actualizar también `MIGRACIONES` en `src/app/(app)/admin/backups/respaldo.tsx` (va en el resumen del respaldo). Un valor nuevo de un enum no se puede usar en la misma transacción en que se agrega.

| Migración | Qué hizo |
|---|---|
| 0006–0007 | rol `desarrollador`; `es_admin()` acepta admin y desarrollador; un solo admin y un solo desarrollador activos |
| 0008 | `perfiles.cambiar_clave`, `solicitudes_clave`, `es_desarrollador()` |
| 0009 | `peso_neto_t` y `valor` de `tiquetes` con `coalesce(neto_impreso_kg, bruto − tara)` |
| 0011 | anticipos con `monto <> 0` (negativos) |
| 0014 | `perfiles.correo` admite null |
| 0015 | `eliminar_tiquete(p_id, p_motivo)` |
| 0016 | `anticipos.soporte_ruta` + `poner_soporte_anticipo` (solo pendientes; el soporte no se cambia) |
| 0017–0018 | rol `consultor` y `es_consultor()`: solo lectura; políticas restrictivas que le impiden escribir |
| 0019 | el Consultor no ve a `configuracion.compradores_ocultos_consultor` (hoy `["prueba"]`) |
| 0020 | **módulo de facturas**: `fact_facturas`, `fact_pagos`, `fact_auditoria`, vistas `fact_facturas_estado`/`fact_totales`, funciones `fact_*`, bucket privado `facturas` |
| 0021 | `consumo_ia` + `modulo` ('tiquetes'/'facturas'), `tipo_archivo`, `resultado`, `referencia_id` |
| 0022 | `corregir_anticipo`: un anticipo **en disputa** se corrige con motivo y vuelve a pendiente |
| 0023 | `eliminar_anticipo`: solo anticipos en disputa, con motivo (queda en el historial) |
| 0024 | `configuracion.dias_aviso_respaldo = 15` (la app escribe `ultimo_respaldo`) |
| 0025 | facturas: `retefuente`, `reteiva`, `reteica` por separado; alerta por cada impuesto |
| 0026 | `configuracion.tarifas_factura` (IVA 5, ReteFuente 1,5, ReteIVA 15 del IVA, ReteICA 0) para la comprobación de cálculos |
| 0027 | facturas: solo APROBADA/ANULADA; `fact_eliminar_factura` (solo anuladas sin abonos vigentes, copia en `fact_auditoria.datos`); sin revertir anulación |
| 0028 | facturas: abonos al CLIENTE: `fact_clientes` (por NIT), `fact_abonos` (reemplaza `fact_pagos`), vista `fact_clientes_saldo` (deuda), sin cobro por factura |
| 0029 | `recargas_ia` (créditos cargados en Claude Console, solo agregar) y vista `consumo_ia_totales`; tarjeta de IA solo para el desarrollador |
| 0030 | vistas `tiquetes_reporte`, `anticipos_reporte` y funciones de totales (solo lectura) para el reporte de Anticipos y la paginación |
| 0031 | facturas: porcentaje impreso de cada impuesto (`iva_pct`…) y `configuracion.tarifas_permitidas_factura` (IVA 5 % fruta / 19 % comisión) |

Tablas: `perfiles`, `extractoras`, `formatos_extractora`, `anticipos` (estado `pendiente|confirmado|en_disputa`, `soporte_ruta`), `tiquetes_pendientes` y `tiquetes` (kilos enteros, `neto_impreso_kg`, `requiere_revision` + `motivo_revision` «Verificar: …», `datos_leidos.nota_ia`), `formatos_no_reconocidos`, `notificaciones`, `configuracion`, `consumo_ia`, `solicitudes_clave`, `historial` (disparadores; motivo con `fijar_contexto(accion, motivo)`), `fact_facturas`, `fact_pagos`, `fact_auditoria`. Vistas `saldos`, `extracto`, `fact_facturas_estado`, `fact_totales`. Buckets privados `tiquetes` (`<comprador>/…`, `<comprador>/anticipos/…`, `formatos/…`) y `facturas`.

## 7. Lectura de tiquetes — reglas pactadas (lo más delicado)

1. **Valores vitales: N° de tiquete, peso neto IMPRESO y fecha** (decisión 2026-10-23). La IA exige certeza total de cada dígito; **ante cualquier duda los marca y pasan a «Revisar»** con la duda que explica la IA (`nota_ia`, ej. «4.º dígito 5 o 6»). **Solo se rechaza lo ilegible** (sin N°, sin neto, fecha no válida).
2. **Los demás campos** (placa, proveedor, bruto, tara, conductor, báscula): dudosos o no leídos → pasan **marcados «Revisar»**. En Pendientes: recuadro rojo «Dato vital dudoso», **números parecidos** de la misma extractora si el N° es dudoso, y **antigüedad** de la fecha de entrada (ámbar desde 5 meses, rojo desde 6).
3. **Se cobra el neto impreso**, no la resta. La resta bruto − tara es **solo informativa** y nunca hace dudoso un campo.
4. **Tiquete de más de 6 meses → no se puede subir**, salvo que la fecha sea dudosa (pasa a revisión).
5. Ilegible → no va a revisión. Solo un tiquete legible de una extractora no registrada puede «Enviar a revisión» (→ «Formatos no reconocidos»).
6. **Duplicado (extractora + número)** → aviso con quién y cuándo. Si choca con un **pendiente cuyo N° quedó dudoso**, el comprador debe informar a la administración por su cuenta (sin botones). Aviso adicional (no bloquea) si ya hay un tiquete con **la misma placa y hora**: suele ser el mismo tiquete con el número mal leído.
7. **Regla del usuario: cualquier cambio que aumente tokens de IA se consulta antes.**
8. **Antes de la IA (sin IA):** cámara guiada y revisión de nitidez; se envía la foto original, sin girar.
9. **Leer no registra:** el tiquete se registra solo al tocar «Coincide, enviar» (un paso, todo o nada). Si se guardó, sale la ventana **«Tiquete registrado correctamente»**; si falla, el error indica revisar «Mis tiquetes → Pendientes» antes de repetir.

**Probado y descartado (no repetir sin que el usuario lo pida):** resolución mínima; rechazar por bruto/tara dudosos; límite de campos dudosos; lista de proveedores; recorte + efecto escaneo; **girar la foto** (por reglas, sensor o IA); segunda lectura con IA; varias fotos; pantalla propia de «base no disponible» (se dejó para después: caso raro).

## 8. Flujos

**Comprador:** «Subir» → cámara o galería → lectura → datos (dudosos resaltados) → «Coincide, enviar» → ventana de confirmación. «Mis tiquetes» con tarjetas **Peso neto × Precio por tonelada = Valor** (`ValorTiquete`). «Anticipos» para confirmar o disputar (ve el soporte y si la administración corrigió tras su disputa). «Extracto».

**Administradora:**
- **Panel (Saldos):** indicadores (pendientes, para verificar, sin precio, anticipos en disputa, formatos no reconocidos, **anticipos sin confirmar**), totales y consumo de IA (facturas aparte).
- **Pendientes:** foto + datos; aprobar / rechazar / corregir; **«Enviar foto por WhatsApp»** debajo de la foto.
- **Tiquetes y precios:** filtros, precio en bloque o individual («Cambiar precio» con motivo: saldos y totales se recalculan solos), editar, anular; tarjetas con `ValorTiquete` y «Enviar foto por WhatsApp».
- **Reportes:** selector «Tiquetes» (filtros, editar/eliminar con Sí/No, foto, WhatsApp, Excel) y «Tiquetes y anticipos» (saldo acumulado por fecha de registro, Excel). **Todo reporte nuevo debe tener Excel.**
- **Anticipos:** registrar con **monto didáctico** (puntos de miles, verde/rojo, en letras, botón ±), soporte (foto) opcional y **aviso Sí/No**; «Subir soporte» en pendientes; «Recordarle por WhatsApp». **En disputa:** «Corregir y volver a enviar» (vuelve a pendiente) o «Eliminar este anticipo» (motivo + «¿Está seguro?»). Desde la cuenta de un comprador, «Anticipos» muestra solo los suyos.
- **Compradores:** crear (rol Comprador, Administrador o **Consultor**) / editar; cuenta con estado y extracto.
- **Extractoras** («Enseñar un tiquete»), **Formatos no reconocidos**, **Historial**.
- **Facturas** (`/facturas`, administradora y desarrollador; botón en el menú): subir PDF o imagen **elegida (sin cámara)**, máx. 4 MB → IA → formulario con validaciones en vivo (Subtotal + IVA − ReteFuente − ReteIVA − ReteICA = Total a pagar; kilos × precio ≈ subtotal) → CONFIRMADA o PENDIENTE_REVISION. CUFE único. Estado de cobro calculado (PENDIENTE_PAGO / ABONADA_PARCIAL / PAGADA / ANULADA), vencida y días de mora, alertas de sobrepago y de cada retención. Abonos (recibido + retenciones = aplicado) que nunca se borran, se anulan; anular factura solo sin abonos vigentes; revertir anulación con motivo; auditoría. Lista con filtros, totales por extractora/emisor/mes y Excel (una columna por impuesto).

**Desarrollador además:** Contraseñas y **Backups**: **«Descargar respaldo completo»** (.zip armado en el navegador con todas las tablas, usuarios sin contraseñas y todos los archivos; ~50 MB; aviso en rojo si pasan más de 15 días; restaurar con `scripts/restaurar-respaldo.mjs`, ver `docs/RESPALDO.md`) y el Excel para consultar.

**WhatsApp:** nunca se abre solo; siempre es un botón. Anticipos (registrar, recordar, corregir), bienvenida, contraseña restablecida, cuenta del comprador y **foto del tiquete** (menú Compartir del celular: WhatsApp pide elegir el chat; si el equipo no comparte archivos, abre el chat del comprador con enlace de 7 días). Los avisos automáticos de tiquetes van solo por la campana.

## 9. Decisiones del usuario (no revertir sin consultar)

- El comprador no elige extractora; la IA la detecta. Duplicados = extractora + número.
- Reglas de lectura de §7. Se cobra el neto impreso.
- **IA solo para leer tiquetes y facturas.** Consumo de IA crítico: consultar antes de agregar llamadas o tokens.
- WhatsApp solo con botón (§8).
- **En producción no se borran tablas ni registros** salvo lo que el usuario pida explícitamente (eliminar tiquete aprobado, anticipo en disputa), siempre con motivo y en el historial. Antes de cambiar la base: probar con transacción deshecha y cuadrar saldos.
- Un administrador y un desarrollador; consultores varios; contraseña por defecto 12345678; correo opcional.
- Facturas: módulo independiente (prefijo `fact_`), cada impuesto en su campo (IVA, ReteFuente, ReteIVA, ReteICA, sin porcentaje en el nombre).
- Respaldo completo solo para el desarrollador, aviso cada 15 días.

## 10. Estado (2026-11-03)

- 10 usuarios: administradora, desarrollador, 1 consultor y compradores (Gabriel, Javier, Rocío, Yudid, Prueba). ~180 tiquetes aprobados; anticipos sin pendientes ni disputas hoy; **0 facturas** (la primera será la **FEPA 12**, Palmali → SAF: subtotal 469.542.120; IVA 23.477.106; ReteFuente 7.043.131,80; ReteIVA 3.521.565,90; total 482.454.528,30).
- Cuadre del 2026-10-30: saldo de la app = cálculo desde cero = extracto = reporte para todos los compradores.
- Costo real IA ≈ US$ 0,008 por lectura de tiquete; facturas ≈ US$ 0,003.
- Postgres sin reinicios desde el 15-oct. «Memory commitment» sale «Problematic» en Supabase: es la reserva fija de los servicios en Nano, no la app. Plan Pro solo si aparecen reinicios o lentitud.

### Extractoras aprendidas

| Nombre en la app | NIT | Nota |
|---|---|---|
| Babú Palm | 901249632 | número en rojo «N° Tiquete» |
| Palnorte | 900486803-8 | «ENTRADA DE MATERIA PRIMA No.», coma de miles |
| Oleoflores | 8901021101 | número = GUÍA TRANSPORTE VEHICULO |
| Agrovaspalma | 901.666.764-5 | el usuario la llama NodoLa4 |
| Lukeoil | (sin NIT) | papel térmico, suele venir girado |

## 11. Variables de entorno

Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING`, `ANTHROPIC_API_KEY` (Secret), `FIRMA_LECTURA_SECRETO`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`; opcional `FACTURAS_MODELO`.
Local: `.env.local` tiene todo **menos `ANTHROPIC_API_KEY`** → la lectura con IA solo se prueba en producción.

## 12. Cómo trabajar

- Verificar antes de subir: `npx tsc --noEmit -p .`, `npx eslint src`, `npm run prueba`; página nueva: `npx next typegen`; cambios grandes: `npx next build`. Si quedan tipos viejos de una página borrada: `rm -rf .next/dev/types`.
- Subir: commit en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `git push origin main` y comprobar «Ready».
- Probar la base con **transacciones que se deshacen** (scripts temporales `scripts/_tmp-*` que se borran). Ver pantallas sin sesión: página temporal en `src/app/ingresar/vista-tmp` + `preview_start` (borrarla después).
- PDFs: no hay pdftoppm; para leer texto instalar `pypdf` en la carpeta temporal (`pip install --target <scratchpad>/py pypdf`).
- En Windows, ediciones con tildes desde scripts: Python con `python -X utf8`.
- **Ya estamos en producción: no borrar nada sin pedírselo al usuario.**
- El usuario prueba en el celular (a veces por Remote Control) y manda capturas. Español sencillo, sin discursos; antes de cambios grandes mostrar el plan y esperar «procede».
- Registrar cada decisión en `docs/NOTAS.md` (fila nueva arriba) y mantener este archivo al día.

## 13. Pendientes

Aquí se anota solo lo que vaya saliendo desde el 2026-11-03.

Plan de Facturas del 2026-11-03 (comprobación de cálculos, Aprobada/Anulada y eliminar, panel por emisor y buscador): **hecho y desplegado** (migraciones 0026 y 0027; ver NOTAS). Falta probarlo con la FEPA 12 real.

Plan de abonos por CLIENTE (2026-11-03): **hecho y desplegado** (migración 0028; ver NOTAS). Falta probar un abono real con soporte.
