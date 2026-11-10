# BancoTicket — contexto para continuar en un chat nuevo de Claude Code

> **Cómo usarlo:** abre el chat nuevo **en la carpeta `C:\PROYECTOS WEB\BANCOTICKET`** (así carga `CLAUDE.md` y `AGENTS.md`) y escribe: «Lee `docs/CONTEXTO-NUEVO-CHAT.md` y continuemos».
> **Fecha de corte:** 2026-11-10 (para continuar en el chat «BancoTicket V5»). **Estado:** **en producción** desde el 21-oct (tiquetes, anticipos, reportes, consultor, facturas de venta con abonos por cliente y respaldo completo). Migraciones aplicadas: **0001 a 0034**.
> La bitácora completa de decisiones está en `docs/NOTAS.md` (lo más reciente arriba). Guía de respaldo y restauración: `docs/RESPALDO.md`.

---

## 1. Qué es

App web en español, **móvil primero**, para controlar los **tiquetes de báscula de entrega de fruta de palma de aceite** y llevar la **cuenta de cada comprador como un banco**:
- **Anticipos confirmados suman** al saldo del comprador. Pueden ser **negativos** (dinero que la administración le debe al comprador, ej. saldo inicial).
- **Cada tiquete aprobado con precio descuenta**: **peso neto IMPRESO** (toneladas) × precio por tonelada.
- **Saldo = anticipos confirmados − valor de tiquetes vigentes con precio.** No se guarda: se calcula (vista `saldos`). Los anticipos pendientes o en disputa **no cuentan**.
- Palabras del estado de cuenta (`src/lib/saldo.ts`): administración **«Saldo a mi favor»** (saldo > 0) / **«Le debo»** (saldo < 0); comprador **«Debo»** / **«Me deben»**; 0 = «Cuenta al día».
- **Módulo aparte de FACTURAS** (desde 2026-10-29), **independiente de los tiquetes** (prefijo `fact_`, nunca toca tablas de tiquetes): facturas de venta que las empresas de la administración (mismo dueño) emiten a sus clientes (extractoras) y los **abonos que el cliente paga a su deuda total** (§8).

Problema que resuelve: los tiquetes son físicos y se podían pagar dos veces. La app evita duplicados (**extractora + número**) y deja control de lo entregado, pagado y pendiente. Especificación original: `docs/especificacion.pdf` (varias decisiones posteriores la cambiaron; ver §9).

## 2. Personas, roles y acceso

| Rol | Quién | Puede |
|---|---|---|
| **Administrador** (uno solo) | Ingrid García (`ingrid`) | Todo: aprobar/rechazar, precios, anticipos, extractoras, reportes, facturas. **Recibe los avisos de los compradores** (campana). |
| **Desarrollador** (uno solo) | Christian Soriano (`christian`, cel. 3182542939, christiansorianob@gmail.com) | Lo mismo que el admin + **Contraseñas** (`/admin/claves`), **Backups** (`/admin/backups`) y, solo él, la **tarjeta de consumo de IA** y el **aviso de fotos antiguas** en el Panel. No recibe avisos de compradores. El rol no se asigna desde la app. |
| **Compradores** (12) | entre ellos Gabriel, Javier, Rocío, Yudid Jaime (`yudidj`) y `prueba` (de pruebas) | Solo lo suyo: subir tiquetes, ver sus tiquetes (paginados), anticipos y extracto. |
| **Consultor** (varios; hay 1) | los crea la administradora en «Compradores» | **Solo ve, no modifica nada** (lo garantiza la base, migraciones 0017–0019): `/consulta` con saldos, cuenta y extracto de cada comprador, Reportes (los 3 tipos, sin editar/eliminar; fotos y Excel sí) y anticipos con soportes. **No ve al comprador `prueba`** (`configuracion.compradores_ocultos_consultor`). |

