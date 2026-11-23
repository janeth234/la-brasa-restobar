/* Servidor de La Brasa Restobar (Node.js)
   - Sirve la web compilada (dist/) a la caja, la cocina y los celulares de los clientes.
   - Guarda todo en PostgreSQL (variable DATABASE_URL) o, si no hay, en server/datos.json.
   - API:
       GET    /api/info                 -> ¿hay servidor? + dirección para los QR
       GET    /api/estado?mesa=7        -> cliente: carta + su mesa          (sin clave)
       GET    /api/estado?web=1         -> página de pedidos por internet: solo la carta
       GET    /api/pedido/:codigo       -> seguimiento de un pedido por internet
       GET    /api/estado?clave=…       -> personal: todo                    (con clave)
       GET    /api/stream?mesa=7|clave= -> cambios en tiempo real (Server-Sent Events)
       POST   /api/accion  {tipo,datos} -> enviarACocina, emitir, guardarProducto…
       GET    /api/fotos/:id            -> foto del producto
       POST   /api/fotos/:id {dataUrl}  -> subir foto (personal)
       DELETE /api/fotos/:id            -> quitar foto (personal)
       POST   /api/bot {mesa, mensaje, historial} -> respuesta del bot con IA (Ollama)
   Variables de entorno: PORT, DATABASE_URL, CLAVE_PERSONAL, PUBLIC_URL,
                         OLLAMA_URL, OLLAMA_MODELO, OLLAMA_API_KEY (ver server/ollama.js) */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { aplicar, vistaPublica, vistaPedidoWeb, ACCIONES_PUBLICAS } from "../src/logica.js";
import { MESAS, METODOS_ONLINE } from "../src/data.js";
import { abrirBaseDeDatos } from "./db.js";
import { ollama, revisarOllama, preguntarOllama } from "./ollama.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(DIR, "..", "dist");
const PORT = Number(process.env.PORT) || 3000;
const CLAVE = process.env.CLAVE_PERSONAL || "1234";

const db = await abrirBaseDeDatos();
let estado = await db.cargar();
const conectados = new Set();   // {res, rol: "personal" | "mesa" | "web", mesa}
await revisarOllama();
setInterval(revisarOllama, 60000);   // si enciendes Ollama después, se conecta solo

// Límite de mensajes al bot por celular (evita abusos): 15 por minuto
const usoBot = new Map();
function puedeUsarBot(ip) {
  const ahora = Date.now();
  const lista = (usoBot.get(ip) || []).filter((t) => ahora - t < 60000);
  lista.push(ahora);
  usoBot.set(ip, lista);
  return lista.length <= 15;
}

/* ---------- utilidades ---------- */
// Qué datos ve cada conexión: el personal todo; una mesa, solo lo suyo; la página web, solo la carta
const vistaPara = (rol, mesa) => (rol === "personal" ? estado : vistaPublica(estado, rol === "mesa" ? mesa : null));
function difundir() {
  for (const c of conectados) c.res.write(`data: ${JSON.stringify(vistaPara(c.rol, c.mesa))}\n\n`);
}
function ipLocal() {
  for (const lista of Object.values(os.networkInterfaces()))
    for (const i of lista || []) if (i.family === "IPv4" && !i.internal) return i.address;
  return "localhost";
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function leerCuerpo(req, limite) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > limite) { reject(new Error("Archivo demasiado grande.")); req.destroy(); }
    });
    req.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch (e) { reject(new Error("Datos inválidos.")); } });
  });
}
const esPersonal = (req, url) => (req.headers["x-clave"] || url.searchParams.get("clave") || "") === CLAVE;
const mesaValida = (m) => (MESAS.includes(String(m || "")) ? String(m) : null);

// Cola: las acciones se aplican y guardan de una en una (así la numeración B001/F001 nunca se repite)
let cola = Promise.resolve();
const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

async function ejecutar(accion) {
  const r = aplicar(estado, accion);          // reglas del negocio (lanza error si algo no cuadra)
  await db.guardar(accion, r.estado, r.resultado);   // primero la base de datos…
  estado = r.estado;                           // …y solo si se guardó, se actualiza la memoria
  difundir();
  return r.resultado;
}

