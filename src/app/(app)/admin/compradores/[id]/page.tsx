import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { TarjetaSaldo, type FilaSaldo } from "@/components/saldo";
import { Extracto } from "@/components/extracto";
import { BotonWhatsApp } from "@/components/ui";
import { formatoPesos } from "@/lib/numeros";

/** Mensaje al comprador con su estado de cuenta en sus propias palabras (Debo / Me deben). */
function mensajeSaldo(nombre: string, saldo: number) {
  if (saldo === 0) return `Hola ${nombre}, su cuenta en BancoTicket está al día: nadie le debe a nadie.`;
  return saldo > 0
    ? `Hola ${nombre}, su estado de cuenta en BancoTicket: usted tiene ${formatoPesos(saldo)} de anticipos que aún debe cubrir con fruta.`
    : `Hola ${nombre}, su estado de cuenta en BancoTicket: le debo ${formatoPesos(-saldo)} por fruta entregada.`;
}

export default async function CuentaComprador({ params, searchParams }: PageProps<"/admin/compradores/[id]">) {
  const { id } = await params;
  const { desde, hasta } = await searchParams;
  const supabase = await supabaseServidor();
  const [{ data: perfil }, { data: saldo }, { count: pendientes }, { count: sinPrecio }] = await Promise.all([
    supabase.from("perfiles").select("*").eq("id", id).single(),
    supabase.from("saldos").select("*").eq("comprador_id", id).maybeSingle(),
    supabase.from("tiquetes_pendientes").select("id", { count: "exact", head: true }).eq("comprador_id", id).eq("estado", "pendiente"),
    supabase.from("tiquetes").select("id", { count: "exact", head: true }).eq("comprador_id", id).eq("estado", "vigente").is("precio_tonelada", null),
  ]);
  if (!perfil) notFound();
  const s = saldo as FilaSaldo | null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">{perfil.nombre}</h1>
        <BotonWhatsApp celular={perfil.celular} texto="Escribir por WhatsApp"
          mensaje={mensajeSaldo(perfil.nombre, Number(s?.saldo ?? 0))} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <TarjetaSaldo fila={s} vista="admin" />
          <div className="grid grid-cols-2 gap-3">
            <Link href="/admin/pendientes" className="tarjeta text-center"><p className="text-2xl font-black text-alerta">{pendientes ?? 0}</p><p className="text-xs text-suave">Pendientes</p></Link>
            <Link href={`/admin/tiquetes?comprador=${id}&sin_precio=1`} className="tarjeta text-center"><p className="text-2xl font-black text-primario">{sinPrecio ?? 0}</p><p className="text-xs text-suave">Sin precio</p></Link>
          </div>
          <Link href={`/admin/tiquetes?comprador=${id}`} className="boton-secundario w-full">Ver tiquetes</Link>
          <Link href={`/admin/anticipos`} className="boton-secundario w-full">Anticipos</Link>
        </div>
        <div className="space-y-3">
          <form className="tarjeta flex flex-wrap items-end gap-2" method="get">
            <label><span className="etiqueta">Desde</span><input type="date" name="desde" className="campo" defaultValue={typeof desde === "string" ? desde : ""} /></label>
            <label><span className="etiqueta">Hasta</span><input type="date" name="hasta" className="campo" defaultValue={typeof hasta === "string" ? hasta : ""} /></label>
            <button className="boton-primario">Filtrar extracto</button>
          </form>
          <Extracto compradorId={id} desde={typeof desde === "string" ? desde : undefined} hasta={typeof hasta === "string" ? hasta : undefined} vista="admin" />
        </div>
      </div>
    </>
  );
}
