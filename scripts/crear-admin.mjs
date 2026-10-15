// Crea el primer administrador. Uso:
//   node --env-file=.env.local scripts/crear-admin.mjs <usuario> <contraseña> "<Nombre>" <celular> <correo>
import { createClient } from "@supabase/supabase-js";

const [usuario, clave, nombre, celular, correo] = process.argv.slice(2);
if (!usuario || !clave || !nombre || !celular || !correo) {
  console.error('Uso: node --env-file=.env.local scripts/crear-admin.mjs <usuario> <contraseña> "<Nombre>" <celular> <correo>');
  process.exit(1);
}
if (clave.length < 8) { console.error("La contraseña debe tener al menos 8 caracteres"); process.exit(1); }

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const u = usuario.trim().toLowerCase();
const { data, error } = await db.auth.admin.createUser({ email: `${u}@bancoticket.local`, password: clave, email_confirm: true });
if (error) { console.error("Auth:", error.message); process.exit(1); }
const { error: e2 } = await db.from("perfiles").insert({ id: data.user.id, nombre, usuario: u, celular: celular.replace(/\D/g, ""), correo, rol: "admin" });
if (e2) { await db.auth.admin.deleteUser(data.user.id); console.error("Perfil:", e2.message); process.exit(1); }
console.log(`Administrador "${u}" creado.`);
