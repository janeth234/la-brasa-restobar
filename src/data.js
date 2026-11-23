/* =========================================================
   CONFIGURACIÓN DEL NEGOCIO (cámbiala por tus datos)
   ========================================================= */
export const EMISOR = {
  ruc: "20601234565",
  razonSocial: "INVERSIONES LA BRASA S.A.C.",
  nombreComercial: "La Brasa Restobar",
  siglas: "LB",
  direccion: "Av. La Marina 1234, San Miguel - Lima",
  telefono: "(01) 555-1234",
};
// Información que responde el bot (cámbiala por la real)
export const NEGOCIO = {
  horario: "De lunes a jueves de 12:00 m. a 11:00 p. m., y de viernes a domingo de 12:00 m. a 1:00 a. m.",
  delivery: "Sí, hacemos delivery en San Miguel, Magdalena del Mar y Pueblo Libre (pedido mínimo S/ 30). Pide y paga en nuestra página: sección \"Pide por internet\". También por WhatsApp al 987 654 321.",
  whatsapp: "987 654 321",
  redes: "Instagram y Facebook: @labrasarestobar",
  wifi: "Red: LaBrasa-Clientes · Clave: brasa2026",
  promociones: "Martes de alitas: 2 × 1 en alitas BBQ de 6 unidades. Jueves: jarra de chicha gratis por una parrilla familiar.",
};
// Pedidos por internet
export const DISTRITOS_REPARTO = ["San Miguel", "Magdalena del Mar", "Pueblo Libre"];
export const PEDIDO_MINIMO_DELIVERY = 30;   // soles
export const IGV = 0.18;         // tasa IGV (los precios del menú ya incluyen IGV)
export const LIMITE_DNI = 700;   // boletas mayores a S/ 700 exigen DNI del cliente
export const MESAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
export const METODOS = ["Efectivo", "Tarjeta", "Yape", "Plin"];
export const METODOS_ONLINE = ["Yape", "Plin", "Tarjeta"];

// Carta inicial: se carga en la base de datos la primera vez. Luego se edita en la pestaña "Carta".
// foto: se sube desde la pestaña Carta (si no hay foto se muestra el dibujo "arte").
// arte.forma: hamburguesa | papas | alitas | parrilla | botella | vaso  (dibujo sin fotos)
// tags: palabras que usa el asistente para recomendar
const H = (id, nombre, precio, desc, c, tags) => ({ id, cat: "Hamburguesas", nombre, precio, desc, disponible: true, foto: null, arte: { forma: "hamburguesa", c }, tags });
const S = (id, nombre, precio, desc, c, tags) => ({ id, cat: "Salchipapas", nombre, precio, desc, disponible: true, foto: null, arte: { forma: "papas", c }, tags });
const A = (id, nombre, precio, desc, c, tags) => ({ id, cat: "Alitas", nombre, precio, desc, disponible: true, foto: null, arte: { forma: "alitas", c }, tags });
const P = (id, nombre, precio, desc, c, tags) => ({ id, cat: "Parrillas", nombre, precio, desc, disponible: true, foto: null, arte: { forma: "parrilla", c }, tags });
const G = (id, nombre, precio, desc, c, tags) => ({ id, cat: "Gaseosas", nombre, precio, desc, disponible: true, foto: null, arte: { forma: "botella", c }, tags });
const R = (id, nombre, precio, desc, c, tags) => ({ id, cat: "Refrescos", nombre, precio, desc, disponible: true, foto: null, arte: { forma: "vaso", c }, tags });

