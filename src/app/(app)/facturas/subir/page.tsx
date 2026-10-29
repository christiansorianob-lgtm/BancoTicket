import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SubirFactura } from "./subir-factura";

export default function SubirFacturaPagina() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Subir factura</h1>
        <Link href="/facturas" className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a facturas</Link>
      </div>
      <SubirFactura />
    </>
  );
}
