import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { Vacio } from "@/components/ui";
import type { FilaSaldo } from "@/components/saldo";

export default async function PanelAdmin() {
  const supabase = await supabaseServidor();
  const [{ data: saldos }, { count: pendientes }, { count: galeria }, { count: disputas }, { count: sinPrecio }, { count: formatos }] = await Promise.all([
    supabase.from("saldos").select("*").order("nombre"),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente").eq("requiere_revision", true),
    supabase.from("anticipos").select("id", { count: "exact", head: true }).eq("estado", "en_disputa"),
    supabase.from("tiquetes").select("id", { count: "exact", head: true }).eq("estado", "vigente").is("precio_tonelada", null),
    supabase.from("formatos_no_reconocidos").select("id", { count: "exact", head: true }).eq("estado", "nuevo"),
  ]);
  const filas = (saldos ?? []) as FilaSaldo[];
  const totalFondos = filas.reduce((s, f) => s + Math.max(0, Number(f.saldo)), 0);
  const totalDeuda = filas.reduce((s, f) => s + Math.min(0, Number(f.saldo)), 0);

  const indicadores = [
    { texto: "Tiquetes pendientes", valor: pendientes ?? 0, href: "/admin/pendientes", tono: "text-alerta" },
    { texto: "Para revisar (galería)", valor: galeria ?? 0, href: "/admin/pendientes", tono: "text-alerta" },
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
        <div className="tarjeta"><p className="text-sm text-suave">Fondos en poder de compradores</p><p className="text-2xl font-bold text-ok">{formatoPesos(totalFondos)}</p></div>
        <div className="tarjeta"><p className="text-sm text-suave">Se les debe a compradores</p><p className="text-2xl font-bold text-error">{formatoPesos(-totalDeuda)}</p></div>
      </section>

      {filas.length === 0 ? <Vacio>Aún no hay compradores. Créelos en «Compradores».</Vacio> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filas.map((f) => (
            <Link key={f.comprador_id} href={`/admin/compradores/${f.comprador_id}`} className="tarjeta block transition hover:shadow-md">
              <p className="font-bold text-profundo">{f.nombre}</p>
              <p className={`text-2xl font-black ${Number(f.saldo) < 0 ? "text-error" : "text-ok"}`}>{formatoPesos(f.saldo)}</p>
              <p className="text-xs text-suave">{Number(f.saldo) < 0 ? "Se le debe" : "Fondos disponibles"}</p>
              <dl className="mt-2 grid grid-cols-3 gap-1 text-xs">
                <div><dt className="text-suave">Anticipos</dt><dd className="font-semibold">{formatoPesos(f.anticipos_confirmados)}</dd></div>
                <div><dt className="text-suave">Compras</dt><dd className="font-semibold">{formatoPesos(f.valor_tiquetes)}</dd></div>
                <div><dt className="text-suave">Toneladas</dt><dd className="font-semibold">{formatoToneladas(f.toneladas_valoradas)}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
