"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CheckCircle2, ImageUp, RotateCcw, XCircle, Loader2 } from "lucide-react";
import { analizarCuadro, type Verificacion } from "@/lib/camara/analisis";
import { imagenDesdeArchivo, reducirImagen } from "@/lib/imagen";
import { fechaHora } from "@/lib/fechas";
import { formatoToneladas } from "@/lib/numeros";
import { BotonWhatsApp, Dato, Mensaje } from "@/components/ui";
import { enviarARevision, enviarTiquete } from "./acciones";

type Extractora = { id: string; nombre: string };
type Control = { nombre: string; ok: boolean; mensaje: string };
type Datos = {
  numero: string; fecha_entrada: string; peso_bruto_kg: number; tara_kg: number;
  neto_impreso_kg: number | null; placa: string | null; conductor: string | null; bascula: string | null;
};
type Lectura =
  | { ok: true; datos: Datos; controles: Control[]; token: string; posiblesDuplicados: { extractora: string; numero: string; fecha_entrada: string }[] }
  | { ok: false; duplicado: { quien: string; cuando: string; estado: string }; datos: Datos; controles: Control[] }
  | { ok: false; motivo: string; controles: Control[]; tokenRevision: string; duplicado?: undefined; datos?: undefined };

type Paso = "elegir" | "camara" | "leyendo" | "resultado" | "enviado" | "revision";

const CUADROS_ESTABLES = 3;

