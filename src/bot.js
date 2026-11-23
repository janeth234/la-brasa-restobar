/* =========================================================
   BOT DE LA PÁGINA (sin IA, por reglas)
   Responde preguntas del restobar, recomienda, toma pedidos escritos,
   dice el estado del pedido y la cuenta. Lo usa la vista del cliente.
   responderBot(texto, contexto) -> { texto, platos?, pedido?, acciones?, seguro? }
     seguro:   true si es una respuesta exacta (no hace falta preguntarle a la IA)
     platos:   productos para mostrar con botón "Agregar"
     pedido:   [{ producto, cant }] listo para agregar con un toque
     acciones: [{ tipo: "ir", tab, label } | { tipo: "mozo", label }]
   ========================================================= */
import { EMISOR, NEGOCIO, METODOS_ONLINE, LIMITE_DNI } from "./data.js";
import { soles, calcularTotales, consolidar, recomendar, categoriasDe } from "./utils.js";

export const normalizar = (t) =>
  String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!]/g, " ").replace(/\.(?!\d)/g, " ").replace(/\s+/g, " ").trim();

const NUMEROS = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const VACIAS = new Set(["de", "del", "la", "el", "los", "las", "con", "por", "favor", "porfa", "porfavor", "para", "mi", "me", "a", "al",
  "y", "e", "quiero", "quisiera", "dame", "deme", "traeme", "trae", "agrega", "agregame", "pide", "pideme", "pedir", "ponme", "manda",
  "tambien", "mas", "otra", "otro", "tienen", "hay", "cuanto", "cuesta", "vale", "sale", "esta", "precio", "que", "porcion", "orden"]);
// palabras que el cliente usa distinto a como figura en la carta
const SINONIMOS = { coca: "coca-cola", cola: "coca-cola", inka: "inca", gaseosa: "", grande: "1.5", litro: "1.5", personal: "500",
  chica: "500", hamburguesas: "hamburguesa", alita: "alitas", salchi: "salchipapa", chela: "", agua: "agua", pollo: "pollo" };

const raiz = (w) => w.replace(/(es|s)$/, "");
const palabrasDe = (t) => normalizar(t).replace(/[(),]/g, " ").split(" ").filter(Boolean);

// Busca qué producto(s) menciona un texto. Devuelve los mejores candidatos.
function buscarProductos(texto, productos) {
  const palabras = palabrasDe(texto)
    .filter((w) => !VACIAS.has(w) && !(w in NUMEROS) && !/^\d{1,2}$/.test(w))   // 1–2 dígitos = cantidad
    .map((w) => (w in SINONIMOS ? SINONIMOS[w] : w))
    .filter(Boolean);
  if (!palabras.length) return [];
  const puntajes = productos.map((p) => {
    const nombre = palabrasDe(p.nombre + " " + p.cat).map(raiz);
    let pts = 0;
    for (const w of palabras) {
      const r = raiz(w);
      if (r.length < 2) continue;
      if (nombre.some((n) => n === r || (r.length >= 4 && (n.startsWith(r) || r.startsWith(n)) && n.length >= 3))) pts++;
    }
    return [p, pts];
  }).filter(([, pts]) => pts > 0);
  if (!puntajes.length) return [];
  const max = Math.max(...puntajes.map(([, x]) => x));
  return puntajes.filter(([, x]) => x === max).map(([p]) => p);
}

