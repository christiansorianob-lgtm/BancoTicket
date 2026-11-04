import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { consultarClientes } from "@/lib/facturas/consulta";
import { Vacio } from "@/components/ui";
import { FormAbono } from "./form-abono";

/** Registrar un abono al cliente. `?cliente=<id>` llega con el cliente ya elegido. */
export default async function NuevoAbono({ searchParams }: PageProps<"/facturas/abonos/nuevo">) {
  const sp = await searchParams;
  const clientes = (await consultarClientes(await supabaseServidor())).sort((a, b) => a.nombre.localeCompare(b.nombre));
  const inicial = typeof sp.cliente === "string" && clientes.some((c) => c.id === sp.cliente) ? sp.cliente : clientes.length === 1 ? clientes[0].id : "";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Registrar abono</h1>
        <Link href="/facturas" className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a facturas</Link>
      </div>
      <p className="text-sm text-suave">El abono baja la deuda total del cliente (la suma de sus facturas aprobadas), no la de una factura en particular.</p>
      {clientes.length === 0 ? <Vacio>Aún no hay clientes: se registran al aprobar su primera factura.</Vacio> : <FormAbono clientes={clientes} inicial={inicial} />}
    </>
  );
}
