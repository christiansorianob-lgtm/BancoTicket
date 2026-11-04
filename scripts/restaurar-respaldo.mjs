// Restaura un respaldo completo de BancoTicket (el .zip del botón «Descargar respaldo completo»).
//
//   Ensayo (por defecto, NO escribe nada): valida el .zip y muestra lo que contiene.
//     node scripts/restaurar-respaldo.mjs ruta/al/respaldo.zip
//
//   Restaurar en un proyecto NUEVO y VACÍO de Supabase (ver docs/RESPALDO.md):
//     node --env-file=.env.destino scripts/restaurar-respaldo.mjs ruta/al/respaldo.zip --aplicar
//
// Protecciones: con --aplicar exige RESTAURAR_CONFIRMADO=si en el entorno y se niega si la base de
// destino ya tiene usuarios o tiquetes (nunca sobrescribe una base en uso).
import { readFileSync } from "node:fs";
import { unzipSync, strFromU8 } from "fflate";

const [ruta, modo] = process.argv.slice(2);
if (!ruta) { console.error("Uso: node scripts/restaurar-respaldo.mjs respaldo.zip [--aplicar]"); process.exit(1); }
const aplicar = modo === "--aplicar";
const CLAVE = "12345678";
const IDENTIDAD = new Set(["historial", "consumo_ia", "fact_auditoria"]); // id «generated always»

const zip = unzipSync(readFileSync(ruta));
const leer = (n) => { if (!zip[n]) throw new Error(`Falta ${n} en el respaldo`); return JSON.parse(strFromU8(zip[n])); };
const resumen = leer("resumen.json");
if (resumen.app !== "BancoTicket") throw new Error("No es un respaldo de BancoTicket");

// ---- Ensayo: que todo lo anunciado en resumen.json esté en el .zip ----
let problemas = 0;
const tablas = {};
console.log(`Respaldo del ${resumen.generado} (migraciones ${resumen.migraciones})`);
for (const t of resumen.orden) {
  tablas[t] = leer(`datos/${t}.json`);
  const ok = tablas[t].length === resumen.conteos[t];
  if (!ok) problemas++;
  console.log(`${ok ? "OK " : "MAL"} ${t.padEnd(24)} ${tablas[t].length} filas${ok ? "" : ` (resumen dice ${resumen.conteos[t]})`}`);
}
const usuarios = leer("datos/usuarios.json");
const archivos = Object.keys(zip).filter((n) => n.startsWith("archivos/") && zip[n].length > 0);
const bytes = archivos.reduce((s, n) => s + zip[n].length, 0);
const okU = usuarios.length === resumen.usuarios, okA = archivos.length === resumen.archivos.total && bytes === resumen.archivos.bytes;
if (!okU) problemas++;
if (!okA) problemas++;
console.log(`${okU ? "OK " : "MAL"} usuarios                 ${usuarios.length}`);
console.log(`${okA ? "OK " : "MAL"} archivos                 ${archivos.length} (${(bytes / 1048576).toFixed(1)} MB)`);
const sinUsuario = tablas.perfiles.filter((p) => !usuarios.some((u) => u.id === p.id)).length;
if (sinUsuario) { problemas++; console.log(`MAL ${sinUsuario} perfil(es) sin su usuario`); }
if (problemas) { console.error(`\n${problemas} problema(s): el respaldo está incompleto.`); process.exit(1); }
console.log("\nEl respaldo está completo y es coherente.");
if (!aplicar) { console.log("(Ensayo: no se escribió nada. Para restaurar, ver docs/RESPALDO.md)"); process.exit(0); }

// ---- Restaurar ----
if (process.env.RESTAURAR_CONFIRMADO !== "si") throw new Error("Falta RESTAURAR_CONFIRMADO=si en el entorno de destino");
const pg = (await import("pg")).default;
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const c = new pg.Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows: [ocupada] } = await c.query("select (select count(*) from auth.users) u, (select count(*) from public.tiquetes) t");
if (Number(ocupada.u) > 0 || Number(ocupada.t) > 0) throw new Error("La base de destino NO está vacía: no se restaura encima de datos existentes");

console.log("\nCreando usuarios (contraseña 12345678)…");
for (const u of usuarios) {
  const { error } = await db.auth.admin.createUser({ id: u.id, email: u.email, password: CLAVE, email_confirm: true });
  if (error) throw new Error(`usuario ${u.email}: ${error.message}`);
}

console.log("Cargando datos…");
await c.query("begin");
try {
  for (const t of resumen.orden) {
    const filas = tablas[t];
    // Sin disparadores (no duplicar el historial ni bloquear soportes) y sin columnas calculadas.
    await c.query(`alter table public.${t} disable trigger user`);
    if (filas.length) {
      const { rows } = await c.query("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 and is_generated <> 'ALWAYS'", [t]);
      const cols = rows.map((r) => `"${r.column_name}"`).join(", ");
      for (let i = 0; i < filas.length; i += 500) {
        // Las migraciones ya crean filas de configuración con su valor inicial: se reemplazan por las del respaldo.
        const conflicto = t === "configuracion" ? "on conflict (clave) do update set valor = excluded.valor" : "";
        await c.query(`insert into public.${t} (${cols}) ${IDENTIDAD.has(t) ? "overriding system value" : ""}
                       select ${cols} from json_populate_recordset(null::public.${t}, $1) ${conflicto}`, [JSON.stringify(filas.slice(i, i + 500))]);
      }
      if (IDENTIDAD.has(t)) await c.query(`select setval(pg_get_serial_sequence('public.${t}', 'id'), (select max(id) from public.${t}))`);
    }
    await c.query(`alter table public.${t} enable trigger user`);
    console.log(`  ${t}: ${filas.length}`);
  }
  // Los usuarios restaurados quedan con la contraseña por defecto: se les recomienda cambiarla.
  await c.query("update public.perfiles set cambiar_clave = true");
  await c.query("commit");
} catch (e) {
  await c.query("rollback");
  throw e;
}
await c.end();

console.log("Subiendo archivos…");
for (const n of archivos) {
  const [, bucket, ...resto] = n.split("/");
  const ext = n.split(".").pop().toLowerCase();
  const tipo = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", pdf: "application/pdf" }[ext] ?? "application/octet-stream";
  const { error } = await db.storage.from(bucket).upload(resto.join("/"), zip[n], { contentType: tipo, upsert: true });
  if (error) throw new Error(`${n}: ${error.message}`);
}
console.log(`\nRestauración terminada: ${usuarios.length} usuarios, ${archivos.length} archivos. Todos entran con la contraseña ${CLAVE}.`);
