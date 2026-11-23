import React, { useState, useRef, useEffect } from "react";
import { EMISOR } from "../data.js";
import { soles } from "../utils.js";
import { responderBot, SUGERENCIAS_BOT } from "../bot.js";
import Plato from "./Plato.jsx";

/* Ventana de chat del bot.
   - Pedidos, cuenta, estado, precios y datos del local: reglas de src/bot.js (exactas).
   - Recomendaciones y conversación libre: Ollama (IA) por /api/bot, si el servidor lo tiene conectado.
   - Si Ollama no está o falla, responde igual con las reglas. */
export default function Bot({ productos, mesa, abiertas, carrito, ia, modeloIA, onAgregar, onIr, onMozo, onVerCarrito, onCerrar }) {
  const [msgs, setMsgs] = useState([{
    de: "bot",
    texto: `¡Hola! Soy el asistente de ${EMISOR.nombreComercial}. Puedo recomendarte algo, tomar tu pedido, decirte cómo va o cuánto es la cuenta. ¿Qué se te antoja?`,
  }]);
  const [texto, setTexto] = useState("");
  const [escribiendo, setEscribiendo] = useState(false);
  const fin = useRef(null);
  useEffect(() => { if (fin.current) fin.current.scrollIntoView({ block: "end" }); }, [msgs, escribiendo]);

  const agregarBot = (m) => setMsgs((ms) => [...ms, { de: "bot", ...m }]);

  async function preguntarIA(pregunta, historial) {
    const r = await fetch("/api/bot", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mesa, mensaje: pregunta, historial: historial.slice(-8).map((m) => ({ de: m.de, texto: m.texto })) }),
    });
    if (!r.ok) throw new Error("IA no disponible");
    const j = await r.json();
    const pedido = (j.agregar || [])
      .map((x) => ({ producto: productos.find((p) => p.id === x.id && p.disponible), cant: x.cant }))
      .filter((x) => x.producto);
    const acciones = [];
    if (j.accion === "mozo") acciones.push({ tipo: "mozo", label: "Sí, llamar al mozo" });
    if (j.accion === "cuenta") acciones.push({ tipo: "ir", tab: "cuenta", label: "Ir a pagar" });
    if (j.accion === "pedidos") acciones.push({ tipo: "ir", tab: "pedidos", label: "Ver mis pedidos" });
    const platos = (j.mostrar || []).map((id) => productos.find((p) => p.id === id && p.disponible)).filter(Boolean);
    return { texto: j.texto, pedido: pedido.length ? pedido : undefined, platos: platos.length ? platos : undefined, acciones };
  }

  const enviar = async (t) => {
    const q = (t || texto).trim().slice(0, 300);
    if (!q || escribiendo) return;
    const historial = msgs;
    setMsgs((ms) => [...ms, { de: "yo", texto: q }]);
    setTexto("");
    setEscribiendo(true);
    // 1) Reglas: pedidos, cuenta, estado, precios y datos del local (exacto e instantáneo)
    let r = responderBot(q, { productos, mesa, abiertas, carrito });
    // 2) Lo demás (recomendar, conversar) lo responde Ollama si está conectado; si falla, quedan las reglas
    if (!r.seguro && ia) {
      try { r = await preguntarIA(q, historial); } catch (e) { /* se usa la respuesta por reglas */ }
    } else {
      await new Promise((ok) => setTimeout(ok, 350));   // pequeña pausa para que se sienta natural
    }
    setEscribiendo(false);
    agregarBot(r);
  };

  const agregarPedido = (pedido, i) => {
    pedido.forEach((x) => onAgregar(x.producto, x.cant, true));
    setMsgs((ms) => ms.map((m, k) => (k === i ? { ...m, hecho: true } : m)));
    agregarBot({
      texto: "Listo, lo agregué. Revisa tu pedido, confírmalo y págalo: cocina lo prepara apenas pagues.",
      acciones: [{ tipo: "carrito", label: "Ver mi pedido y confirmarlo" }],
    });
  };

  const accion = (a) => {
    if (a.tipo === "mozo") { onMozo(); agregarBot({ texto: "Listo, avisé al mozo. Ya viene a tu mesa." }); }
    if (a.tipo === "ir") { onIr(a.tab); onCerrar(); }
    if (a.tipo === "carrito") { onCerrar(); onVerCarrito(); }
  };

  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja chat" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Chat con el asistente">
        <div className="chat-cab">
          <div className="bot-id">
            <span className="bot-avatar" aria-hidden="true">LB</span>
            <span><b>Asistente</b><small>{ia ? `IA con Ollama${modeloIA ? ` · ${modeloIA}` : ""}` : "Responde al instante"}</small></span>
          </div>
          <button className="btn chico" onClick={onCerrar}>Cerrar</button>
        </div>

        <div className="chat-msgs" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={"burbuja " + m.de}>
              <p>{m.texto}</p>
              {m.platos && m.platos.map((p) => (
                <div key={p.id} className="reco">
                  <Plato arte={p.arte} foto={p.foto} size={48} />
                  <span><b>{p.nombre}</b><small>{soles(p.precio)}</small></span>
                  <button className="btn chico" onClick={() => { onAgregar(p, 1, true); agregarBot({ texto: `Agregué 1 × ${p.nombre}.`, acciones: [{ tipo: "carrito", label: "Ver mi pedido y confirmarlo" }] }); }}>Agregar</button>
                </div>
              ))}
              {m.pedido && !m.hecho && (
                <button className="btn primario bot-confirmar" onClick={() => agregarPedido(m.pedido, i)}>Sí, agregar al pedido</button>
              )}
              {m.acciones && m.acciones.map((a) => (
                <button key={a.label} className="btn chico bot-accion" onClick={() => accion(a)}>{a.label}</button>
              ))}
            </div>
          ))}
          {escribiendo && <div className="burbuja bot escribiendo"><span /><span /><span /></div>}
          <div ref={fin} />
        </div>

        <div className="chips bot-chips">
          {SUGERENCIAS_BOT.map((s) => <button key={s} className="chip" onClick={() => enviar(s)}>{s}</button>)}
        </div>
        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
            placeholder="Ej.: 2 hamburguesas royal y una Inca Kola" aria-label="Mensaje" />
          <button className="btn primario" type="submit" disabled={escribiendo}>Enviar</button>
        </form>
      </div>
    </div>
  );
}
