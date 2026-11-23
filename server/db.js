/* Capa de datos del servidor.
   - Si existe la variable DATABASE_URL  -> PostgreSQL (Supabase, Neon, local…)
   - Si no existe                        -> archivo server/datos.json (para practicar sin base de datos)
   Ambas ofrecen lo mismo: cargar(), guardar(), fotoGuardar(), fotoLeer(), fotoBorrar(). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESTADO_INICIAL } from "../src/logica.js";
import { PRODUCTOS_INICIALES, CATEGORIAS_BASE, MESAS, IGV } from "../src/data.js";
import { calcularTotales, montoEnLetras, armarCliente } from "../src/utils.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const num = (v) => (v === null || v === undefined ? v : Number(v));
const iso = (v) => (v ? new Date(v).toISOString() : v);
const urlFoto = (id, version) => (version > 0 ? `/api/fotos/${encodeURIComponent(id)}?v=${version}` : null);

export async function abrirBaseDeDatos() {
  return process.env.DATABASE_URL ? abrirPostgres(process.env.DATABASE_URL) : abrirArchivo();
}

/* =====================================================================
   PostgreSQL / Supabase — esquema normalizado (3FN), ver schema.sql
   ===================================================================== */
const TIPO_DOC = { DNI: "1", RUC: "6" };                 // catálogo 06 SUNAT
const NOMBRE_DOC = { 1: "DNI", 6: "RUC" };
const SIN_NOMBRE = "CLIENTES VARIOS";
const fotoVersion = "(extract(epoch from clock_timestamp()) * 1000)::bigint";

