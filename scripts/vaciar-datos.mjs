// Deja la base sin datos de negocio para empezar de cero (solo en desarrollo).
// Conserva los usuarios (perfiles y accesos) y la configuración. Uso:
//   node --env-file=.env.local scripts/vaciar-datos.mjs --si
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--si")) {
  console.error("Borra extractoras, tiquetes, anticipos, avisos, historial y fotos. Confirme con --si");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query(`truncate notificaciones, historial, formatos_no_reconocidos, tiquetes, tiquetes_pendientes,
               anticipos, formatos_extractora, extractoras restart identity cascade`);
await c.end();

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let borradas = 0;
const { data: carpetas } = await db.storage.from("tiquetes").list("", { limit: 1000 });
for (const carpeta of carpetas ?? []) {
  const { data: archivos } = await db.storage.from("tiquetes").list(carpeta.name, { limit: 1000 });
  const rutas = (archivos ?? []).map((a) => `${carpeta.name}/${a.name}`);
  if (rutas.length) { await db.storage.from("tiquetes").remove(rutas); borradas += rutas.length; }
}
console.log(`Base vacía (usuarios conservados). Fotos borradas: ${borradas}`);
