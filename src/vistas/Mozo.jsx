import React, { useState } from "react";
import { MESAS } from "../data.js";
import { soles, calcularTotales, minutosDesde, categoriasDe } from "../utils.js";

/* Vista del mozo: alertas (pedidos listos, pedidos por QR, llamados) y toma de pedidos en mesa */
export default function VistaMozo({ pos, alertas }) {
  const [mesa, setMesa] = useState("1");
  const productos = pos.productos.filter((p) => p.disponible);
  const categorias = categoriasDe(productos);
  const [catElegida, setCat] = useState(null);
  const cat = categorias.includes(catElegida) ? catElegida : categorias[0];
  const [carrito, setCarrito] = useState([]);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");

  const ocupadas = new Set(pos.comandas.filter((c) => c.mesa).map((c) => c.mesa));
  const llamando = new Set(alertas.alertas.map((a) => a.mesa));

  const agregar = (p) =>
    setCarrito((c) => {
      const ex = c.find((i) => i.id === p.id);
      if (ex) return c.map((i) => (i.id === p.id ? { ...i, cant: i.cant + 1 } : i));
      return [...c, { id: p.id, nombre: p.nombre, precio: p.precio, cant: 1 }];
    });
  const cambiarCant = (id, d) =>
    setCarrito((c) => c.map((i) => (i.id === id ? { ...i, cant: i.cant + d } : i)).filter((i) => i.cant > 0));

  const enviar = () => {
    if (!carrito.length) return;
    pos.enviarACocina(mesa, carrito, nota.trim(), "mozo");
    setAviso(`Pedido de mesa ${mesa} registrado: pasa a cocina cuando se cobre en caja`);
    setCarrito([]); setNota("");
    setTimeout(() => setAviso(""), 2500);
  };
  const { total } = calcularTotales(carrito);

  return (
    <>
      <section className={"panel-alertas" + (alertas.alertas.length ? " con-alertas" : "")} aria-live="polite">
        <div className="pa-cab">
          <h2>Alertas del mozo {alertas.alertas.length > 0 && <span className="badge">{alertas.alertas.length}</span>}</h2>
          {alertas.sonido
            ? <span className="pa-sonido"><span className="ok">Sonido activado</span>
                <button className="btn chico" onClick={alertas.probar}>Probar</button>
                <button className="btn chico" onClick={alertas.desactivarSonido}>Silenciar</button></span>
            : <button className="btn primario corto" onClick={alertas.activarSonido}>Activar alertas con sonido</button>}
        </div>
        {!alertas.alertas.length && <p className="vacio">Sin alertas. Aquí aparecen los pedidos listos para servir, los pedidos nuevos por QR y las mesas que te llaman.</p>}
        {alertas.alertas.map((a) => (
          <article key={a.id} className={"alerta-item tipo-" + a.tipo}>
            <span className="ai-mesa">{a.mesa}</span>
            <span className="ai-txt">
              <b>{a.texto}</b>
              {a.detalle && <small>{a.detalle}</small>}
              <small>hace {minutosDesde(a.desde)} min</small>
            </span>
            <button className={a.tipo === "listo" ? "btn primario corto" : "btn"} onClick={a.hacer}>{a.accion}</button>
          </article>
        ))}
      </section>
      <div className="grid-mozo">
        <section className="panel">
          <h2>Mesa</h2>
          <div className="mesas">
            {MESAS.map((m) => (
              <button key={m} onClick={() => setMesa(m)}
                className={"mesa" + (m === mesa ? " sel" : "") + (ocupadas.has(m) ? " ocupada" : "") + (llamando.has(m) ? " llama" : "")}>
                {m}
              </button>
            ))}
          </div>
          <p className="leyenda"><span className="pto" /> cuenta abierta <span className="pto amarillo" /> tiene alerta</p>

          <h2>Carta</h2>
          <div className="chips">
            {categorias.map((c) => (
              <button key={c} className={c === cat ? "chip on" : "chip"} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="productos">
            {productos.filter((p) => p.cat === cat).map((p) => (
              <button key={p.id} className="producto" onClick={() => agregar(p)}>
                <span>{p.nombre}</span>
                <b>{soles(p.precio)}</b>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel comanda">
          <h2>Comanda · Mesa {mesa}</h2>
          {!carrito.length && <p className="vacio">Toca un plato de la carta para agregarlo.</p>}
          <ul className="lineas">
            {carrito.map((i) => (
              <li key={i.id}>
                <div className="cant">
                  <button onClick={() => cambiarCant(i.id, -1)} aria-label="Quitar uno">−</button>
                  <span>{i.cant}</span>
                  <button onClick={() => cambiarCant(i.id, 1)} aria-label="Agregar uno">+</button>
                </div>
                <span className="nom">{i.nombre}</span>
                <span className="num">{soles(i.precio * i.cant)}</span>
              </li>
            ))}
          </ul>
          <label className="campo">
            <span>Nota para cocina</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: término medio, sin cremas" />
          </label>
          <div className="total-linea"><span>Total</span><b>{soles(total)}</b></div>
          <button className="btn primario" disabled={!carrito.length} onClick={enviar}>Registrar pedido</button>
          <p className="vacio peq">Cocina lo prepara cuando el cliente pague en caja.</p>
          {aviso && <p className="ok">{aviso}</p>}
        </aside>
      </div>
    </>
  );
}
