/** Campos editables de un tiquete (el administrador puede cambiar cualquier dato). */
type Tiquete = {
  extractora_id?: string; numero?: string; fecha_entrada?: string; peso_bruto_kg?: number; tara_kg?: number;
  neto_impreso_kg?: number | null; placa?: string | null; conductor?: string | null; proveedor?: string | null; bascula?: string | null;
};

/** "2026-10-13T14:41:42+00:00" → "2026-10-13T09:41" en hora de Colombia, para datetime-local. */
function aLocalColombia(iso?: string) {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function CamposTiquete({ t = {}, extractoras }: { t?: Tiquete; extractoras: { id: string; nombre: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label><span className="etiqueta">Extractora</span>
        <select name="extractora_id" className="campo" defaultValue={t.extractora_id}>
          {extractoras.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </label>
      <label><span className="etiqueta">N° tiquete</span><input name="numero" className="campo" defaultValue={t.numero} required /></label>
      <label><span className="etiqueta">Fecha y hora de entrada</span><input name="fecha_entrada" type="datetime-local" className="campo" defaultValue={aLocalColombia(t.fecha_entrada)} required /></label>
      <label><span className="etiqueta">Placa</span><input name="placa" className="campo uppercase" defaultValue={t.placa ?? ""} /></label>
      <label><span className="etiqueta">Peso bruto (kg)</span><input name="peso_bruto_kg" inputMode="numeric" className="campo" defaultValue={t.peso_bruto_kg} required /></label>
      <label><span className="etiqueta">Tara (kg)</span><input name="tara_kg" inputMode="numeric" className="campo" defaultValue={t.tara_kg} required /></label>
      <label><span className="etiqueta">Neto impreso (kg, opcional)</span><input name="neto_impreso_kg" inputMode="numeric" className="campo" defaultValue={t.neto_impreso_kg ?? ""} /></label>
      <label><span className="etiqueta">Proveedor</span><input name="proveedor" className="campo" defaultValue={t.proveedor ?? ""} /></label>
      <label><span className="etiqueta">Conductor</span><input name="conductor" className="campo" defaultValue={t.conductor ?? ""} /></label>
      <label><span className="etiqueta">Báscula</span><input name="bascula" className="campo" defaultValue={t.bascula ?? ""} /></label>
      <label><span className="etiqueta">Motivo del cambio</span><input name="motivo" className="campo" placeholder="Ej.: corrección de lectura" /></label>
    </div>
  );
}
