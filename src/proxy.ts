import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLICAS = ["/ingresar"];

/** Refresca la sesión de Supabase y manda al inicio de sesión a quien no la tenga. */
export async function proxy(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return new NextResponse(
      `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BancoTicket</title><body style="font-family:system-ui;background:#eef2f7;color:#0f1e33;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<div style="background:#fff;border-radius:16px;padding:24px;max-width:420px;box-shadow:0 2px 8px #0001">
<h1 style="color:#1e3a8a;margin-top:0">BancoTicket</h1>
<p>La aplicación todavía no está configurada: faltan las variables de entorno de Supabase.</p>
<p style="color:#4a5b72;font-size:14px">Ver docs/DESPLIEGUE.md.</p></div></body></html>`,
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista, headers) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => respuesta.headers.set(k, v));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const ruta = request.nextUrl.pathname;

  if (!data?.claims && !PUBLICAS.some((p) => ruta.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "";
    if (ruta !== "/") url.searchParams.set("volver", ruta + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/cron|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
