import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { hoyColombia } from "@/lib/fechas";
import { Vacio } from "@/components/ui";
import type { FilaSaldo } from "@/components/saldo";
import { textoSaldo } from "@/lib/saldo";

export default async function PanelAdmin() {
  const supabase = await supabaseServidor();
  const inicioMes = `${hoyColombia().slice(0, 8)}01T00:00:00-05:00`;
  const [{ data: saldos }, { count: pendientes }, { count: galeria }, { count: disputas }, { count: sinPrecio }, { count: formatos }, { data: consumo }] = await Promise.all([
    supabase.from("saldos").select("*").order("nombre"),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente").eq("requiere_revision", true),
    supabase.from("anticipos").select("id", { count: "exact", head: true }).eq("estado", "en_disputa"),
    supabase.from("tiquetes").select("id", { count: "exact", head: true }).eq("estado", "vigente").is("precio_tonelada", null),
    supabase.from("formatos_no_reconocidos").select("id", { count: "exact", head: true }).eq("estado", "nuevo"),
    supabase.from("consumo_ia").select("tipo, costo_usd, modulo").gte("creado_en", inicioMes),
  ]);
  const usos = consumo ?? [];
  const costoMes = usos.reduce((s, u) => s + Number(u.costo_usd), 0);
  const lecturasMes = usos.filter((u) => u.tipo === "lectura" && u.modulo !== "facturas").length;
  // Módulo de facturas: categoría aparte (no cambia las cifras de los tiquetes).
  const facturasUsos = usos.filter((u) => u.modulo === "facturas");
  const costoFacturas = facturasUsos.reduce((s, u) => s + Number(u.costo_usd), 0);
  const aprendizajesMes = usos.filter((u) => u.tipo === "aprendizaje").length;
  const filas = (saldos ?? []) as FilaSaldo[];
  const totalFondos = filas.reduce((s, f) => s + Math.max(0, Number(f.saldo)), 0);
  const totalDeuda = filas.reduce((s, f) => s + Math.min(0, Number(f.saldo)), 0);

  const indicadores = [
    { texto: "Tiquetes pendientes", valor: pendientes ?? 0, href: "/admin/pendientes", tono: "text-alerta" },
    { texto: "Para verificar", valor: galeria ?? 0, href: "/admin/pendientes", tono: "text-alerta" },
    { texto: "Aprobados sin precio", valor: sinPrecio ?? 0, href: "/admin/tiquetes?sin_precio=1", tono: "text-primario" },
    { texto: "Anticipos en disputa", valor: disputas ?? 0, href: "/admin/anticipos", tono: "text-error" },
    { texto: "Formatos no reconocidos", valor: formatos ?? 0, href: "/admin/formatos", tono: "text-error" },
  ];

  return (
    <>
      <h1 className="titulo">Saldos de compradores</h1>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {indicadores.map((i) => (
          <Link key={i.texto} href={i.href} className="tarjeta">
            <p className={`text-3xl font-black ${i.tono}`}>{i.valor}</p>
            <p className="text-sm text-suave">{i.texto}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="tarjeta">
          <p className="text-sm font-bold text-ok">Total saldo a mi favor</p>
          <p className="text-2xl font-bold text-ok">{formatoPesos(totalFondos)}</p>
          <p className="text-xs text-suave">Anticipos que los compradores aún no han cubierto con fruta.</p>
        </div>
        <div className="tarjeta">
          <p className="text-sm font-bold text-error">Total que les debo</p>
          <p className="text-2xl font-bold text-error">{formatoPesos(-totalDeuda)}</p>
          <p className="text-xs text-suave">Fruta entregada que aún no les he pagado.</p>
        </div>
      </section>

      <section className="tarjeta flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-suave">Consumo de IA este mes</p>
          <p className="text-2xl font-bold text-profundo">US$ {costoMes.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</p>
        </div>
        <p className="text-sm text-suave">
          {lecturasMes} lectura{lecturasMes === 1 ? "" : "s"} de tiquetes · {aprendizajesMes} formato{aprendizajesMes === 1 ? "" : "s"} aprendido{aprendizajesMes === 1 ? "" : "s"}
          {/* Con el gasto total (incluye el ajuste a la consola de Anthropic), no solo el estimado por tokens. */}
          {lecturasMes > 0 && ` · US$ ${((costoMes - costoFacturas) / lecturasMes).toLocaleString("es-CO", { maximumFractionDigits: 4 })} por lectura`}
          {facturasUsos.length > 0 && ` · Facturas: ${facturasUsos.length} lectura${facturasUsos.length === 1 ? "" : "s"} (US$ ${costoFacturas.toLocaleString("es-CO", { maximumFractionDigits: 4 })})`}
        </p>
      </section>

      {filas.length === 0 ? <Vacio>Aún no hay compradores. Créelos en «Compradores».</Vacio> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filas.map((f) => (
            <Link key={f.comprador_id} href={`/admin/compradores/${f.comprador_id}`} className="tarjeta block transition hover:shadow-md">
              <p className="font-bold text-profundo">{f.nombre}</p>
              {(() => {
                const t = textoSaldo(f.saldo, "admin");
                return (
                  <>
                    <p className={`text-sm font-bold ${t.tono === "debe" ? "text-error" : t.tono === "favor" ? "text-ok" : "text-suave"}`}>{t.titulo}</p>
                    <p className={`text-2xl font-black ${t.tono === "debe" ? "text-error" : t.tono === "favor" ? "text-ok" : "text-profundo"}`}>{t.monto}</p>
                  </>
                );
              })()}
              <dl className="mt-2 grid grid-cols-3 gap-1 text-xs">
                <div><dt className="text-suave">Anticipos</dt><dd className="font-semibold">{formatoPesos(f.anticipos_confirmados)}</dd></div>
                <div><dt className="text-suave">Fruta</dt><dd className="font-semibold">{formatoPesos(f.valor_tiquetes)}</dd></div>
                <div><dt className="text-suave">Toneladas</dt><dd className="font-semibold">{formatoToneladas(f.toneladas_valoradas)}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
