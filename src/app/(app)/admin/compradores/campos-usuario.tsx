type U = { id: string; nombre: string; usuario: string; celular: string; correo: string; rol: string; activo: boolean };

export function CamposUsuario({ u }: { u?: U }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {u && <input type="hidden" name="id" value={u.id} />}
      <label><span className="etiqueta">Nombre</span><input name="nombre" className="campo" defaultValue={u?.nombre} required /></label>
      <label><span className="etiqueta">Usuario (para ingresar)</span><input name="usuario" className="campo lowercase" defaultValue={u?.usuario} required autoCapitalize="none" /></label>
      <label><span className="etiqueta">Celular WhatsApp</span><input name="celular" inputMode="tel" className="campo" defaultValue={u?.celular} required placeholder="3001234567" /></label>
      <label><span className="etiqueta">Correo</span><input name="correo" type="email" className="campo" defaultValue={u?.correo} required /></label>
      <label><span className="etiqueta">{u ? "Nueva contraseña (opcional)" : "Contraseña"}</span>
        <input name="clave" type="password" className="campo" autoComplete="new-password" minLength={8} required={!u} />
      </label>
      <label><span className="etiqueta">Rol</span>
        {u?.rol === "desarrollador" ? (
          <input className="campo" value="Desarrollador" disabled />
        ) : (
          <select name="rol" className="campo" defaultValue={u?.rol ?? "comprador"}><option value="comprador">Comprador</option><option value="admin">Administrador (solo uno)</option></select>
        )}
      </label>
      {u && (
        <label><span className="etiqueta">Estado</span>
          <select name="activo" className="campo" defaultValue={u.activo ? "on" : "off"}><option value="on">Activo</option><option value="off">Inactivo (no puede ingresar)</option></select>
        </label>
      )}
    </div>
  );
}
