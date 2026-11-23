import React, { useState, useEffect } from "react";
import { soles, calcularTotales, minutosDesde } from "../utils.js";

/* Pestaña "Delivery": pedidos hechos por internet (delivery y recojo).
   Ya vienen pagados; cocina los prepara y aquí se despachan o se entregan. */
const ETIQUETA = { nuevo: "En cola de cocina", preparando: "Preparando", listo: "Listo", en_camino: "En camino" };

export default function VistaDelivery({ pos }) {
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const web = pos.comandas.filter((c) => c.web).sort((a, b) => new Date(a.creado) - new Date(b.creado));
  const grupos = [
    ["Listos para salir o recoger", web.filter((c) => c.estado === "listo")],
    ["En camino", web.filter((c) => c.estado === "en_camino")],
    ["En cocina", web.filter((c) => c.estado === "nuevo" || c.estado === "preparando")],
  ];

  return (
    <section className="panel">
      <div className="fila-titulo">
        <h2>Pedidos por internet · {web.length} activos</h2>
        <a className="btn chico" href="#pedir" target="_blank" rel="noreferrer">Abrir la página de pedidos</a>
      </div>
      {!web.length && <p className="vacio">No hay pedidos por internet activos. Llegan ya pagados desde la página “Pide por internet” (#pedir).</p>}
      {grupos.map(([titulo, lista]) => lista.length > 0 && (
        <div key={titulo} className="grupo-productos">
          <h3>{titulo} ({lista.length})</h3>
          <div className="web-lista">
            {lista.map((c) => {
              const w = c.web, delivery = w.tipo === "delivery";
              return (
                <article key={c.id} className={"web-card estado-" + c.estado}>
                  <header>
                    <b>{delivery ? "Delivery" : "Recojo"} #{w.codigo}</b>
                    <span className="web-estado">{ETIQUETA[c.estado]} · hace {minutosDesde(c.creado)} min</span>
                  </header>
                  <p className="web-cliente"><b>{w.nombre}</b> · <a href={`tel:${w.telefono}`}>{w.telefono}</a> ·{" "}
                    <a href={`https://wa.me/51${w.telefono}`} target="_blank" rel="noreferrer">WhatsApp</a></p>
                  {delivery && <p className="web-dir">{w.direccion}, {w.distrito}{w.referencia ? ` · Ref.: ${w.referencia}` : ""}</p>}
                  <ul>{c.items.map((i) => <li key={i.id}>{i.cant}× {i.nombre}</li>)}</ul>
                  {c.nota && <p className="nota">Nota: {c.nota}</p>}
                  <footer>
                    <span>Pagado {soles(calcularTotales(c.items).total)}</span>
                    {c.estado === "listo" && delivery && <button className="btn primario corto" onClick={() => pos.cambiarEstado(c.id, "en_camino")}>Despachar (en camino)</button>}
                    {c.estado === "listo" && !delivery && <button className="btn primario corto" onClick={() => pos.cambiarEstado(c.id, "entregado")}>Entregado al cliente</button>}
                    {c.estado === "en_camino" && <button className="btn primario corto" onClick={() => pos.cambiarEstado(c.id, "entregado")}>Entregado</button>}
                  </footer>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