// "2 hamburguesas royal y una inca kola grande" -> [{producto, cant}], dudas
function leerPedido(texto, productos) {
  const partes = normalizar(texto).split(/,|\by\b|\be\b|\bmas\b|\+|\bademas\b|\btambien\b/).map((s) => s.trim()).filter(Boolean);
  const pedido = [], dudas = [];
  for (const parte of partes) {
    const m = parte.match(/(?:^|\s)(\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s/);
    const cant = m ? (NUMEROS[m[1]] || Number(m[1])) : 1;
    const encontrados = buscarProductos(parte, productos);
    if (encontrados.length === 1) pedido.push({ producto: encontrados[0], cant });
    else if (encontrados.length > 1) dudas.push({ texto: parte, opciones: encontrados.slice(0, 6), cant });
  }
  return { pedido, dudas };
}

const ESTADOS = { nuevo: "pagado, en cola de cocina", preparando: "preparándose en cocina", listo: "listo, el mozo ya lo lleva", entregado: "entregado en tu mesa" };
const estadoDe = (c) => (c.comprobanteId ? ESTADOS[c.estado] || c.estado : "pendiente de pago (cocina lo prepara cuando pagues)");

export function responderBot(texto, { productos, mesa, abiertas = [], carrito = [] }) {
  const t = normalizar(texto);
  const disponibles = productos.filter((p) => p.disponible);
  const tiene = (re) => re.test(t);

  if (!t) return { texto: "Escríbeme qué necesitas." };

  // Respuestas exactas (pedidos, cuenta, estado, precios, datos del local): siempre por reglas
  const segura = (() => {
    // --- acciones de la mesa ---
    if (tiene(/\b(mozo|mesero|moza|mesera|atencion|atiendan|venga alguien)\b/))
      return { texto: "¿Quieres que avise al mozo para que venga a tu mesa?", acciones: [{ tipo: "mozo", label: "Sí, llamar al mozo" }] };

    if (tiene(/(mi|el|nuestro) pedido|demora|cuanto falta|ya viene|esta listo|ya esta|tarda/)) {
      if (!abiertas.length) return { texto: "Todavía no tienes pedidos en esta mesa. ¿Te muestro la carta o te recomiendo algo?" };
      const lineas = abiertas.map((c, i) => `Pedido ${i + 1}: ${estadoDe(c)}.`);
      const acciones = [{ tipo: "ir", tab: "pedidos", label: "Ver mis pedidos" }];
      if (abiertas.some((c) => !c.comprobanteId)) acciones.unshift({ tipo: "ir", tab: "cuenta", label: "Pagar ahora" });
      return { texto: lineas.join("\n"), acciones };
    }

    if (tiene(/\b(yape|plin|tarjeta|visa|efectivo|formas? de pago|metodos? de pago|como pago|aceptan)\b/))
      return { texto: `Puedes pagar desde tu celular con ${METODOS_ONLINE.join(", ")} en la pestaña "Cuenta y pago", o pagar en caja en efectivo o tarjeta.` };

    if (tiene(/\b(la cuenta|cuanto debo|cuanto es|cuanto va|cuanto sale todo|pagar|cobrar|total)\b/)) {
      const total = calcularTotales(consolidar(abiertas.filter((c) => !c.comprobanteId))).total;   // solo lo pendiente de pago
      const enCarrito = calcularTotales(carrito).total;
      if (!total && enCarrito)
        return { texto: `Aún no confirmas tu pedido: tienes ${soles(enCarrito)} en el carrito. Confírmalo y págalo para que cocina lo prepare.`, acciones: [{ tipo: "carrito", label: "Ver mi pedido y confirmarlo" }] };
      if (!total) return { texto: abiertas.length ? "No tienes nada pendiente de pago: lo que pediste ya está pagado." : "Tu cuenta está en S/ 0.00: aún no has pedido nada." };
      const aviso = enCarrito ? `\nAdemás tienes ${soles(enCarrito)} en tu carrito sin confirmar.` : "";
      return { texto: `Tienes ${soles(total)} pendiente de pago (IGV incluido). Cocina prepara tu pedido apenas lo pagues, desde aquí o en caja.${aviso}`,
        acciones: [{ tipo: "ir", tab: "cuenta", label: "Pagar ahora" }] };
    }

    if (tiene(/\b(boleta|factura|ruc|dni|comprobante)\b/))
      return { texto: `Emitimos boleta o factura electrónica. Para factura necesitas tu RUC, razón social y dirección fiscal. Las boletas mayores a ${soles(LIMITE_DNI)} requieren DNI. Lo eliges al pagar en "Cuenta y pago".`,
        acciones: [{ tipo: "ir", tab: "cuenta", label: "Ir a pagar" }] };

    // --- información del local ---
    if (tiene(/\b(horario|hora|abren|cierran|atienden|abierto)\b/)) return { texto: `Nuestro horario: ${NEGOCIO.horario}` };
    if (tiene(/\b(donde|direccion|ubicados|ubicacion|local|llegar)\b/)) return { texto: `Estamos en ${EMISOR.direccion}. Teléfono ${EMISOR.telefono}.` };
    if (tiene(/\b(delivery|domicilio|envio|envian|llevar a casa)\b/)) return { texto: NEGOCIO.delivery };
    if (tiene(/\b(wifi|wi fi|internet|clave del)\b/)) return { texto: `Wi-Fi para clientes: ${NEGOCIO.wifi}` };
    if (tiene(/\b(instagram|facebook|redes|tiktok)\b/)) return { texto: NEGOCIO.redes };
    if (tiene(/\b(promo|promocion|promociones|oferta|descuento|2x1)\b/)) return { texto: NEGOCIO.promociones };

    // --- carta y precios ---
    if (tiene(/\b(carta|menu|que tienen|que venden|que hay|categorias)\b/)) {
      const cats = categoriasDe(disponibles).map((c) => {
        const precios = disponibles.filter((p) => p.cat === c).map((p) => p.precio);
        return `• ${c}: desde ${soles(Math.min(...precios))}`;
      });
      return { texto: "Esto es lo que tenemos hoy:\n" + cats.join("\n") + "\n\nPuedes pedirme algo así: «2 hamburguesas royal y una Inca Kola grande»." };
    }

    const preguntaPrecio = tiene(/\b(cuanto (cuesta|esta|vale|sale|cuestan)|precio|precios)\b/);
    const preguntaHay = tiene(/\b(tienen|hay|venden|queda|quedan)\b/);
    if (preguntaPrecio || preguntaHay) {
      const enc = buscarProductos(t, productos);
      if (enc.length) {
        const agotados = enc.filter((p) => !p.disponible);
        const ok = enc.filter((p) => p.disponible);
        let txt = ok.length ? ok.map((p) => `${p.nombre}: ${soles(p.precio)}`).join("\n") : "";
        if (agotados.length) txt += (txt ? "\n" : "") + `Hoy no tenemos: ${agotados.map((p) => p.nombre).join(", ")}.`;
        return { texto: txt, platos: ok.slice(0, 6) };
      }
      if (preguntaHay) return { texto: "Eso no lo tenemos en la carta. ¿Te muestro lo que hay?" };
    }

    // --- pedido escrito ---
    const { pedido, dudas } = leerPedido(t, disponibles);
    if (pedido.length || dudas.length) {
      const r = { texto: "" };
      if (pedido.length) {
        const total = pedido.reduce((a, x) => a + x.producto.precio * x.cant, 0);
        r.texto = "Entendí:\n" + pedido.map((x) => `• ${x.cant} × ${x.producto.nombre} (${soles(x.producto.precio * x.cant)})`).join("\n") +
          `\nTotal: ${soles(total)}. ¿Lo agrego a tu pedido? Cocina lo prepara cuando lo pagues.`;
        r.pedido = pedido;
      }
      if (dudas.length) {
        r.texto += (r.texto ? "\n\n" : "") + `¿Cuál de estos${dudas[0].cant > 1 ? ` (x${dudas[0].cant})` : ""}? Toca "Agregar" en el que quieras:`;
        r.platos = dudas[0].opciones;
      }
      return r;
    }
    return null;
  })();
  if (segura) return { ...segura, seguro: true };

  // Lo demás (recomendaciones, conversación) puede responderlo la IA (Ollama) si está conectada
  // --- recomendaciones por antojo ---
  const reco = recomendar(t, disponibles);
  if (reco.platos.length) return { texto: reco.texto, platos: reco.platos };

  if (tiene(/^(hola|buenas|buenos|hey|ola|que tal)/))
    return { texto: `¡Hola! Bienvenido a ${EMISOR.nombreComercial}${mesa ? ` (mesa ${mesa})` : ""}. Puedo recomendarte algo, tomar tu pedido, decirte cuánto va tu cuenta o llamar al mozo. ¿Qué se te antoja?` };
  if (tiene(/\b(gracias|grax|genial|perfecto|ok|listo|chevere|bacan)\b/)) return { texto: "¡Con gusto! Si necesitas algo más, aquí estoy." };
  if (tiene(/\b(chau|adios|hasta luego|nos vemos)\b/)) return { texto: `¡Gracias por visitarnos! Vuelve pronto a ${EMISOR.nombreComercial}.` };

  return {
    texto: "No te entendí bien. Puedes preguntarme por la carta, precios, el horario, delivery o formas de pago, o pedirme algo como «una salchipapa especial y dos limonadas».",
  };
}

// Mensajes rápidos que se muestran como botones
export const SUGERENCIAS_BOT = ["¿Qué me recomiendas?", "Ver la carta", "¿Cómo va mi pedido?", "¿Cuánto es la cuenta?", "¿Hacen delivery?", "Promociones"];
