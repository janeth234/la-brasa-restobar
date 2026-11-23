import { ahora, uid, calcularTotales, consolidar, montoEnLetras, validarCliente, armarCliente, soles } from "./utils.js";
import { DISTRITOS_REPARTO, PEDIDO_MINIMO_DELIVERY, METODOS_ONLINE } from "./data.js";

/* Reglas del negocio en un solo lugar.
   Las usa el SERVIDOR (server/server.js) y también el modo demo sin servidor.
   aplicar(estado, accion) -> { estado: nuevoEstado, resultado } */

export const ESTADO_INICIAL = {
  productos: [],     // la carta: {id, cat, nombre, precio, desc, disponible, foto, arte, tags}
  comandas: [],      // {id, mesa | null, web?, items, nota, origen: "qr"|"mozo"|"web", estado, creado, comprobanteId?}
                     // web = {codigo, tipo: "delivery"|"recojo", nombre, telefono, direccion, distrito, referencia}
  solicitudes: [],   // {id, mesa, tipo: "mozo"|"cuenta", datos, creado}
  comprobantes: [],  // boletas y facturas emitidas
  correlativos: { B001: 0, F001: 0 },
  resenas: [],       // {id, mesa, estrellas, comentario, compId, fecha}
};

/* Regla del restobar: COCINA SOLO PREPARA LO QUE YA ESTÁ PAGADO.
   Una comanda sin comprobanteId está "pendiente de pago" (no aparece en cocina).
   Al emitir la boleta/factura, sus comandas reciben comprobanteId y pasan a cocina. */
export const porPagar = (c) => !c.comprobanteId;
const porPagarDe = (e, mesa) => e.comandas.filter((c) => mesa && c.mesa === mesa && porPagar(c));
export const ESTADOS_VALIDOS = ["nuevo", "preparando", "listo", "en_camino", "entregado"];

// Nombre y precio se toman de la carta (nunca del celular) para que nadie cambie precios
function limpiarItems(e, items) {
  if (!Array.isArray(items) || !items.length) throw new Error("Pedido vacío");
  return items.map((i) => {
    const p = e.productos.find((x) => x.id === i.id);
    if (!p || !p.disponible) throw new Error(`"${(p && p.nombre) || i.nombre || i.id}" ya no está disponible.`);
    const cant = Math.floor(Number(i.cant));
    if (!(cant > 0 && cant <= 50)) throw new Error("Cantidad inválida.");
    return { id: p.id, nombre: p.nombre, precio: p.precio, cant };
  });
}

// Arma la boleta/factura (valida RUC/DNI, numera la serie). No cambia el estado.
function crearComprobante(e, { items, datosCliente, pago: p = {}, origen, mesa = null, web = null }) {
  const tot = calcularTotales(items);
  const dc = { tipo: "boleta", doc: "", nombre: "", direccion: "", ...(datosCliente || {}) };
  const err = validarCliente(dc, tot.total);
  if (err) throw new Error(err);
  const tc = dc.tipo === "factura" ? "factura" : "boleta";
  const recibido = Math.max(Number(p.recibido) || tot.total, tot.total);
  const pago = { metodo: String(p.metodo || "Efectivo"), recibido, vuelto: Math.round((recibido - tot.total) * 100) / 100,
    operacion: p.operacion ? String(p.operacion).slice(0, 30) : undefined };
  const serie = tc === "factura" ? "F001" : "B001";
  const numero = (e.correlativos[serie] || 0) + 1;
  const comp = {
    id: uid(), tipo: tc, serie, numero: String(numero).padStart(8, "0"),
    fecha: ahora(), mesa, cliente: armarCliente(dc), items, ...tot, pago, origen,
    letras: montoEnLetras(tot.total), ...(web ? { web: { codigo: web.codigo, tipo: web.tipo } } : {}),
  };
  return { comp, correlativos: { ...e.correlativos, [serie]: numero } };
}

// Código corto para seguir un pedido por internet (sin letras que se confunden)
function codigoPedido(e) {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    let c = "";
    for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
    if (!e.comandas.some((x) => x.web && x.web.codigo === c)) return c;
  }
}

