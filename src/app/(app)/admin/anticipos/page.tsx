import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha, fechaHora, hoyColombia } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { EstadoChip, Vacio } from "@/components/ui";
import { FormAnticipo } from "./form-anticipo";
import { CampoMonto } from "./campo-monto";
import { Image as ImageIcon } from "lucide-react";
import { urlsFotos } from "@/lib/fotos";
import { corregirAnticipo, eliminarAnticipo, registrarAnticipo, recordarAnticipo, subirSoporteAnticipo } from "../acciones";
import { CorregirAnticipo, EliminarAnticipo } from "./corregir";
import { BotonReenviar } from "./reenviar";
import { CampoSoporte, SubirSoporte } from "./soporte";

export default async function AnticiposAdmin({ searchParams }: PageProps<"/admin/anticipos">) {
  const { estado, comprador: compradorParam } = await searchParams;
  // Memoria de navegación: desde la cuenta de un comprador se ven solo sus anticipos.
  const comprador = typeof compradorParam === "string" ? compradorParam : "";
  const supabase = await supabaseServidor();
  let q = supabase
    .from("anticipos")
    .select("*, comprador:perfiles!anticipos_comprador_id_fkey(nombre), registrador:perfiles!anticipos_registrado_por_fkey(nombre)")
    .order("registrado_en", { ascending: false })
    .limit(200);
  if (typeof estado === "string" && estado) q = q.eq("estado", estado);
  if (comprador) q = q.eq("comprador_id", comprador);
  const [{ data }, { data: compradores }] = await Promise.all([
    q,
    supabase.from("perfiles").select("id, nombre").eq("rol", "comprador").eq("activo", true).order("nombre"),
  ]);
  const filas = data ?? [];
  const soportes = await urlsFotos(filas.map((a) => a.soporte_ruta));
  const nombreComprador = compradores?.find((c) => c.id === comprador)?.nombre;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titulo">Anticipos{nombreComprador ? ` de ${nombreComprador}` : ""}</h1>
        {comprador && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/compradores/${comprador}`} className="boton-secundario min-h-9 text-sm"><ArrowLeft className="size-4" aria-hidden /> Volver a la cuenta</Link>
            <Link href="/admin/anticipos" className="boton-secundario min-h-9 text-sm">Ver todos los compradores</Link>
          </div>
        )}
      </div>
      <section className="tarjeta">
        <h2 className="mb-3 font-bold text-profundo">Registrar</h2>
        <FormAnticipo accion={registrarAnticipo} compradores={compradores ?? []}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label><span className="etiqueta">Comprador</span>
              <select name="comprador" className="campo" required defaultValue={nombreComprador ? comprador : ""}>
                <option value="" disabled>Elija</option>
                {compradores?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <CampoMonto />
            <label><span className="etiqueta">Fecha</span><input name="fecha" type="date" className="campo" defaultValue={hoyColombia()} required /></label>
            <label><span className="etiqueta">Nota</span><input name="nota" className="campo" /></label>
            <CampoSoporte />
          </div>
          <p className="text-xs text-suave">
            <strong>Positivo</strong> (ej. 5.000.000): dinero que le entrego al comprador; queda a mi favor hasta que lo cubra con fruta.{" "}
            <strong>Negativo</strong> (ej. -2.000.000): dinero que yo le debo al comprador, por ejemplo el saldo con el que empezamos.{" "}
            Queda pendiente hasta que el comprador lo confirme en «Anticipos» de su app.
          </p>
        </FormAnticipo>
      </section>

      <form className="flex flex-wrap gap-2" method="get">
        {comprador && <input type="hidden" name="comprador" value={comprador} />}
        {[["", "Todos"], ["pendiente", "Pendientes"], ["confirmado", "Confirmados"], ["en_disputa", "En disputa"]].map(([v, t]) => (
          <button key={v} name="estado" value={v} className={`rounded-full px-4 py-2 text-sm font-semibold ${(estado ?? "") === v ? "bg-primario text-white" : "bg-white/70 text-suave"}`}>{t}</button>
        ))}
      </form>

      {filas.length === 0 && <Vacio>No hay registros.</Vacio>}
      <ul className="grid gap-3 md:grid-cols-2">
        {filas.map((a) => (
          <li key={a.id} className="tarjeta space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-profundo">{a.comprador?.nombre}</p>
                <p className={`text-xl font-black ${Number(a.monto) < 0 ? "text-error" : ""}`}>{formatoPesos(Math.abs(Number(a.monto)))}</p>
                <p className="text-sm text-suave">
                  {Number(a.monto) < 0 ? "Saldo a favor del comprador (le debo)" : "Anticipo"} del {fecha(a.fecha)} · por {a.registrador?.nombre}
                </p>
              </div>
              <EstadoChip estado={a.estado} />
            </div>
            {a.nota && <p className="text-sm">{a.nota}</p>}
            {a.respondido_en && <p className="text-xs text-suave">Respondido {fechaHora(a.respondido_en)} · {a.dispositivo}</p>}
            {a.motivo_disputa && (a.estado === "en_disputa"
              ? <p className="rounded-lg bg-error-suave p-2 text-sm text-error">Motivo de la disputa: {a.motivo_disputa}</p>
              : <p className="rounded-lg bg-alerta-suave p-2 text-sm text-alerta">Corregido tras la disputa del comprador («{a.motivo_disputa}»). Espera su confirmación.</p>)}
            {a.estado === "en_disputa" && (
              <>
                <CorregirAnticipo accion={corregirAnticipo.bind(null, a.id)} monto={Number(a.monto)} fecha={a.fecha} nota={a.nota} />
                <EliminarAnticipo accion={eliminarAnticipo.bind(null, a.id)} monto={Number(a.monto)} />
              </>
            )}
            {a.soporte_ruta && soportes[a.soporte_ruta] && (
              <a href={soportes[a.soporte_ruta]} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primario hover:bg-primario-suave">
                <ImageIcon className="size-5" aria-hidden /> Ver soporte
              </a>
            )}
            {a.estado === "pendiente" && !a.soporte_ruta && <SubirSoporte accion={subirSoporteAnticipo.bind(null, a.id)} />}
            {a.estado === "pendiente" && <BotonReenviar accion={recordarAnticipo.bind(null, a.id)} />}
          </li>
        ))}
      </ul>
    </>
  );
}
