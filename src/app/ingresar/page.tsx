import { FormularioIngreso } from "./formulario";

export default async function Ingresar({ searchParams }: PageProps<"/ingresar">) {
  const { volver } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="tarjeta w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/logo.webp" alt="Logo de BancoTicket" width={96} height={96} className="mx-auto mb-3 size-24 rounded-3xl shadow-lg" />
          <h1 className="titulo">BancoTicket</h1>
          <p className="text-sm text-suave">Tiquetes de fruta y cuentas de compradores</p>
        </div>
        <FormularioIngreso volver={typeof volver === "string" ? volver : "/"} />
      </div>
    </main>
  );
}
