import Link from "next/link";
import { exigirSesion } from "@/lib/sesion";
import { cerrarSesion } from "@/app/ingresar/acciones";
import { Mensaje } from "@/components/ui";
import { FormularioClave } from "./formulario";

/** Cada usuario cambia su contraseña cuando quiera (se llega con la llave del encabezado). */
export default async function CambiarClave() {
  const perfil = await exigirSesion();
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="tarjeta w-full max-w-sm space-y-4">
        <div>
          <h1 className="titulo">Cambiar contraseña</h1>
          <p className="text-sm text-suave">{perfil.nombre} · @{perfil.usuario}</p>
        </div>
        {perfil.cambiar_clave && (
          <Mensaje tono="alerta">Está usando la contraseña por defecto (12345678). Le recomendamos escoger una propia.</Mensaje>
        )}
        <FormularioClave porDefecto={perfil.cambiar_clave} />
        <div className="flex justify-between text-sm font-semibold text-primario">
          <Link href="/">Volver</Link>
          <form action={cerrarSesion}><button>Salir</button></form>
        </div>
      </div>
    </main>
  );
}
