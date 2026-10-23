import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { TarjetaSaldo, type FilaSaldo } from "@/components/saldo";
import { Extracto } from "@/components/extracto";

/** Cuenta de un comprador para el Consultor: estado de cuenta y extracto, solo lectura. */
export default async function CuentaConsulta({ params, searchParams }: PageProps<"/consulta/compradores/[id]">) {
  const { id } = await params;
  const { desde, hasta } = await searchParams;
  const supabase = await supabaseServidor();
  const [{ data: perfil }, { data: saldo }] = await Promise.all([
    supabase.from("perfiles").select("nombre").eq("id", id).eq("rol", "comprador").maybeSingle(),
    supabase.from("saldos").select("*").eq("comprador_id", id).maybeSingle(),
  ]);
  if (!perfil) notFound();
  const d = typeof desde === "string" ? desde : undefined;
  const h = typeof hasta === "string" ? hasta : undefined;

  return (
    <>
      <h1 className="titulo">{perfil.nombre}</h1>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <TarjetaSaldo fila={saldo as FilaSaldo | null} vista="admin" />
          <Link href={`/consulta/reportes?tipo=cuenta&comprador=${id}`} className="boton-secundario w-full">Tiquetes y anticipos</Link>
          <Link href={`/consulta/reportes?comprador=${id}`} className="boton-secundario w-full">Reporte de tiquetes</Link>
          <Link href={`/consulta/anticipos?comprador=${id}`} className="boton-secundario w-full">Anticipos y soportes</Link>
        </div>
        <div className="space-y-3">
          <form className="tarjeta flex flex-wrap items-end gap-2" method="get">
            <label><span className="etiqueta">Desde</span><input type="date" name="desde" className="campo" defaultValue={d ?? ""} /></label>
            <label><span className="etiqueta">Hasta</span><input type="date" name="hasta" className="campo" defaultValue={h ?? ""} /></label>
            <button className="boton-primario">Filtrar extracto</button>
          </form>
          <Extracto compradorId={id} desde={d} hasta={h} vista="admin" />
        </div>
      </div>
    </>
  );
}
