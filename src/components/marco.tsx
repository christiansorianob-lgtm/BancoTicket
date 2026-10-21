import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, Camera, FileText, Home, LogOut, Wallet, ListChecks, Tags, Users, Factory, History, ScanSearch, Receipt, KeyRound, FileSpreadsheet, DatabaseBackup } from "lucide-react";
import { EnlaceMenu } from "@/components/enlace-menu";
import { BotonRefrescar } from "@/components/boton-refrescar";
import { esGestor, type Perfil } from "@/lib/sesion";
import { cerrarSesion } from "@/app/ingresar/acciones";

const COMPRADOR = [
  { href: "/", texto: "Inicio", icono: Home },
  { href: "/subir", texto: "Subir", icono: Camera },
  { href: "/mis-tiquetes", texto: "Tiquetes", icono: FileText },
  { href: "/anticipos", texto: "Anticipos", icono: Wallet },
  { href: "/extracto", texto: "Extracto", icono: Receipt },
];

const ADMIN = [
  { href: "/admin", texto: "Saldos", icono: Home },
  { href: "/admin/pendientes", texto: "Pendientes", icono: ListChecks },
  { href: "/admin/tiquetes", texto: "Tiquetes y precios", icono: Tags },
  { href: "/admin/reportes", texto: "Reportes", icono: FileSpreadsheet },
  { href: "/admin/anticipos", texto: "Anticipos", icono: Wallet },
  { href: "/admin/compradores", texto: "Compradores", icono: Users },
  { href: "/admin/extractoras", texto: "Extractoras", icono: Factory },
  { href: "/admin/formatos", texto: "Formatos", icono: ScanSearch },
  { href: "/admin/historial", texto: "Historial", icono: History },
];

/** Solo para el desarrollador. */
const CLAVES = { href: "/admin/claves", texto: "Contraseñas", icono: KeyRound };
const BACKUPS = { href: "/admin/backups", texto: "Backups", icono: DatabaseBackup };

export function Marco({ perfil, avisosSinLeer, children }: { perfil: Perfil; avisosSinLeer: number; children: ReactNode }) {
  const gestor = esGestor(perfil.rol);
  const enlaces = gestor ? (perfil.rol === "desarrollador" ? [...ADMIN, CLAVES, BACKUPS] : ADMIN) : COMPRADOR;
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/40 bg-gradient-to-r from-profundo to-primario text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href={gestor ? "/admin" : "/"}className="flex items-center gap-2 font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">B</span>
            <span className="hidden sm:inline">BancoTicket</span>
          </Link>
          <span className="min-w-0 flex-1 truncate text-sm text-white/80">{perfil.nombre}</span>
          <BotonRefrescar />
          <Link href="/avisos" className="relative rounded-lg p-2 hover:bg-white/10" aria-label="Avisos">
            <Bell className="size-5" />
            {avisosSinLeer > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-bold text-profundo">{avisosSinLeer}</span>
            )}
          </Link>
          <Link href="/clave" className="rounded-lg p-2 hover:bg-white/10" aria-label="Cambiar contraseña" title="Cambiar contraseña">
            <KeyRound className="size-5" />
          </Link>
          <form action={cerrarSesion}>
            <button className="rounded-lg p-2 hover:bg-white/10" aria-label="Salir" title="Salir"><LogOut className="size-5" /></button>
          </form>
        </div>
        {gestor && (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
            {enlaces.map((e) => (
              <EnlaceMenu key={e.href} href={e.href} variante="superior">
                <e.icono className="size-4" aria-hidden /> {e.texto}
              </EnlaceMenu>
            ))}
          </nav>
        )}
      </header>

      <main className={`mx-auto w-full max-w-6xl flex-1 px-4 py-5 ${perfil.rol === "comprador" ? "pb-28" : ""}`}>{children}</main>

      {perfil.rol === "comprador" && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-white/95 backdrop-blur" aria-label="Menú">
          <div className="mx-auto grid max-w-lg grid-cols-5">
            {enlaces.map((e) => (
              <EnlaceMenu key={e.href} href={e.href} variante="inferior">
                <e.icono className="size-6" aria-hidden /> {e.texto}
              </EnlaceMenu>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
