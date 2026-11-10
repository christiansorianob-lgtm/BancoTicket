import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { consultarClientes, consultarCuentas, consultarEmisores } from "@/lib/facturas/consulta";
import { Vacio } from "@/components/ui";
import { FormAbono } from "./form-abono";

/**
 * Registrar un abono de un cliente a un emisor. `?cliente=<id>&emisor=<nit>` llegan ya elegidos.
 * Cada cliente con cada emisor es una cuenta independiente (decisión del usuario 2026-11-10).
 */
export default async function NuevoAbono({ searchParams }: PageProps<"/facturas/abonos/nuevo">) {
  const sp = await searchParams;
  const supabase = await supabaseServidor();
  const [todos, emisores, cuentas] = await Promise.all([consultarClientes(supabase), consultarEmisores(supabase), consultarCuentas(supabase)]);
  const clientes = todos.sort((a, b) => a.nombre.localeCompare(b.nombre));
  const inicial = typeof sp.cliente === "string" && clientes.some((c) => c.id === sp.cliente) ? sp.cliente : clientes.length === 1 ? clientes[0].id : "";
  const inicialEmisor = typeof sp.emisor === "string" && emisores.some((e) => e.nit === sp.emisor) ? sp.emisor : "";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Registrar abono</h1>
        <Link href="/facturas" className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a facturas</Link>
      </div>
      <p className="text-sm text-suave">Elija qué cliente paga y a qué emisor. El abono baja solo la deuda de ese cliente con ese emisor: cada cuenta es independiente.</p>
      {clientes.length === 0 || emisores.length === 0 ? <Vacio>Aún no hay clientes ni emisores: se registran al aprobar la primera factura.</Vacio>
        : <FormAbono clientes={clientes} emisores={emisores} cuentas={cuentas} inicial={inicial} inicialEmisor={inicialEmisor} />}
    </>
  );
}