export function SubirTiquete({ extractoras, celularAdmin, nombreComprador }: { extractoras: Extractora[]; celularAdmin: string | null; nombreComprador: string }) {
  const [extractoraId, setExtractoraId] = useState("");
  const [paso, setPaso] = useState<Paso>("elegir");
  const [origen, setOrigen] = useState<"camara" | "galeria">("camara");
  const [foto, setFoto] = useState<string | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ numero: string; extractora: string } | null>(null);
  const [enviando, iniciar] = useTransition();
  const galeria = useRef<HTMLInputElement>(null);

  const extractora = extractoras.find((e) => e.id === extractoraId);

  function reiniciar() {
    if (foto) URL.revokeObjectURL(foto);
    setFoto(null); setLectura(null); setError(null); setEnviado(null);
    setPaso("elegir");
  }

  async function leer(blob: Blob, desde: "camara" | "galeria") {
    setOrigen(desde);
    setFoto(URL.createObjectURL(blob));
    setPaso("leyendo");
    setError(null);
    const form = new FormData();
    form.set("imagen", new File([blob], blob.type === "image/webp" ? "tiquete.webp" : "tiquete.jpg", { type: blob.type }));
    form.set("extractora_id", extractoraId);
    form.set("origen", desde);
    try {
      const r = await fetch("/api/leer-tiquete", { method: "POST", body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Error al leer la foto");
      setLectura(json);
      setPaso("resultado");
    } catch (e) {
      setError((e as Error).message);
      setPaso("elegir");
    }
  }

  async function desdeGaleria(archivo: File | undefined) {
    if (!archivo) return;
    try {
      const img = await imagenDesdeArchivo(archivo);
      await leer(await reducirImagen(img), "galeria");
    } catch {
      setError("No se pudo abrir la imagen");
    }
  }

  if (paso === "enviado" && enviado) {
    return (
      <div className="tarjeta space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" />
        <div>
          <p className="text-lg font-bold text-profundo">Tiquete recibido</p>
          <p className="text-suave">N° {enviado.numero} de {enviado.extractora} quedó pendiente de aprobación. Le llegará un aviso cuando lo revisen.</p>
        </div>
        <BotonWhatsApp celular={celularAdmin} texto="Avisar a la administradora"
          mensaje={`Hola, soy ${nombreComprador}. Subí el tiquete N° ${enviado.numero} de ${enviado.extractora} a BancoTicket para su aprobación.`} />
        <button className="boton-secundario w-full" onClick={reiniciar}>Subir otro tiquete</button>
      </div>
    );
  }

  if (paso === "revision") {
    return (
      <div className="tarjeta space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-14 text-alerta" />
        <p className="text-suave">La foto pasó a revisión del administrador. Le avisaremos cuando la registre.</p>
        <BotonWhatsApp celular={celularAdmin} texto="Avisar a la administradora"
          mensaje={`Hola, soy ${nombreComprador}. Envié a revisión un tiquete de ${extractora?.nombre ?? ""} que la app no pudo leer.`} />
        <button className="boton-secundario w-full" onClick={reiniciar}>Volver</button>
      </div>
    );
  }

  if (paso === "camara") {
    return <CamaraGuiada onCaptura={(b) => leer(b, "camara")} onCancelar={() => setPaso("elegir")} />;
  }

  if (paso === "leyendo") {
    return (
      <div className="tarjeta space-y-3 text-center">
        {foto && <img src={foto} alt="Foto del tiquete" className="mx-auto max-h-72 rounded-xl" />}
        <p className="flex items-center justify-center gap-2 font-semibold text-primario"><Loader2 className="size-5 animate-spin" /> Leyendo el tiquete…</p>
      </div>
    );
  }

  if (paso === "resultado" && lectura) {
    return (
      <div className="space-y-4">
        <div className="tarjeta grid gap-4 sm:grid-cols-2">
          {foto && <img src={foto} alt="Foto del tiquete" className="w-full rounded-xl border border-borde" />}
          <div className="space-y-3">
            {lectura.datos && (
              <dl className="grid grid-cols-2 gap-3">
                <Dato etiqueta="Extractora">{extractora?.nombre}</Dato>
                <Dato etiqueta="N° tiquete">{lectura.datos.numero}</Dato>
                <Dato etiqueta="Fecha">{fechaHora(lectura.datos.fecha_entrada)}</Dato>
                <Dato etiqueta="Placa">{lectura.datos.placa ?? "—"}</Dato>
                <Dato etiqueta="Peso bruto">{formatoToneladas(lectura.datos.peso_bruto_kg / 1000)}</Dato>
                <Dato etiqueta="Tara">{formatoToneladas(lectura.datos.tara_kg / 1000)}</Dato>
                <Dato etiqueta="Peso neto">{formatoToneladas((lectura.datos.peso_bruto_kg - lectura.datos.tara_kg) / 1000)}</Dato>
                {lectura.datos.conductor && <Dato etiqueta="Conductor">{lectura.datos.conductor}</Dato>}
                {lectura.datos.bascula && <Dato etiqueta="Báscula">{lectura.datos.bascula}</Dato>}
              </dl>
            )}
            <ul className="space-y-1 text-sm">
              {lectura.controles.map((c) => (
                <li key={c.nombre} className={`flex items-start gap-1.5 ${c.ok ? "text-ok" : "text-error"}`}>
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />} {c.mensaje}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {error && <Mensaje tono="error">{error}</Mensaje>}

        {lectura.ok ? (
          <>
            <Mensaje tono="alerta">Compare estos datos con el tiquete que tiene en la mano. No se pueden editar: si algo no coincide, tome otra foto.</Mensaje>
            {lectura.posiblesDuplicados.length > 0 && (
              <Mensaje tono="alerta">
                Posible duplicado: ya hay un tiquete con la misma placa a la misma hora ({lectura.posiblesDuplicados.map((p) => `${p.extractora} N° ${p.numero}`).join(", ")}).
              </Mensaje>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="boton-primario py-4" disabled={enviando}
                onClick={() => iniciar(async () => {
                  const r = await enviarTiquete(lectura.token);
                  if (r.ok) { setEnviado(r); setPaso("enviado"); } else setError(r.error);
                })}>
                <CheckCircle2 className="size-5" /> {enviando ? "Enviando…" : "Coincide, enviar"}
              </button>
              <button className="boton-secundario py-4" disabled={enviando} onClick={() => setPaso(origen === "camara" ? "camara" : "elegir")}>
                <RotateCcw className="size-5" /> No coincide, tomar otra foto
              </button>
            </div>
          </>
        ) : lectura.duplicado ? (
          <>
            <Mensaje tono="error">
              Este tiquete ya está registrado en {extractora?.nombre}: lo registró {lectura.duplicado.quien} el {fechaHora(lectura.duplicado.cuando)} ({lectura.duplicado.estado}).
            </Mensaje>
            <button className="boton-secundario w-full" onClick={reiniciar}>Volver</button>
          </>
        ) : (
          <>
            <Mensaje tono="error">No se pudo leer bien el tiquete: {lectura.motivo}. Repita la foto de frente, con buena luz y el tiquete completo.</Mensaje>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="boton-primario" onClick={() => setPaso(origen === "camara" ? "camara" : "elegir")}><RotateCcw className="size-5" /> Tomar otra foto</button>
              <button className="boton-secundario" disabled={enviando}
                onClick={() => iniciar(async () => {
                  const r = await enviarARevision(lectura.tokenRevision);
                  if (r.ok) setPaso("revision"); else setError(r.error ?? "Error");
                })}>
                Enviar a revisión del administrador
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Mensaje tono="error">{error}</Mensaje>}
      <div className="tarjeta space-y-4">
        <div>
          <label htmlFor="extractora" className="etiqueta">1. ¿En qué extractora entregó la fruta?</label>
          <select id="extractora" className="campo" value={extractoraId} onChange={(e) => setExtractoraId(e.target.value)}>
            <option value="">Elija la extractora</option>
            {extractoras.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div>
          <p className="etiqueta">2. Tome la foto del tiquete</p>
          <button className="boton-primario w-full py-4 text-lg" disabled={!extractoraId} onClick={() => setPaso("camara")}>
            <Camera className="size-6" /> Abrir cámara
          </button>
        </div>
        <div className="border-t border-borde pt-3">
          <button className="w-full text-sm font-medium text-suave underline disabled:opacity-50" disabled={!extractoraId} onClick={() => galeria.current?.click()}>
            <ImageUp className="mr-1 inline size-4" /> Subir desde la galería (queda para revisión)
          </button>
          <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => { desdeGaleria(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

/** Marco guía en fracciones del video: apaisado para tiquetes horizontales, vertical para los altos. */
function calcularMarco(vw: number, vh: number, horizontal: boolean) {
  const proporcion = horizontal ? 1.75 : 1 / 1.4;
  const ancho = Math.min(vw * 0.94, vh * 0.94 * proporcion);
  const alto = ancho / proporcion;
  return { x: (vw - ancho) / 2 / vw, y: (vh - alto) / 2 / vh, w: ancho / vw, h: alto / vh };
}

function CamaraGuiada({ onCaptura, onCancelar }: { onCaptura: (b: Blob) => void; onCancelar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [horizontal, setHorizontal] = useState(true);
  const [tamano, setTamano] = useState<{ w: number; h: number } | null>(null);
  const [verificaciones, setVerificaciones] = useState<Verificacion[]>([]);
  const [estables, setEstables] = useState(0);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);
  const horizontalRef = useRef(horizontal);
  useEffect(() => { horizontalRef.current = horizontal; }, [horizontal]);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let temporizador: ReturnType<typeof setInterval> | undefined;
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;

    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        const v = video.current!;
        v.srcObject = flujo;
        await v.play();
        temporizador = setInterval(() => {
          if (!v.videoWidth) return;
          // El celular puede girar: se lee el tamaño real del video en cada cuadro.
          setTamano((t) => (t?.w === v.videoWidth && t?.h === v.videoHeight ? t : { w: v.videoWidth, h: v.videoHeight }));
          // Solo se analiza lo que está dentro del marco.
          const m = calcularMarco(v.videoWidth, v.videoHeight, horizontalRef.current);
          const sx = m.x * v.videoWidth, sy = m.y * v.videoHeight, sw = m.w * v.videoWidth, sh = m.h * v.videoHeight;
          const escala = 320 / Math.max(sw, sh);
          lienzo.width = Math.round(sw * escala);
          lienzo.height = Math.round(sh * escala);
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);
          const r = analizarCuadro(ctx.getImageData(0, 0, lienzo.width, lienzo.height));
          setVerificaciones(r);
          setEstables((n) => (r.every((x) => x.ok) ? n + 1 : 0));
        }, 300);
      } catch {
        setErrorCamara("No se pudo abrir la cámara. Revise el permiso de cámara del navegador.");
      }
    })();

    return () => {
      clearInterval(temporizador);
      flujo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const lista = estables >= CUADROS_ESTABLES;
  const primerAviso = verificaciones.find((v) => !v.ok);
  const marco = tamano ? calcularMarco(tamano.w, tamano.h, horizontal) : null;

  async function capturar() {
    const v = video.current;
    if (!v) return;
    setCapturando(true);
    // Se recorta al marco: el tiquete aprovecha toda la resolución de la foto.
    const m = calcularMarco(v.videoWidth, v.videoHeight, horizontal);
    const c = document.createElement("canvas");
    c.width = Math.round(m.w * v.videoWidth);
    c.height = Math.round(m.h * v.videoHeight);
    c.getContext("2d")!.drawImage(v, m.x * v.videoWidth, m.y * v.videoHeight, c.width, c.height, 0, 0, c.width, c.height);
    onCaptura(await reducirImagen(c, 1600));
  }

  if (errorCamara) {
    return (
      <div className="space-y-3">
        <Mensaje tono="error">{errorCamara}</Mensaje>
        <button className="boton-secundario w-full" onClick={onCancelar}>Volver</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${horizontal ? "bg-primario text-white" : "bg-white text-suave"}`} onClick={() => { setHorizontal(true); setEstables(0); }}>
          Tiquete horizontal
        </button>
        <button className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${!horizontal ? "bg-primario text-white" : "bg-white text-suave"}`} onClick={() => { setHorizontal(false); setEstables(0); }}>
          Tiquete vertical
        </button>
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={video} playsInline muted className="block h-auto w-full" />
        {marco && (
          <div
            className={`pointer-events-none absolute rounded-lg border-4 shadow-[0_0_0_9999px_rgb(0_0_0/0.45)] ${lista ? "border-emerald-400" : "border-red-500/90"}`}
            style={{ left: `${marco.x * 100}%`, top: `${marco.y * 100}%`, width: `${marco.w * 100}%`, height: `${marco.h * 100}%` }}
          />
        )}
        <div className={`absolute inset-x-3 top-3 rounded-xl px-3 py-2 text-center text-sm font-bold text-white ${lista ? "bg-emerald-600/90" : "bg-red-600/90"}`}>
          {lista ? "Lista: puede tomar la foto" : (primerAviso?.aviso ?? "Acomodando la cámara…")}
        </div>
      </div>
      <p className="text-center text-xs text-suave">Ponga el tiquete dentro del marco. Para tiquetes anchos, también puede girar el celular.</p>
      <ul className="grid grid-cols-3 gap-1 text-xs">
        {verificaciones.map((v) => (
          <li key={v.clave} className={`flex items-center gap-1 rounded-lg px-2 py-1 font-medium ${v.ok ? "bg-ok-suave text-ok" : "bg-error-suave text-error"}`}>
            <span className={`size-2 rounded-full ${v.ok ? "bg-ok" : "bg-error"}`} /> {v.clave[0].toUpperCase() + v.clave.slice(1)}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button className="boton-secundario" onClick={onCancelar}>Cancelar</button>
        <button className="boton-primario py-4 text-lg" disabled={!lista || capturando} onClick={capturar}>
          <Camera className="size-6" /> {capturando ? "Procesando…" : "Tomar foto"}
        </button>
      </div>
    </div>
  );
}
