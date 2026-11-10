import Link from "next/link";
import { Eye, HandCoins } from "lucide-react";
import { fecha } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { formatoNit, type CuentaSaldo } from "@/lib/facturas/tipos";

const porcentaje = (parte: number, total: number) => (total > 0 ? Math.min(100, Math.round((parte / total) * 100)) : 0);

/** Enlace a la cuenta de un cliente con un emisor. */
export const enlaceCuenta = (c: Pick<CuentaSaldo, "cliente_id" | "emisor_nit">) => `/facturas/clientes/${c.cliente_id}?emisor=${c.emisor_nit}`;

/**
 * Tarjeta de la cuenta de un CLIENTE con un EMISOR (independiente de las demás): deuda, vencidas,
 * % abonado, facturado, abonado, último abono, «Ver cuenta» y «Abonar».
 */
export function TarjetaCuenta({ c, titulo = "cliente" }: { c: CuentaSaldo; titulo?: "cliente" | "emisor" }) {
  const debe = c.deuda > 1, aFavor = c.deuda < -1;
  return (
    <li className="tarjeta space-y-3">
      <div>
        {titulo === "cliente" ? (
          <>
            <p className="font-bold text-profundo">{c.cliente_nombre}</p>
            <p className="text-xs text-suave">NIT {formatoNit(c.cliente_nit)}</p>
            <p className="mt-1 text-sm font-semibold text-primario">Emisor: {c.emisor_nombre}</p>
          </>
        ) : (
          <>
            <p className="font-bold text-profundo">{c.emisor_nombre}</p>
            <p className="text-xs text-suave">Emisor · NIT {formatoNit(c.emisor_nit)}</p>
          </>
        )}
      </div>
      <div className={`rounded-xl p-3 ${debe ? "bg-alerta-suave" : "bg-ok-suave"}`}>
        <p className="text-xs font-semibold text-suave">{debe ? "Le debe" : aFavor ? "Saldo a favor del cliente" : "Cuenta al día"}</p>
        <p className={`text-2xl font-black tabular-nums ${debe ? "text-alerta" : "text-ok"}`}>{formatoPesos(Math.abs(c.deuda))}</p>
        {c.facturas_vencidas > 0 && <p className="text-xs font-semibold text-error">{c.facturas_vencidas} factura(s) vencida(s) sin cubrir</p>}
      </div>
      <div>
        <div className="flex justify-between text-xs text-suave"><span>Abonado de lo facturado</span><span className="font-semibold">{porcentaje(c.abonado, c.facturado)} %</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-borde/60"><div className="h-full rounded-full bg-ok" style={{ width: `${porcentaje(c.abonado, c.facturado)}%` }} /></div>
      </div>
      <dl className="space-y-1 text-sm tabular-nums">
        <div className="flex justify-between gap-2"><dt className="text-suave">Facturado ({c.facturas})</dt><dd className="font-semibold">{formatoPesos(c.facturado)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-suave">Abonado ({c.abonos})</dt><dd className="font-semibold text-ok">{formatoPesos(c.abonado)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-suave">Último abono</dt><dd>{c.ultimo_abono ? fecha(c.ultimo_abono) : "—"}</dd></div>
      </dl>
      <div className="grid grid-cols-2 gap-2">
        <Link href={enlaceCuenta(c)} className="boton-secundario min-h-10 text-sm"><Eye className="size-4" aria-hidden /> Ver cuenta</Link>
        <Link href={`/facturas/abonos/nuevo?cliente=${c.cliente_id}&emisor=${c.emisor_nit}`} className="boton-primario min-h-10 text-sm"><HandCoins className="size-4" aria-hidden /> Abonar</Link>
      </div>
    </li>
  );
}
