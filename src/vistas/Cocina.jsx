import React, { useState, useEffect } from "react";

const reloj = (iso) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};

/* Pantalla de cocina (KDS): solo llegan las comandas YA PAGADAS (mozo o QR).
   El cronómetro cuenta desde el pago. */
export default function VistaCocina({ pos }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const columnas = [
    ["nuevo", "Nuevas", "Empezar", "preparando"],
    ["preparando", "En preparación", "Listo", "listo"],
    ["listo", "Listas para servir", "Entregado", "entregado"],
  ];
  return (
    <div className="kds">
      {columnas.map(([estado, titulo, accion, siguiente]) => {
        const lista = pos.comandas.filter((c) => c.comprobanteId && c.estado === estado);
        return (
          <section key={estado} className={"col col-" + estado}>
            <h2>{titulo} <span className="badge">{lista.length}</span></h2>
            {!lista.length && <p className="vacio">Sin comandas</p>}
            {lista.map((c) => {
              const desde = c.pagadoEn || c.creado;
              const tarde = (Date.now() - new Date(desde).getTime()) / 60000 >= 15 && estado !== "listo";
              return (
                <article key={c.id} className={"ticket-cocina" + (tarde ? " tarde" : "")}>
                  <header>
                    <b>Mesa {c.mesa}</b>
                    <span className="reloj">{reloj(desde)}</span>
                  </header>
                  <p className="origen">Pagado · {c.origen === "qr" ? "pedido por QR" : "tomado por el mozo"}</p>
                  <ul>
                    {c.items.map((i) => (
                      <li key={i.id}><b>{i.cant}×</b> {i.nombre}</li>
                    ))}
                  </ul>
                  {c.nota && <p className="nota">Nota: {c.nota}</p>}
                  <button className="btn" onClick={() => pos.cambiarEstado(c.id, siguiente)}>{accion}</button>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
