// Ejecuta una migración SQL en la base de Supabase. Uso:
//   node --env-file=.env.local scripts/aplicar-sql.mjs supabase/migrations/0001_esquema.sql
import { readFileSync } from "node:fs";
import pg from "pg";

const archivo = process.argv[2];
if (!archivo) { console.error("Indique el archivo .sql"); process.exit(1); }
const url = process.env.POSTGRES_URL_NON_POOLING;
if (!url) { console.error("Falta POSTGRES_URL_NON_POOLING en .env.local"); process.exit(1); }

const cliente = new pg.Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false } });
await cliente.connect();
try {
  await cliente.query("begin");
  await cliente.query(readFileSync(archivo, "utf8"));
  await cliente.query("commit");
  console.log(`Aplicado: ${archivo}`);
} catch (e) {
  await cliente.query("rollback");
  console.error("Error, no se aplicó nada:", e.message);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
