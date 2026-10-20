import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { perfilActual } from "@/lib/sesion";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aprenderDeFoto } from "@/lib/lectura/aprender-guardar";

export const maxDuration = 60;

const TIPOS = ["image/webp", "image/jpeg"] as const;

/** El administrador sube la foto de un tiquete de ejemplo y el sistema aprende la extractora y su formato. */
export async function POST(request: Request) {
  const perfil = await perfilActual();
  if (!perfil || perfil.rol !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Falta la clave de Anthropic" }, { status: 503 });

  const imagen = (await request.formData()).get("imagen");
  if (!(imagen instanceof File) || !TIPOS.includes(imagen.type as (typeof TIPOS)[number])) {
    return NextResponse.json({ error: "La foto debe ser JPEG o WebP" }, { status: 400 });
  }
  if (imagen.size > 600_000) return NextResponse.json({ error: "La foto es demasiado grande" }, { status: 400 });

  const bytes = Buffer.from(await imagen.arrayBuffer());
  const ruta = `formatos/${randomUUID()}.${imagen.type === "image/webp" ? "webp" : "jpg"}`;
  const db = supabaseAdmin();
  const subida = await db.storage.from("tiquetes").upload(ruta, bytes, { contentType: imagen.type });
  if (subida.error) return NextResponse.json({ error: "No se pudo guardar la foto" }, { status: 500 });

  try {
    const r = await aprenderDeFoto({ bytes, tipo: imagen.type as (typeof TIPOS)[number], ruta }, perfil.id);
    if (!r.ok) await db.storage.from("tiquetes").remove([ruta]);
    revalidatePath("/admin/extractoras");
    return NextResponse.json(r);
  } catch (e) {
    await db.storage.from("tiquetes").remove([ruta]);
    console.error("Fallo al aprender formato", e);
    return NextResponse.json({ error: (e as Error).message || "No se pudo analizar la foto" }, { status: 500 });
  }
}
