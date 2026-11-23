import { IGV, LIMITE_DNI, CATEGORIAS_BASE } from "./data.js";

export const soles = (n) => "S/ " + Number(n || 0).toFixed(2);
export const r2 = (n) => Math.round(n * 100) / 100;
export const ahora = () => new Date().toISOString();
export const fechaHora = (iso) =>
  new Date(iso).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
export const minutosDesde = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
export const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- Validación de documentos ---------- */
// RUC peruano: 11 dígitos, prefijo 10/15/17/20 y dígito verificador (módulo 11)
export function validarRUC(ruc) {
  if (!/^(10|15|17|20)\d{9}$/.test(ruc)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, p, i) => acc + p * Number(ruc[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 10) dv = 0;
  if (dv === 11) dv = 1;
  return dv === Number(ruc[10]);
}
export const validarDNI = (dni) => /^\d{8}$/.test(dni);

// Devuelve un texto de error o "" si los datos del comprobante están bien
export function validarCliente({ tipo, doc, nombre, direccion }, total) {
  if (tipo === "factura") {
    if (!validarRUC(doc)) return "RUC inválido: debe tener 11 dígitos y dígito verificador correcto.";
    if (!nombre.trim()) return "Ingresa la razón social.";
    if (!direccion.trim()) return "Ingresa la dirección fiscal.";
  } else {
    if (doc && !validarDNI(doc)) return "El DNI debe tener 8 dígitos.";
    if (total > LIMITE_DNI && !doc) return `Boletas mayores a ${soles(LIMITE_DNI)} requieren DNI del cliente.`;
  }
  return "";
}
export function armarCliente({ tipo, doc, nombre, direccion }) {
  return tipo === "factura"
    ? { tipoDoc: "RUC", doc, nombre: nombre.trim().toUpperCase(), direccion: direccion.trim() }
    : { tipoDoc: doc ? "DNI" : "-", doc: doc || "-", nombre: nombre.trim().toUpperCase() || "CLIENTES VARIOS" };
}

/* ---------- Importes ---------- */
export function calcularTotales(items) {
  const total = r2(items.reduce((a, it) => a + it.precio * it.cant, 0));
  const gravada = r2(total / (1 + IGV));
  return { total, gravada, igv: r2(total - gravada) };
}
// junta los items de varias comandas de la misma mesa
export function consolidar(comandas) {
  const mapa = {};
  comandas.forEach((c) => c.items.forEach((i) => {
    mapa[i.id] = mapa[i.id] ? { ...mapa[i.id], cant: mapa[i.id].cant + i.cant } : { ...i };
  }));
  return Object.values(mapa);
}

/* ---------- Importe en letras (va en el comprobante) ---------- */
const U = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const ESP = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE",
  "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDOS", "VEINTITRES", "VEINTICUATRO",
  "VEINTICINCO", "VEINTISEIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DEC = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CEN = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
function menorCien(n) {
  if (n < 10) return U[n];
  if (n < 30) return ESP[n - 10];
  const d = Math.floor(n / 10), u = n % 10;
  return DEC[d] + (u ? " Y " + U[u] : "");
}
function menorMil(n) {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100), r = n % 100;
  return [CEN[c], r ? menorCien(r) : ""].filter(Boolean).join(" ");
}
function enteroALetras(n) {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones) partes.push(millones === 1 ? "UN MILLON" : menorMil(millones).replace(/UNO$/, "UN") + " MILLONES");
  if (miles) partes.push(miles === 1 ? "MIL" : menorMil(miles).replace(/UNO$/, "UN") + " MIL");
  if (resto) partes.push(menorMil(resto));
  return partes.join(" ");
}
export function montoEnLetras(total) {
  const entero = Math.floor(total);
  const cent = Math.round((total - entero) * 100);
  return `SON: ${enteroALetras(entero)} CON ${String(cent).padStart(2, "0")}/100 SOLES`;
}

/* ---------- Asistente de la carta (reglas por palabras clave) ---------- */
const normalizar = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const CLAVES = [
  [/hambre|mucho|contundente|llenar|grande/, ["hambre"]],
  [/compartir|grupo|amigos|familia|todos/, ["compartir"]],
  [/picante|aji|rocoto|bufalo/, ["picante"]],
  [/barato|economic|poco dinero|presupuesto/, ["economico"]],
  [/hamburguesa|burger/, ["hamburguesa"]],
  [/salchi|papas/, ["salchipapa"]],
  [/alita/, ["alitas"]],
  [/parrilla|brasa|asado|churrasco|anticucho/, ["parrilla"]],
  [/carne|res/, ["carne"]],
  [/pollo/, ["pollo"]],
  [/dulce/, ["dulce"]],
  [/gaseosa|cola|inca|sprite/, ["gaseosa"]],
  [/refresco|natural|chicha|limonada|maracuya|jugo/, ["refresco"]],
  [/tomar|beber|bebida|sed/, ["bebida"]],
  [/recomien|especialidad|mejor/, ["parrilla", "alitas"]],
];
export function recomendar(texto, productos) {
  const t = normalizar(texto);
  const buscados = CLAVES.filter(([re]) => re.test(t)).flatMap(([, tags]) => tags);
  if (!buscados.length) return { texto: "No te entendí del todo. ¿Quieres hamburguesa, salchipapa, alitas, parrilla o algo para tomar?", platos: [] };
  const puntaje = productos.filter((p) => p.disponible).map((p) => [p, (p.tags || []).filter((tg) => buscados.includes(tg)).length + Math.random() * 0.5])
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([p]) => p);
  return { texto: puntaje.length ? "Te recomiendo estos:" : "Esta vez no tengo algo así en la carta.", platos: puntaje };
}

// Categorías en el orden de la carta (las nuevas van al final)
export function categoriasDe(productos) {
  const usadas = [...new Set(productos.map((p) => p.cat))];
  return [...CATEGORIAS_BASE.filter((c) => usadas.includes(c)), ...usadas.filter((c) => !CATEGORIAS_BASE.includes(c))];
}
