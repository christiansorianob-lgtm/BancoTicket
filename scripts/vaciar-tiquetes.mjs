// Borra solo los tiquetes (pendientes, aprobados, rechazados y no reconocidos) y sus fotos,
// para volver a hacer pruebas. Conserva extractoras, formatos aprendidos, anticipos y usuarios. Uso:
//   node --env-file=.env.local scripts/vaciar-tiquetes.mjs --si
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--si")) {
  console.error("Borra todos los tiquetes y sus fotos. Confirme con --si");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
await c.query("truncate tiquetes, tiquetes_pendientes, formatos_no_reconocidos");
await c.query("delete from historial where tabla in ('tiquetes', 'tiquetes_pendientes')");
await c.query("delete from notificaciones where enlace like '/mis-tiquetes%' or enlace like '/admin/pendientes%' or enlace like '/admin/formatos%'");
await c.query("commit");
await c.end();

// Fotos de los compradores (carpetas por usuario); la carpeta «formatos» son los ejemplos aprendidos y se conserva.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let borradas = 0;
const { data: carpetas } = await db.storage.from("tiquetes").list("", { limit: 1000 });
for (const carpeta of carpetas ?? []) {
  if (carpeta.name === "formatos") continue;
  const { data: archivos } = await db.storage.from("tiquetes").list(carpeta.name, { limit: 1000 });
  const rutas = (archivos ?? []).map((a) => `${carpeta.name}/${a.name}`);
  if (rutas.length) { await db.storage.from("tiquetes").remove(rutas); borradas += rutas.length; }
}
console.log(`Tiquetes borrados. Fotos de compradores borradas: ${borradas}`);
