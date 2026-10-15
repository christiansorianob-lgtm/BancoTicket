import { FormularioIngreso } from "./formulario";

export default async function Ingresar({ searchParams }: PageProps<"/ingresar">) {
  const { volver } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="tarjeta w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primario to-profundo text-2xl font-black text-white shadow-lg">B</div>
          <h1 className="titulo">BancoTicket</h1>
          <p className="text-sm text-suave">Tiquetes de fruta y cuentas de compradores</p>
        </div>
        <FormularioIngreso volver={typeof volver === "string" ? volver : "/"} />
      </div>
    </main>
  );
}
