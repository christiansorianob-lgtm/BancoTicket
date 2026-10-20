"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, CheckCircle2, ImageUp, RotateCcw, XCircle, Loader2 } from "lucide-react";
import { analizarCuadro, textoDeLado, type Verificacion } from "@/lib/camara/analisis";
import { imagenDesdeArchivo, reducirImagen } from "@/lib/imagen";
import { fechaHora } from "@/lib/fechas";
import { formatoToneladas } from "@/lib/numeros";
import { Dato, Mensaje } from "@/components/ui";
import { AvisoContacto } from "@/components/contacto";
import { detalleTiquete } from "@/lib/mensajes";
import { enviarARevision, enviarTiquete } from "./acciones";

type Extractora = { id: string; nombre: string };
type Control = { nombre: string; ok: boolean; mensaje: string; dudoso?: boolean };
type Datos = {
  numero: string; fecha_entrada: string; peso_bruto_kg: number; tara_kg: number;
  neto_impreso_kg: number | null; placa: string | null; conductor: string | null; proveedor: string | null; bascula: string | null;
};
/** El tiquete parece de otra extractora: lo que dice el logo y, si está registrada, cuál es. */
type OtraExtractora = { detectada: string | null; sugeridaId: string | null; sugeridaNombre: string | null };
type Lectura = { otraExtractora?: OtraExtractora | null } & (
  | { ok: true; datos: Datos; controles: Control[]; dudosos: string[]; token: string; posiblesDuplicados: { extractora: string; numero: string; fecha_entrada: string }[] }
  | { ok: false; duplicado: { quien: string; cuando: string; estado: string }; datos: Datos; controles: Control[] }
  | { ok: false; motivo: string; controles: Control[]; tokenRevision: string; duplicado?: undefined; datos?: undefined }
);

type Paso = "elegir" | "camara" | "leyendo" | "resultado" | "enviado" | "revision";

const CUADROS_ESTABLES = 3;