export function aplicar(e, { tipo, datos = {} }) {
  switch (tipo) {
    case "enviarACocina": {
      const { mesa, items, nota, origen } = datos;
      if (!mesa) throw new Error("Falta la mesa.");
      const limpios = limpiarItems(e, items);
      const comanda = {
        id: uid(), mesa, items: limpios, nota: String(nota || "").slice(0, 200),
        origen: origen === "mozo" ? "mozo" : "qr", estado: "nuevo", creado: ahora(),
      };
      return { estado: { ...e, comandas: [...e.comandas, comanda] }, resultado: comanda };
    }
    case "cambiarEstado": {
      const { id, estado } = datos;
      if (!ESTADOS_VALIDOS.includes(estado)) throw new Error("Estado inválido.");
      const actual = e.comandas.find((c) => c.id === id);
      if (!actual) throw new Error("La comanda ya no existe.");
      if (porPagar(actual)) throw new Error("Esta comanda aún no está pagada: cocina la prepara cuando se cobre.");
      if (estado === "en_camino" && !(actual.web && actual.web.tipo === "delivery")) throw new Error("Solo un delivery puede salir en camino.");
      // al entregarla, sale de las pantallas (en la base de datos queda como "entregado")
      if (estado === "entregado") return { estado: { ...e, comandas: e.comandas.filter((c) => c.id !== id) } };
      return { estado: { ...e, comandas: e.comandas.map((c) => (c.id === id ? { ...c, estado, [estado]: ahora() } : c)) } };
    }
    case "solicitar": {
      const { mesa, tipo: t, datos: d } = datos;
      if (!["mozo", "cuenta"].includes(t)) throw new Error("Solicitud inválida.");
      const solicitudes = [...e.solicitudes.filter((s) => !(s.mesa === mesa && s.tipo === t)),
        { id: uid(), mesa, tipo: t, datos: d || null, creado: ahora() }];
      return { estado: { ...e, solicitudes } };
    }
    case "atender":
      return { estado: { ...e, solicitudes: e.solicitudes.filter((s) => s.id !== datos.id) } };

    case "emitir": {
      // Emite boleta (B001) o factura (F001) y cierra la cuenta de la mesa
      const { mesa, datosCliente, origen } = datos;
      const items = consolidar(porPagarDe(e, mesa));
      if (!items.length) throw new Error("La mesa no tiene pedidos pendientes de pago.");
      const { comp, correlativos } = crearComprobante(e, { items, datosCliente, pago: datos.pago, origen, mesa });
      return {
        estado: {
          ...e,
          correlativos,
          comprobantes: [comp, ...e.comprobantes],
          // las comandas pagadas pasan a cocina (el cronómetro de cocina empieza al pagar)
          comandas: e.comandas.map((c) => (c.mesa === mesa && porPagar(c) ? { ...c, comprobanteId: comp.id, pagadoEn: comp.fecha } : c)),
          solicitudes: e.solicitudes.filter((s) => s.mesa !== mesa),
        },
        resultado: comp,
      };
    }
    case "pedidoWeb": {
      // Pedido por internet: se paga al pedir y pasa directo a cocina (primero se paga)
      const { items, nota, entrega = {}, datosCliente, pago = {} } = datos;
      const limpios = consolidar([{ items: limpiarItems(e, items) }]);   // une productos repetidos
      const tipo = entrega.tipo === "delivery" ? "delivery" : "recojo";
      const nombre = String(entrega.nombre || "").trim().slice(0, 80);
      const telefono = String(entrega.telefono || "").replace(/\D/g, "");
      if (nombre.length < 2) throw new Error("Escribe tu nombre.");
      if (!/^9\d{8}$/.test(telefono)) throw new Error("El celular debe tener 9 dígitos y empezar con 9.");
      let direccion = "", distrito = "", referencia = "";
      if (tipo === "delivery") {
        distrito = String(entrega.distrito || "");
        direccion = String(entrega.direccion || "").trim().slice(0, 200);
        referencia = String(entrega.referencia || "").trim().slice(0, 200);
        if (!DISTRITOS_REPARTO.includes(distrito)) throw new Error("Elige un distrito de reparto.");
        if (direccion.length < 5) throw new Error("Escribe la dirección de entrega.");
        if (calcularTotales(limpios).total < PEDIDO_MINIMO_DELIVERY)
          throw new Error(`El pedido mínimo para delivery es ${soles(PEDIDO_MINIMO_DELIVERY)}.`);
      }
      if (!METODOS_ONLINE.includes(pago.metodo)) throw new Error("Elige cómo pagar: " + METODOS_ONLINE.join(", ") + ".");
      const web = { codigo: codigoPedido(e), tipo, nombre, telefono, direccion, distrito, referencia };
      const { comp, correlativos } = crearComprobante(e, { items: limpios, datosCliente, pago, origen: "web", web });
      const comanda = {
        id: uid(), mesa: null, web, items: limpios, nota: String(nota || "").slice(0, 200),
        origen: "web", estado: "nuevo", creado: comp.fecha, comprobanteId: comp.id, pagadoEn: comp.fecha,
      };
      return {
        estado: { ...e, correlativos, comprobantes: [comp, ...e.comprobantes], comandas: [...e.comandas, comanda] },
        resultado: { codigo: web.codigo, comprobante: comp, comanda },
      };
    }
    case "calificar": {
      const { mesa, compId } = datos;
      const estrellas = Math.round(Number(datos.estrellas));
      if (!(estrellas >= 1 && estrellas <= 5)) throw new Error("La calificación debe ser de 1 a 5 estrellas.");
      const r = { id: uid(), mesa, estrellas, comentario: String(datos.comentario || "").slice(0, 300), compId: compId || null, fecha: ahora() };
      return { estado: { ...e, resenas: [r, ...e.resenas] } };
    }
    case "guardarProducto": {
      // crea o edita un producto de la carta
      const p = limpiarProducto(datos.producto);
      const existe = e.productos.some((x) => x.id === p.id);
      const productos = existe ? e.productos.map((x) => (x.id === p.id ? { ...x, ...p, foto: x.foto } : x)) : [...e.productos, p];
      return { estado: { ...e, productos }, resultado: p };
    }
    case "eliminarProducto":
      return { estado: { ...e, productos: e.productos.filter((x) => x.id !== datos.id) } };
    case "fijarFoto":   // foto = URL (servidor) o dataURL (modo demo); null para quitarla
      return { estado: { ...e, productos: e.productos.map((x) => (x.id === datos.id ? { ...x, foto: datos.foto || null } : x)) } };

    case "reiniciar":   // borra pedidos, comprobantes y reseñas; la carta se mantiene
      return { estado: { ...ESTADO_INICIAL, productos: e.productos } };
    default:
      throw new Error("Acción desconocida: " + tipo);
  }
}

