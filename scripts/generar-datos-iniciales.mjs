// Genera server/datos_iniciales.sql a partir de la carta de src/data.js
//   node scripts/generar-datos-iniciales.mjs
import fs from "node:fs";
import { PRODUCTOS_INICIALES, CATEGORIAS_BASE, MESAS } from "../src/data.js";

const t = (v) => (v === null || v === undefined ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const l = [];
l.push("-- Datos iniciales de La Brasa Restobar (generado desde src/data.js)");
l.push("-- Ejecutar DESPUÉS de schema.sql. Se puede ejecutar varias veces sin duplicar datos.", "BEGIN;", "");
l.push("-- Mesas");
l.push(`INSERT INTO mesas (id) VALUES ${MESAS.map((m) => `(${Number(m)})`).join(", ")} ON CONFLICT (id) DO NOTHING;`, "");
l.push("-- Categorías");
l.push(`INSERT INTO categorias (nombre, orden) VALUES\n  ${CATEGORIAS_BASE.map((c, i) => `(${t(c)}, ${i + 1})`).join(",\n  ")}\nON CONFLICT (nombre) DO NOTHING;`, "");
l.push("-- Productos");
for (const p of PRODUCTOS_INICIALES) {
  const [c1, c2, c3] = p.arte.c;
  l.push(`INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT ${t(p.id)}, id, ${t(p.nombre)}, ${t(p.desc)}, ${p.precio.toFixed(2)}, ${t(p.arte.forma)}, ${t(c1)}, ${t(c2)}, ${t(c3 || null)}
  FROM categorias WHERE nombre = ${t(p.cat)} ON CONFLICT (id) DO NOTHING;`);
}
const tags = [...new Set(PRODUCTOS_INICIALES.flatMap((p) => p.tags))].sort();
l.push("", "-- Etiquetas para el bot");
l.push(`INSERT INTO etiquetas (nombre) VALUES ${tags.map((x) => `(${t(x)})`).join(", ")} ON CONFLICT (nombre) DO NOTHING;`, "");
l.push("-- Etiquetas de cada producto");
for (const p of PRODUCTOS_INICIALES)
  l.push(`INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT ${t(p.id)}, id FROM etiquetas WHERE nombre IN (${p.tags.map(t).join(", ")}) ON CONFLICT DO NOTHING;`);
l.push("", "COMMIT;", "");
fs.writeFileSync(new URL("../server/datos_iniciales.sql", import.meta.url), l.join("\n"));
console.log("server/datos_iniciales.sql generado:", PRODUCTOS_INICIALES.length, "productos,", tags.length, "etiquetas");
