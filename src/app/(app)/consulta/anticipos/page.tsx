import { Image as ImageIcon } from "lucide-react";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fecha, fechaHora } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { EstadoChip, Vacio } from "@/components/ui";

/** Anticipos con sus soportes, para el Consultor: solo lectura (sin registrar, subir soporte ni recordar). */
export default async function AnticiposConsulta({ searchParams }: PageProps<"/consulta/anticipos">) {
  const { estado, comprador } = await searchParams;
  const supabase = await supabaseServidor();
  let q = supabase
    .from("anticipos")
    .select("*, comprador:perfiles!anticipos_comprador_id_fkey(nombre), registrador:perfiles!anticipos_registrado_por_fkey(nombre)")
    .order("registrado_en", { ascending: false })
    .limit(200);
  if (typeof estado === "string" && estado) q = q.eq("estado", estado);
  if (typeof comprador === "string" && comprador) q = q.eq("comprador_id", comprador);
  const [{ data }, { data: compradores }] = await Promise.all([
    q,
    supabase.from("perfiles").select("id, nombre").eq("rol", "comprador").order("nombre"),
  ]);
  const filas = data ?? [];
  const soportes = await urlsFotos(filas.map((a) => a.soporte_ruta));

  return (
    <>
      <h1 className="titulo">Anticipos</h1>
      <form className="tarjeta grid gap-3 sm:grid-cols-3" method="get">
        <label><span className="etiqueta">Comprador</span>
          <select name="comprador" defaultValue={typeof comprador === "string" ? comprador : ""} className="campo">
            <option value="">Todos</option>
            {compradores?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label><span className="etiqueta">Estado</span>
          <select name="estado" defaultValue={typeof estado === "string" ? estado : ""} className="campo">
            <option value="">Todos</option><option value="pendiente">Pendientes</option><option value="confirmado">Confirmados</option><option value="en_disputa">En disputa</option>
          </select>
        </label>
        <div className="flex items-end"><button className="boton-primario w-full">Filtrar</button></div>
      </form>

      {filas.length === 0 && <Vacio>No hay anticipos con estos filtros.</Vacio>}
      <ul className="grid gap-3 md:grid-cols-2">
        {filas.map((a) => (
          <li key={a.id} className="tarjeta space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-profundo">{a.comprador?.nombre}</p>
                <p className={`text-xl font-black ${Number(a.monto) < 0 ? "text-error" : ""}`}>{formatoPesos(Math.abs(Number(a.monto)))}</p>
                <p className="text-sm text-suave">
                  {Number(a.monto) < 0 ? "Saldo a favor del comprador (la administración le debe)" : "Anticipo"} del {fecha(a.fecha)} · por {a.registrador?.nombre}
                </p>
              </div>
              <EstadoChip estado={a.estado} />
            </div>
            {a.nota && <p className="text-sm">{a.nota}</p>}
            {a.soporte_ruta && soportes[a.soporte_ruta] ? (
              <a href={soportes[a.soporte_ruta]} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primario hover:bg-primario-suave">
                <ImageIcon className="size-5" aria-hidden /> Ver soporte
              </a>
            ) : <p className="text-xs text-suave">Sin soporte</p>}
            {a.respondido_en && <p className="text-xs text-suave">Respondido {fechaHora(a.respondido_en)}</p>}
            {a.motivo_disputa && (a.estado === "en_disputa"
              ? <p className="rounded-lg bg-error-suave p-2 text-sm text-error">Motivo de la disputa: {a.motivo_disputa}</p>
              : <p className="rounded-lg bg-alerta-suave p-2 text-sm text-alerta">Corregido tras la disputa del comprador («{a.motivo_disputa}»).</p>)}
          </li>
        ))}
      </ul>
    </>
  );
}
