// Crea un administrador. La contraseña se pide en la terminal (no queda en el historial). Uso:
//   node --env-file=.env.local scripts/crear-admin.mjs <usuario> "<Nombre>" <celular> <correo>
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";

const [usuario, nombre, celular, correo] = process.argv.slice(2);
if (!usuario || !nombre || !celular || !correo) {
  console.error('Uso: node --env-file=.env.local scripts/crear-admin.mjs <usuario> "<Nombre>" <celular> <correo>');
  process.exit(1);
}

function preguntarOculto(texto) {
  return new Promise((resolver) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(s); };
    rl.question(texto, (r) => { rl.close(); process.stdout.write("\n"); resolver(r); });
  });
}

const clave = await preguntarOculto("Contraseña (mínimo 8 caracteres, no se verá al escribir): ");
const repetida = await preguntarOculto("Repita la contraseña: ");
if (clave !== repetida) { console.error("Las contraseñas no coinciden"); process.exit(1); }
if (clave.length < 8) { console.error("La contraseña debe tener al menos 8 caracteres"); process.exit(1); }

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const u = usuario.trim().toLowerCase();
const { data, error } = await db.auth.admin.createUser({ email: `${u}@bancoticket.local`, password: clave, email_confirm: true });
if (error) { console.error("Auth:", error.message); process.exit(1); }
const { error: e2 } = await db.from("perfiles").insert({ id: data.user.id, nombre, usuario: u, celular: celular.replace(/\D/g, ""), correo, rol: "admin" });
if (e2) { await db.auth.admin.deleteUser(data.user.id); console.error("Perfil:", e2.message); process.exit(1); }
console.log(`Administrador "${u}" creado. Ingrese en la app con ese usuario.`);
