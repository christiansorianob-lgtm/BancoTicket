import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fechaHora } from "@/lib/fechas";
import { Chip, Vacio } from "@/components/ui";
import { FormAccion } from "@/components/form-accion";
import { eliminarFormatoExtractora, guardarExtractora } from "../acciones";
import { AprenderFormato } from "./aprender";

export default async function Extractoras() {
  const supabase = await supabaseServidor();
  const [{ data: ext }, { data: fmt }] = await Promise.all([
    supabase.from("extractoras").select("*").order("nombre"),
    supabase.from("formatos_extractora").select("*").order("creado_en"),
  ]);
  const extractoras = ext ?? [];
  const formatos = fmt ?? [];
  const fotos = await urlsFotos(formatos.map((f) => f.imagen_ruta));

  return (
    <>
      <h1 className="titulo">Extractoras</h1>
      <AprenderFormato />

      {extractoras.length === 0 && <Vacio>Aún no hay extractoras. Suba la foto de un tiquete para empezar.</Vacio>}
      <ul className="grid gap-3 md:grid-cols-2">
        {extractoras.map((e) => {
          const suyos = formatos.filter((f) => f.extractora_id === e.id);
          return (
            <li key={e.id} className="tarjeta space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-profundo">{e.nombre}</p>
                  <p className="text-sm text-suave">{e.nit ? `NIT ${e.nit}` : "Sin NIT impreso"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Chip tono={e.activa ? "ok" : "neutro"}>{e.activa ? "Activa" : "Inactiva"}</Chip>
                  <Chip tono="primario">{suyos.length} formato{suyos.length === 1 ? "" : "s"}</Chip>
                </div>
              </div>
              {(e.nombres_impresos ?? []).length > 0 && (
                <p className="text-xs text-suave">Aparece en el tiquete como: {(e.nombres_impresos as string[]).join(" · ")}</p>
              )}

              <ul className="space-y-2">
                {suyos.map((f, i) => (
                  <li key={f.id} className="flex gap-3 rounded-xl border border-borde bg-white/60 p-2">
                    {f.imagen_ruta && fotos[f.imagen_ruta] && (
                      <a href={fotos[f.imagen_ruta]} target="_blank" rel="noopener noreferrer" className="shrink-0">
                        <img src={fotos[f.imagen_ruta]} alt={`Formato ${i + 1}`} className="size-16 rounded-lg object-cover" />
                      </a>
                    )}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">Formato {i + 1}</p>
                      <p className="text-xs text-suave">{f.descripcion}</p>
                      <p className="text-xs text-suave">Aprendido {fechaHora(f.creado_en)}</p>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs font-semibold text-primario">Ver lo aprendido</summary>
                        <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-[11px]">{JSON.stringify(f.plantilla, null, 2)}</pre>
                      </details>
                    </div>
                    <FormAccion accion={eliminarFormatoExtractora.bind(null, f.id)} boton="Eliminar" tonoBoton="secundario"
                      confirmar="¿Olvidar este formato? Los tiquetes ya registrados no cambian." className="shrink-0 [&_button]:min-h-9 [&_button]:px-3 [&_button]:text-xs" />
                  </li>
                ))}
              </ul>

              <details>
                <summary className="cursor-pointer text-sm font-semibold text-primario">Editar</summary>
                <FormAccion accion={guardarExtractora} boton="Guardar" className="mt-3">
                  <input type="hidden" name="id" value={e.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label><span className="etiqueta">Nombre</span><input name="nombre" className="campo" defaultValue={e.nombre} required /></label>
                    <label><span className="etiqueta">Estado</span>
                      <select name="activa" className="campo" defaultValue={e.activa ? "on" : "off"}>
                        <option value="on">Activa</option><option value="off">Inactiva</option>
                      </select>
                    </label>
                  </div>
                </FormAccion>
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
