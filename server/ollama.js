/* Conexión del bot con Ollama (IA).
   - Ollama en tu PC:  instala Ollama y ejecuta  `ollama pull llama3.2`  (no necesita configuración)
   - Ollama Cloud:     OLLAMA_URL=https://ollama.com  OLLAMA_API_KEY=tu_clave  OLLAMA_MODELO=gpt-oss:120b
   Variables: OLLAMA_URL (por defecto http://localhost:11434), OLLAMA_MODELO (por defecto llama3.2), OLLAMA_API_KEY */
import { EMISOR, NEGOCIO, METODOS_ONLINE } from "../src/data.js";
import { calcularTotales, consolidar } from "../src/utils.js";

const URL_OLLAMA = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
const MODELO = process.env.OLLAMA_MODELO || "llama3.2";
const CLAVE = process.env.OLLAMA_API_KEY || "";
const ES_NUBE = /ollama\.com/.test(URL_OLLAMA);
const cabeceras = { "Content-Type": "application/json", ...(CLAVE ? { Authorization: `Bearer ${CLAVE}` } : {}) };

export const ollama = { activo: false, modelo: MODELO, url: URL_OLLAMA, motivo: "sin revisar" };

// ¿Está Ollama encendido y tiene el modelo descargado?
export async function revisarOllama() {
  try {
    const r = await fetch(`${URL_OLLAMA}/api/tags`, { headers: cabeceras, signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`respondió ${r.status}`);
    const { models = [] } = await r.json();
    const nombres = models.map((m) => m.name || m.model);
    const tiene = ES_NUBE || nombres.some((n) => n === MODELO || n.startsWith(MODELO + ":"));
    ollama.activo = tiene;
    ollama.motivo = tiene ? "conectado" : `falta el modelo: ejecuta  ollama pull ${MODELO}`;
  } catch (e) {
    ollama.activo = false;
    ollama.motivo = `no responde en ${URL_OLLAMA} (${e.message})`;
  }
  return ollama;
}

// Formato de respuesta que le pedimos al modelo
const ESQUEMA = {
  type: "object",
  properties: {
    texto: { type: "string" },
    mostrar: { type: "array", items: { type: "string" } },
    agregar: { type: "array", items: { type: "object", properties: { id: { type: "string" }, cant: { type: "integer" } }, required: ["id", "cant"] } },
    accion: { type: "string", enum: ["ninguna", "mozo", "cuenta", "pedidos"] },
  },
  required: ["texto"],
};

const ESTADOS = { nuevo: "pagado, en cola de cocina", preparando: "en preparación", listo: "listo para servir", entregado: "entregado" };

function instrucciones(estado, mesa) {
  const carta = estado.productos.filter((p) => p.disponible)
    .map((p) => `${p.id} | ${p.nombre} | ${p.cat} | S/ ${p.precio.toFixed(2)} | ${p.desc}`).join("\n");
  const pedidosMesa = estado.comandas.filter((c) => c.mesa === mesa);
  const pedidos = pedidosMesa.length
    ? pedidosMesa.map((c, i) => `Pedido ${i + 1} (${c.comprobanteId ? ESTADOS[c.estado] || c.estado : "PENDIENTE DE PAGO"}): ${c.items.map((x) => `${x.cant} ${x.nombre}`).join(", ")}`).join("\n")
    : "Todavía no ha pedido nada.";
  const total = calcularTotales(consolidar(pedidosMesa.filter((c) => !c.comprobanteId))).total;
  return `Eres el asistente virtual de ${EMISOR.nombreComercial}, un restobar en Lima, Perú. Atiendes desde su celular al cliente de la mesa ${mesa}.
Responde SIEMPRE en español, amable, cercano y BREVE (máximo 3 oraciones). Usa SOLO la información de abajo.
Nunca inventes productos, precios, promociones ni datos. Si no sabes algo, dilo y sugiere llamar al mozo.
No tomes pedidos de productos que no estén en la carta. No hables de temas ajenos al restobar.

DATOS DEL LOCAL
Dirección: ${EMISOR.direccion}. Teléfono: ${EMISOR.telefono}.
Horario: ${NEGOCIO.horario}
Delivery: ${NEGOCIO.delivery}
Promociones: ${NEGOCIO.promociones}
Pago desde el celular: ${METODOS_ONLINE.join(", ")}. En caja: efectivo o tarjeta. Emitimos boleta (DNI) o factura (RUC).

CARTA DISPONIBLE HOY (id | nombre | categoría | precio con IGV | descripción)
${carta}

MESA ${mesa}
${pedidos}
Pendiente de pago: S/ ${total.toFixed(2)}
REGLA: cocina solo prepara lo que ya está pagado. Si hay algo pendiente de pago, recuérdale que lo pague (desde "Pagar" o en caja).

FORMATO: responde SOLO con un objeto JSON, sin texto fuera de él:
{"texto": "tu respuesta", "mostrar": ["ids de hasta 3 productos que recomiendas"], "agregar": [{"id": "id", "cant": 1}], "accion": "ninguna"}
- "agregar": solo si el cliente pide claramente agregar productos a su pedido; si no, [].
- "accion": "mozo" si quiere al mozo, "cuenta" si quiere pagar, "pedidos" si pregunta por su pedido; si no, "ninguna".`;
}

// Saca el primer objeto JSON del texto (los modelos a veces agregan texto alrededor)
function leerJSON(texto) {
  try { return JSON.parse(texto); } catch (e) { /* sigue */ }
  const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(texto.slice(a, b + 1)); } catch (e) { /* sigue */ } }
  return { texto: texto.trim() };
}

export async function preguntarOllama(estado, mesa, mensaje, historial = []) {
  const mensajes = [
    { role: "system", content: instrucciones(estado, mesa) },
    ...historial.slice(-8).map((m) => ({ role: m.de === "yo" ? "user" : "assistant", content: String(m.texto || "").slice(0, 500) })),
    { role: "user", content: String(mensaje).slice(0, 300) },
  ];
  const cuerpo = {
    model: MODELO, messages: mensajes, stream: false, options: { temperature: 0.3 },
    ...(ES_NUBE ? {} : { format: ESQUEMA }),   // Ollama Cloud no admite salidas estructuradas
  };
  const r = await fetch(`${URL_OLLAMA}/api/chat`, {
    method: "POST", headers: cabeceras, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw new Error(`Ollama respondió ${r.status}`);
  const datos = await r.json();
  const j = leerJSON((datos.message && datos.message.content) || "");

  // Validar lo que devolvió el modelo: solo productos reales y disponibles
  const disponibles = new Map(estado.productos.filter((p) => p.disponible).map((p) => [p.id, p]));
  const texto = String(j.texto || "").trim().slice(0, 700);
  if (!texto) throw new Error("Respuesta vacía de Ollama");
  return {
    texto,
    mostrar: (Array.isArray(j.mostrar) ? j.mostrar : []).filter((id) => disponibles.has(id)).slice(0, 3),
    agregar: (Array.isArray(j.agregar) ? j.agregar : [])
      .filter((x) => x && disponibles.has(x.id))
      .map((x) => ({ id: x.id, cant: Math.min(20, Math.max(1, Math.floor(Number(x.cant) || 1))) })),
    accion: ["mozo", "cuenta", "pedidos"].includes(j.accion) ? j.accion : null,
  };
}
