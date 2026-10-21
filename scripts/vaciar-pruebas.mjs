// Borra los datos que se generan al probar: tiquetes, anticipos, avisos, solicitudes de contraseña, historial y fotos
// de compradores. Conserva usuarios, extractoras con sus formatos aprendidos (aprenderlos
// cuesta IA) y el registro de consumo de IA. Uso:
//   node --env-file=.env.local scripts/vaciar-pruebas.mjs --si
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--si")) {
  console.error("Borra tiquetes, anticipos, avisos, historial y fotos de compradores. Confirme con --si");
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("truncate tiquetes, tiquetes_pendientes, formatos_no_reconocidos, anticipos, notificaciones, solicitudes_clave, historial restart identity");
await c.end();

// Fotos de los compradores; la carpeta «formatos» (ejemplos aprendidos) se conserva.
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let borradas = 0;
const { data: carpetas } = await db.storage.from("tiquetes").list("", { limit: 1000 });
for (const carpeta of carpetas ?? []) {
  if (carpeta.name === "formatos") continue;
  const { data: archivos } = await db.storage.from("tiquetes").list(carpeta.name, { limit: 1000 });
  const rutas = (archivos ?? []).map((a) => `${carpeta.name}/${a.name}`);
  if (rutas.length) { await db.storage.from("tiquetes").remove(rutas); borradas += rutas.length; }
}
console.log(`Datos de prueba borrados. Fotos de compradores borradas: ${borradas}`);
