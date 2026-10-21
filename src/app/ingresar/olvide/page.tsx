import Link from "next/link";
import { FormularioOlvide } from "./formulario";

export default function OlvideClave() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="tarjeta w-full max-w-sm space-y-4">
        <div>
          <h1 className="titulo">Olvidé mi contraseña</h1>
          <p className="text-sm text-suave">Escriba su usuario. La solicitud llega al desarrollador; cuando la apruebe, su contraseña será 12345678 y la app le pedirá cambiarla.</p>
        </div>
        <FormularioOlvide />
        <Link href="/ingresar" className="block text-center text-sm font-semibold text-primario">Volver a ingresar</Link>
      </div>
    </main>
  );
}
