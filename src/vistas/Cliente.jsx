import React, { useState, useRef, useEffect } from "react";
import { EMISOR, IGV, METODOS_ONLINE, MESAS } from "../data.js";
import { soles, calcularTotales, consolidar, validarCliente, armarCliente, categoriasDe } from "../utils.js";
import Plato from "../components/Plato.jsx";
import FormComprobante, { DATOS_VACIOS } from "../components/FormComprobante.jsx";
import ModalTicket from "../components/Ticket.jsx";
import Bot from "../components/Bot.jsx";

// Seguimiento: primero se paga; recién entonces cocina lo prepara
const PASOS = [["pago", "Pagado"], ["nuevo", "En cocina"], ["preparando", "Preparando"], ["listo", "Listo"]];

/* Lo que ve el cliente al escanear el QR de su mesa */
export default function VistaCliente({ mesa, pos, onSalir }) {
  const [tab, setTab] = useState("carta");
  const productos = pos.productos.filter((p) => p.disponible);
  const categorias = categoriasDe(productos);
  const [catElegida, setCat] = useState(null);
  const cat = categorias.includes(catElegida) ? catElegida : categorias[0];
  const [carrito, setCarrito] = useState([]);
  const [nota, setNota] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [verCarrito, setVerCarrito] = useState(false);
  const [asistente, setAsistente] = useState(false);
  const [toast, setToast] = useState("");
  const [comp, setComp] = useState(null);       // comprobante emitido tras pagar
  const [verTicket, setVerTicket] = useState(false);

  const pedidos = pos.pedidosDe(mesa);        // por pagar y en cocina
  const porPagar = pos.porPagarDe(mesa);      // lo que falta pagar
  const cantCarrito = carrito.reduce((a, i) => a + i.cant, 0);
  const totCarrito = calcularTotales(carrito).total;

  const avisar = (t) => { setToast(t); setTimeout(() => setToast(""), 2200); };
  const agregar = (p, cant = 1) => {
    setCarrito((c) => {
      const ex = c.find((i) => i.id === p.id);
      if (ex) return c.map((i) => (i.id === p.id ? { ...i, cant: i.cant + cant } : i));
      return [...c, { id: p.id, nombre: p.nombre, precio: p.precio, cant }];
    });
    avisar(`${p.nombre} agregado`);
  };
  const cambiarCant = (id, d) =>
    setCarrito((c) => c.map((i) => (i.id === id ? { ...i, cant: i.cant + d } : i)).filter((i) => i.cant > 0));

  const pedir = () => {
    pos.enviarACocina(mesa, carrito, nota.trim(), "qr");
    setCarrito([]); setNota(""); setVerCarrito(false); setComp(null); setTab("cuenta");
    avisar("Pedido registrado: págalo para que cocina lo prepare");
  };
  const llamarMozo = () => { pos.solicitar(mesa, "mozo"); avisar("Avisamos al mozo, ya viene"); };

  return (
    <div className="cliente">
      <header className="cli-top">
        <div>
          <strong>{EMISOR.nombreComercial}</strong>
          <span className="cli-mesa">Mesa {mesa}</span>
        </div>
        <button className="btn chico" onClick={llamarMozo}>Llamar al mozo</button>
      </header>

      <nav className="cli-tabs">
        {[["carta", "Carta"], ["pedidos", `Mis pedidos${pedidos.length ? " (" + pedidos.length + ")" : ""}`], ["cuenta", `Pagar${porPagar.length ? " (" + porPagar.length + ")" : ""}`]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      {tab === "carta" && (
        <div className="cli-cuerpo">
          <button className="asistente-btn" onClick={() => setAsistente(true)}>
            <b>¿No sabes qué pedir?</b>
            <span>Pregúntale al asistente o escríbele tu pedido</span>
          </button>
          <div className="chips cli-cats">
            {categorias.map((c) => (
              <button key={c} className={c === cat ? "chip on" : "chip"} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="carta">
            {productos.filter((p) => p.cat === cat).map((p) => (
              <article key={p.id} className="plato-card">
                <button className="plato-abrir" onClick={() => setDetalle(p)} aria-label={`Ver ${p.nombre}`}>
                  <Plato arte={p.arte} foto={p.foto} size={84} />
                  <span className="plato-txt">
                    <b>{p.nombre}</b>
                    <small>{p.desc}</small>
                    <em>{soles(p.precio)}</em>
                  </span>
                </button>
                <button className="mas" onClick={() => agregar(p)} aria-label={`Agregar ${p.nombre}`}>+</button>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "pedidos" && <MisPedidos pedidos={pedidos} irACarta={() => setTab("carta")} irAPagar={() => setTab("cuenta")} />}

      {tab === "cuenta" && (
        <Cuenta mesa={mesa} pos={pos} abiertas={porPagar} comp={comp}
          onPagado={(c) => setComp(c)} onVerTicket={() => setVerTicket(true)}
          onNuevo={() => { setComp(null); setTab("carta"); }} avisar={avisar} />
      )}

      {cantCarrito > 0 && !verCarrito && (
        <button className="barra-carrito" onClick={() => setVerCarrito(true)}>
          <span>Ver mi pedido ({cantCarrito})</span><b>{soles(totCarrito)}</b>
        </button>
      )}

      {detalle && <Detalle p={detalle} onCerrar={() => setDetalle(null)} onAgregar={(cant) => { agregar(detalle, cant); setDetalle(null); }} />}

      {verCarrito && (
        <div className="hoja-fondo" onClick={() => setVerCarrito(false)}>
          <div className="hoja" onClick={(e) => e.stopPropagation()}>
            <h2>Tu pedido · Mesa {mesa}</h2>
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
              <span>¿Alguna indicación para cocina?</span>
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: sin cebolla" />
            </label>
            <button className="btn primario" disabled={!carrito.length} onClick={pedir}>
              Confirmar pedido · {soles(totCarrito)}
            </button>
            <button className="btn ancho" onClick={() => setVerCarrito(false)}>Seguir viendo la carta</button>
          </div>
        </div>
      )}

      {!asistente && !verCarrito && !detalle && tab !== "cuenta" && (
        <button className={"bot-flotante" + (cantCarrito > 0 ? " sube" : "")} onClick={() => setAsistente(true)} aria-label="Abrir el asistente">
          <span className="bot-avatar" aria-hidden="true">LB</span><span>¿Te ayudo?</span>
        </button>
      )}
      {asistente && (
        <Bot productos={productos} mesa={mesa} abiertas={pedidos} carrito={carrito} ia={pos.botIA} modeloIA={pos.modeloIA}
          onAgregar={(p, cant) => agregar(p, cant)} onIr={setTab} onMozo={llamarMozo}
          onVerCarrito={() => setVerCarrito(true)} onCerrar={() => setAsistente(false)} />
      )}
      {verTicket && comp && <ModalTicket comp={comp} onCerrar={() => setVerTicket(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}

      {pos.modo !== "servidor" && (
        <footer className="cli-pie">
          <button className="link" onClick={onSalir}>Salir de la vista cliente (demo)</button>
        </footer>
      )}
    </div>
  );
}

/* ---------- Ficha del plato ---------- */
function Detalle({ p, onCerrar, onAgregar }) {
  const [cant, setCant] = useState(1);
  return (
    <div className="hoja-fondo" onClick={onCerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={p.nombre}>
        <div className="detalle-arte"><Plato arte={p.arte} foto={p.foto} size={180} /></div>
        <h2 className="detalle-nombre">{p.nombre}</h2>
        <p>{p.desc}</p>
        <div className="detalle-pie">
          <div className="cant grande">
            <button onClick={() => setCant((c) => Math.max(1, c - 1))} aria-label="Menos">−</button>
            <span>{cant}</span>
            <button onClick={() => setCant((c) => c + 1)} aria-label="Más">+</button>
          </div>
          <button className="btn primario" onClick={() => onAgregar(cant)}>Agregar · {soles(p.precio * cant)}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Seguimiento del pedido ---------- */
function MisPedidos({ pedidos, irACarta, irAPagar }) {
  if (!pedidos.length)
    return (
      <div className="cli-cuerpo">
        <p className="vacio">Aún no pediste nada en esta mesa.</p>
        <button className="btn primario" onClick={irACarta}>Ver la carta</button>
      </div>
    );
  return (
    <div className="cli-cuerpo">
      {pedidos.map((c, n) => {
        const idx = c.comprobanteId ? PASOS.findIndex(([e]) => e === c.estado) : -1;
        return (
          <article key={c.id} className="seguimiento">
            <h3>Pedido {n + 1}</h3>
            <ol className="pasos">
              {PASOS.map(([e, l], i) => <li key={e} className={i <= idx ? "hecho" : ""}>{l}</li>)}
            </ol>
            <ul>{c.items.map((i) => <li key={i.id}>{i.cant}× {i.nombre}</li>)}</ul>
            {!c.comprobanteId && (
              <div className="pendiente-pago">
                <p>Pendiente de pago: cocina lo prepara cuando pagues.</p>
                <button className="btn primario" onClick={irAPagar}>Pagar ahora</button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ---------- Cuenta, pago desde el celular y calificación ---------- */
function Cuenta({ mesa, pos, abiertas, comp, onPagado, onVerTicket, onNuevo, avisar }) {
  const [datos, setDatos] = useState(DATOS_VACIOS);
  const [metodo, setMetodo] = useState("Yape");
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [calificado, setCalificado] = useState(false);

  const items = consolidar(abiertas);
  const tot = calcularTotales(items);
  const yaPidio = pos.solicitudes.some((s) => s.mesa === mesa && s.tipo === "cuenta");

  if (comp) {
    return (
      <div className="cli-cuerpo centro">
        <div className="check" aria-hidden="true">✓</div>
        <h2 className="titulo-pago">Pago aprobado</h2>
        <p className="vacio">Mesa {comp.mesa} · {soles(comp.total)} · {comp.pago.metodo}</p>
        <p className="ok">Tu pedido ya pasó a cocina. Síguelo en "Mis pedidos".</p>
        <button className="btn ancho" onClick={onVerTicket}>
          Ver mi {comp.tipo === "factura" ? "factura" : "boleta"} {comp.serie}-{comp.numero}
        </button>
        {!calificado ? (
          <div className="calificar">
            <h3>¿Cómo estuvo todo?</h3>
            <div className="estrellas" role="radiogroup" aria-label="Calificación">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} role="radio" aria-checked={estrellas === i} aria-label={`${i} estrellas`}
                  className={i <= estrellas ? "llena" : ""} onClick={() => setEstrellas(i)}>★</button>
              ))}
            </div>
            <label className="campo">
              <span>Comentario (opcional)</span>
              <input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Cuéntanos tu experiencia" />
            </label>
            <button className="btn primario" disabled={!estrellas}
              onClick={() => { pos.calificar(mesa, estrellas, comentario.trim(), comp.id); setCalificado(true); }}>
              Enviar calificación
            </button>
          </div>
        ) : (
          <div className="calificar"><h3>¡Gracias por tu visita!</h3><p className="vacio">Tu opinión llegó al restaurante.</p></div>
        )}
        <button className="link" onClick={onNuevo}>Hacer un nuevo pedido</button>
      </div>
    );
  }

  if (!items.length)
    return <div className="cli-cuerpo"><p className="vacio">No tienes nada pendiente de pago. Cuando pidas algo de la carta, aparecerá aquí para pagarlo.</p></div>;

  const pagarOnline = () => {
    const err = validarCliente(datos, tot.total);
    if (err) return setError(err);
    setError(""); setProcesando(true);
    // Aquí iría la pasarela real (Niubiz, Culqi, Mercado Pago, Izipay…). En la demo se simula.
    setTimeout(async () => {
      try {
        const c = await pos.emitir({
          mesa, tipo: datos.tipo, origen: "qr", datosCliente: datos, cliente: armarCliente(datos),
          pago: { metodo, recibido: tot.total, vuelto: 0, operacion: String(Math.floor(10000000 + Math.random() * 89999999)) },
        });
        onPagado(c);
      } catch (e) {
        setError(e.message);
      }
      setProcesando(false);
    }, 1200);
  };
  const pagarEnCaja = () => {
    const err = validarCliente(datos, tot.total);
    if (err) return setError(err);
    setError("");
    pos.solicitar(mesa, "cuenta", datos);
    avisar("Avisamos a caja: al pagar, tu pedido pasa a cocina");
  };

  return (
    <div className="cli-cuerpo">
      <h2>Por pagar · Mesa {mesa}</h2>
      <p className="alerta">Cocina prepara tu pedido apenas lo pagues.</p>
      <ul className="lineas">
        {items.map((i) => (
          <li key={i.id} className="sin-cant">
            <span className="nom">{i.cant}× {i.nombre}</span>
            <span className="num">{soles(i.precio * i.cant)}</span>
          </li>
        ))}
      </ul>
      <dl className="totales">
        <dt>Op. gravada</dt><dd>{soles(tot.gravada)}</dd>
        <dt>IGV ({IGV * 100}%)</dt><dd>{soles(tot.igv)}</dd>
        <dt className="grande">Total</dt><dd className="grande">{soles(tot.total)}</dd>
      </dl>

      <h2>¿Boleta o factura?</h2>
      <FormComprobante datos={datos} onChange={(d) => { setDatos(d); setError(""); }} total={tot.total} />

      <h2>Pagar desde tu celular</h2>
      <div className="chips">
        {METODOS_ONLINE.map((m) => (
          <button key={m} className={m === metodo ? "chip on" : "chip"} onClick={() => setMetodo(m)}>{m}</button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      <button className="btn primario" disabled={procesando} onClick={pagarOnline}>
        {procesando ? "Procesando pago…" : `Pagar ${soles(tot.total)} con ${metodo}`}
      </button>
      <p className="vacio peq">Pago simulado para la demo.</p>
      <button className="btn ancho" disabled={yaPidio} onClick={pagarEnCaja}>
        {yaPidio ? "Ya avisamos a caja: paga ahí para que cocina empiece" : "Prefiero pagar en caja / efectivo"}
      </button>
    </div>
  );
}

/* ---------- QR general (#carta): el cliente elige su mesa ---------- */
export function ElegirMesa({ onElegir }) {
  return (
    <div className="cliente">
      <header className="cli-top"><div><strong>{EMISOR.nombreComercial}</strong><span className="cli-mesa">Bienvenido</span></div></header>
      <div className="cli-cuerpo">
        <h2 className="titulo-pago">¿En qué mesa estás?</h2>
        <p className="vacio">Toca tu número de mesa para ver la carta y pedir.</p>
        <div className="mesas">
          {MESAS.map((m) => <button key={m} className="mesa" onClick={() => onElegir(m)}>{m}</button>)}
        </div>
      </div>
    </div>
  );
}
