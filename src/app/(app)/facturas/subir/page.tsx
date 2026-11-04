import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { leerConfiguracion } from "@/lib/config";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { SubirFactura } from "./subir-factura";

export default async function SubirFacturaPagina() {
  const [{ tarifas_factura }, { data: clientes }] = await Promise.all([
    leerConfiguracion(), (await supabaseServidor()).from("fact_clientes").select("nit, nombre"),
  ]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Subir factura</h1>
        <Link href="/facturas" className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a facturas</Link>
      </div>
      <SubirFactura tarifas={tarifas_factura} clientes={clientes ?? []} />
    </>
  );
}