async function abrirPostgres(url) {
  const { default: pg } = await import("pg");
  const local = /localhost|127\.0\.0\.1/.test(url);
  const pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });

  // Ejecuta varias consultas en una transacción: o se guardan todas o ninguna
  async function transaccion(fn) {
    const cli = await pool.connect();
    try {
      await cli.query("BEGIN");
      const r = await fn((sql, params) => cli.query(sql, params));
      await cli.query("COMMIT");
      return r;
    } catch (e) {
      await cli.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      cli.release();
    }
  }

  /* ---------- escritura de entidades ---------- */
  async function idCategoria(q, nombre) {
    const { rows } = await q(
      `INSERT INTO categorias (nombre, orden) VALUES ($1, (SELECT COALESCE(MAX(orden), 0) + 1 FROM categorias))
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`, [nombre]);
    return rows[0].id;
  }
  async function guardarProducto(q, p) {
    const cat = await idCategoria(q, p.cat);
    const [c1, c2, c3] = (p.arte && p.arte.c) || [];
    await q(
      `INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, disponible, activo, dibujo, color_1, color_2, color_3)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET categoria_id = EXCLUDED.categoria_id, nombre = EXCLUDED.nombre,
         descripcion = EXCLUDED.descripcion, precio = EXCLUDED.precio, disponible = EXCLUDED.disponible,
         activo = TRUE, dibujo = EXCLUDED.dibujo, color_1 = EXCLUDED.color_1, color_2 = EXCLUDED.color_2, color_3 = EXCLUDED.color_3`,
      [p.id, cat, p.nombre, p.desc || "", p.precio, p.disponible !== false, (p.arte && p.arte.forma) || "hamburguesa",
        c1 || null, c2 || null, c3 || null]);
    await q("DELETE FROM producto_etiquetas WHERE producto_id = $1", [p.id]);
    for (const tag of [...new Set((p.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))]) {
      const { rows } = await q("INSERT INTO etiquetas (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id", [tag]);
      await q("INSERT INTO producto_etiquetas (producto_id, etiqueta_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [p.id, rows[0].id]);
    }
  }
  // Devuelve el id del cliente (lo crea o actualiza); null si no hay documento
  async function guardarCliente(q, c) {
    const tipo = c && TIPO_DOC[c.tipoDoc];
    if (!tipo || !c.doc || c.doc === "-") return null;
    const { rows } = await q(
      `INSERT INTO clientes (tipo_documento, numero_documento, nombre, direccion) VALUES ($1, $2, $3, $4)
       ON CONFLICT (tipo_documento, numero_documento) DO UPDATE SET
         nombre = CASE WHEN EXCLUDED.nombre = '${SIN_NOMBRE}' THEN clientes.nombre ELSE EXCLUDED.nombre END,
         direccion = COALESCE(EXCLUDED.direccion, clientes.direccion)
       RETURNING id`,
      [tipo, c.doc, (c.nombre || SIN_NOMBRE).slice(0, 150), c.direccion || null]);
    return rows[0].id;
  }

  // 1. Crear tablas, catálogos, mesas y la carta inicial (solo la primera vez)
  await pool.query(fs.readFileSync(path.join(DIR, "schema.sql"), "utf8"));
  await transaccion(async (q) => {
    for (const m of MESAS) await q("INSERT INTO mesas (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [Number(m)]);
    const { rows: [{ n }] } = await q("SELECT count(*)::int AS n FROM productos");
    if (n === 0) {
      for (const c of CATEGORIAS_BASE) await idCategoria(q, c);
      for (const p of PRODUCTOS_INICIALES) await guardarProducto(q, p);
      console.log(`  Carta inicial cargada en la base de datos (${PRODUCTOS_INICIALES.length} productos).`);
    }
  });

  // Fotos iniciales: si la base de datos aún no tiene ninguna foto, copia las de public/fotos/<id>.jpg
  const { rows: [{ fotos }] } = await pool.query("SELECT count(*)::int AS fotos FROM producto_fotos");
  if (fotos === 0) {
    const carpeta = path.join(DIR, "..", "public", "fotos");
    const { rows: existentes } = await pool.query("SELECT id FROM productos WHERE activo");
    let n = 0;
    for (const { id } of existentes) {
      const archivo = path.join(carpeta, `${id}.jpg`);
      if (!fs.existsSync(archivo)) continue;
      await pool.query(
        `INSERT INTO producto_fotos (producto_id, imagen, tipo_mime, version)
         VALUES ($1, decode($2, 'base64'), 'image/jpeg', ${fotoVersion}) ON CONFLICT (producto_id) DO NOTHING`,
        [id, fs.readFileSync(archivo).toString("base64")]);
      n++;
    }
    if (n) console.log(`  Fotos de la carta cargadas en la base de datos (${n}).`);
  }

  const datosSolicitud = (r) => (r.tipo_comprobante ? {
    tipo: r.tipo_comprobante === "01" ? "factura" : "boleta",
    doc: r.numero_documento || "",
    nombre: r.cliente_nombre && r.cliente_nombre !== SIN_NOMBRE ? r.cliente_nombre : "",
    direccion: r.direccion || "",
  } : null);
  const items = (lista) => (lista || []).map((i) => ({ id: i.id, nombre: i.nombre, precio: num(i.precio), cant: num(i.cant) }));

  return {
    tipo: "PostgreSQL",

    // Lee lo necesario para trabajar: carta, pedidos (por pagar y en cocina), avisos, últimos comprobantes y reseñas
    async cargar() {
      const [prod, com, sol, ser, comp, res] = await Promise.all([
        pool.query(`
          SELECT p.id, c.nombre AS categoria, p.nombre, p.descripcion, p.precio, p.disponible,
                 p.dibujo, p.color_1, p.color_2, p.color_3, pf.version AS foto_version,
                 COALESCE((SELECT json_agg(e.nombre ORDER BY e.nombre) FROM producto_etiquetas pe
                           JOIN etiquetas e ON e.id = pe.etiqueta_id WHERE pe.producto_id = p.id), '[]'::json) AS tags
          FROM productos p
          JOIN categorias c ON c.id = p.categoria_id
          LEFT JOIN producto_fotos pf ON pf.producto_id = p.id
          WHERE p.activo
          ORDER BY c.orden, p.orden`),
        pool.query(`
          SELECT co.id, co.mesa_id, co.estado, co.origen, co.nota, co.creado, co.comprobante_id, cp.fecha_emision AS pagado_en,
                 COALESCE((SELECT json_agg(json_build_object('id', ci.producto_id, 'nombre', p.nombre,
                           'precio', ci.precio_unitario, 'cant', ci.cantidad) ORDER BY p.nombre)
                           FROM comanda_items ci JOIN productos p ON p.id = ci.producto_id
                           WHERE ci.comanda_id = co.id), '[]'::json) AS items
          FROM comandas co LEFT JOIN comprobantes cp ON cp.id = co.comprobante_id
          WHERE co.estado <> 'entregado'      -- pendientes de pago y las que cocina aún no entrega
          ORDER BY co.creado`),
        pool.query(`
          SELECT s.id, s.mesa_id, s.tipo, s.creado, s.tipo_comprobante,
                 cl.numero_documento, cl.nombre AS cliente_nombre, cl.direccion
          FROM solicitudes s LEFT JOIN clientes cl ON cl.id = s.cliente_id ORDER BY s.creado`),
        pool.query("SELECT serie, ultimo_numero FROM series"),
        pool.query(`
          SELECT v.id, v.serie, v.numero, v.tipo_comprobante, v.fecha_emision, v.mesa_id, v.origen,
                 v.tipo_documento, v.numero_documento, v.cliente, v.direccion,
                 mp.nombre AS metodo, pg.monto, pg.monto_recibido, pg.numero_operacion,
                 COALESCE((SELECT json_agg(json_build_object('id', d.producto_id, 'nombre', d.descripcion,
                           'precio', d.precio_unitario, 'cant', d.cantidad) ORDER BY d.descripcion)
                           FROM v_comprobante_detalle d WHERE d.comprobante_id = v.id), '[]'::json) AS items
          FROM v_comprobantes v
          LEFT JOIN pagos pg ON pg.comprobante_id = v.id
          LEFT JOIN metodos_pago mp ON mp.id = pg.metodo_pago_id
          ORDER BY v.fecha_emision DESC LIMIT 500`),
        pool.query(`
          SELECT r.id, r.comprobante_id, r.estrellas, r.comentario, r.fecha,
                 (SELECT co.mesa_id FROM comandas co WHERE co.comprobante_id = r.comprobante_id LIMIT 1) AS mesa_id
          FROM resenas r ORDER BY r.fecha DESC LIMIT 500`),
      ]);

      return {
        ...ESTADO_INICIAL,
        productos: prod.rows.map((r) => ({
          id: r.id, cat: r.categoria, nombre: r.nombre, desc: r.descripcion, precio: num(r.precio), disponible: r.disponible,
          arte: { forma: r.dibujo, c: [r.color_1, r.color_2, r.color_3].filter(Boolean) },
          tags: r.tags || [], foto: urlFoto(r.id, num(r.foto_version) || 0),
        })),
        comandas: com.rows.map((r) => ({
          id: r.id, mesa: String(r.mesa_id), estado: r.estado, origen: r.origen, nota: r.nota, creado: iso(r.creado), items: items(r.items),
          ...(r.comprobante_id ? { comprobanteId: r.comprobante_id, pagadoEn: iso(r.pagado_en) } : {}),
        })),
        solicitudes: sol.rows.map((r) => ({ id: r.id, mesa: String(r.mesa_id), tipo: r.tipo, datos: datosSolicitud(r), creado: iso(r.creado) })),
        correlativos: Object.fromEntries(ser.rows.map((r) => [r.serie.trim(), num(r.ultimo_numero)])),
        comprobantes: comp.rows.map((r) => {
          const its = items(r.items);
          const tot = calcularTotales(its);   // los importes se calculan del detalle (no se guardan)
          return {
            id: r.id, tipo: r.tipo_comprobante === "01" ? "factura" : "boleta", serie: r.serie.trim(),
            numero: String(r.numero).padStart(8, "0"), fecha: iso(r.fecha_emision), mesa: String(r.mesa_id), origen: r.origen,
            cliente: r.numero_documento
              ? { tipoDoc: NOMBRE_DOC[r.tipo_documento], doc: r.numero_documento, nombre: r.cliente, ...(r.direccion ? { direccion: r.direccion } : {}) }
              : { tipoDoc: "-", doc: "-", nombre: SIN_NOMBRE },
            items: its, ...tot, letras: montoEnLetras(tot.total),
            pago: {
              metodo: r.metodo, recibido: num(r.monto_recibido), vuelto: Math.round((num(r.monto_recibido) - num(r.monto)) * 100) / 100,
              ...(r.numero_operacion ? { operacion: r.numero_operacion } : {}),
            },
          };
        }),
        resenas: res.rows.map((r) => ({
          id: r.id, mesa: String(r.mesa_id), estrellas: num(r.estrellas), comentario: r.comentario, compId: r.comprobante_id, fecha: iso(r.fecha),
        })),
      };
    },

    // Guarda en la base de datos el efecto de una acción (ver src/logica.js)
    async guardar({ tipo, datos }, despues, resultado) {
      await transaccion(async (q) => {
        switch (tipo) {
          case "enviarACocina": {
            const c = resultado;
            await q("INSERT INTO comandas (id, mesa_id, estado, origen, nota, creado) VALUES ($1, $2, $3, $4, $5, $6)",
              [c.id, Number(c.mesa), c.estado, c.origen, c.nota, c.creado]);
            for (const i of c.items)
              await q("INSERT INTO comanda_items (comanda_id, producto_id, cantidad, precio_unitario) VALUES ($1, $2, $3, $4)",
                [c.id, i.id, i.cant, i.precio]);
            break;
          }
          case "cambiarEstado":
            await q("UPDATE comandas SET estado = $2, actualizado = now() WHERE id = $1", [datos.id, datos.estado]);
            break;
          case "solicitar": {
            const s = despues.solicitudes.find((x) => x.mesa === datos.mesa && x.tipo === datos.tipo);
            let tipoComp = null, clienteId = null;
            if (s.datos) {
              tipoComp = s.datos.tipo === "factura" ? "01" : "03";
              clienteId = await guardarCliente(q, armarCliente({ tipo: "boleta", doc: "", nombre: "", direccion: "", ...s.datos }));
            }
            await q("DELETE FROM solicitudes WHERE mesa_id = $1 AND tipo = $2", [Number(s.mesa), s.tipo]);
            await q("INSERT INTO solicitudes (id, mesa_id, tipo, tipo_comprobante, cliente_id, creado) VALUES ($1, $2, $3, $4, $5, $6)",
              [s.id, Number(s.mesa), s.tipo, tipoComp, clienteId, s.creado]);
            break;
          }
          case "atender":
            await q("DELETE FROM solicitudes WHERE id = $1", [datos.id]);
            break;
          case "emitir": {
            const c = resultado;
            const mesa = Number(c.mesa);
            await q("UPDATE series SET ultimo_numero = $2 WHERE serie = $1", [c.serie, Number(c.numero)]);
            const clienteId = await guardarCliente(q, c.cliente);
            await q(`INSERT INTO comprobantes (id, serie, numero, fecha_emision, cliente_id, tasa_igv, origen)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [c.id, c.serie, Number(c.numero), c.fecha, clienteId, IGV, c.origen === "qr" ? "qr" : "caja"]);
            await q("UPDATE comandas SET comprobante_id = $1, actualizado = now() WHERE mesa_id = $2 AND comprobante_id IS NULL", [c.id, mesa]);
            await q(`INSERT INTO pagos (comprobante_id, metodo_pago_id, monto, monto_recibido, numero_operacion)
                     VALUES ($1, (SELECT id FROM metodos_pago WHERE nombre = $2), $3, $4, $5)`,
              [c.id, c.pago.metodo, c.total, c.pago.recibido, c.pago.operacion || null]);
            await q("DELETE FROM solicitudes WHERE mesa_id = $1", [mesa]);
            break;
          }
          case "calificar": {
            const r = despues.resenas[0];
            if (!r.compId) throw new Error("La reseña debe estar asociada a un comprobante.");
            await q("INSERT INTO resenas (id, comprobante_id, estrellas, comentario, fecha) VALUES ($1, $2, $3, $4, $5)",
              [r.id, r.compId, r.estrellas, r.comentario || null, r.fecha]);
            break;
          }
          case "guardarProducto":
            await guardarProducto(q, resultado);
            break;
          case "eliminarProducto":   // baja lógica: el historial de ventas sigue apuntando al producto
            await q("UPDATE productos SET activo = FALSE, disponible = FALSE WHERE id = $1", [datos.id]);
            await q("DELETE FROM producto_fotos WHERE producto_id = $1", [datos.id]);
            break;
          case "reiniciar":
            await q("DELETE FROM resenas");
            await q("DELETE FROM solicitudes");
            await q("DELETE FROM comandas");          // borra también comanda_items (CASCADE)
            await q("DELETE FROM comprobantes");      // borra también pagos (CASCADE)
            await q("DELETE FROM clientes");
            await q("UPDATE series SET ultimo_numero = 0");
            break;
          default:
            throw new Error("Acción sin guardar: " + tipo);
        }
      });
    },

    async fotoGuardar(id, base64, mime) {
      const { rows } = await pool.query(
        `INSERT INTO producto_fotos (producto_id, imagen, tipo_mime, version) VALUES ($1, decode($2, 'base64'), $3, ${fotoVersion})
         ON CONFLICT (producto_id) DO UPDATE SET imagen = EXCLUDED.imagen, tipo_mime = EXCLUDED.tipo_mime, version = ${fotoVersion}
         RETURNING version`, [id, base64, mime]);
      return urlFoto(id, num(rows[0].version));
    },
    async fotoLeer(id) {
      const { rows } = await pool.query(
        "SELECT encode(imagen, 'base64') AS b64, tipo_mime FROM producto_fotos WHERE producto_id = $1", [id]);
      return rows.length ? { buffer: Buffer.from(rows[0].b64, "base64"), mime: rows[0].tipo_mime } : null;
    },
    async fotoBorrar(id) {
      await pool.query("DELETE FROM producto_fotos WHERE producto_id = $1", [id]);
    },
  };
}

/* =====================================================================
   Archivo JSON (sin base de datos) — solo para practicar en tu PC
   ===================================================================== */
function abrirArchivo() {
  const archivo = path.join(DIR, "datos.json");
  const carpetaFotos = path.join(DIR, "fotos");
  let ultimo;
  try { ultimo = { ...ESTADO_INICIAL, ...JSON.parse(fs.readFileSync(archivo, "utf8")) }; } catch (e) { ultimo = { ...ESTADO_INICIAL }; }
  if (!ultimo.productos.length) ultimo.productos = PRODUCTOS_INICIALES;
  const escribir = (s) => fs.writeFileSync(archivo, JSON.stringify(s, null, 1));
  const ruta = (id) => path.join(carpetaFotos, id.replace(/[^\w-]/g, "_"));
  return {
    tipo: "archivo server/datos.json (sin base de datos)",
    async cargar() { return ultimo; },
    async guardar(_accion, despues) { ultimo = despues; escribir(despues); },
    async fotoGuardar(id, base64, mime) {
      fs.mkdirSync(carpetaFotos, { recursive: true });
      fs.writeFileSync(ruta(id), Buffer.from(base64, "base64"));
      fs.writeFileSync(ruta(id) + ".tipo", mime);
      return `/api/fotos/${encodeURIComponent(id)}?v=${Date.now()}`;
    },
    async fotoLeer(id) {
      try { return { buffer: fs.readFileSync(ruta(id)), mime: fs.readFileSync(ruta(id) + ".tipo", "utf8") }; } catch (e) { return null; }
    },
    async fotoBorrar(id) { fs.rmSync(ruta(id), { force: true }); fs.rmSync(ruta(id) + ".tipo", { force: true }); },
    // el estado completo (con las URLs de fotos) se guarda tras cada cambio
    async guardarTodo(s) { ultimo = s; escribir(s); },
  };
}
