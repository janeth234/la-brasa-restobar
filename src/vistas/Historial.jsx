import React, { useState } from "react";
import { METODOS } from "../data.js";
import { soles, r2, fechaHora } from "../utils.js";

const Estrellas = ({ n }) => (
  <span className="estrellas-mini" aria-label={`${n} de 5 estrellas`}>
    {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? "llena" : ""}>★</i>)}
  </span>
);

/* Comprobantes emitidos, cierre de caja y reseñas de los clientes */
export default function VistaHistorial({ pos, onVer }) {
  const [filtro, setFiltro] = useState("todos");
  const [confirmar, setConfirmar] = useState(false);
  const comps = pos.comprobantes;
  const lista = comps.filter((c) => filtro === "todos" || c.tipo === filtro);
  const totalDia = r2(comps.reduce((a, c) => a + c.total, 0));
  const porMetodo = METODOS.map((m) => [m, r2(comps.filter((c) => c.pago.metodo === m).reduce((a, c) => a + c.total, 0))]);
  const promedio = pos.resenas.length ? pos.resenas.reduce((a, r) => a + r.estrellas, 0) / pos.resenas.length : 0;

  return (
    <div className="grid-caja">
      <section className="panel">
        <h2>Comprobantes emitidos</h2>
        <div className="chips">
          {[["todos", "Todos"], ["boleta", "Boletas"], ["factura", "Facturas"]].map(([k, l]) => (
            <button key={k} className={filtro === k ? "chip on" : "chip"} onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>
        {!lista.length ? <p className="vacio">Aún no se emitieron comprobantes.</p> : (
          <table className="detalle">
            <thead><tr><th>Número</th><th>Cliente</th><th>Pago</th><th className="num">Total</th><th></th></tr></thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.serie}-{c.numero}</b><br /><small>{fechaHora(c.fecha)} · Mesa {c.mesa}</small></td>
                  <td>{c.cliente.nombre}<br /><small>{c.cliente.doc === "-" ? "Sin documento" : c.cliente.tipoDoc + " " + c.cliente.doc}</small></td>
                  <td>{c.pago.metodo}<br /><small>{c.origen === "qr" ? "desde el celular" : "en caja"}</small></td>
                  <td className="num">{soles(c.total)}</td>
                  <td><button className="btn chico" onClick={() => onVer(c)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>Reseñas de clientes</h2>
        {!pos.resenas.length ? <p className="vacio">Las calificaciones que dejan los clientes al pagar por QR aparecen aquí.</p> : (
          <ul className="resenas">
            {pos.resenas.map((r) => (
              <li key={r.id}>
                <Estrellas n={r.estrellas} /> <small>Mesa {r.mesa} · {fechaHora(r.fecha)}</small>
                {r.comentario && <p>{r.comentario}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="panel">
        <h2>Cierre de caja</h2>
        <p className="cifra">{soles(totalDia)}</p>
        <p className="vacio">
          {comps.filter((c) => c.tipo === "boleta").length} boletas · {comps.filter((c) => c.tipo === "factura").length} facturas
        </p>
        <ul className="barras">
          {porMetodo.map(([m, v]) => (
            <li key={m}>
              <span>{m}</span>
              <div className="barra"><i style={{ width: totalDia ? (v / totalDia) * 100 + "%" : 0 }} /></div>
              <b className="num">{soles(v)}</b>
            </li>
          ))}
        </ul>
        <h2>Calificación promedio</h2>
        <p className="cifra">{promedio ? promedio.toFixed(1) : "–"} <small className="vacio">/ 5 · {pos.resenas.length} reseñas</small></p>

        <div className="separador" />
        {!confirmar
          ? <button className="btn" onClick={() => setConfirmar(true)}>Reiniciar datos de prueba</button>
          : (
            <div className="confirmar">
              <p>¿Borrar pedidos, comprobantes, reseñas y correlativos?</p>
              <button className="btn peligro" onClick={() => { pos.reiniciar(); setConfirmar(false); }}>Sí, borrar</button>
              <button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button>
            </div>
          )}
      </aside>
    </div>
  );
}
