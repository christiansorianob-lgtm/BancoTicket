import { NextResponse, type NextRequest } from "next/server";
import { esGestor, perfilActual } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";
import { cuentaCliente } from "@/lib/facturas/cuenta";
import { cuentaClienteExcel } from "@/lib/facturas/cuenta-excel";

/** Excel de la cuenta de un cliente de facturas (facturas y abonos con saldo). Solo administración. */
export async function GET(request: NextRequest) {
  const perfil = await perfilActual();
  if (!perfil || !esGestor(perfil.rol)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Cliente no válido" }, { status: 400 });
  const cuenta = await cuentaCliente(await supabaseServidor(), id);
  if (!cuenta) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  const archivo = await cuentaClienteExcel(cuenta.cliente, cuenta.movimientos, perfil.nombre);
  const nombre = cuenta.cliente.nombre.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="BancoTicket-cuenta-${nombre}-${hoyColombia()}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