- Ingreso con **usuario y contraseña** (Supabase Auth con correo interno `<usuario>@bancoticket.local`). El **correo real es opcional**.
- **Contraseñas:** usuario nuevo o restablecido queda con **12345678** (no se obliga a cambiarla). Se cambia con la **llave 🔑** (`/clave`). «Olvidé mi contraseña» → solicitud → el desarrollador la aprueba en «Contraseñas».
- Encabezado de **todos los perfiles**: **logo oficial** (`public/logo.webp`; favicon e íconos en `src/app/`), ↻ refrescar, campana, llave y salir. El menú resalta la sección abierta. `inicioDe(rol)` lleva a cada perfil a su inicio.

## 3. Dónde está todo

| Qué | Dónde |
|---|---|
| Código local | `C:\PROYECTOS WEB\BANCOTICKET` (Windows, ruta con espacio: usar comillas) |
| GitHub (privado) | https://github.com/christiansorianob-lgtm/BancoTicket — rama `main` |
| Producción | https://bancoticket.vercel.app (Vercel, equipo `christian-alexanders-projects-b132b23e`, proyecto `bancoticket` id `prj_iejWvEPXl3XhpggwnXzNNz7SzEOC`, plan Hobby). **Sin tareas programadas** (no hay `vercel.json`). |
| Despliegue | **Cada push a `main` despliega solo y hoy llega en ~1 minuto.** Comprobar con `npx vercel ls bancoticket --scope christian-alexanders-projects-b132b23e` hasta «Ready». Si Vercel no toma el push (pasó el 5-nov por un incidente de Vercel; ver vercel-status.com): **redesplegar** con el MCP de Vercel `create_deployment` con `deploymentId` del despliegue cancelado/fallido más reciente, `target:"production"`, `forceNew:"1"` (con `gitSource` dio 403). **No** usar `vercel --prod` local (subiría `.env.local` y `tiquetes-ejemplo/`). |
| Base de datos | Supabase (desde Vercel Storage), **plan Pro, compute Micro (1 GB RAM)** desde el 2026-11-04 (el cambio reinició Postgres sin pérdida de datos), us-east-1. Pro trae backups diarios (7 días); igual se hace el **respaldo completo** cada 15 días (§8). |
| IA | Anthropic API (`ANTHROPIC_API_KEY` solo en Vercel, Secret). Saldo prepagado en Claude Console (US$ 10 cargados el 20-oct; las recargas se registran en la app, tabla `recargas_ia`). |
| Registros del servidor | Vercel runtime logs (Hobby guarda **1 hora**). Cada lectura de tiquete escribe `console.info("lectura", {...})` (sin conductor ni cédulas). MCP de Vercel `get_runtime_logs`. |

## 4. Pila

- **Next.js 16.4** (App Router, TypeScript, Turbopack). ⚠️ `middleware` se llama **`proxy`** (`src/proxy.ts`; deja pasar sin sesión `/ingresar/*` y archivos .png/.webp/.ico/.jpg/.svg). Leer `node_modules/next/dist/docs/` antes de usar APIs nuevas. `cacheComponents` desactivado. Tras crear una página: `npx next typegen`.
- **Tailwind 4**; clases propias `tarjeta`, `boton-primario`, `boton-secundario`, `boton-peligro`, `boton-whatsapp`, `campo`, `etiqueta`, `titulo` en `src/app/globals.css`.
- **Supabase** (Postgres + Auth + Storage) con `@supabase/ssr`; RLS en todas las tablas. La app **no usa Realtime ni consultas automáticas**: solo consume recursos cuando alguien hace algo.
- **Anthropic SDK** — **la IA se usa SOLO para leer tiquetes y facturas de venta** (decisión del usuario; cada lectura cuenta en `consumo_ia` con su `modulo`):
  - Tiquetes: `claude-haiku-5-5`, `messages.parse` + `zodOutputFormat`, effort `medium` (`src/lib/lectura/lector-ia.ts`).
  - Facturas: `FACTURAS_MODELO` (por defecto `claude-haiku-5-5`), PDF como documento o imagen enderezada a 2000 px (`src/lib/facturas/lector.ts`). Lee también el **porcentaje impreso** de cada impuesto y la **descripción del ítem** (el tipo NO lo lee la IA). ⚠️ La API admite **máximo 16 campos que pueden ser null** en el esquema: hoy van 15 (impuestos y porcentajes van sin null para la IA; 0 = no aparece).
  - Aprender formato de extractora (solo admin): `claude-opus-5-5` (`src/lib/lectura/aprender.ts`).
