import { exigirDesarrollador, NOMBRE_ROL, type Rol } from "@/lib/sesion";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { fechaHora } from "@/lib/fechas";
import { CLAVE_POR_DEFECTO } from "@/lib/claves";
import { BotonWhatsApp, Chip, Mensaje, Vacio } from "@/components/ui";
import { FormAccion } from "@/components/form-accion";
import { resolverSolicitudClave } from "../acciones";

type Fila = {
  id: string; estado: string; creado_en: string; resuelta_en: string | null;
  usuario: { nombre: string; usuario: string; celular: string; rol: string } | null;
};

/** Solicitudes de restablecer contraseña: solo el desarrollador las ve y las aprueba. */
export default async function Claves() {
  await exigirDesarrollador();
  const supabase = await supabaseServidor();
  const { data } = await supabase
    .from("solicitudes_clave")
    .select("id, estado, creado_en, resuelta_en, usuario:perfiles!solicitudes_clave_usuario_id_fkey(nombre, usuario, celular, rol)")
    .order("creado_en", { ascending: false })
    .limit(50);
  const filas = (data ?? []) as unknown as Fila[];
  const pendientes = filas.filter((f) => f.estado === "pendiente");
  const resueltas = filas.filter((f) => f.estado !== "pendiente");

  return (
    <>
      <h1 className="titulo">Solicitudes de contraseña ({pendientes.length})</h1>
      <Mensaje tono="alerta">
        Antes de aprobar, confirme por WhatsApp que la solicitud la hizo esa persona. Al aprobar, su contraseña queda en {CLAVE_POR_DEFECTO} y la app le pide cambiarla al ingresar.
      </Mensaje>
      {pendientes.length === 0 && <Vacio>No hay solicitudes pendientes.</Vacio>}
      <ul className="grid gap-3 md:grid-cols-2">
        {pendientes.map((f) => (
          <li key={f.id} className="tarjeta space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-profundo">{f.usuario?.nombre}</p>
                <p className="text-sm text-suave">@{f.usuario?.usuario} · {f.usuario?.celular} · {fechaHora(f.creado_en)}</p>
              </div>
              <Chip tono="primario">{NOMBRE_ROL[(f.usuario?.rol ?? "comprador") as Rol]}</Chip>
            </div>
            <BotonWhatsApp celular={f.usuario?.celular} texto="Confirmar por WhatsApp"
              mensaje={`Hola ${f.usuario?.nombre ?? ""}, recibí una solicitud para restablecer su contraseña de BancoTicket. ¿La hizo usted?`} />
            <div className="flex flex-wrap gap-2">
              <FormAccion accion={resolverSolicitudClave.bind(null, f.id, true)} boton="Aprobar"
                confirmar={`¿Restablecer la contraseña de @${f.usuario?.usuario} a ${CLAVE_POR_DEFECTO}?`} />
              <FormAccion accion={resolverSolicitudClave.bind(null, f.id, false)} boton="Rechazar" tonoBoton="secundario" />
            </div>
          </li>
        ))}
      </ul>

      {resueltas.length > 0 && (
        <>
          <h2 className="font-bold text-profundo">Resueltas</h2>
          <ul className="tarjeta divide-y divide-borde text-sm">
            {resueltas.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">{f.usuario?.nombre} (@{f.usuario?.usuario}) · {f.resuelta_en && fechaHora(f.resuelta_en)}</span>
                <Chip tono={f.estado === "aprobada" ? "ok" : "neutro"}>{f.estado === "aprobada" ? "Aprobada" : "Rechazada"}</Chip>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
