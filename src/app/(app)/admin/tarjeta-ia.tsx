import { ExternalLink, Sparkles } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha } from "@/lib/fechas";
import { FormRecarga } from "./form-recarga";

/** Avisos del saldo de IA (solo avisan): amarillo por debajo de US$ 2 y rojo por debajo de US$ 1. */
const SALDO_BAJO = 2;
const SALDO_MUY_BAJO = 1;

const usd = (n: number, dec = 2) => `US$ ${n.toLocaleString("es-CO", { minimumFractionDigits: dec, maximumFractionDigits: Math.max(dec, 4) })}`;
const plural = (n: number, s: string, p = `${s}s`) => `${n.toLocaleString("es-CO")} ${n === 1 ? s : p}`;

/**
 * Consumo de IA (decisión del usuario, 2026-11-06): solo para el desarrollador. Totales desde el
 * inicio y del mes, y cuánto queda del crédito cargado en Claude Console (recargas − lo gastado).
 * Es una estimación con el registro de la app; la cifra exacta está en la Console.
 */
export async function TarjetaIA() {
  const supabase = await supabaseServidor();
  const [{ data: totales }, { data: recargas }] = await Promise.all([
    supabase.from("consumo_ia_totales").select("*"),
    supabase.from("recargas_ia").select("fecha, monto_usd, nota").order("fecha"),
  ]);
  const filas = (totales ?? []).map((t) => ({ modulo: t.modulo as string, tipo: t.tipo as string, usos: Number(t.usos), costo: Number(t.costo), usosMes: Number(t.usos_mes), costoMes: Number(t.costo_mes) }));
  const de = (f: (x: (typeof filas)[number]) => boolean) => filas.filter(f).reduce((s, x) => ({ usos: s.usos + x.usos, costo: s.costo + x.costo, usosMes: s.usosMes + x.usosMes, costoMes: s.costoMes + x.costoMes }), { usos: 0, costo: 0, usosMes: 0, costoMes: 0 });
  const tiquetes = de((x) => x.modulo === "tiquetes" && x.tipo === "lectura");
  const facturas = de((x) => x.modulo === "facturas");
  const formatos = de((x) => x.tipo === "aprendizaje");
  const total = de(() => true);
  const otros = total.costo - tiquetes.costo - facturas.costo - formatos.costo; // ajustes para cuadrar con la Console
  const cargado = (recargas ?? []).reduce((s, r) => s + Number(r.monto_usd), 0);
  const saldo = cargado - total.costo;
  const usado = cargado > 0 ? Math.min(100, (total.costo / cargado) * 100) : 0;
  const porTiquete = tiquetes.usos ? tiquetes.costo / tiquetes.usos : 0;
  const alcanza = porTiquete > 0 ? Math.max(0, Math.floor(saldo / porTiquete)) : null;
  const tono = saldo < SALDO_MUY_BAJO ? "error" : saldo < SALDO_BAJO ? "alerta" : "ok";

  return (
    <section className="tarjeta space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-profundo"><Sparkles className="size-5" aria-hidden /> Consumo de IA</h2>
          <p className="text-xs text-suave">Solo lo ve el desarrollador. Estimado con el registro de la app; la cifra exacta está en Claude Console.</p>
        </div>
        <a href="https://platform.claude.com/dashboard" target="_blank" rel="noopener noreferrer" className="boton-secundario min-h-9 text-sm"><ExternalLink className="size-4" aria-hidden /> Claude Console</a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`rounded-xl p-3 ${tono === "ok" ? "bg-ok-suave" : tono === "alerta" ? "bg-alerta-suave" : "bg-error-suave"}`}>
          <p className="text-xs font-semibold text-suave">Saldo estimado de créditos</p>
          <p className={`text-2xl font-black tabular-nums ${tono === "ok" ? "text-ok" : tono === "alerta" ? "text-alerta" : "text-error"}`}>{usd(saldo)}</p>
          {tono !== "ok" && <p className="text-xs font-semibold text-error">Saldo bajo: recargue en Claude Console.</p>}
        </div>
        <div className="rounded-xl bg-primario-suave p-3">
          <p className="text-xs font-semibold text-suave">Gastado en total</p>
          <p className="text-2xl font-black tabular-nums text-profundo">{usd(total.costo)}</p>
          <p className="text-xs text-suave">de {usd(cargado)} cargados</p>
        </div>
        <div className="rounded-xl bg-primario-suave p-3">
          <p className="text-xs font-semibold text-suave">Este mes</p>
          <p className="text-2xl font-black tabular-nums text-profundo">{usd(total.costoMes)}</p>
          <p className="text-xs text-suave">{plural(tiquetes.usosMes, "tiquete")} · {plural(facturas.usosMes, "factura")}</p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-suave"><span>Crédito usado</span><span className="font-semibold">{usado.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-borde/60"><div className={`h-full rounded-full ${tono === "ok" ? "bg-primario" : tono === "alerta" ? "bg-alerta" : "bg-error"}`} style={{ width: `${usado}%` }} /></div>
        {alcanza != null && <p className="mt-1 text-sm text-texto">Al ritmo actual le alcanza para unas <b>{alcanza.toLocaleString("es-CO")} lecturas de tiquetes</b> más.</p>}
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm tabular-nums sm:grid-cols-2">
        <div className="flex justify-between gap-2"><dt className="text-suave">Lecturas de tiquetes ({tiquetes.usos.toLocaleString("es-CO")})</dt><dd className="font-semibold">{usd(tiquetes.costo)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-suave">Promedio por tiquete</dt><dd className="font-semibold">{usd(porTiquete, 4)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-suave">Lecturas de facturas ({facturas.usos.toLocaleString("es-CO")})</dt><dd className="font-semibold">{usd(facturas.costo)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-suave">Promedio por factura</dt><dd className="font-semibold">{usd(facturas.usos ? facturas.costo / facturas.usos : 0, 4)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-suave">Formatos aprendidos ({formatos.usos})</dt><dd className="font-semibold">{usd(formatos.costo)}</dd></div>
        {otros > 0.00005 && <div className="flex justify-between gap-2"><dt className="text-suave">Ajustes para cuadrar con la Console</dt><dd className="font-semibold">{usd(otros)}</dd></div>}
      </dl>

      <details>
        <summary className="cursor-pointer text-sm font-semibold text-primario">Recargas ({(recargas ?? []).length}) · Registrar recarga</summary>
        <ul className="mt-2 space-y-1 text-sm">
          {(recargas ?? []).map((r, i) => (
            <li key={i} className="flex justify-between gap-2 border-b border-borde/60 pb-1"><span>{fecha(r.fecha)}{r.nota ? ` · ${r.nota}` : ""}</span><b className="tabular-nums">{usd(Number(r.monto_usd))}</b></li>
          ))}
        </ul>
        <div className="mt-3"><FormRecarga /></div>
      </details>
    </section>
  );
}
