import React, { useState, useEffect } from "react";
import { EMISOR, MESAS } from "./data.js";
import { usePOS } from "./usePOS.js";
import { useAlertasMozo } from "./useAlertasMozo.js";
import VistaMozo from "./vistas/Mozo.jsx";
import VistaCocina from "./vistas/Cocina.jsx";
import VistaCaja from "./vistas/Caja.jsx";
import VistaHistorial from "./vistas/Historial.jsx";
import VistaMesasQR from "./vistas/MesasQR.jsx";
import VistaProductos from "./vistas/Productos.jsx";
import VistaCliente, { ElegirMesa } from "./vistas/Cliente.jsx";
import ModalTicket from "./components/Ticket.jsx";

/* Rutas por hash:
   #mesa-7  -> carta del cliente de la mesa 7 (lo que abre el QR de la mesa)
   #carta   -> QR general: el cliente elige su mesa y luego ve la carta
   #mozo, #cocina, #caja, #comprobantes, #productos, #qr -> sistema del personal (con clave) */
const VISTAS = [["mozo", "Mozo"], ["cocina", "Cocina"], ["caja", "Caja"], ["comprobantes", "Comprobantes"],
  ["productos", "Carta"], ["qr", "Mesas y QR"]];
const leerHash = () => window.location.hash.replace("#", "");

export default function App() {
  const [ruta, setRuta] = useState(leerHash());
  const [verTicket, setVerTicket] = useState(null);
  const encontrada = (ruta.match(/^mesa-(\w+)$/) || [])[1];
  const mesaCliente = encontrada && MESAS.includes(encontrada) ? encontrada : null;
  const rol = mesaCliente ? "cliente" : ruta === "carta" ? "ninguno" : "personal";
  const pos = usePOS({ rol, mesa: mesaCliente });
  const personalListo = rol === "personal" && pos.modo !== "cargando" && !(pos.modo === "servidor" && pos.necesitaClave);
  const alertas = useAlertasMozo(pos, personalListo);

  useEffect(() => {
    const f = () => setRuta(leerHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const ir = (r) => { window.location.hash = r; setRuta(r); };

  if (mesaCliente) return <VistaCliente mesa={mesaCliente} pos={pos} onSalir={() => ir("qr")} />;
  if (ruta === "carta") return <ElegirMesa onElegir={(m) => ir("mesa-" + m)} />;
  if (pos.modo === "servidor" && pos.necesitaClave) return <Ingreso pos={pos} />;

  const vista = VISTAS.some(([k]) => k === ruta) ? ruta : "mozo";
  const badges = {
    mozo: alertas.alertas.length,
    cocina: pos.comandas.filter((c) => c.comprobanteId && (c.estado === "nuevo" || c.estado === "preparando")).length,
    caja: new Set(pos.comandas.filter((c) => !c.comprobanteId).map((c) => c.mesa)).size,
    comprobantes: pos.comprobantes.length,
  };

  return (
    <div className="app">
      <header className="top no-print">
        <div className="marca">
          <span className="logo" aria-hidden="true">{EMISOR.siglas}</span>
          <div>
            <strong>{EMISOR.nombreComercial}</strong>
            <small>RUC {EMISOR.ruc}</small>
          </div>
          <span className={"conexion " + pos.modo} title="Estado de la conexión">
            {pos.modo === "servidor" ? "En línea" : pos.modo === "local" ? "Modo demo" : "Conectando…"}
          </span>
        </div>
        <nav className="tabs">
          {VISTAS.map(([k, label]) => (
            <button key={k} className={vista === k ? "tab on" : "tab"} onClick={() => ir(k)}>
              {label}
              {badges[k] ? <span className="badge">{badges[k]}</span> : null}
            </button>
          ))}
          {pos.modo === "servidor" && <button className="tab" onClick={pos.salir}>Salir</button>}
        </nav>
      </header>

      <main className={"no-print" + (vista === "cocina" ? " oscuro" : "")}>
        {vista === "mozo" && <VistaMozo pos={pos} alertas={alertas} />}
        {vista === "cocina" && <VistaCocina pos={pos} />}
        {vista === "caja" && <VistaCaja pos={pos} onEmitido={setVerTicket} />}
        {vista === "comprobantes" && <VistaHistorial pos={pos} onVer={setVerTicket} />}
        {vista === "productos" && <VistaProductos pos={pos} />}
        {vista === "qr" && <VistaMesasQR modo={pos.modo} />}
      </main>

      {vista !== "mozo" && alertas.alertas.length > 0 && (
        <button className="alerta-flotante no-print" onClick={() => ir("mozo")}>
          <span className="alerta-num">{alertas.alertas.length}</span>
          <span><b>{alertas.alertas[alertas.alertas.length - 1].texto}</b>
            <small>{alertas.alertas.length > 1 ? `y ${alertas.alertas.length - 1} alerta(s) más · ` : ""}Ver alertas del mozo</small></span>
        </button>
      )}
      {verTicket && <ModalTicket comp={verTicket} onCerrar={() => setVerTicket(null)} />}
    </div>
  );
}

/* Pantalla de ingreso del personal (la web es pública, el sistema no) */
function Ingreso({ pos }) {
  const [clave, setClave] = useState("");
  return (
    <div className="ingreso">
      <form className="ingreso-caja" onSubmit={(e) => { e.preventDefault(); pos.entrar(clave); }}>
        <span className="logo grande" aria-hidden="true">{EMISOR.siglas}</span>
        <h1>{EMISOR.nombreComercial}</h1>
        <p className="vacio">Acceso del personal: caja, cocina, mozos y carta.</p>
        <label className="campo">
          <span>Clave del personal</span>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoFocus autoComplete="current-password" />
        </label>
        {pos.errorClave && <p className="err">{pos.errorClave}</p>}
        <button className="btn primario" type="submit">Entrar</button>
        <p className="vacio peq">¿Eres cliente? Escanea el QR de tu mesa para ver la carta.</p>
      </form>
    </div>
  );
}