- **sharp**, **exceljs 4.4.0** (Excel) y **fflate** (zip del respaldo).

## 5. Estructura de código (lo importante)

```
src/proxy.ts                          sesión + redirección a /ingresar
src/lib/supabase/{servidor,admin}.ts  con sesión (RLS) / service_role
src/lib/sesion.ts                     Rol (admin|desarrollador|comprador|consultor), esGestor, puedeConsultar, inicioDe,
                                      exigirAdmin/Desarrollador/Comprador/Consulta
src/lib/fechas.ts                     America/Bogota, es-CO, interpretarFechaTiquete, antiguedad (meses y días)
src/lib/numeros.ts · monto.ts         kilos/montos colombianos; formatearMonto, textoMonto, montoEnLetras, posicionTras
src/lib/saldo.ts · mensajes.ts · avisos.ts · whatsapp.ts · config.ts · fotos.ts (urlsFotos(rutas, segundos))
src/lib/paginacion.ts + components/paginacion.tsx   10 filas por página (25/50), conserva los filtros
src/lib/fotos-antiguas.ts             cuenta fotos con más de 6 meses (solo lectura; aviso al desarrollador)
src/lib/camara/*                      cámara guiada y nitidez (navegador y servidor)
src/lib/lectura/                      tipos, lector-ia (instrucción §7), controles, firma, aprender, consumo, parecidos
src/lib/informes/                     consulta (paginaInforme, totalesInforme) + tiquetes-excel; movimientos + cuenta +
                                      cuenta-excel («Tiquetes y anticipos»); anticipos + anticipos-excel; backup-excel
src/lib/facturas/                     tipos (FacturaLeida, TIPOS_FACTURA, clasificarFactura, nitDigitos), lector, validar,
                                      comprobacion (tarifas por tipo), formulario, consulta, cuenta, cuenta-excel, excel
src/lib/respaldo/                     comun (tablas, armarZip) y servidor (índice y páginas)
src/components/                       marco (menús), form-accion (Sí/No con confirmarCon/textoSi), valor-tiquete
                                      (peso × precio = valor), enviar-tiquete (EnviarFoto), campo-precio (precio por tonelada
                                      con miles, letras, por kilo y aviso de unidades), aviso-fotos-antiguas, ui, saldo, extracto…
src/app/api/leer-tiquete              foto → nitidez → IA → controles → duplicados → lectura firmada
src/app/api/facturas/leer             factura → tipo real por bytes → IA → duplicado CUFE → bucket facturas
src/app/api/exportar/{tiquetes,cuenta,anticipos,facturas,cuenta-cliente}   Excel (los 3 reportes también para consultores)
src/app/api/facturas/abono            registrar abono al cliente con soporte (ruta y no acción: soporte hasta 4 MB)
src/app/api/respaldo/{indice,tabla}   respaldo completo (solo desarrollador)
src/app/api/backup                    Excel de Backups. (Sin tareas programadas: las fotos ya no se borran solas, ver NOTAS 2026-11-04)
src/app/(app)/subir/                  subir tiquete (cámara o galería) + ventana «Tiquete registrado correctamente»
src/app/(app)/{mis-tiquetes,anticipos,extracto,avisos}   comprador
src/app/(app)/admin/                  panel (+ tarjeta-ia, form-recarga, recargas-ia: solo dev), pendientes, tiquetes,
                                      reportes (selector: tiquetes, cuenta, anticipos), anticipos (registrar,
                                      soporte, corregir/eliminar en disputa), compradores, extractoras, formatos,
                                      historial, claves (dev), backups (dev)
src/app/(app)/facturas/               lista (clientes, buscador, tipos, emisores), subir, [id] detalle (comprobación,
                                      corregir, anular/eliminar, auditoría), abonos/nuevo, clientes/[id] (cuenta del cliente)
src/app/(app)/consulta/               sección del Consultor (solo lectura)
scripts/                              aplicar-sql, prueba-lectura (npm run prueba), restaurar-respaldo, vaciar-*
docs/                                 NOTAS.md, RESPALDO.md, ARQUITECTURA.md, DESPLIEGUE.md, especificacion.pdf, este archivo
tiquetes-ejemplo/                     fotos reales con datos personales (en .gitignore, NO se sube)
```

