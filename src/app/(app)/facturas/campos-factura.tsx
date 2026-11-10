"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { completarPrecio, validarFactura } from "@/lib/facturas/validar";
import { facturaDesde, numeroEnCampo } from "@/lib/facturas/formulario";
import { formatoNit, nitDigitos, type FacturaLeida } from "@/lib/facturas/tipos";

/** Cliente ya registrado (para avisar si el NIT existe con otro nombre). */
export type ClienteRegistrado = { nit: string; nombre: string };
import type { TarifasFactura } from "@/lib/facturas/comprobacion";
import { ComprobacionFactura } from "./comprobacion";

const ETIQUETAS: [keyof FacturaLeida, string, "texto" | "fecha" | "numero"][] = [
  ["numero_factura", "N° de factura", "texto"], ["cufe", "CUFE", "texto"],
  ["emisor_razon_social", "Emisor (razón social)", "texto"], ["emisor_nit", "NIT del emisor", "texto"],
  ["extractora_razon_social", "Cliente / extractora (razón social)", "texto"], ["extractora_nit", "NIT del cliente", "texto"],
  ["fecha_emision", "Fecha de emisión", "fecha"], ["fecha_vencimiento", "Fecha de vencimiento", "fecha"],
  ["periodo_desde", "Periodo desde", "fecha"], ["periodo_hasta", "Periodo hasta", "fecha"],
  ["kilos", "Kilos", "numero"], ["precio_kilo", "Precio por kilo", "numero"],
  ["subtotal", "Subtotal", "numero"], ["total_a_pagar", "Total a pagar", "numero"],
  // Cada impuesto junto a su porcentaje impreso en la factura (ej. «IVA 19%»).
  ["iva", "IVA", "numero"], ["iva_pct", "IVA % (impreso en la factura)", "numero"],
  ["retefuente", "ReteFuente", "numero"], ["retefuente_pct", "ReteFuente % (impreso)", "numero"],
  ["reteiva", "ReteIVA", "numero"], ["reteiva_pct", "ReteIVA % (impreso)", "numero"],
  ["reteica", "ReteICA", "numero"], ["reteica_pct", "ReteICA % (impreso)", "numero"],
];

/**
 * Campos editables de la factura con las validaciones en vivo (las mismas que aplica el servidor al
 * guardar). Un campo vacío es «no se leyó»: queda resaltado.
 */
export function CamposFactura({ inicial, tarifas, clientes }: { inicial: FacturaLeida; tarifas: TarifasFactura; clientes: ClienteRegistrado[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [datos, setDatos] = useState<FacturaLeida>(() => completarPrecio(inicial));

  useEffect(() => {
    const form = caja.current?.closest("form");
    if (!form) return;
    const revisar = () => setDatos(completarPrecio(facturaDesde((k) => new FormData(form).get(k) as string | null)));
    form.addEventListener("input", revisar);
    return () => form.removeEventListener("input", revisar);
  }, []);

  // El cliente es uno por NIT: si el NIT ya está registrado con otro nombre, se ofrece ese nombre.
  const registrado = clientes.find((c) => c.nit === nitDigitos(datos.extractora_nit));
  const nombreLeido = (datos.extractora_razon_social ?? "").trim();
  function usarNombre(nombre: string) {
    const campo = caja.current?.closest("form")?.elements.namedItem("extractora_razon_social") as HTMLInputElement | null;
    if (!campo) return;
    campo.value = nombre;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div ref={caja} className="space-y-3">
      {registrado && registrado.nombre !== nombreLeido ? (
        <div className="space-y-2 rounded-xl border-2 border-alerta bg-alerta-suave p-3 text-sm" role="alert">
          <p className="flex items-start gap-2 font-semibold text-alerta"><AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            El cliente con NIT {formatoNit(registrado.nit)} ya está registrado como «{registrado.nombre}». En esta factura dice «{nombreLeido || "—"}».</p>
          <p className="text-texto">Para no tener dos clientes por un punto, una coma o una letra, use el nombre registrado. La deuda es una sola por NIT.</p>
          <button type="button" className="boton-primario min-h-10 w-full text-sm sm:w-auto" onClick={() => usarNombre(registrado.nombre)}>Usar «{registrado.nombre}»</button>
        </div>
      ) : registrado ? (
        <p className="flex items-center gap-2 rounded-xl bg-ok-suave px-3 py-2 text-sm font-semibold text-ok"><CheckCircle2 className="size-4 shrink-0" aria-hidden /> Cliente registrado: {registrado.nombre} – NIT {formatoNit(registrado.nit)}</p>
      ) : nitDigitos(datos.extractora_nit) ? (
        <p className="rounded-xl bg-primario-suave px-3 py-2 text-sm text-profundo">Cliente nuevo: al aprobar se registra «{nombreLeido || "—"}» con NIT {formatoNit(datos.extractora_nit)}.</p>
      ) : null}
      <ComprobacionFactura datos={datos} tarifas={tarifas} />
      <ul className="space-y-1 rounded-xl border border-borde p-3 text-sm">
        {validarFactura(datos).map((v) => (
          <li key={v.nombre} className={`flex items-start gap-1.5 ${v.ok ? "text-ok" : "font-semibold text-error"}`}>
            {v.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />} {v.nombre}: {v.mensaje}
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2">
        {ETIQUETAS.map(([k, etiqueta, tipo]) => {
          const valor = inicial[k];
          // Las retenciones en 0 son normales (no aplican) y un porcentaje vacío es que la factura no lo
          // imprime (se prueba con las tarifas permitidas): no se resaltan como «no se leyó».
          const vacio = (valor == null || valor === "") && !k.endsWith("_pct");
          return (
            <label key={k} className={k === "cufe" ? "sm:col-span-2" : ""}>
              <span className={`etiqueta ${vacio ? "text-alerta" : ""}`}>{etiqueta}{vacio ? " · no se leyó" : ""}</span>
              <input name={k} type={tipo === "fecha" ? "date" : "text"} inputMode={tipo === "numero" ? "decimal" : undefined}
                defaultValue={tipo === "numero" ? numeroEnCampo(valor as number | null) : (valor as string | null) ?? ""}
                className={`campo ${vacio ? "border-alerta bg-alerta-suave" : ""} ${tipo === "numero" ? "tabular-nums" : ""} ${k === "cufe" ? "text-xs" : ""}`} />
            </label>
          );
        })}
      </div>
      <p className="text-xs text-suave">Números en formato colombiano: punto de miles y coma decimal (ej. 142.060.536,75). La comprobación se actualiza al corregir.</p>
    </div>
  );
}