export function SubirTiquete({ extractoras, celularAdmin, correosAdmin, nombreComprador }: { extractoras: Extractora[]; celularAdmin: string | null; correosAdmin: string[]; nombreComprador: string }) {
  const [extractoraId, setExtractoraId] = useState("");
  const [paso, setPaso] = useState<Paso>("elegir");
  const [origen, setOrigen] = useState<"camara" | "galeria">("camara");
  const [foto, setFoto] = useState<string | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<{ numero: string; extractora: string; detalle: string } | null>(null);
  const [enviando, iniciar] = useTransition();
  const [aceptoOtraExtractora, setAceptoOtraExtractora] = useState(false);
  const [ultimaFoto, setUltimaFoto] = useState<{ blob: Blob; desde: "camara" | "galeria" } | null>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const camaraNativa = useRef<HTMLInputElement>(null);

  const extractora = extractoras.find((e) => e.id === extractoraId);

  function reiniciar() {
    if (foto) URL.revokeObjectURL(foto);
    setUltimaFoto(null);
    setFoto(null); setLectura(null); setError(null); setEnviado(null);
    setPaso("elegir");
  }

  async function leer(blob: Blob, desde: "camara" | "galeria", conExtractora = extractoraId) {
    setUltimaFoto({ blob, desde });
    setAceptoOtraExtractora(false);
    setOrigen(desde);
    setFoto(URL.createObjectURL(blob));
    setPaso("leyendo");
    setError(null);
    const form = new FormData();
    form.set("imagen", new File([blob], blob.type === "image/webp" ? "tiquete.webp" : "tiquete.jpg", { type: blob.type }));
    form.set("extractora_id", conExtractora);
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

  async function desdeArchivo(archivo: File | undefined, desde: "camara" | "galeria") {
    if (!archivo) return;
    try {
      const img = await imagenDesdeArchivo(archivo);
      await leer(await reducirImagen(img, 2000), desde);
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
        <AvisoContacto contacto={{
          celular: celularAdmin, correos: correosAdmin, asunto: `BancoTicket: tiquete N° ${enviado.numero} de ${enviado.extractora} por aprobar`,
          mensaje: `Hola, soy ${nombreComprador}. Subí este tiquete a BancoTicket para su aprobación:

${enviado.detalle}`,
        }} />
        <button className="boton-secundario w-full" onClick={reiniciar}>Subir otro tiquete</button>
      </div>
    );
  }

  if (paso === "revision") {
    return (
      <div className="tarjeta space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-14 text-alerta" />
        <p className="text-suave">La foto pasó a revisión del administrador. Le avisaremos cuando la registre.</p>
        <AvisoContacto contacto={{
          celular: celularAdmin, correos: correosAdmin, asunto: "BancoTicket: tiquete para revisión",
          mensaje: `Hola, soy ${nombreComprador}. Envié a revisión un tiquete de ${extractora?.nombre ?? ""} que la app no pudo leer.`,
        }} />
        <button className="boton-secundario w-full" onClick={reiniciar}>Volver</button>
      </div>
    );
  }

  if (paso === "camara") {
    return (
      <>
        <CamaraGuiada onCaptura={(b) => leer(b, "camara")} onCancelar={() => setPaso("elegir")} onCamaraNativa={() => camaraNativa.current?.click()} />
        <input ref={camaraNativa} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { desdeArchivo(e.target.files?.[0], "camara"); e.target.value = ""; }} />
      </>
    );
  }

  if (paso === "leyendo") {
    return (
      <div className="tarjeta space-y-3 text-center">
        {foto && <img src={foto} alt="Foto del tiquete" className="mx-auto max-h-72 rounded-xl" />}
        <p className="flex items-center justify-center gap-2 font-semibold text-primario"><Loader2 className="size-5 animate-spin" /> Leyendo el tiquete…</p>
      </div>
    );
  }

  if (paso === "resultado" && lectura?.otraExtractora && !aceptoOtraExtractora) {
    const otra = lectura.otraExtractora;
    return (
      <div className="space-y-4">
        <div className="tarjeta space-y-3">
          {foto && <img src={foto} alt="Foto del tiquete" className="w-full rounded-xl border border-borde" />}
          <Mensaje tono="alerta">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
              <span>
                Este tiquete no parece ser de <b>{extractora?.nombre}</b>
                {otra.detectada ? <>: el logo o encabezado dice <b>«{otra.detectada}»</b></> : ""}. ¿Qué desea hacer?
              </span>
            </span>
          </Mensaje>
        </div>
        <div className="grid gap-2">
          {otra.sugeridaId && (
            <button className="boton-primario" onClick={() => {
              setExtractoraId(otra.sugeridaId!);
              if (ultimaFoto) leer(ultimaFoto.blob, ultimaFoto.desde, otra.sugeridaId!);
            }}>
              Leerlo como {otra.sugeridaNombre}
            </button>
          )}
          <button className={otra.sugeridaId ? "boton-secundario" : "boton-primario"} onClick={() => setPaso("elegir")}>
            Elegir otra extractora
          </button>
          <button className="boton-secundario" onClick={() => setAceptoOtraExtractora(true)}>
            Continuar con {extractora?.nombre} (quedará para revisión)
          </button>
        </div>
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
                {lectura.datos.proveedor && <Dato etiqueta="Proveedor">{lectura.datos.proveedor}</Dato>}
                {lectura.datos.conductor && <Dato etiqueta="Conductor">{lectura.datos.conductor}</Dato>}
                {lectura.datos.bascula && <Dato etiqueta="Báscula">{lectura.datos.bascula}</Dato>}
              </dl>
            )}
            <ul className="space-y-1 text-sm">
              {lectura.controles.map((c) => (
                <li key={c.nombre} className={`flex items-start gap-1.5 ${!c.ok ? "text-error" : c.dudoso ? "text-alerta" : "text-ok"}`}>
                  {!c.ok ? <XCircle className="mt-0.5 size-4 shrink-0" /> : c.dudoso ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />} {c.mensaje}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {error && <Mensaje tono="error">{error}</Mensaje>}

        {lectura.ok ? (
          <>
            <Mensaje tono="alerta">Compare estos datos con el tiquete que tiene en la mano. No se pueden editar: si algo no coincide, tome otra foto.</Mensaje>
            {lectura.dudosos.length > 0 && (
              <Mensaje tono="alerta">Puede enviarlo, pero llegará marcado para que el administrador verifique: {lectura.dudosos.join(", ")}. Si prefiere, tome otra foto más nítida.</Mensaje>
            )}
            {lectura.posiblesDuplicados.length > 0 && (
              <Mensaje tono="alerta">
                Posible duplicado: ya hay un tiquete con la misma placa a la misma hora ({lectura.posiblesDuplicados.map((p) => `${p.extractora} N° ${p.numero}`).join(", ")}).
              </Mensaje>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="boton-primario py-4" disabled={enviando}
                onClick={() => iniciar(async () => {
                  const r = await enviarTiquete(lectura.token);
                  if (r.ok) { setEnviado({ ...r, detalle: detalleTiquete({ ...lectura.datos, extractora: r.extractora }) }); setPaso("enviado"); } else setError(r.error);
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
          {ultimaFoto && extractoraId && (
            <button className="boton-primario mb-3 w-full" onClick={() => leer(ultimaFoto!.blob, ultimaFoto!.desde)}>
              Leer la misma foto con {extractora?.nombre}
            </button>
          )}
          <p className="etiqueta">2. Tome la foto del tiquete</p>
          <button className="boton-primario w-full py-4 text-lg" disabled={!extractoraId} onClick={() => setPaso("camara")}>
            <Camera className="size-6" /> Abrir cámara
          </button>
        </div>
        <div className="border-t border-borde pt-3">
          <button className="w-full text-sm font-medium text-suave underline disabled:opacity-50" disabled={!extractoraId} onClick={() => galeria.current?.click()}>
            <ImageUp className="mr-1 inline size-4" /> Subir una foto desde la galería
          </button>
          <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => { desdeArchivo(e.target.files?.[0], "galeria"); e.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

type Marco = { x: number; y: number; w: number; h: number };

// Márgenes del marco sobre la pantalla: arriba queda el aviso y abajo el disparador.
const MARGEN = { izq: 0.04, der: 0.04, arriba: 0.11, abajo: 0.19 };

/**
 * El video llena la pantalla (object-cover). El marco ocupa casi toda la pantalla, en
 * la orientación que tenga el celular; aquí se traduce a fracciones del video.
 */
function marcoEnVideo(vw: number, vh: number, cw: number, ch: number): Marco {
  const s = Math.max(cw / vw, ch / vh);
  const offX = (cw - vw * s) / 2, offY = (ch - vh * s) / 2;
  const rx = MARGEN.izq * cw, ry = MARGEN.arriba * ch;
  const rw = cw * (1 - MARGEN.izq - MARGEN.der), rh = ch * (1 - MARGEN.arriba - MARGEN.abajo);
  const x = Math.max(0, (rx - offX) / s), y = Math.max(0, (ry - offY) / s);
  const w = Math.min(vw - x, rw / s), h = Math.min(vh - y, rh / s);
  return { x: x / vw, y: y / vh, w: w / vw, h: h / vh };
}

/**
 * Foto a la resolución del sensor (ImageCapture), no del video de vista previa.
 * La vista previa suele ser el centro de la foto: se recorta el mismo marco sobre ella.
 * Si el navegador no lo permite o la orientación no coincide, se usa el cuadro del video.
 */
async function fotoDelSensor(flujo: MediaStream, v: HTMLVideoElement, m: Marco): Promise<HTMLCanvasElement> {
  let fuente: CanvasImageSource = v;
  let fw = v.videoWidth, fh = v.videoHeight;
  try {
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto(): Promise<Blob> } }).ImageCapture;
    if (IC) {
      const foto = await createImageBitmap(await new IC(flujo.getVideoTracks()[0]).takePhoto(), { imageOrientation: "from-image" });
      const mismaOrientacion = (foto.width >= foto.height) === (v.videoWidth >= v.videoHeight);
      if (mismaOrientacion && foto.width > v.videoWidth) { fuente = foto; fw = foto.width; fh = foto.height; }
    }
  } catch { /* se usa el video */ }

  // Zona de la foto que corresponde a la vista previa (recorte centrado con la proporción del video).
  const pv = v.videoWidth / v.videoHeight;
  const vw = Math.min(fw, fh * pv), vh = vw / pv;
  const ox = (fw - vw) / 2, oy = (fh - vh) / 2;
  // Margen de 2 % por si la vista previa no coincide exactamente con la foto.
  const mx = Math.max(0, m.x - 0.02), my = Math.max(0, m.y - 0.02);
  const mw = Math.min(1 - mx, m.w + 0.04), mh = Math.min(1 - my, m.h + 0.04);
  const c = document.createElement("canvas");
  c.width = Math.round(mw * vw);
  c.height = Math.round(mh * vh);
  c.getContext("2d")!.drawImage(fuente, ox + mx * vw, oy + my * vh, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/** Si el texto del tiquete quedó de lado, gira la foto 90° para que la lectura sea más fácil. */
function enderezar(c: HTMLCanvasElement): HTMLCanvasElement {
  const escala = 320 / Math.max(c.width, c.height);
  const p = document.createElement("canvas");
  p.width = Math.round(c.width * escala);
  p.height = Math.round(c.height * escala);
  const pctx = p.getContext("2d", { willReadFrequently: true })!;
  pctx.drawImage(c, 0, 0, p.width, p.height);
  if (!textoDeLado(pctx.getImageData(0, 0, p.width, p.height))) return c;
  const r = document.createElement("canvas");
  r.width = c.height;
  r.height = c.width;
  const ctx = r.getContext("2d")!;
  ctx.translate(r.width / 2, r.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  return r;
}

function CamaraGuiada({ onCaptura, onCancelar, onCamaraNativa }: { onCaptura: (b: Blob) => void; onCancelar: () => void; onCamaraNativa: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const flujoRef = useRef<MediaStream | null>(null);
  const [verificaciones, setVerificaciones] = useState<Verificacion[]>([]);
  const [estables, setEstables] = useState(0);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [capturando, setCapturando] = useState(false);

  useEffect(() => {
    let flujo: MediaStream | null = null;
    let temporizador: ReturnType<typeof setInterval> | undefined;
    const lienzo = document.createElement("canvas");
    const ctx = lienzo.getContext("2d", { willReadFrequently: true })!;
    // Sin desplazamiento de la página mientras la cámara ocupa la pantalla.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: false,
        });
        flujoRef.current = flujo;
        // Enfoque continuo donde el navegador lo permite (Chrome en Android).
        await flujo.getVideoTracks()[0]
          .applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
          .catch(() => {});
        const v = video.current!;
        v.srcObject = flujo;
        await v.play();
        temporizador = setInterval(() => {
          const caja = contenedor.current;
          if (!v.videoWidth || !caja) return;
          // Solo se analiza lo que está dentro del marco (sigue al celular si gira).
          const m = marcoEnVideo(v.videoWidth, v.videoHeight, caja.clientWidth, caja.clientHeight);
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
      document.body.style.overflow = overflowAnterior;
    };
  }, []);

  const lista = estables >= CUADROS_ESTABLES;
  const primerAviso = verificaciones.find((v) => !v.ok);

  async function capturar() {
    const v = video.current, caja = contenedor.current;
    if (!v || !caja || !flujoRef.current) return;
    setCapturando(true);
    const m = marcoEnVideo(v.videoWidth, v.videoHeight, caja.clientWidth, caja.clientHeight);
    const c = enderezar(await fotoDelSensor(flujoRef.current, v, m));
    onCaptura(await reducirImagen(c, 2000));
  }

  if (errorCamara) {
    return (
      <div className="space-y-3">
        <Mensaje tono="error">{errorCamara}</Mensaje>
        <button className="boton-primario w-full" onClick={onCamaraNativa}><Camera className="size-5" /> Usar la cámara normal del celular</button>
        <button className="boton-secundario w-full" onClick={onCancelar}>Volver</button>
      </div>
    );
  }

  return (
    <div ref={contenedor} className="fixed inset-0 z-50 h-dvh w-screen overflow-hidden bg-black">
      <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      {/* Marco: casi toda la pantalla, en la orientación del celular */}
      <div
        className={`pointer-events-none absolute rounded-xl border-4 shadow-[0_0_0_9999px_rgb(0_0_0/0.4)] transition-colors ${lista ? "border-emerald-400" : "border-red-500/90"}`}
        style={{ left: `${MARGEN.izq * 100}%`, right: `${MARGEN.der * 100}%`, top: `${MARGEN.arriba * 100}%`, bottom: `${MARGEN.abajo * 100}%` }}
      />

      {/* Barra superior: cerrar, aviso y cámara normal */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 p-3">
        <button className="flex size-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-white" onClick={onCancelar} aria-label="Cerrar cámara">
          <XCircle className="size-6" />
        </button>
        <p className={`min-w-0 flex-1 rounded-full px-3 py-2 text-center text-sm font-bold text-white ${lista ? "bg-emerald-600/90" : "bg-red-600/90"}`}>
          {lista ? "Lista: toque el botón" : (primerAviso?.aviso ?? "Acomodando la cámara…")}
        </p>
      </div>

      {/* Barra inferior: disparador grande al alcance del pulgar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <ul className="flex w-24 flex-wrap gap-1" aria-label="Verificaciones">
          {verificaciones.map((v) => (
            <li key={v.clave} title={v.clave} className={`size-3 rounded-full ${v.ok ? "bg-emerald-400" : "bg-red-500"}`} />
          ))}
        </ul>
        <button
          className={`flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white transition ${lista ? "bg-white/90" : "bg-white/25"} disabled:opacity-60`}
          disabled={!lista || capturando}
          onClick={capturar}
          aria-label="Tomar foto"
        >
          {capturando ? <Loader2 className="size-8 animate-spin text-primario" /> : <Camera className={`size-8 ${lista ? "text-primario" : "text-white"}`} />}
        </button>
        <button className="w-24 text-right text-xs font-semibold text-white underline" onClick={onCamaraNativa}>
          Usar cámara normal
        </button>
      </div>
    </div>
  );
}
