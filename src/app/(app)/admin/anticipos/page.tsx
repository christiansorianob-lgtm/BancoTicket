import { supabaseServidor } from "@/lib/supabase/servidor";
import { fecha, fechaHora, hoyColombia } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { EstadoChip, Vacio } from "@/components/ui";
import { FormAccion } from "@/components/form-accion";
import { registrarAnticipo, reenviarEnlace } from "../acciones";
import { BotonReenviar } from "./reenviar";

export default async function AnticiposAdmin({ searchParams }: PageProps<"/admin/anticipos">) {
  const { estado } = await searchParams;
  const supabase = await supabaseServidor();
  let q = supabase
    .from("anticipos")
    .select("*, comprador:perfiles!anticipos_comprador_id_fkey(nombre), registrador:perfiles!anticipos_registrado_por_fkey(nombre)")
    .order("registrado_en", { ascending: false })
    .limit(200);
  if (typeof estado === "string" && estado) q = q.eq("estado", estado);
  const [{ data }, { data: compradores }] = await Promise.all([
    q,
    supabase.from("perfiles").select("id, nombre").eq("rol", "comprador").eq("activo", true).order("nombre"),
  ]);
  const filas = data ?? [];

  return (
    <>
      <h1 className="titulo">Anticipos</h1>
      <section className="tarjeta">
        <h2 className="mb-3 font-bold text-profundo">Registrar</h2>
        <FormAccion accion={registrarAnticipo} boton="Registrar y generar enlace" limpiar>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label><span className="etiqueta">Comprador</span>
              <select name="comprador" className="campo" required defaultValue="">
                <option value="" disabled>Elija</option>
                {compradores?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label><span className="etiqueta">Monto (COP)</span><input name="monto" inputMode="decimal" className="campo" required placeholder="Ej.: 5.000.000" /></label>
            <label><span className="etiqueta">Fecha</span><input name="fecha" type="date" className="campo" defaultValue={hoyColombia()} required /></label>
            <label><span className="etiqueta">Nota</span><input name="nota" className="campo" /></label>
          </div>
          <p className="text-xs text-suave">Queda pendiente hasta que el comprador lo confirme con su enlace (único, de un solo uso y con vencimiento). También se le envía por correo.</p>
        </FormAccion>
      </section>

      <form className="flex flex-wrap gap-2" method="get">
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
                <p className="text-xl font-black">{formatoPesos(a.monto)}</p>
                <p className="text-sm text-suave">Anticipo del {fecha(a.fecha)} · por {a.registrador?.nombre}</p>
              </div>
              <EstadoChip estado={a.estado} />
            </div>
            {a.nota && <p className="text-sm">{a.nota}</p>}
            {a.estado === "pendiente" && <p className="text-xs text-suave">Enlace vence: {fechaHora(a.enlace_vence)}</p>}
            {a.respondido_en && <p className="text-xs text-suave">Respondido {fechaHora(a.respondido_en)} · {a.dispositivo}</p>}
            {a.motivo_disputa && <p className="rounded-lg bg-error-suave p-2 text-sm text-error">Motivo: {a.motivo_disputa}</p>}
            {a.estado === "pendiente" && <BotonReenviar accion={reenviarEnlace.bind(null, a.id)} />}
          </li>
        ))}
      </ul>
    </>
  );
}
