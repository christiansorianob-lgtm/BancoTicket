import { supabaseServidor } from "@/lib/supabase/servidor";
import { fechaHora } from "@/lib/fechas";
import { Chip, Vacio } from "@/components/ui";

const TABLAS: Record<string, string> = {
  tiquetes: "Tiquetes", tiquetes_pendientes: "Pendientes", anticipos: "Anticipos", perfiles: "Usuarios", extractoras: "Extractoras",
};
const OCULTOS = new Set(["enlace_hash", "datos_leidos", "valor", "peso_neto_t"]);

/** Solo las claves que cambiaron, para leer el historial de un vistazo. */
function diferencias(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null) {
  const claves = new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})]);
  return [...claves]
    .filter((k) => !OCULTOS.has(k) && JSON.stringify(antes?.[k]) !== JSON.stringify(despues?.[k]))
    .map((k) => ({ k, antes: antes?.[k], despues: despues?.[k] }));
}

const mostrar = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default async function Historial({ searchParams }: PageProps<"/admin/historial">) {
  const { tabla } = await searchParams;
  const supabase = await supabaseServidor();
  let q = supabase.from("historial").select("*").order("creado_en", { ascending: false }).limit(200);
  if (typeof tabla === "string" && TABLAS[tabla]) q = q.eq("tabla", tabla);
  const [{ data }, { data: usuarios }] = await Promise.all([q, supabase.from("perfiles").select("id, nombre")]);
  const nombres = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]));
  const filas = data ?? [];

  return (
    <>
      <h1 className="titulo">Historial de cambios</h1>
      <form className="flex flex-wrap gap-2" method="get">
        <button name="tabla" value="" className="rounded-full bg-white/70 px-4 py-2 text-sm font-semibold">Todo</button>
        {Object.entries(TABLAS).map(([v, t]) => (
          <button key={v} name="tabla" value={v} className={`rounded-full px-4 py-2 text-sm font-semibold ${tabla === v ? "bg-primario text-white" : "bg-white/70 text-suave"}`}>{t}</button>
        ))}
      </form>
      {filas.length === 0 && <Vacio>Sin cambios registrados.</Vacio>}
      <ul className="space-y-2">
        {filas.map((h) => {
          const cambios = h.accion === "crear" || h.accion === "eliminar" ? [] : diferencias(h.valor_anterior, h.valor_nuevo);
          const registro = (h.valor_nuevo ?? h.valor_anterior) as Record<string, unknown> | null;
          return (
            <li key={h.id} className="tarjeta p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tono="primario">{TABLAS[h.tabla] ?? h.tabla}</Chip>
                <Chip tono={h.accion === "eliminar" || h.accion === "rechazar" ? "error" : "neutro"}>{h.accion}</Chip>
                <span className="font-semibold">{mostrar(registro?.numero ?? registro?.nombre ?? registro?.monto)}</span>
                <span className="ml-auto text-xs text-suave">{fechaHora(h.creado_en)} · {nombres.get(h.usuario_id) ?? "Sistema"}</span>
              </div>
              {h.motivo && <p className="mt-1 text-suave">Motivo: {h.motivo}</p>}
              {cambios.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {cambios.map((c) => <li key={c.k}><b>{c.k}</b>: {mostrar(c.antes)} → {mostrar(c.despues)}</li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