export function limpiarProducto(p = {}) {
  const nombre = String(p.nombre || "").trim();
  const precio = Math.round(Number(p.precio) * 100) / 100;
  const cat = String(p.cat || "").trim();
  if (!nombre) throw new Error("El producto necesita un nombre.");
  if (!cat) throw new Error("El producto necesita una categoría.");
  if (!(precio > 0)) throw new Error("El precio debe ser mayor a 0.");
  return {
    id: p.id || "p" + uid(),
    cat, nombre, precio,
    desc: String(p.desc || "").trim(),
    disponible: p.disponible !== false,
    foto: p.foto || null,
    arte: p.arte || { forma: "hamburguesa", c: ["#7a3b22", "#7cc35a", "#e04b3a"] },
    tags: Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
  };
}

/* Lo que puede ver un cliente desde el QR: la carta y SOLO lo de su mesa
   (no ve comprobantes ni datos de otros clientes) */
export function vistaPublica(e, mesa) {
  return {
    ...ESTADO_INICIAL,
    productos: e.productos.filter((p) => p.disponible),
    comandas: mesa ? e.comandas.filter((c) => c.mesa === mesa) : [],
    solicitudes: mesa ? e.solicitudes.filter((s) => s.mesa === mesa) : [],
  };
}

/* Seguimiento de un pedido por internet (solo quien tiene el código lo ve).
   Devuelve null si ya fue entregado o no existe. */
export function vistaPedidoWeb(e, codigo) {
  const c = e.comandas.find((x) => x.web && x.web.codigo === String(codigo || "").toUpperCase());
  if (!c) return null;
  const comp = e.comprobantes.find((x) => x.id === c.comprobanteId) || null;
  return {
    codigo: c.web.codigo, tipo: c.web.tipo, estado: c.estado, creado: c.creado, items: c.items,
    total: calcularTotales(c.items).total, nombre: c.web.nombre, distrito: c.web.distrito, direccion: c.web.direccion,
    comprobante: comp,
  };
}

// Acciones que un cliente puede hacer desde su celular sin clave
export const ACCIONES_PUBLICAS = ["enviarACocina", "solicitar", "emitir", "calificar", "pedidoWeb"];