## 6. Base de datos

**Migraciones aplicadas: 0001 a 0034.** Nunca editar una aplicada; crear la siguiente (`0035_nombre.sql`) y aplicarla con:
```
node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/0035_nombre.sql
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
| 0032 | facturas: `descripcion` del ítem y `tipo` (FRUTA, COMISION, OTRO) |
| 0033 | `configuracion.tarifas_por_tipo_factura`: fruta IVA 5 % / ReteFuente 1,5 %; comisión IVA 19 % / ReteFuente 11 %; retención en $ 0 = no aplicada |
| 0034 | abonos de un cliente a UN emisor: `fact_abonos.emisor_nit`/`emisor_nombre`, vistas `fact_emisores` y `fact_cuentas_saldo` (cuenta por cliente + emisor, independientes) |

Tablas: `perfiles`, `extractoras`, `formatos_extractora`, `anticipos` (estado `pendiente|confirmado|en_disputa`, `soporte_ruta`), `tiquetes_pendientes` y `tiquetes` (kilos enteros, `neto_impreso_kg`, `requiere_revision` + `motivo_revision` «Verificar: …», `datos_leidos.nota_ia`), `formatos_no_reconocidos`, `notificaciones`, `configuracion`, `consumo_ia`, `recargas_ia` (solo agregar; solo dev), `solicitudes_clave`, `historial` (disparadores; motivo con `fijar_contexto(accion, motivo)`). Facturas: `fact_clientes` (uno por NIT, solo dígitos), `fact_facturas` (APROBADA o `anulada`, `cliente_id`, impuestos + `*_pct` impresos, `descripcion`, `tipo` FRUTA/COMISION/OTRO, `motivo_revision` = diferencias al aprobar), `fact_abonos` (al cliente; VIGENTE/ANULADO, soporte), `fact_auditoria` (`datos` = copia al eliminar). Vistas `saldos`, `extracto`, `consumo_ia_totales`, `tiquetes_reporte`, `anticipos_reporte`, `fact_facturas_estado`, `fact_totales`, `fact_clientes_saldo` (deuda = Σ total a pagar aprobadas − Σ abonos vigentes; `facturas_vencidas`). Funciones de totales `reporte_tiquetes_totales`, `reporte_anticipos_totales`. Configuración relevante: `tarifas_por_tipo_factura` (0033, la que usa la app), `meses_conservacion_fotos` (6), `dias_aviso_respaldo` (15), `compradores_ocultos_consultor`. Buckets privados `tiquetes` (`<comprador>/…`, `<comprador>/anticipos/…`, `formatos/…`) y `facturas` (`<año>/…`, `abonos/<año>/…`).

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

**Comprador:** «Subir» → cámara o galería → lectura → datos (dudosos resaltados) → «Coincide, enviar» → ventana de confirmación. «Mis tiquetes» (10 por página) con tarjetas **Peso neto × Precio por tonelada = Valor** (`ValorTiquete`). «Anticipos» para confirmar o disputar (ve el soporte y si la administración corrigió tras su disputa). «Extracto».

**Administradora:**
- **Panel (Saldos):** indicadores (pendientes, para verificar, sin precio, anticipos en disputa, formatos no reconocidos, anticipos sin confirmar) y totales. (El consumo de IA ya no lo ve: es solo del desarrollador.)
- **Pendientes:** foto + datos; aprobar / rechazar / corregir; «Enviar foto por WhatsApp» debajo de la foto.
- **Tiquetes y precios** (10 por página): filtros, **precio en bloque** (aplica a TODO el filtro; el aviso dice cuántos) o individual («Cambiar precio» con motivo), editar, anular; tarjetas con `ValorTiquete`, botón azul **«Ver foto»** y «Enviar foto por WhatsApp». El precio por tonelada se escribe con `CampoPrecio` (miles, letras, por kilo, aviso si parece precio por kilo o un cero de más).
- **Reportes** (selector de 3 botones; todos paginados de a 10, totales de TODO el filtro y Excel con todo lo filtrado; **todo reporte nuevo debe tener Excel**): «Tiquetes» (filtros, editar/eliminar con Sí/No, foto, WhatsApp), «Tiquetes y anticipos» (saldo acumulado por fecha de registro; cada página arranca con «Saldo que viene de la página anterior») y **«Anticipos»** (fecha, comprador, estado; totales por estado; soporte).
- **Anticipos:** registrar con **monto didáctico** (puntos de miles, verde/rojo, en letras, botón ±), soporte (foto) opcional y **aviso Sí/No**; «Subir soporte» en pendientes; «Recordarle por WhatsApp». **En disputa:** «Corregir y volver a enviar» (vuelve a pendiente) o «Eliminar este anticipo» (motivo + «¿Está seguro?»).
- **Compradores:** crear (rol Comprador, Administrador o **Consultor**) / editar; cuenta con estado y extracto.
- **Extractoras** («Enseñar un tiquete»), **Formatos no reconocidos**, **Historial** (paginado, hasta el primer cambio).
- **Facturas** (`/facturas`, administradora y desarrollador):
  - **Subir:** PDF o imagen **elegida (sin cámara)**, máx. 4 MB → IA → formulario con **Tipo** (lista: Compra de fruta / Comisión / Otro, propuesto por `clasificarFactura` según descripción e IVA), **Descripción**, cada impuesto con su **% impreso** y la **Comprobación de cálculos** en vivo → **«Aprobar factura»** (Sí/No; si algo no cuadra lo lista y queda anotado). Solo se guarda al aprobar. CUFE único. **NIT del cliente obligatorio**; si el NIT ya existe con otro nombre, aviso con «Usar «nombre registrado»».
  - **Comprobación** (`src/lib/facturas/comprobacion.ts`, sin IA): kilos × precio = subtotal; cada impuesto con el **% impreso** (o, si no se leyó, el que coincida) validado contra las **tarifas del tipo**: **Compra de fruta IVA 5 %, ReteFuente 1,5 %; Comisión IVA 19 %, ReteFuente 11 %; ReteIVA 15 % del IVA**; una retención en $ 0 = «no se aplicó» (hay empresas que no la practican); total = subtotal + IVA − retenciones (± $ 1).
  - **Estados:** solo **Aprobada** o **Anulada** (con motivo, en cualquier momento; deja de sumar). Anulada → **Eliminar** (borra registro y archivo; copia en auditoría) para subirla de nuevo.
  - **Abonos de un CLIENTE a un EMISOR** (no a la factura; cada cliente + emisor es una cuenta independiente, vista `fact_cuentas_saldo`): «Registrar abono» → cliente y emisor (dos listas libres), monto, forma (Transferencia, Consignación, Cheque, Efectivo, Otro), N° de referencia, quién abona, fecha, observación, soporte opcional (foto/PDF) → Sí/No con la deuda antes y después. Abono mal hecho: anular con motivo → eliminar.
  - **Pestaña Facturas:** «Lo que me deben los clientes» (tarjeta por cliente: Le debe / Saldo a favor, vencidas sin cubrir, % abonado, Ver cuenta, Abonar), buscador (N°/CUFE, estado, **tipo**, cliente, emisor, fechas), totales por tipo, panel por emisor, tarjetas de factura (fondo azul, tipo, **descripción**, Ver detalle / Cuenta del cliente), totales por mes y Excel (impuestos, tarifas, tipo, descripción). **Cuenta del cliente:** facturas y abonos con saldo acumulado + Excel.

**Desarrollador además:**
- **Contraseñas** y **Backups**: **«Descargar respaldo completo»** (.zip armado en el navegador con las 17 tablas, usuarios sin contraseñas y todos los archivos; ~87 MB el 4-nov; aviso en rojo si pasan más de 15 días; restaurar con `scripts/restaurar-respaldo.mjs`, que reemplaza las filas de `configuracion` que crean las migraciones; ver `docs/RESPALDO.md`) y el Excel para consultar. Revisado el 4-nov: cubre todas las tablas y buckets.
- **Panel → Consumo de IA** (solo él): saldo estimado de créditos (recargas − gastado; amarillo < US$ 2, rojo < US$ 1), gastado total y del mes, lecturas que alcanzan, desglose y «Registrar recarga».
- **Fotos antiguas:** ya **no se borran solas** (se quitó la tarea diaria). Aviso en Panel y Backups cuando haya fotos de tiquetes con más de 6 meses (la primera, ~22-abr-2027). La limpieza se hace **a mano con el usuario**: respaldo antes y solo los archivos; **ningún registro se toca** (ese día, ajustar la pantalla para «Foto eliminada por antigüedad»).

**WhatsApp:** nunca se abre solo; siempre es un botón. Anticipos (registrar, recordar, corregir), bienvenida, contraseña restablecida, cuenta del comprador y **foto del tiquete** (menú Compartir del celular: WhatsApp pide elegir el chat; si el equipo no comparte archivos, abre el chat del comprador con enlace de 7 días). Los avisos automáticos de tiquetes van solo por la campana.

## 9. Decisiones del usuario (no revertir sin consultar)

- El comprador no elige extractora; la IA la detecta. Duplicados = extractora + número.
- Reglas de lectura de §7. Se cobra el neto impreso.
- **IA solo para leer tiquetes y facturas.** Consumo de IA crítico: consultar antes de agregar llamadas o tokens.
- WhatsApp solo con botón (§8).
- **En producción no se borran tablas ni registros** salvo lo que el usuario pida explícitamente (eliminar tiquete aprobado, anticipo en disputa), siempre con motivo y en el historial. Antes de cambiar la base: probar con transacción deshecha y cuadrar saldos.
- Un administrador y un desarrollador; consultores varios; contraseña por defecto 12345678; correo opcional.
- Facturas: módulo **independiente de los tiquetes** (prefijo `fact_`; al tocarlo, no tocar nada de tiquetes); cada impuesto en su campo con su % impreso; tarifas por tipo (fruta 5 % / 1,5 %; comisión 19 % / 11 %); abonos de un cliente a un emisor: **cada cliente con cada emisor es una cuenta independiente** (desde 2026-11-10; antes era una sola deuda por cliente); solo Aprobada/Anulada.
- Paginación de 10 filas (25/50) con totales y Excel de todo el filtro.
- Nada se borra solo en producción (fotos incluidas); cualquier limpieza es manual y con el usuario.
- La administradora no ve el consumo de IA; solo el desarrollador.
- Respaldo completo solo para el desarrollador, aviso cada 15 días.

## 10. Estado (2026-11-10)

- 15 usuarios: administradora, desarrollador, 1 consultor y 12 compradores. **385 tiquetes aprobados**, 19 pendientes, 55 anticipos, 470 archivos guardados.
- Facturas: **5** (FEPA 12, GLFE 10, FEIA 673 comisión, GLFE 13, FEPA 13: 4 Compra de fruta y 1 Comisión), **1 cliente** (SOLUCIONES AGROPECUARIAS Y FINANCIERAS S.A.S., NIT 901.253.217-5), **0 abonos** todavía. Las 5 dan «Todo coincide».
- IA: gastado ≈ US$ 1,49 de US$ 10 cargados; ≈ US$ 0,0018 por tiquete y ≈ US$ 0,0005 por factura.
- Respaldo completo hecho el 4-nov (antes de pasar a Supabase Pro). Cuadre del 2026-10-30: saldo de la app = cálculo desde cero = extracto = reporte.

### Extractoras aprendidas

| Nombre en la app | NIT | Nota |
|---|---|---|
| Babú Palm | 901249632 | número en rojo «N° Tiquete» |
| Palnorte | 900486803-8 | «ENTRADA DE MATERIA PRIMA No.», coma de miles |
| Oleoflores | 8901021101 | número = GUÍA TRANSPORTE VEHICULO |
| Agrovaspalma | 901.666.764-5 | el usuario la llama NodoLa4 |
| Lukeoil | (sin NIT) | papel térmico, suele venir girado |

## 11. Variables de entorno

Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING`, `ANTHROPIC_API_KEY` (Secret), `FIRMA_LECTURA_SECRETO`, `NEXT_PUBLIC_APP_URL`; opcional `FACTURAS_MODELO`. (`CRON_SECRET` ya no se usa: no hay tareas programadas.)
Local: `.env.local` tiene todo **menos `ANTHROPIC_API_KEY`** → la lectura con IA solo se prueba en producción.

