import { supabaseServidor } from "@/lib/supabase/servidor";
import { Chip, Vacio } from "@/components/ui";
import { FormAccion } from "@/components/form-accion";
import { guardarExtractora } from "../acciones";

const EJEMPLO = `{
  "rotulo_numero": "Entrada de materia prima No.",
  "sinonimos": { "peso_bruto": ["Peso entrada"], "tara": ["Peso salida"] },
  "formato_fecha": "27 de julio de 2026 10:15",
  "notas": "El neto aparece como 'Peso neto'"
}`;

function Campos({ e }: { e?: { id: string; nombre: string; activa: boolean; plantilla: unknown } }) {
  return (
    <div className="grid gap-3">
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="etiqueta">Nombre</span><input name="nombre" className="campo" defaultValue={e?.nombre} required /></label>
        <label><span className="etiqueta">Estado</span>
          <select name="activa" className="campo" defaultValue={e?.activa === false ? "off" : "on"}><option value="on">Activa</option><option value="off">Inactiva</option></select>
        </label>
      </div>
      <label><span className="etiqueta">Plantilla de lectura (JSON, ayuda a la IA a leer este formato)</span>
        <textarea name="plantilla" className="campo min-h-32 font-mono text-xs" placeholder={EJEMPLO}
          defaultValue={e && e.plantilla && Object.keys(e.plantilla as object).length ? JSON.stringify(e.plantilla, null, 2) : ""} />
      </label>
    </div>
  );
}

export default async function Extractoras() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("extractoras").select("*").order("nombre");
  const filas = data ?? [];
  return (
    <>
      <h1 className="titulo">Extractoras</h1>
      <details className="tarjeta">
        <summary className="cursor-pointer font-bold text-profundo">Agregar extractora</summary>
        <FormAccion accion={guardarExtractora} boton="Agregar" className="mt-3" limpiar><Campos /></FormAccion>
      </details>
      {filas.length === 0 && <Vacio>No hay extractoras.</Vacio>}
      <ul className="grid gap-3 md:grid-cols-2">
        {filas.map((e) => (
          <li key={e.id} className="tarjeta">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-profundo">{e.nombre}</p>
              <div className="flex gap-1">
                {Object.keys(e.plantilla ?? {}).length > 0 && <Chip tono="primario">Con plantilla</Chip>}
                <Chip tono={e.activa ? "ok" : "neutro"}>{e.activa ? "Activa" : "Inactiva"}</Chip>
              </div>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-primario">Editar</summary>
              <FormAccion accion={guardarExtractora} boton="Guardar" className="mt-3"><Campos e={e} /></FormAccion>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