/* ---------- rutas ---------- */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".json": "application/json", ".woff2": "font/woff2",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const ruta = url.pathname;
  try {
    if (ruta === "/api/info")
      return json(res, 200, {
        ok: true, url: process.env.PUBLIC_URL || `http://${ipLocal()}:${PORT}/`, baseDeDatos: db.tipo,
        bot: ollama.activo ? "ollama" : "reglas", modelo: ollama.activo ? ollama.modelo : null,
      });

    if (ruta === "/api/bot" && req.method === "POST") {
      if (!ollama.activo) return json(res, 503, { error: "IA no disponible: " + ollama.motivo });
      const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
      if (!puedeUsarBot(ip)) return json(res, 429, { error: "Demasiados mensajes, espera un momento." });
      const { mesa, mensaje, historial } = await leerCuerpo(req, 20000);
      const m = mesaValida(mesa);
      if (!m || !mensaje) return json(res, 400, { error: "Falta la mesa o el mensaje." });
      try {
        return json(res, 200, await preguntarOllama(estado, m, mensaje, Array.isArray(historial) ? historial : []));
      } catch (e) {
        console.error("Bot (Ollama):", e.message);
        return json(res, 502, { error: "La IA no respondió." });
      }
    }

    if (ruta === "/api/estado" && req.method === "GET") {
      const mesa = mesaValida(url.searchParams.get("mesa"));
      if (mesa) return json(res, 200, vistaPublica(estado, mesa));
      if (url.searchParams.get("web")) return json(res, 200, vistaPublica(estado, null));
      if (!esPersonal(req, url)) return json(res, 401, { error: "Clave del personal requerida." });
      return json(res, 200, estado);
    }

    const seguir = ruta.match(/^\/api\/pedido\/([A-Za-z0-9]{6})$/);
    if (seguir && req.method === "GET") {
      const v = vistaPedidoWeb(estado, seguir[1]);
      return v ? json(res, 200, v) : json(res, 404, { error: "Pedido entregado o no encontrado." });
    }

    if (ruta === "/api/stream") {
      const mesa = mesaValida(url.searchParams.get("mesa"));
      const rol = mesa ? "mesa" : url.searchParams.get("web") ? "web" : "personal";
      if (rol === "personal" && !esPersonal(req, url)) return json(res, 401, { error: "Clave del personal requerida." });
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      const c = { res, rol, mesa };
      res.write(`data: ${JSON.stringify(vistaPara(rol, mesa))}\n\n`);
      conectados.add(c);
      const ping = setInterval(() => res.write(": ping\n\n"), 25000);
      req.on("close", () => { clearInterval(ping); conectados.delete(c); });
      return;
    }

    if (ruta === "/api/accion" && req.method === "POST") {
      const accion = await leerCuerpo(req, 200000);
      const personal = esPersonal(req, url);
      let mesaCliente = null;
      if (!personal && accion.tipo === "pedidoWeb") {
        // Pedido por internet: sin mesa; la lógica exige pago en línea y valida todo
        const resultado = await enCola(() => ejecutar(accion));
        return json(res, 200, { resultado: { codigo: resultado.codigo, comprobante: resultado.comprobante } });
      }
      if (!personal) {
        // Un cliente (QR) solo puede hacer estas acciones y solo para su mesa
        mesaCliente = mesaValida(req.headers["x-mesa"]);
        const d = accion.datos || {};
        if (!ACCIONES_PUBLICAS.includes(accion.tipo) || accion.tipo === "pedidoWeb" || !mesaCliente || d.mesa !== mesaCliente)
          return json(res, 403, { error: "No autorizado." });
        if (accion.tipo === "enviarACocina") d.origen = "qr";
        if (accion.tipo === "emitir") {
          d.origen = "qr";
          if (!METODOS_ONLINE.includes(d.pago && d.pago.metodo)) return json(res, 400, { error: "Método de pago no válido." });
        }
      }
      const resultado = await enCola(() => ejecutar(accion));
      return json(res, 200, { estado: personal ? estado : vistaPublica(estado, mesaCliente), resultado });
    }

    const foto = ruta.match(/^\/api\/fotos\/([^/]+)$/);
    if (foto) {
      const id = decodeURIComponent(foto[1]);
      if (req.method === "GET") {
        const f = await db.fotoLeer(id);
        if (!f) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { "Content-Type": f.mime, "Cache-Control": "public, max-age=31536000, immutable" });
        return res.end(f.buffer);
      }
      if (!esPersonal(req, url)) return json(res, 401, { error: "Clave del personal requerida." });
      if (!estado.productos.some((p) => p.id === id)) return json(res, 404, { error: "Producto no encontrado." });
      let nuevaUrl = null;
      if (req.method === "POST") {
        const { dataUrl } = await leerCuerpo(req, 4 * 1024 * 1024);
        const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
        if (!m) return json(res, 400, { error: "La foto debe ser JPG, PNG o WebP." });
        nuevaUrl = await enCola(() => db.fotoGuardar(id, m[2], m[1]));
      } else if (req.method === "DELETE") {
        await enCola(() => db.fotoBorrar(id));
      } else {
        res.writeHead(405); return res.end();
      }
      estado = { ...estado, productos: estado.productos.map((p) => (p.id === id ? { ...p, foto: nuevaUrl } : p)) };
      if (db.guardarTodo) await db.guardarTodo(estado);
      difundir();
      return json(res, 200, { estado });
    }

    if (ruta.startsWith("/api/")) return json(res, 404, { error: "Ruta no encontrada." });

    // Archivos de la web (dist/). Cualquier otra ruta devuelve index.html
    let archivo = path.join(DIST, decodeURIComponent(ruta));
    if (!archivo.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) archivo = path.join(DIST, "index.html");
    if (!fs.existsSync(archivo)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Falta compilar la web: ejecuta  npm run build");
    }
    const ext = path.extname(archivo);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=86400",
    });
    fs.createReadStream(archivo).pipe(res);
  } catch (e) {
    console.error(e.message);
    if (!res.headersSent) json(res, 400, { error: e.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("\n  La Brasa Restobar en línea");
  console.log(`  Datos:              ${db.tipo}`);
  console.log(`  En esta PC:         http://localhost:${PORT}`);
  console.log(`  Celulares (Wi-Fi):  http://${ipLocal()}:${PORT}`);
  console.log(`  Bot con IA:         ${ollama.activo ? `Ollama (${ollama.modelo})` : `sin IA, responde por reglas — Ollama ${ollama.motivo}`}`);
  if (!process.env.CLAVE_PERSONAL) console.log("  Clave del personal: 1234  (cámbiala con la variable CLAVE_PERSONAL)");
  console.log("");
});
