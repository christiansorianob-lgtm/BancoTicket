"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, HandCoins, Paperclip } from "lucide-react";
import { Mensaje } from "@/components/ui";
import { montoDesdeTexto } from "@/lib/numeros";
import { formatearMonto, montoEnLetras, textoMonto } from "@/lib/monto";
import { hoyColombia } from "@/lib/fechas";
import { FORMAS_PAGO, NOMBRE_FORMA_PAGO, formatoNit, type ClienteSaldo, type CuentaSaldo, type Emisor } from "@/lib/facturas/tipos";
import { MAX_BYTES_FACTURA } from "@/lib/facturas/validar";

/** Deuda en palabras: positiva «Le debe», negativa «Saldo a favor del cliente». */
const deudaEnTexto = (d: number) => (d < -1 ? `Saldo a favor del cliente ${textoMonto(-d)}` : d > 1 ? `Le debe ${textoMonto(d)}` : "Cuenta al día");

/**
 * Registrar un abono de un CLIENTE a un EMISOR (decisión del usuario 2026-11-10): cada cliente con
 * cada emisor es una cuenta independiente. Cliente y emisor se eligen de dos listas libres. Antes de
 * guardar, aviso Sí / No con la deuda de esa cuenta antes y después.
 */
export function FormAbono({ clientes, emisores, cuentas, inicial, inicialEmisor }: {
  clientes: ClienteSaldo[]; emisores: Emisor[]; cuentas: CuentaSaldo[]; inicial: string; inicialEmisor: string;
}) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState(inicial);
  const [emisorNit, setEmisorNit] = useState(inicialEmisor);
  const [monto, setMonto] = useState("");
  const [confirmar, setConfirmar] = useState<FormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const cliente = clientes.find((c) => c.id === clienteId);
  const emisor = emisores.find((e) => e.nit === emisorNit);
  // Cuenta de ese cliente con ese emisor (sin facturas ni abonos todavía = 0).
  const cuenta = cuentas.find((c) => c.cliente_id === clienteId && c.emisor_nit === emisorNit);
  const deuda = cuenta?.deuda ?? 0;
  const valor = montoDesdeTexto(monto.replace(/,$/, "")) ?? 0;

  return (
    <form className="tarjeta space-y-4"
      onChange={() => confirmar && setConfirmar(null)}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const datos = new FormData(e.currentTarget);
        const soporte = datos.get("soporte");
        if (soporte instanceof File && soporte.size > MAX_BYTES_FACTURA) return setError("El soporte pesa más de 4 MB.");
        if (!cliente) return setError("Elija el cliente.");
        if (!emisor) return setError("Elija el emisor.");
        if (valor <= 0) return setError("Escriba el monto abonado.");
        setConfirmar(datos);
      }}>
      <label className="block">
        <span className="etiqueta">Cliente (extractora que paga)</span>
        <select name="cliente_id" required value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="campo">
          <option value="">Elija el cliente…</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} – NIT {formatoNit(c.nit)}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="etiqueta">Emisor (a quién le paga)</span>
        <select name="emisor_nit" required value={emisorNit} onChange={(e) => setEmisorNit(e.target.value)} className="campo">
          <option value="">Elija el emisor…</option>
          {emisores.map((e) => <option key={e.nit} value={e.nit}>{e.nombre} – NIT {formatoNit(e.nit)}</option>)}
        </select>
      </label>
      {cliente && emisor && (
        <div className="rounded-xl bg-primario-suave p-3 text-sm">
          <p className="font-bold text-profundo">{cliente.nombre} → {emisor.nombre}</p>
          <p className={`text-lg font-black ${deuda > 1 ? "text-alerta" : "text-ok"}`}>{deudaEnTexto(deuda)}</p>
          <p className="text-suave">{cuenta ? `${cuenta.facturas} factura(s) por ${textoMonto(cuenta.facturado)} · abonado ${textoMonto(cuenta.abonado)}` : "Este emisor aún no tiene facturas ni abonos con este cliente."}</p>
        </div>
      )}

      <div>
        <span className="etiqueta">Monto abonado (COP)</span>
        <input name="monto" inputMode="decimal" autoComplete="off" required value={monto} placeholder="Ej.: 50.000.000"
          className={`campo text-lg font-bold tabular-nums ${valor > 0 ? "border-ok text-ok" : ""}`}
          onChange={(e) => setMonto(formatearMonto(e.target.value.replace(/-/g, "")))} onBlur={() => setMonto((v) => v.replace(/,$/, ""))} />
        {valor > 0 && <p className="mt-1 text-sm font-semibold text-ok">{textoMonto(valor)} · {montoEnLetras(valor)}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="etiqueta">Forma de pago</span>
          <select name="forma_pago" required defaultValue="TRANSFERENCIA" className="campo">
            {FORMAS_PAGO.map((f) => <option key={f} value={f}>{NOMBRE_FORMA_PAGO[f]}</option>)}
          </select>
        </label>
        <label><span className="etiqueta">N° de referencia (opcional)</span>
          <input name="referencia" className="campo" placeholder="Ej.: 0012345678" title="N° de la transacción, de la consignación o del cheque" />
          <span className="mt-1 block text-xs text-suave">N° de la transacción, de la consignación o del cheque.</span>
        </label>
        <label><span className="etiqueta">Quién realiza el abono</span>
          <input name="realizado_por" required className="campo" placeholder="Nombre y apellido" autoComplete="off" />
        </label>
        <label><span className="etiqueta">Fecha del abono</span>
          <input name="fecha" type="date" required defaultValue={hoyColombia()} className="campo" />
        </label>
        <label className="sm:col-span-2"><span className="etiqueta">Observación (opcional)</span>
          <textarea name="observacion" rows={2} className="campo" placeholder="Ej.: abono de la quincena, pago parcial acordado…" />
        </label>
        <label className="sm:col-span-2"><span className="etiqueta flex items-center gap-1"><Paperclip className="size-4" aria-hidden /> Soporte (opcional)</span>
          <input name="soporte" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="campo text-sm" />
          <span className="mt-1 block text-xs text-suave">Foto o PDF de la consignación o transferencia, máximo 4 MB.</span>
        </label>
      </div>

      {confirmar && cliente && emisor ? (
        <div className="space-y-3 rounded-xl border-2 border-alerta bg-alerta-suave p-3" role="alertdialog" aria-label="Confirmar abono">
          <p className="flex items-start gap-2 text-sm font-semibold text-profundo">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-alerta" aria-hidden />
            <span>Abono de {textoMonto(valor)} de {cliente.nombre} a {emisor.nombre}.<br />
              Deuda antes: {deudaEnTexto(deuda)} → queda en: <b>{deudaEnTexto(deuda - valor)}</b>. ¿Registrar el abono?</span>
          </p>
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            <button type="button" className="boton-primario" disabled={guardando}
              onClick={() => iniciar(async () => {
                const r = await fetch("/api/facturas/abono", { method: "POST", body: confirmar });
                const json = await r.json().catch(() => ({}));
                if (!r.ok) { setConfirmar(null); return setError(json.error ?? "No se pudo registrar el abono"); }
                router.push(`/facturas/clientes/${cliente.id}?emisor=${emisor.nit}`);
                router.refresh();
              })}>{guardando ? "Guardando…" : "Sí, registrar"}</button>
            <button type="button" className="boton-secundario" disabled={guardando} onClick={() => setConfirmar(null)}>No</button>
          </div>
        </div>
      ) : (
        <button className="boton-primario w-full sm:w-auto"><HandCoins className="size-5" aria-hidden /> Registrar abono</button>
      )}
      {error && <Mensaje tono="error">{error}</Mensaje>}
    </form>
  );
}
