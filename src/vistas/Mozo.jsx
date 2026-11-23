import React, { useState } from "react";
import { MESAS } from "../data.js";
import { soles, calcularTotales, minutosDesde, categoriasDe } from "../utils.js";

/* Vista del mozo: toma pedidos en mesa y atiende los llamados de los clientes */
export default function VistaMozo({ pos }) {
  const [mesa, setMesa] = useState("1");
  const productos = pos.productos.filter((p) => p.disponible);
  const categorias = categoriasDe(productos);
  const [catElegida, setCat] = useState(null);
  const cat = categorias.includes(catElegida) ? catElegida : categorias[0];
  const [carrito, setCarrito] = useState([]);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState("");

  const ocupadas = new Set(pos.comandas.filter((c) => c.estado !== "pagado").map((c) => c.mesa));
  const llamando = new Set(pos.solicitudes.map((s) => s.mesa));

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
    setAviso(`Comanda de mesa ${mesa} enviada a cocina`);
    setCarrito([]); setNota("");
    setTimeout(() => setAviso(""), 2500);
  };
  const { total } = calcularTotales(carrito);

  return (
    <>
      {pos.solicitudes.length > 0 && (
        <section className="llamados" aria-live="polite">
          {pos.solicitudes.map((s) => (
            <div key={s.id} className="llamado">
              <span><b>Mesa {s.mesa}</b> {s.tipo === "cuenta" ? "pide la cuenta (pagará en caja)" : "llama al mozo"} · hace {minutosDesde(s.creado)} min</span>
              <button className="btn chico" onClick={() => pos.atender(s.id)}>Atendido</button>
            </div>
          ))}
        </section>
      )}
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
          <p className="leyenda"><span className="pto" /> cuenta abierta <span className="pto amarillo" /> está llamando</p>

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
          <button className="btn primario" disabled={!carrito.length} onClick={enviar}>Enviar a cocina</button>
          {aviso && <p className="ok">{aviso}</p>}
        </aside>
      </div>
    </>
  );
}
