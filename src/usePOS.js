import { useState, useEffect, useRef } from "react";
import { aplicar, ESTADO_INICIAL, vistaPedidoWeb } from "./logica.js";
import { PRODUCTOS_INICIALES } from "./data.js";

/* Conexión con los datos del restobar.
   - MODO SERVIDOR (web publicada o npm start): los datos viven en la base de datos del servidor
     y llegan en tiempo real a todos los dispositivos.
       · rol "cliente"  (QR #mesa-7): sin clave, solo ve la carta y su propia mesa.
       · rol "personal" (caja, cocina, mozo, carta): necesita la clave del personal.
   - MODO DEMO (sin servidor): todo en este navegador (localStorage). */
const CLAVE_LOCAL = "pos_estado";
const leerLocal = () => {
  let s;
  try { s = { ...ESTADO_INICIAL, ...JSON.parse(localStorage.getItem(CLAVE_LOCAL) || "{}") }; } catch (e) { s = { ...ESTADO_INICIAL }; }
  if (!s.productos || !s.productos.length) s.productos = PRODUCTOS_INICIALES;
  return s;
};
const guardarLocal = (s) => { try { localStorage.setItem(CLAVE_LOCAL, JSON.stringify(s)); } catch (e) { /* lleno o sin storage */ } };
const leerClave = () => { try { return localStorage.getItem("pos_clave") || ""; } catch (e) { return ""; } };

export function usePOS({ rol, mesa }) {
  const [modo, setModo] = useState("cargando");          // "cargando" | "servidor" | "local"
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const [clave, setClave] = useState(leerClave);
  const [necesitaClave, setNecesitaClave] = useState(false);
  const [errorClave, setErrorClave] = useState("");
  const [info, setInfo] = useState(null);           // datos del servidor (¿bot con Ollama?)
  const modoRef = useRef("cargando");
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  // 1. ¿Hay servidor?
  useEffect(() => {
    fetch("/api/info")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("sin servidor"))))
      .then((i) => { modoRef.current = "servidor"; setModo("servidor"); setInfo(i); })
      .catch(() => { modoRef.current = "local"; setModo("local"); });
  }, []);

  // 2. Cargar datos y escuchar cambios en tiempo real
  useEffect(() => {
    if (modo === "local") {
      setEstado(leerLocal());
      const f = (ev) => { if (ev.key === CLAVE_LOCAL) setEstado(leerLocal()); };
      window.addEventListener("storage", f);
      return () => window.removeEventListener("storage", f);
    }
    if (modo !== "servidor" || rol === "ninguno") return undefined;

    const qs = rol === "cliente" ? `mesa=${encodeURIComponent(mesa)}` : rol === "web" ? "web=1" : `clave=${encodeURIComponent(clave)}`;
    let fuente = null, vivo = true;
    fetch(`/api/estado?${qs}`)
      .then((r) => {
        if (r.status === 401) { setNecesitaClave(true); if (clave) setErrorClave("Clave incorrecta."); return null; }
        return r.json();
      })
      .then((s) => {
        if (!s || !vivo) return;
        setNecesitaClave(false); setErrorClave(""); setEstado(s);
        fuente = new EventSource(`/api/stream?${qs}`);
        fuente.onmessage = (ev) => setEstado(JSON.parse(ev.data));
      })
      .catch(() => {});
    return () => { vivo = false; if (fuente) fuente.close(); };
  }, [modo, rol, mesa, clave]);

  const cabeceras = () => ({ "Content-Type": "application/json", "x-clave": rol === "personal" ? clave : "", "x-mesa": mesa || "" });

  // Ejecuta una acción del negocio y devuelve su resultado (p. ej. el comprobante emitido)
  const accion = async (tipo, datos) => {
    if (modoRef.current === "servidor") {
      const r = await fetch("/api/accion", { method: "POST", headers: cabeceras(), body: JSON.stringify({ tipo, datos }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error del servidor");
      if (j.estado) setEstado(j.estado);
      return j.resultado;
    }
    const { estado: nuevo, resultado } = aplicar(estadoRef.current, { tipo, datos });
    estadoRef.current = nuevo;
    setEstado(nuevo);
    guardarLocal(nuevo);
    return resultado;
  };
  const enSegundoPlano = (tipo, datos) => accion(tipo, datos).catch((e) => console.error(e));

  // Fotos: en el servidor se guardan en la base de datos; en modo demo, en el navegador
  const subirFoto = async (id, dataUrl) => {
    if (modoRef.current === "servidor") {
      const r = await fetch(`/api/fotos/${encodeURIComponent(id)}`, { method: "POST", headers: cabeceras(), body: JSON.stringify({ dataUrl }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No se pudo subir la foto");
      setEstado(j.estado);
      return;
    }
    await accion("fijarFoto", { id, foto: dataUrl });
  };
  const quitarFoto = async (id) => {
    if (modoRef.current === "servidor") {
      const r = await fetch(`/api/fotos/${encodeURIComponent(id)}`, { method: "DELETE", headers: cabeceras() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "No se pudo quitar la foto");
      setEstado(j.estado);
      return;
    }
    await accion("fijarFoto", { id, foto: null });
  };

  const entrar = (c) => {
    if (c && c === clave) { setErrorClave("Clave incorrecta."); return; }
    try { localStorage.setItem("pos_clave", c); } catch (e) { /* nada */ }
    setErrorClave(""); setClave(c);
  };
  const salir = () => { entrar(""); setNecesitaClave(true); setEstado(ESTADO_INICIAL); };

  return {
    ...estado,
    modo, necesitaClave, errorClave, entrar, salir,
    botIA: !!(info && info.bot === "ollama"), modeloIA: info && info.modelo,
    pedidosDe: (m) => estado.comandas.filter((c) => c.mesa === m),                 // por pagar y en cocina
    porPagarDe: (m) => estado.comandas.filter((c) => c.mesa === m && !c.comprobanteId),
    enviarACocina: (m, items, nota, origen) => enSegundoPlano("enviarACocina", { mesa: m, items, nota, origen }),
    cambiarEstado: (id, est) => enSegundoPlano("cambiarEstado", { id, estado: est }),
    solicitar: (m, tipo, datos) => enSegundoPlano("solicitar", { mesa: m, tipo, datos }),
    atender: (id) => enSegundoPlano("atender", { id }),
    calificar: (m, estrellas, comentario, compId) => enSegundoPlano("calificar", { mesa: m, estrellas, comentario, compId }),
    reiniciar: () => enSegundoPlano("reiniciar"),
    emitir: (datos) => accion("emitir", datos),                        // devuelve el comprobante
    pedidoWeb: (datos) => accion("pedidoWeb", datos),                  // devuelve {codigo, comprobante}
    // Seguimiento de un pedido por internet; null si ya se entregó o no existe
    seguirPedido: async (codigo) => {
      if (modoRef.current === "servidor") {
        const r = await fetch(`/api/pedido/${encodeURIComponent(codigo)}`);
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("No se pudo consultar el pedido");
        return r.json();
      }
      return vistaPedidoWeb(estadoRef.current, codigo);
    },
    guardarProducto: (producto) => accion("guardarProducto", { producto }),
    eliminarProducto: (id) => accion("eliminarProducto", { id }),
    subirFoto, quitarFoto,
  };
}
