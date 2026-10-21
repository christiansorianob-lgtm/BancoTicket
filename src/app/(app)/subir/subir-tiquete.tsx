"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Camera, CheckCircle2, ImageUp, RotateCcw, XCircle, Loader2 } from "lucide-react";
import { analizarCuadro, nitidezDeFoto, pareceDocumento, UMBRALES, type Verificacion } from "@/lib/camara/analisis";
import { MENSAJE_BORROSA } from "@/lib/camara/nitidez";
import { imagenDesdeArchivo, reducirImagen } from "@/lib/imagen";
import { fechaHora } from "@/lib/fechas";
import { formatoToneladas, netoKg } from "@/lib/numeros";
import { Dato, Mensaje } from "@/components/ui";
import { AvisoContacto, abrirWhatsApp } from "@/components/contacto";
import { detalleTiquete } from "@/lib/mensajes";
import { MESES_MAXIMOS } from "@/lib/lectura/controles";import { enviarARevision, enviarTiquete } from "./acciones";

type Control = { nombre: string; ok: boolean; mensaje: string; dudoso?: boolean };
type Datos = {
  numero: string; fecha_entrada: string; peso_bruto_kg: number; tara_kg: number;
  neto_impreso_kg: number | null; placa: string | null; conductor: string | null; proveedor: string | null; bascula: string | null;
};
/** extractora: la que detectó la IA entre las registradas (null si no la reconoció). */
type Lectura = { extractora?: { id: string; nombre: string } | null } & (
  | { ok: true; datos: Datos; controles: Control[]; dudosos: string[]; token: string; posiblesDuplicados: { extractora: string; numero: string; fecha_entrada: string }[] }
  | { ok: false; duplicado: { quien: string; cuando: string; estado: string }; datos: Datos; controles: Control[]; ilegible?: undefined }
  // Ilegible: no se puede enviar; el comprador debe conseguir una foto clara.
  | { ok: false; ilegible: true; fueraDePeriodo: boolean; motivo: string; controles: Control[]; duplicado?: undefined; datos?: undefined }
  // Tiquete legible de una extractora que no está registrada: va a revisión para aprenderla.
  | { ok: false; motivo: string; controles: Control[]; tokenRevision: string; duplicado?: undefined; datos?: undefined; ilegible?: undefined }
);

type Paso = "inicio" | "camara" | "leyendo" | "resultado";

// Luz, quietud y enfoque en verde durante 3 cuadros seguidos (~1 s): la foto se toma sola.
const CUADROS_ESTABLES = 3;

/**
 * El comprador elige cámara guiada o galería; la IA reconoce la extractora y lee el
 * tiquete. Él compara los datos con el papel y confirma.
 */
