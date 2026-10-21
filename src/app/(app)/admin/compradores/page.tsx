import Link from "next/link";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { Chip, Vacio } from "@/components/ui";
import { FormAccion } from "@/components/form-accion";
import { guardarUsuario } from "../acciones";
import { CamposUsuario } from "./campos-usuario";
import { NOMBRE_ROL, type Rol } from "@/lib/sesion";

export default async function Compradores() {
  const supabase = await supabaseServidor();
  const { data } = await supabase.from("perfiles").select("*").order("rol").order("nombre");
  const filas = data ?? [];
  return (
    <>
      <h1 className="titulo">Compradores y administradores</h1>
      <details className="tarjeta">
        <summary className="cursor-pointer font-bold text-profundo">Crear usuario</summary>
        <FormAccion accion={guardarUsuario} boton="Crear usuario" className="mt-3" limpiar>
          <CamposUsuario />
        </FormAccion>
      </details>
      {filas.length === 0 && <Vacio>No hay usuarios.</Vacio>}
      <ul className="grid gap-3 md:grid-cols-2">
        {filas.map((u) => (
          <li key={u.id} className={`tarjeta ${u.activo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-profundo">{u.nombre}</p>
                <p className="text-sm text-suave">@{u.usuario} · {u.celular}{u.correo ? ` · ${u.correo}` : ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Chip tono={u.rol === "comprador" ? "neutro" : "primario"}>{NOMBRE_ROL[u.rol as Rol]}</Chip>
                {!u.activo && <Chip tono="error">Inactivo</Chip>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {u.rol === "comprador" && <Link href={`/admin/compradores/${u.id}`} className="boton-primario min-h-9 text-sm">Ver cuenta</Link>}
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-primario">Editar</summary>
              <FormAccion accion={guardarUsuario} boton="Guardar" className="mt-3">
                <CamposUsuario u={u} />
              </FormAccion>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