## 12. Cómo trabajar

- Verificar antes de subir: `npx tsc --noEmit -p .`, `npx eslint src`, `npm run prueba`; página nueva: `npx next typegen`; cambios grandes: `npx next build`. Si quedan tipos viejos de una página borrada: `rm -rf .next/dev/types`.
- Subir: commit en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `git push origin main` y comprobar «Ready».
- Probar la base con **transacciones que se deshacen** (scripts temporales `scripts/_tmp-*` que se borran), comparando una «huella» antes/después (tiquetes, anticipos, saldos, facturas). Ver pantallas sin sesión: página temporal en `src/app/ingresar/vista-tmp` + `preview_start` (borrarla después). El panel del navegador recorta las capturas a la derecha: comprobar desborde con `scrollWidth`.
- Una migración que agrega columnas a `fact_facturas` debe **volver a crear `fact_facturas_estado` y `fact_totales`** (la vista toma `f.*` al crearse). Para cambiar un valor de `configuracion` sin modificar registros: agregar una fila nueva y que la app la prefiera.
- Probar con `tsx` módulos que tienen `import "server-only"`: usar el cliente de Supabase directo o redirigir ese módulo a un archivo vacío.
- PDFs: no hay pdftoppm; para leer texto instalar `pypdf` en la carpeta temporal (`pip install --target <scratchpad>/py pypdf`).
- En Windows, ediciones con tildes desde scripts: Python con `python -X utf8`.
- **Ya estamos en producción: no borrar nada sin pedírselo al usuario.**
- El usuario prueba en el celular (a veces por Remote Control; su teléfono usa letra grande: cifras largas en tarjetas de medio ancho se salen) y manda capturas. Español sencillo, sin discursos; antes de cambios grandes mostrar el plan y esperar «procede». Al terminar, **desplegar y confirmar «Ready»**.
- Registrar cada decisión en `docs/NOTAS.md` (fila nueva arriba) y mantener este archivo al día.

## 13. Pendientes

Aquí se anota solo lo que vaya saliendo (desde el 2026-11-03). Todo lo pedido hasta el 2026-11-10 está **hecho y desplegado**.

- Probar en uso real: el primer **abono** a un cliente con soporte, y una factura de **comisión con ReteFuente del 11 %**.
- Si cambian las tarifas por ley: ajustar `configuracion.tarifas_por_tipo_factura` (fila nueva o con permiso del usuario).
- ~22-abr-2027: primer aviso de fotos con más de 6 meses → limpieza manual con el usuario.
- Seguir el respaldo completo cada 15 días.
