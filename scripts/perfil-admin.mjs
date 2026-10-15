// Crea el perfil de administrador para un usuario que ya existe en Supabase Auth
// (creado en Authentication → Users con el correo <usuario>@bancoticket.local). Uso:
//   node --env-file=.env.local scripts/perfil-admin.mjs <usuario> "<Nombre>" <celular> <correo>
import { createClient } from "@supabase/supabase-js";

const [usuario, nombre, celular, correo] = process.argv.slice(2);
if (!usuario || !nombre || !celular || !correo) {
  console.error('Uso: node --env-file=.env.local scripts/perfil-admin.mjs <usuario> "<Nombre>" <celular> <correo>');
  process.exit(1);
}
const u = usuario.trim().toLowerCase();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
if (error) { console.error(error.message); process.exit(1); }
const usuarioAuth = data.users.find((x) => x.email === `${u}@bancoticket.local`);
if (!usuarioAuth) { console.error(`No existe ${u}@bancoticket.local en Authentication → Users`); process.exit(1); }
const { error: e2 } = await db.from("perfiles").upsert({ id: usuarioAuth.id, nombre, usuario: u, celular: celular.replace(/\D/g, ""), correo, rol: "admin", activo: true });
if (e2) { console.error("Perfil:", e2.message); process.exit(1); }
console.log(`Perfil de administrador listo para "${u}".`);