export const PRODUCTOS_INICIALES = [
  H("h1", "Hamburguesa clásica", 14, "Carne de res a la plancha, lechuga, tomate y papas al hilo.", ["#7a3b22", "#7cc35a", "#e04b3a"], ["hamburguesa", "carne", "economico"]),
  H("h2", "Hamburguesa royal", 17, "Carne, huevo frito, queso y plátano frito. Con papas.", ["#7a3b22", "#f6d548", "#f3f0e6"], ["hamburguesa", "carne", "hambre"]),
  H("h3", "Hamburguesa a lo pobre", 19, "Carne, huevo, plátano frito, tocino y queso. Con papas.", ["#7a3b22", "#f6d548", "#c8452c"], ["hamburguesa", "carne", "hambre"]),
  H("h4", "Doble queso tocino", 22, "Doble carne, doble cheddar y tocino crocante. Con papas.", ["#6a3019", "#f3a21b", "#c8452c"], ["hamburguesa", "carne", "hambre"]),
  H("h5", "Hamburguesa de pollo", 15, "Filete de pollo apanado, lechuga, tomate y mayonesa.", ["#d49a4a", "#7cc35a", "#e04b3a"], ["hamburguesa", "pollo", "economico"]),

  S("s1", "Salchipapa clásica", 12, "Papas fritas con hot dog en rodajas y cremas al gusto.", ["#f2c94c", "#c8523a", "#f3f0e6"], ["salchipapa", "economico"]),
  S("s2", "Salchipapa especial", 16, "Papas, hot dog, huevo frito y queso derretido.", ["#f2c94c", "#c8523a", "#f6d548"], ["salchipapa", "hambre"]),
  S("s3", "Salchipollo", 18, "Papas, hot dog y trozos de pollo broaster.", ["#f2c94c", "#c8523a", "#c98a3c"], ["salchipapa", "pollo", "hambre"]),
  S("s4", "Salchipapa familiar", 32, "Fuente grande para 3–4 personas con chorizo y huevos.", ["#f2c94c", "#a8402a", "#f6d548"], ["salchipapa", "compartir", "hambre"]),

  A("a1", "Alitas BBQ (6 und)", 22, "Alitas bañadas en salsa barbacoa ahumada. Con papas.", ["#8a3a1c", "#f2c94c"], ["alitas", "pollo"]),
  A("a2", "Alitas búfalo (6 und)", 22, "Salsa picante estilo búfalo con dip de queso azul.", ["#d1491f", "#f2c94c"], ["alitas", "pollo", "picante"]),
  A("a3", "Alitas acevichadas (6 und)", 24, "Con salsa acevichada, cebolla china y ajonjolí.", ["#e8b25a", "#f2c94c"], ["alitas", "pollo", "picante"]),
  A("a4", "Alitas maracuyá (6 und)", 23, "Glaseadas en salsa dulce de maracuyá.", ["#f0a020", "#f2c94c"], ["alitas", "pollo", "dulce"]),
  A("a5", "Alitas mix (12 und)", 40, "Elige dos sabores. Ideal para compartir. Con papas.", ["#b8451f", "#f2c94c"], ["alitas", "pollo", "compartir"]),

  P("p1", "Anticuchos (2 palitos)", 20, "Corazón de res en ají panca, con papa dorada y choclo.", ["#6e2a16", "#f2c94c", "#f3e3a0"], ["parrilla", "carne", "picante"]),
  P("p2", "Chorizo parrillero", 18, "Chorizo artesanal a la brasa con papas y chimichurri.", ["#9a3a22", "#f2c94c", "#5a8a3c"], ["parrilla", "carne"]),
  P("p3", "Pollo a la parrilla", 28, "Pierna de pollo marinada a la brasa con papas y ensalada.", ["#c47a33", "#f2c94c", "#7cc35a"], ["parrilla", "pollo"]),
  P("p4", "Churrasco 300 g", 38, "Corte de res a la brasa, papas fritas y ensalada.", ["#5a2414", "#f2c94c", "#7cc35a"], ["parrilla", "carne", "hambre"]),
  P("p5", "Parrilla personal", 45, "Churrasco, chorizo, pollo y anticucho con papas.", ["#5a2414", "#9a3a22", "#c47a33"], ["parrilla", "carne", "hambre"]),
  P("p6", "Parrilla familiar (4 pers.)", 120, "Carnes, chorizos, pollo, anticuchos, papas y ensalada.", ["#5a2414", "#9a3a22", "#c47a33"], ["parrilla", "carne", "compartir", "hambre"]),

  G("g1", "Inca Kola 500 ml", 5, "Personal, helada.", ["#f4d000", "#0a6fb5"], ["bebida", "gaseosa", "economico"]),
  G("g2", "Coca-Cola 500 ml", 5, "Personal, helada.", ["#3a1a12", "#d92b2b"], ["bebida", "gaseosa", "economico"]),
  G("g3", "Inca Kola 1.5 L", 10, "Para compartir en la mesa.", ["#f4d000", "#0a6fb5"], ["bebida", "gaseosa", "compartir"]),
  G("g4", "Coca-Cola 1.5 L", 10, "Para compartir en la mesa.", ["#3a1a12", "#d92b2b"], ["bebida", "gaseosa", "compartir"]),
  G("g5", "Sprite 500 ml", 5, "Personal, helada.", ["#cfeccf", "#1f8a4c"], ["bebida", "gaseosa", "economico"]),
  G("g6", "Agua mineral 625 ml", 4, "Sin gas.", ["#e3f1f8", "#3a8cc1"], ["bebida", "economico"]),

  R("r1", "Chicha morada (vaso)", 6, "Maíz morado con piña, canela y clavo.", ["#4b1846", "#7d2c74"], ["bebida", "refresco", "economico"]),
  R("r2", "Chicha morada (jarra 1 L)", 15, "Para compartir, bien helada.", ["#4b1846", "#7d2c74"], ["bebida", "refresco", "compartir"]),
  R("r3", "Limonada frozen", 9, "Limón y hielo frappé.", ["#e8ef9a", "#c9d65a"], ["bebida", "refresco"]),
  R("r4", "Limonada (jarra 1 L)", 15, "Limón recién exprimido.", ["#eef3b0", "#c9d65a"], ["bebida", "refresco", "compartir"]),
  R("r5", "Maracuyá (jarra 1 L)", 15, "Refresco natural de maracuyá.", ["#f7b733", "#e08a1e"], ["bebida", "refresco", "compartir"]),
];
// Fotos reales de la carta inicial: public/fotos/<id>.jpg
// (con base de datos, el servidor las copia a la tabla producto_fotos la primera vez)
for (const p of PRODUCTOS_INICIALES) p.foto = `fotos/${p.id}.jpg`;

export const CATEGORIAS_BASE = [...new Set(PRODUCTOS_INICIALES.map((p) => p.cat))];
export const FORMAS = ["hamburguesa", "papas", "alitas", "parrilla", "botella", "vaso"];
