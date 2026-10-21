import Link from "next/link";
import { exigirComprador } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { leerConfiguracion } from "@/lib/config";
import { urlsFotos } from "@/lib/fotos";
import { fechaHora } from "@/lib/fechas";
import { formatoPesos, formatoToneladas, netoKg } from "@/lib/numeros";
import { Dato, EstadoChip, Vacio } from "@/components/ui";
import { BotonEliminarRechazado } from "./eliminar";

const FILTROS = [
  { valor: "pendiente", texto: "Pendientes" },
  { valor: "vigente", texto: "Aprobados" },
  { valor: "rechazado", texto: "Rechazados" },
];

export default async function MisTiquetes({ searchParams }: PageProps<"/mis-tiquetes">) {
  await exigirComprador();
  const { estado: e } = await searchParams;
  const estado = FILTROS.some((f) => f.valor === e) ? (e as string) : "pendiente";
  const supabase = await supabaseServidor();
  const config = await leerConfiguracion();

  const filas =
    estado === "vigente"
      ? (await supabase.from("tiquetes").select("*, extractoras(nombre)").eq("estado", "vigente").order("fecha_entrada", { ascending: false }).limit(200)).data ?? []
      : (await supabase.from("tiquetes_pendientes").select("*, extractoras(nombre)").eq("estado", estado).order("cargado_en", { ascending: false }).limit(200)).data ?? [];
  const fotos = await urlsFotos(filas.map((f) => f.imagen_ruta));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="titulo">Mis tiquetes</h1>
      <div className="flex gap-2 overflow-x-auto">
        {FILTROS.map((f) => (
          <Link key={f.valor} href={`/mis-tiquetes?estado=${f.valor}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${estado === f.valor ? "bg-primario text-white" : "bg-white/70 text-suave"}`}>
            {f.texto}
          </Link>
        ))}
      </div>

      {filas.length === 0 && <Vacio>No hay tiquetes en esta lista.</Vacio>}

      <ul className="space-y-3">
        {filas.map((t) => {
          const neto = netoKg(t);
          const conPrecio = t.precio_tonelada != null;
          return (
            <li key={t.id} className="tarjeta">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-profundo">{t.extractoras?.nombre} · N° {t.numero}</p>
                  <p className="text-sm text-suave">{fechaHora(t.fecha_entrada)}</p>
                </div>
                <EstadoChip estado={t.estado} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(estado !== "vigente" || conPrecio || config.comprador_ve_toneladas_sin_precio) && (
                  <Dato etiqueta="Peso neto">{formatoToneladas(neto / 1000)}</Dato>
                )}
                <Dato etiqueta="Placa">{t.placa ?? "—"}</Dato>
                {t.proveedor && <Dato etiqueta="Proveedor">{t.proveedor}</Dato>}
                {estado === "vigente" && <Dato etiqueta="Precio / t">{conPrecio ? formatoPesos(t.precio_tonelada) : "Sin precio"}</Dato>}
                {estado === "vigente" && <Dato etiqueta="Valor">{conPrecio ? formatoPesos(t.valor) : "—"}</Dato>}
              </dl>
              {t.estado === "rechazado" && (
                <p className="mt-3 rounded-lg bg-error-suave p-2 text-sm text-error"><b>Motivo:</b> {t.motivo_rechazo}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {t.imagen_ruta && fotos[t.imagen_ruta] && (
                  <a href={fotos[t.imagen_ruta]} target="_blank" rel="noopener noreferrer" className="boton-secundario text-sm">Ver foto</a>
                )}
                {t.estado === "rechazado" && <BotonEliminarRechazado id={t.id} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
