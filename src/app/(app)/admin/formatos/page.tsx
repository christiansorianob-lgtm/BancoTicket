import { supabaseServidor } from "@/lib/supabase/servidor";
import { urlsFotos } from "@/lib/fotos";
import { fechaHora } from "@/lib/fechas";
import { Vacio } from "@/components/ui";
import { FormAccion } from "@/components/form-accion";
import { CamposTiquete } from "@/components/campos-tiquete";
import { aprenderDesdeNoReconocido, descartarFormato, registrarDesdeFormato } from "../acciones";

/**
 * Lecturas fallidas: el administrador puede enseñarle al sistema el formato con la misma
 * foto (si es una extractora o un formato nuevo) y registrar el tiquete a mano.
 */
export default async function Formatos() {
  const supabase = await supabaseServidor();
  const [{ data }, { data: extractoras }] = await Promise.all([
    supabase.from("formatos_no_reconocidos").select("*, extractoras(nombre), perfiles(nombre)").eq("estado", "nuevo").order("creado_en"),
    supabase.from("extractoras").select("id, nombre").order("nombre"),
  ]);
  const filas = data ?? [];
  const fotos = await urlsFotos(filas.map((f) => f.imagen_ruta));

  return (
    <>
      <h1 className="titulo">Formatos no reconocidos ({filas.length})</h1>
      <p className="text-sm text-suave">
        Tiquetes que la lectura automática no pudo leer. Si es una extractora nueva o un formato distinto, toque «Aprender este formato»:
        los siguientes se leerán solos. Luego registre este tiquete a mano.
      </p>
      {filas.length === 0 && <Vacio>No hay formatos por revisar.</Vacio>}
      <ul className="space-y-4">
        {filas.map((f) => (
          <li key={f.id} className="tarjeta grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="space-y-2">
              {f.imagen_ruta && fotos[f.imagen_ruta] && (
                <a href={fotos[f.imagen_ruta]} target="_blank" rel="noopener noreferrer">
                  <img src={fotos[f.imagen_ruta]} alt="Tiquete no reconocido" className="max-h-[28rem] w-full rounded-xl border border-borde object-contain" />
                </a>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-primario">Texto leído</summary>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-2">{f.texto_leido}{"\n"}{JSON.stringify(f.datos_leidos, null, 2)}</pre>
              </details>
            </div>
            <div className="space-y-3">
              <p className="font-bold text-profundo">{f.extractoras?.nombre ?? "Extractora sin reconocer"} · {f.perfiles?.nombre} · {fechaHora(f.creado_en)}</p>
              {f.imagen_ruta && (
                <FormAccion accion={aprenderDesdeNoReconocido.bind(null, f.id)} boton="Aprender este formato" tonoBoton="secundario" />
              )}
              <FormAccion accion={registrarDesdeFormato.bind(null, f.id)} boton="Registrar tiquete como pendiente">
                <CamposTiquete t={{ extractora_id: f.extractora_id ?? undefined }} extractoras={extractoras ?? []} />
              </FormAccion>
              <FormAccion accion={descartarFormato.bind(null, f.id)} boton="Descartar" tonoBoton="secundario" confirmar="¿Descartar esta foto?" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
