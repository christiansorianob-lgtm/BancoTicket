import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { formatoPesos, formatoToneladas } from "@/lib/numeros";
import { Vacio } from "@/components/ui";
import type { FilaSaldo } from "@/components/saldo";
import { textoSaldo } from "@/lib/saldo";
import { perfilActual } from "@/lib/sesion";
import { leerConfiguracion } from "@/lib/config";
import { fotosAntiguas } from "@/lib/fotos-antiguas";
import { AvisoFotosAntiguas } from "@/components/aviso-fotos-antiguas";
import { TarjetaIA } from "./tarjeta-ia";

export default async function PanelAdmin() {
  const supabase = await supabaseServidor();
  const [{ data: saldos }, { count: pendientes }, { count: galeria }, { count: disputas }, { count: sinPrecio }, { count: formatos }, { count: porConfirmar }] = await Promise.all([
    supabase.from("saldos").select("*").order("nombre"),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("estado", "pendiente").eq("requiere_revision", true),
    supabase.from("anticipos").select("id", { count: "exact", head: true }).eq("estado", "en_disputa"),
    supabase.from("tiquetes").select("id", { count: "exact", head: true }).eq("estado", "vigente").is("precio_tonelada", null),
    supabase.from("formatos_no_reconocidos").select("id", { count: "exact", head: true }).eq("estado", "nuevo"),
    // Anticipos que el comprador aún no confirma (no cuentan en el saldo hasta que los confirme).
    supabase.from("anticipos").select("id", { count: "exact", head: true }).eq("estado", "pendiente"),
  ]);
  // Solo para el desarrollador: aviso de fotos antiguas (solo cuenta) y consumo de IA.
  const esDesarrollador = (await perfilActual())?.rol === "desarrollador";
  const fotos = esDesarrollador ? await fotosAntiguas() : null;
  // Decisión del usuario (2026-11-12): la administradora no ve en Saldos a los compradores de pruebas
  // (configuracion.compradores_ocultos_consultor, hoy «prueba») ni los cuenta en los totales. El
  // desarrollador sí los ve. Solo cambia la pantalla.
  let ocultos = new Set<string>();
  if (!esDesarrollador) {
    const usuarios = (await leerConfiguracion()).compradores_ocultos_consultor;
    if (Array.isArray(usuarios) && usuarios.length) {
      const { data } = await supabase.from("perfiles").select("id").in("usuario", usuarios);
      ocultos = new Set((data ?? []).map((p) => p.id));
    }
  }
  const filas = ((saldos ?? []) as FilaSaldo[]).filter((f) => !ocultos.has(f.comprador_id));
  const totalFondos = filas.reduce((s, f) => s + Math.max(0, Number(f.saldo)), 0);
  const totalDeuda = filas.reduce((s, f) => s + Math.min(0, Number(f.saldo)), 0);

  const indicadores = [
    { texto: "Tiquetes pendientes", valor: pendientes ?? 0, href: "/admin/pendientes", tono: "text-alerta" },
    { texto: "Para verificar", valor: galeria ?? 0, href: "/admin/pendientes", tono: "text-alerta" },
    { texto: "Aprobados sin precio", valor: sinPrecio ?? 0, href: "/admin/tiquetes?sin_precio=1", tono: "text-primario" },
    { texto: "Anticipos en disputa", valor: disputas ?? 0, href: "/admin/anticipos", tono: "text-error" },
    { texto: "Formatos no reconocidos", valor: formatos ?? 0, href: "/admin/formatos", tono: "text-error" },
    { texto: "Anticipos sin confirmar", valor: porConfirmar ?? 0, href: "/admin/anticipos?estado=pendiente", tono: "text-alerta" },
  ];

  return (
    <>
      {fotos && fotos.total > 0 && <AvisoFotosAntiguas fotos={fotos} conEnlace />}
      <h1 className="titulo">Saldos de compradores</h1>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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

      {esDesarrollador && <TarjetaIA />}

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