export function SubirTiquete({ celularAdmin, nombreComprador }: { celularAdmin: string | null; nombreComprador: string }) {
  const [paso, setPaso] = useState<Paso>("inicio");
  const [origen, setOrigen] = useState<"camara" | "galeria">("camara");
  const [foto, setFoto] = useState<string | null>(null);
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Lo último que se envió: se muestra en la pantalla de subir, con el WhatsApp de respaldo.
  const [listo, setListo] = useState<{ texto: string; mensaje: string } | null>(null);
  const [enviando, iniciar] = useTransition();
  const galeria = useRef<HTMLInputElement>(null);
  const camaraNativa = useRef<HTMLInputElement>(null);

  const nombreExtractora = lectura?.extractora?.nombre ?? "";

  function reiniciar() {
    if (foto) URL.revokeObjectURL(foto);
    setFoto(null); setLectura(null); setError(null); setListo(null);
    setPaso("inicio");
  }

  /** Tras enviar: abre la app de WhatsApp con el mensaje y vuelve a la pantalla de subir tiquete. */
  function terminar(texto: string, mensaje: string) {
    abrirWhatsApp({ celular: celularAdmin, mensaje });
    if (foto) URL.revokeObjectURL(foto);
    setFoto(null); setLectura(null); setError(null);
    setListo({ texto, mensaje });
    setPaso("inicio");
  }

  function repetirFoto() {
    setPaso(origen === "camara" ? "camara" : "inicio");
  }

  async function leer(blob: Blob, desde: "camara" | "galeria") {
    setOrigen(desde);
    setFoto(URL.createObjectURL(blob));
    setPaso("leyendo");
    setError(null);
    const form = new FormData();
    form.set("imagen", new File([blob], blob.type === "image/webp" ? "tiquete.webp" : "tiquete.jpg", { type: blob.type }));
    form.set("origen", desde);
    try {
      const r = await fetch("/api/leer-tiquete", { method: "POST", body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Error al leer la foto");
      setLectura(json);
      setPaso("resultado");
    } catch (e) {
      setError((e as Error).message);
      setPaso("inicio");
    }
  }

  async function desdeArchivo(archivo: File | undefined, desde: "camara" | "galeria") {
    if (!archivo) return;
    let img: ImageBitmap;
    try {
      img = await imagenDesdeArchivo(archivo);
    } catch {
      setError("No se pudo abrir la imagen");
      setPaso("inicio");
      return;
    }
    // Mismas revisiones que la cámara guiada, antes de gastar una lectura de la IA.
    if (!pareceDocumento(img)) {
      setError("La imagen no parece un tiquete (no se ve texto impreso). Elija la foto del tiquete.");
      setPaso("inicio");
      return;
    }
    if (nitidezDeFoto(img) < 1) {
      setError(MENSAJE_BORROSA);
      setPaso("inicio");
      return;
    }
    await leer(await reducirImagen(img, 2000), desde);
  }

  if (paso === "camara") {
    return (
      <>
        <CamaraGuiada onCaptura={(b) => leer(b, "camara")} onCancelar={() => setPaso("inicio")}
          onCamaraNativa={() => camaraNativa.current?.click()} onGaleria={() => galeria.current?.click()} />
        <input ref={camaraNativa} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { desdeArchivo(e.target.files?.[0], "camara"); e.target.value = ""; }} />
        <input ref={galeria} type="file" accept="image/*" className="hidden"
          onChange={(e) => { desdeArchivo(e.target.files?.[0], "galeria"); e.target.value = ""; }} />
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

  if (paso === "resultado" && lectura) {
    // Campos que la IA no leyó 100 % seguros: se resaltan y la administradora los revisa.
    const dudoso = (campo: string) => lectura.ok && lectura.dudosos.includes(campo);
    return (
      <div className="space-y-4">
        <div className="tarjeta grid gap-4 sm:grid-cols-2">
          {foto && <img src={foto} alt="Foto del tiquete" className="w-full rounded-xl border border-borde" />}
          <div className="space-y-3">
            {lectura.datos && (
              <dl className="grid grid-cols-2 gap-3">
                <Dato etiqueta="Extractora">{nombreExtractora || "—"}</Dato>
                <Dato etiqueta="N° tiquete" revisar={dudoso("número")}>{lectura.datos.numero}</Dato>
                <Dato etiqueta="Fecha" revisar={dudoso("fecha")}>{fechaHora(lectura.datos.fecha_entrada)}</Dato>
                <Dato etiqueta="Placa" revisar={dudoso("placa")}>{lectura.datos.placa ?? "—"}</Dato>
                <Dato etiqueta="Peso bruto" revisar={dudoso("peso bruto")}>{formatoToneladas(lectura.datos.peso_bruto_kg / 1000)}</Dato>
                <Dato etiqueta="Tara" revisar={dudoso("tara")}>{formatoToneladas(lectura.datos.tara_kg / 1000)}</Dato>
                <Dato etiqueta="Peso neto">{formatoToneladas(netoKg(lectura.datos) / 1000)}</Dato>
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
            <Mensaje tono="alerta">Compare estos datos, incluida la extractora, con el tiquete que tiene en la mano. No se pueden editar: si algo no coincide, tome otra foto.</Mensaje>
            {lectura.dudosos.length > 0 && (
              <Mensaje tono="alerta">El número y el peso neto se leyeron con certeza. Estos otros datos no son 100 % legibles: {lectura.dudosos.join(", ")} (resaltados arriba). Puede enviarlo así y la administradora los revisará con la foto.</Mensaje>
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
                  if (!r.ok) return setError(r.error);
                  terminar(
                    `Tiquete N° ${r.numero} de ${r.extractora} enviado. Queda pendiente de aprobación.`,
                    `Hola, soy ${nombreComprador}. Subí este tiquete a BancoTicket para su aprobación:\n\n${detalleTiquete({ ...lectura.datos, extractora: r.extractora })}`,
                  );
                })}>
                <CheckCircle2 className="size-5" /> {enviando ? "Enviando…" : "Coincide, enviar"}
              </button>
              <button className="boton-secundario py-4" disabled={enviando} onClick={repetirFoto}>
                <RotateCcw className="size-5" /> No coincide, tomar otra foto
              </button>
            </div>
          </>
        ) : lectura.duplicado ? (
          <>
            <Mensaje tono="error">
              Este tiquete ya está registrado en {nombreExtractora}: lo registró {lectura.duplicado.quien} el {fechaHora(lectura.duplicado.cuando)} ({lectura.duplicado.estado}).
            </Mensaje>
            <button className="boton-secundario w-full" onClick={reiniciar}>Volver</button>
          </>
        ) : lectura.ilegible && lectura.fueraDePeriodo ? (
          <>
            <Mensaje tono="error">
              Este tiquete no está dentro del periodo permitido para subirlo: {lectura.motivo.toLowerCase()} desde su fecha de entrada. Solo se pueden subir tiquetes de los últimos {MESES_MAXIMOS} meses.
            </Mensaje>
            <button className="boton-secundario w-full" onClick={reiniciar}>Volver</button>
          </>
        ) : lectura.ilegible ? (
          <>
            <Mensaje tono="error">
              No se puede registrar: {lectura.motivo}. Se necesita un tiquete más legible: busque una foto más clara o, mejor, tome la foto al tiquete en físico con la cámara de la app, de frente, con buena luz, completo y sin arrugas.
            </Mensaje>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="boton-primario py-4" onClick={() => setPaso("camara")}><Camera className="size-5" /> Tomar la foto con la cámara</button>
              <button className="boton-secundario py-4" onClick={() => galeria.current?.click()}><ImageUp className="size-5" /> Elegir otra foto</button>
            </div>
            <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => { desdeArchivo(e.target.files?.[0], "galeria"); e.target.value = ""; }} />
          </>
        ) : (
          <>
            <Mensaje tono="error">{lectura.motivo}. Si es de una extractora nueva, envíelo a revisión para que el administrador la registre.</Mensaje>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="boton-primario" onClick={repetirFoto}><RotateCcw className="size-5" /> Tomar otra foto</button>
              <button className="boton-secundario" disabled={enviando}
                onClick={() => iniciar(async () => {
                  const r = await enviarARevision(lectura.tokenRevision);
                  if (!r.ok) return setError(r.error ?? "Error");
                  terminar(
                    "La foto pasó a revisión del administrador. Le avisaremos cuando la registre.",
                    `Hola, soy ${nombreComprador}. Envié a revisión un tiquete${nombreExtractora ? ` de ${nombreExtractora}` : ""} que la app no pudo leer.`,
                  );
                })}>
                Enviar a revisión del administrador
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Inicio: dos opciones, cámara guiada o galería. También se vuelve aquí tras enviar o si hubo un error.
  return (
    <div className="space-y-4">
      {error && <Mensaje tono="error">{error}</Mensaje>}
      {listo && (
        <div className="tarjeta space-y-3">
          <Mensaje tono="ok"><span className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0" /> {listo.texto}</span></Mensaje>
          <p className="text-xs text-suave">Si WhatsApp no se abrió, toque el botón:</p>
          <AvisoContacto contacto={{ celular: celularAdmin, mensaje: listo.mensaje }} automatico={false} />
        </div>
      )}
      <p className="text-center text-sm text-suave">¿Cómo quiere subir el tiquete? La app reconoce sola la extractora y lee los datos.</p>
      <div className="grid gap-3">
        <button className="tarjeta flex items-center gap-4 text-left transition hover:ring-2 hover:ring-primario" onClick={() => setPaso("camara")}>
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primario text-white"><Camera className="size-7" /></span>
          <span>
            <span className="block text-lg font-bold text-profundo">Usar la cámara</span>
            <span className="block text-sm text-suave">Apunte al tiquete y la foto se toma sola cuando esté nítida.</span>
          </span>
        </button>
        <button className="tarjeta flex items-center gap-4 text-left transition hover:ring-2 hover:ring-primario" onClick={() => galeria.current?.click()}>
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primario-suave text-primario"><ImageUp className="size-7" /></span>
          <span>
            <span className="block text-lg font-bold text-profundo">Subir desde la galería</span>
            <span className="block text-sm text-suave">Elija una foto del tiquete que ya tenga guardada.</span>
          </span>
        </button>
        <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={(e) => { desdeArchivo(e.target.files?.[0], "galeria"); e.target.value = ""; }} />
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

function CamaraGuiada({ onCaptura, onCancelar, onCamaraNativa, onGaleria }: {
  onCaptura: (b: Blob) => void; onCancelar: () => void; onCamaraNativa: () => void; onGaleria: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const flujoRef = useRef<MediaStream | null>(null);
  const [verificaciones, setVerificaciones] = useState<Verificacion[]>([]);
  const [nitidez, setNitidez] = useState(0);
  const [estables, setEstables] = useState(0);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [avisoFoto, setAvisoFoto] = useState<string | null>(null);
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
        let previo: Float32Array | null = null;
        temporizador = setInterval(() => {
          const caja = contenedor.current;
          if (!v.videoWidth || !caja) return;
          // Solo se analiza lo que está dentro del marco (sigue al celular si gira).
          const m = marcoEnVideo(v.videoWidth, v.videoHeight, caja.clientWidth, caja.clientHeight);
          const sx = m.x * v.videoWidth, sy = m.y * v.videoHeight, sw = m.w * v.videoWidth, sh = m.h * v.videoHeight;
          // A 640 px el desenfoque se nota; a menos resolución una imagen borrosa parece nítida.
          const escala = Math.min(1, UMBRALES.ladoAnalisis / Math.max(sw, sh));
          const ancho = Math.round(sw * escala), alto = Math.round(sh * escala);
          if (lienzo.width !== ancho || lienzo.height !== alto) { lienzo.width = ancho; lienzo.height = alto; previo = null; }
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, ancho, alto);
          const r = analizarCuadro(ctx.getImageData(0, 0, ancho, alto), previo);
          previo = r.lum;
          setVerificaciones(r.verificaciones);
          setNitidez(r.nitidez);
          setEstables((n) => (r.verificaciones.every((x) => x.ok || !x.bloquea) ? n + 1 : 0));
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
  const primerAviso = verificaciones.find((v) => !v.ok && v.bloquea) ?? verificaciones.find((v) => !v.ok);
  const esperaHasta = useRef(0);

  async function capturar() {
    const v = video.current, caja = contenedor.current;
    if (!v || !caja || !flujoRef.current || capturando) return;
    setCapturando(true);
    setAvisoFoto(null);
    const m = marcoEnVideo(v.videoWidth, v.videoHeight, caja.clientWidth, caja.clientHeight);
    // No se gira la foto: la IA lee bien tiquetes de lado y un giro automático equivocado arruinaría una foto buena.
    const c = await fotoDelSensor(flujoRef.current, v, m);
    // Revisión decisiva: la foto que se va a enviar, a resolución completa, debe estar nítida.
    // Sin texto impreso no se gasta una lectura de la IA.
    const fallo = !pareceDocumento(c)
      ? "No se ve un tiquete en la foto. Apunte la cámara al tiquete: se tomará otra sola."
      : nitidezDeFoto(c) < 1 ? "La foto salió borrosa. Sostenga el celular quieto: se tomará otra sola." : null;
    if (fallo) {
      setAvisoFoto(fallo);
      setEstables(0);
      esperaHasta.current = Date.now() + 1500;
      setCapturando(false);
      return;
    }
    onCaptura(await reducirImagen(c, 2000));
  }

  // Foto automática: apenas se cumplen los mínimos (luz, quieto y enfocado), se toma sola.
  useEffect(() => {
    if (!lista || capturando || Date.now() < esperaHasta.current) return;
    void capturar();
    // capturar usa refs y el estado actual; basta con reaccionar cuando la cámara queda lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, estables]);

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
        <p className={`min-w-0 flex-1 rounded-full px-3 py-2 text-center text-sm font-bold text-white ${avisoFoto ? "bg-red-600/90" : lista ? "bg-emerald-600/90" : "bg-red-600/90"}`}>
          {capturando ? "Tomando la foto…" : avisoFoto ?? (lista ? "Lista: tomando la foto…" : (primerAviso?.aviso ?? "Acomodando la cámara…"))}
        </p>
      </div>

      {/* Barra inferior: nitidez, galería, disparador grande al alcance del pulgar y cámara normal */}
      <div className="absolute inset-x-0 bottom-0 space-y-3 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-sm items-center gap-2 text-xs font-semibold text-white">
          <span className="shrink-0">Nitidez</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25" role="meter" aria-label="Nitidez" aria-valuenow={Math.round(Math.min(nitidez, 1.5) * 100)} aria-valuemin={0} aria-valuemax={150}>
            <div className={`h-full rounded-full transition-all ${nitidez >= 1 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.min(nitidez / 1.5, 1) * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
        <button className="flex w-24 flex-col items-center gap-1 text-xs font-semibold text-white" onClick={onGaleria} aria-label="Subir desde la galería">
          <span className="flex size-11 items-center justify-center rounded-full bg-black/50"><ImageUp className="size-6" /></span>
          Galería
        </button>
        <button
          className={`flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white transition ${lista ? "bg-white/90" : "bg-white/25"} disabled:opacity-60`}
          disabled={capturando}
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
    </div>
  );
}
