import React, { useState, useEffect } from "react";
import { EMISOR, NEGOCIO, IGV, METODOS_ONLINE, DISTRITOS_REPARTO, PEDIDO_MINIMO_DELIVERY } from "../data.js";
import { soles, calcularTotales, validarCliente, categoriasDe } from "../utils.js";
import Plato from "../components/Plato.jsx";
import FormComprobante, { DATOS_VACIOS } from "../components/FormComprobante.jsx";
import ModalTicket from "../components/Ticket.jsx";
import Bot from "../components/Bot.jsx";

/* PÁGINA DE PEDIDOS POR INTERNET  (#pedir)
   Delivery o recojo en el local. Se paga al pedir y el pedido pasa directo a cocina.
   Seguimiento con un código (#seguir-ABC123). */

const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* nada */ } };
const ENTREGA_VACIA = { tipo: "delivery", nombre: "", telefono: "", distrito: DISTRITOS_REPARTO[0], direccion: "", referencia: "" };

export function PaginaPedido({ pos, ir }) {
  const productos = pos.productos.filter((p) => p.disponible);
  const categorias = categoriasDe(productos);
  const [catElegida, setCat] = useState(null);
  const cat = categorias.includes(catElegida) ? catElegida : categorias[0];
  const [carrito, setCarrito] = useState([]);
  const [paso, setPaso] = useState("carta");                 // carta | datos | listo
  const [detalle, setDetalle] = useState(null);
  const [bot, setBot] = useState(false);
  const [toast, setToast] = useState("");
  const [entrega, setEntrega] = useState(() => ({ ...ENTREGA_VACIA, ...leer("pos_web_entrega", {}) }));
  const [datosComp, setDatosComp] = useState(DATOS_VACIOS);
  const [metodo, setMetodo] = useState("Yape");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");
  const [pagando, setPagando] = useState(false);
  const [hecho, setHecho] = useState(null);                  // {codigo, comprobante}
  const [verTicket, setVerTicket] = useState(false);
  const misPedidos = leer("pos_web_pedidos", []);

  const tot = calcularTotales(carrito);
  const cant = carrito.reduce((a, i) => a + i.cant, 0);
  const esDelivery = entrega.tipo === "delivery";
  const faltaMinimo = esDelivery && tot.total < PEDIDO_MINIMO_DELIVERY;

  const avisar = (t) => { setToast(t); setTimeout(() => setToast(""), 2000); };
  const agregar = (p, n = 1) => {
    setCarrito((c) => {
      const ex = c.find((i) => i.id === p.id);
      return ex ? c.map((i) => (i.id === p.id ? { ...i, cant: i.cant + n } : i)) : [...c, { id: p.id, nombre: p.nombre, precio: p.precio, cant: n }];
    });
    avisar(`${p.nombre} agregado`);
  };
  const cambiar = (id, d) => setCarrito((c) => c.map((i) => (i.id === id ? { ...i, cant: i.cant + d } : i)).filter((i) => i.cant > 0));
  const setE = (k, v) => setEntrega((e) => ({ ...e, [k]: v }));

  const pagar = () => {
    setError("");
    if (entrega.nombre.trim().length < 2) return setError("Escribe tu nombre.");
    if (!/^9\d{8}$/.test(entrega.telefono)) return setError("El celular debe tener 9 dígitos y empezar con 9.");
    if (esDelivery && entrega.direccion.trim().length < 5) return setError("Escribe la dirección de entrega.");
    if (faltaMinimo) return setError(`El pedido mínimo para delivery es ${soles(PEDIDO_MINIMO_DELIVERY)}.`);
    const err = validarCliente(datosComp, tot.total);
    if (err) return setError(err);
    setPagando(true);
    guardar("pos_web_entrega", { ...entrega, tipo: entrega.tipo });
    // Aquí iría la pasarela de pago real (Niubiz, Culqi, Izipay, Mercado Pago…). En la demo se simula.
    setTimeout(async () => {
      try {
        const r = await pos.pedidoWeb({
          items: carrito.map((i) => ({ id: i.id, cant: i.cant })), nota: nota.trim(), entrega, datosCliente: datosComp,
          pago: { metodo, operacion: String(Math.floor(10000000 + Math.random() * 89999999)) },
        });
        guardar("pos_web_pedidos", [{ codigo: r.codigo, fecha: new Date().toISOString(), total: r.comprobante.total }, ...misPedidos].slice(0, 10));
        setHecho(r); setCarrito([]); setNota(""); setPaso("listo");
      } catch (e) {
        setError(e.message);
      }
      setPagando(false);
    }, 1200);
  };

  /* ---------- confirmación ---------- */
  if (paso === "listo" && hecho) {
    return (
      <div className="cliente web">
        <Cabecera />
        <div className="cli-cuerpo centro">
          <div className="check" aria-hidden="true">✓</div>
          <h2 className="titulo-pago">¡Pedido pagado!</h2>
          <p className="vacio">Ya está en cocina. Guarda tu código para seguirlo:</p>
          <p className="codigo-pedido">{hecho.codigo}</p>
          <button className="btn primario" onClick={() => ir("seguir-" + hecho.codigo)}>Seguir mi pedido</button>
          <button className="btn ancho" onClick={() => setVerTicket(true)}>
            Ver mi {hecho.comprobante.tipo === "factura" ? "factura" : "boleta"} {hecho.comprobante.serie}-{hecho.comprobante.numero}
          </button>
          <button className="link" onClick={() => { setHecho(null); setPaso("carta"); }}>Hacer otro pedido</button>
        </div>
        {verTicket && <ModalTicket comp={hecho.comprobante} onCerrar={() => setVerTicket(false)} />}
      </div>
    );
  }

  /* ---------- datos de entrega y pago ---------- */
  if (paso === "datos") {
    return (
      <div className="cliente web">
        <Cabecera />
        <div className="cli-cuerpo">
          <button className="link volver" onClick={() => setPaso("carta")}>← Volver a la carta</button>
          <h2>Tu pedido</h2>
          <ul className="lineas">
            {carrito.map((i) => (
              <li key={i.id}>
                <div className="cant">
                  <button onClick={() => cambiar(i.id, -1)} aria-label="Quitar uno">−</button>
                  <span>{i.cant}</span>
                  <button onClick={() => cambiar(i.id, 1)} aria-label="Agregar uno">+</button>
                </div>
                <span className="nom">{i.nombre}</span>
                <span className="num">{soles(i.precio * i.cant)}</span>
              </li>
            ))}
          </ul>
          {!carrito.length && <p className="vacio">Tu pedido está vacío.</p>}
          <dl className="totales">
            <dt>Op. gravada</dt><dd>{soles(tot.gravada)}</dd>
            <dt>IGV ({IGV * 100}%)</dt><dd>{soles(tot.igv)}</dd>
            <dt className="grande">Total</dt><dd className="grande">{soles(tot.total)}</dd>
          </dl>

          <h2>¿Cómo lo recibes?</h2>
          <div className="segmento">
            <button className={esDelivery ? "on" : ""} onClick={() => setE("tipo", "delivery")}>Delivery</button>
            <button className={!esDelivery ? "on" : ""} onClick={() => setE("tipo", "recojo")}>Recojo en el local</button>
          </div>
          {esDelivery
            ? <p className="vacio peq-izq">Reparto en {DISTRITOS_REPARTO.join(", ")}. Pedido mínimo {soles(PEDIDO_MINIMO_DELIVERY)}. Delivery gratis.</p>
            : <p className="vacio peq-izq">Recoges en {EMISOR.direccion}. Te avisamos cuando esté listo.</p>}

          <label className="campo"><span>Nombre *</span>
            <input value={entrega.nombre} onChange={(e) => setE("nombre", e.target.value)} autoComplete="name" />
          </label>
          <label className="campo"><span>Celular *</span>
            <input inputMode="tel" maxLength={9} value={entrega.telefono} placeholder="9XXXXXXXX" autoComplete="tel-national"
              onChange={(e) => setE("telefono", e.target.value.replace(/\D/g, ""))} />
          </label>
          {esDelivery && (
            <>
              <label className="campo"><span>Distrito *</span>
                <select value={entrega.distrito} onChange={(e) => setE("distrito", e.target.value)}>
                  {DISTRITOS_REPARTO.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="campo"><span>Dirección *</span>
                <input value={entrega.direccion} onChange={(e) => setE("direccion", e.target.value)} placeholder="Av. / Jr. / Calle, número, dpto." autoComplete="street-address" />
              </label>
              <label className="campo"><span>Referencia</span>
                <input value={entrega.referencia} onChange={(e) => setE("referencia", e.target.value)} placeholder="Frente al parque, puerta verde…" />
              </label>
            </>
          )}
          <label className="campo"><span>Indicaciones para cocina</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: sin cremas, término medio" />
          </label>

          <h2>¿Boleta o factura?</h2>
          <FormComprobante datos={datosComp} onChange={(d) => { setDatosComp(d); setError(""); }} total={tot.total} />

          <h2>Pago</h2>
          <div className="chips">
            {METODOS_ONLINE.map((m) => <button key={m} className={m === metodo ? "chip on" : "chip"} onClick={() => setMetodo(m)}>{m}</button>)}
          </div>
          {faltaMinimo && <p className="alerta">Te faltan {soles(PEDIDO_MINIMO_DELIVERY - tot.total)} para el pedido mínimo de delivery.</p>}
          {error && <p className="err">{error}</p>}
          <button className="btn primario" disabled={pagando || !carrito.length || faltaMinimo} onClick={pagar}>
            {pagando ? "Procesando pago…" : `Pagar ${soles(tot.total)} con ${metodo}`}
          </button>
          <p className="vacio peq">Pago simulado para la demo. Al pagar, tu pedido pasa a cocina.</p>
        </div>
      </div>
    );
  }

  /* ---------- carta ---------- */
  return (
    <div className="cliente web">
      <Cabecera />
      <section className="web-hero">
        <h1>Pide por internet</h1>
        <p>Delivery a {DISTRITOS_REPARTO.join(", ")} o recojo en el local. Pagas en línea y tu pedido entra directo a cocina.</p>
        <p className="web-horario">{NEGOCIO.horario}</p>
      </section>
      {misPedidos.length > 0 && (
        <div className="mis-web">
          <span>Tus pedidos:</span>
          {misPedidos.slice(0, 3).map((m) => (
            <button key={m.codigo} className="chip" onClick={() => ir("seguir-" + m.codigo)}>{m.codigo}</button>
          ))}
        </div>
      )}
      <div className="cli-cuerpo">
        <button className="asistente-btn" onClick={() => setBot(true)}>
          <b>¿No sabes qué pedir?</b>
          <span>Pregúntale al asistente o escríbele tu pedido</span>
        </button>
        <div className="chips cli-cats">
          {categorias.map((c) => <button key={c} className={c === cat ? "chip on" : "chip"} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        {!productos.length && <p className="vacio">Cargando la carta…</p>}
        <div className="carta">
          {productos.filter((p) => p.cat === cat).map((p) => (
            <article key={p.id} className="plato-card">
              <button className="plato-abrir" onClick={() => setDetalle(p)} aria-label={`Ver ${p.nombre}`}>
                <Plato arte={p.arte} foto={p.foto} size={84} />
                <span className="plato-txt"><b>{p.nombre}</b><small>{p.desc}</small><em>{soles(p.precio)}</em></span>
              </button>
              <button className="mas" onClick={() => agregar(p)} aria-label={`Agregar ${p.nombre}`}>+</button>
            </article>
          ))}
        </div>
      </div>

      {cant > 0 && (
        <button className="barra-carrito" onClick={() => setPaso("datos")}>
          <span>Continuar ({cant})</span><b>{soles(tot.total)}</b>
        </button>
      )}

      {detalle && (
        <div className="hoja-fondo" onClick={() => setDetalle(null)}>
          <div className="hoja" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={detalle.nombre}>
            <div className="detalle-arte"><Plato arte={detalle.arte} foto={detalle.foto} size={180} /></div>
            <h2 className="detalle-nombre">{detalle.nombre}</h2>
            <p>{detalle.desc}</p>
            <button className="btn primario" onClick={() => { agregar(detalle); setDetalle(null); }}>Agregar · {soles(detalle.precio)}</button>
          </div>
        </div>
      )}
      {bot && (
        <Bot productos={productos} mesa={null} abiertas={[]} carrito={carrito} ia={false}
          onAgregar={(p, n) => agregar(p, n)} onIr={() => setPaso("datos")} onMozo={() => {}}
          onVerCarrito={() => setPaso("datos")} onCerrar={() => setBot(false)} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Cabecera() {
  return (
    <header className="cli-top">
      <div>
        <strong>{EMISOR.nombreComercial}</strong>
        <span className="cli-mesa">Pedidos por internet</span>
      </div>
      <a className="btn chico web-tel" href={`https://wa.me/51${NEGOCIO.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
    </header>
  );
}

/* ---------- SEGUIMIENTO (#seguir-ABC123) ---------- */
const PASOS_DELIVERY = [["nuevo", "Pagado"], ["preparando", "Preparando"], ["listo", "Listo"], ["en_camino", "En camino"], ["entregado", "Entregado"]];
const PASOS_RECOJO = [["nuevo", "Pagado"], ["preparando", "Preparando"], ["listo", "Listo para recoger"], ["entregado", "Entregado"]];
const MENSAJE = {
  nuevo: "Recibimos tu pago. Tu pedido está en cola de cocina.",
  preparando: "Estamos preparando tu pedido.",
  listo: { delivery: "Tu pedido está listo y sale en breve.", recojo: "¡Tu pedido está listo! Puedes pasar a recogerlo." },
  en_camino: "Tu pedido va en camino.",
  entregado: "Pedido entregado. ¡Buen provecho!",
};

export function SeguirPedido({ pos, codigo, ir }) {
  const [pedido, setPedido] = useState(() => leer("pos_web_ultimo_" + codigo, null));
  const [estado, setEstado] = useState("cargando");   // cargando | activo | entregado | no_existe
  const [verTicket, setVerTicket] = useState(false);

  useEffect(() => {
    if (pos.modo === "cargando") return undefined;
    let vivo = true;
    const consultar = async () => {
      try {
        const p = await pos.seguirPedido(codigo);
        if (!vivo) return;
        if (p) { setPedido(p); guardar("pos_web_ultimo_" + codigo, p); setEstado("activo"); }
        else setEstado(leer("pos_web_ultimo_" + codigo, null) ? "entregado" : "no_existe");
      } catch (e) { /* se reintenta */ }
    };
    consultar();
    const t = setInterval(consultar, 6000);
    return () => { vivo = false; clearInterval(t); };
  }, [pos.modo, codigo]);

  const est = estado === "entregado" ? "entregado" : pedido && pedido.estado;
  const pasos = pedido && pedido.tipo === "delivery" ? PASOS_DELIVERY : PASOS_RECOJO;
  const idx = pasos.findIndex(([e]) => e === est);
  const msg = est && (typeof MENSAJE[est] === "string" ? MENSAJE[est] : MENSAJE[est] && MENSAJE[est][pedido.tipo]);

  return (
    <div className="cliente web">
      <Cabecera />
      <div className="cli-cuerpo">
        <p className="vacio">Pedido</p>
        <p className="codigo-pedido izq">{codigo}</p>
        {estado === "cargando" && !pedido && <p className="vacio">Buscando tu pedido…</p>}
        {estado === "no_existe" && (
          <>
            <p className="alerta">No encontramos ese pedido. Puede que ya se haya entregado o que el código esté mal escrito.</p>
            <button className="btn primario" onClick={() => ir("pedir")}>Hacer un pedido</button>
          </>
        )}
        {pedido && (
          <>
            <article className="seguimiento">
              <h3>{pedido.tipo === "delivery" ? `Delivery a ${pedido.distrito}` : "Recojo en el local"}</h3>
              <ol className="pasos" style={{ gridTemplateColumns: `repeat(${pasos.length}, 1fr)` }}>
                {pasos.map(([e, l], i) => <li key={e} className={i <= idx ? "hecho" : ""}>{l}</li>)}
              </ol>
              {msg && <p className="msg-seguimiento">{msg}</p>}
              <ul>{pedido.items.map((i) => <li key={i.id}>{i.cant}× {i.nombre}</li>)}</ul>
              <p><b>Total pagado: {soles(pedido.total)}</b></p>
              {pedido.tipo === "recojo" && <p className="vacio">Dirección: {EMISOR.direccion}</p>}
            </article>
            {pedido.comprobante && (
              <button className="btn ancho" onClick={() => setVerTicket(true)}>
                Ver mi {pedido.comprobante.tipo === "factura" ? "factura" : "boleta"} {pedido.comprobante.serie}-{pedido.comprobante.numero}
              </button>
            )}
            <p className="vacio peq">Esta página se actualiza sola.</p>
            <button className="link" onClick={() => ir("pedir")}>Hacer otro pedido</button>
          </>
        )}
      </div>
      {verTicket && pedido && pedido.comprobante && <ModalTicket comp={pedido.comprobante} onCerrar={() => setVerTicket(false)} />}
    </div>
  );
}
