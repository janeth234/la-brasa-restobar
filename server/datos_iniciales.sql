-- Datos iniciales de La Brasa Restobar (generado desde src/data.js)
-- Ejecutar DESPUÉS de schema.sql. Se puede ejecutar varias veces sin duplicar datos.
BEGIN;

-- Mesas
INSERT INTO mesas (id) VALUES (1), (2), (3), (4), (5), (6), (7), (8), (9), (10) ON CONFLICT (id) DO NOTHING;

-- Categorías
INSERT INTO categorias (nombre, orden) VALUES
  ('Hamburguesas', 1),
  ('Salchipapas', 2),
  ('Alitas', 3),
  ('Parrillas', 4),
  ('Gaseosas', 5),
  ('Refrescos', 6)
ON CONFLICT (nombre) DO NOTHING;

-- Productos
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'h1', id, 'Hamburguesa clásica', 'Carne de res a la plancha, lechuga, tomate y papas al hilo.', 14.00, 'hamburguesa', '#7a3b22', '#7cc35a', '#e04b3a'
  FROM categorias WHERE nombre = 'Hamburguesas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'h2', id, 'Hamburguesa royal', 'Carne, huevo frito, queso y plátano frito. Con papas.', 17.00, 'hamburguesa', '#7a3b22', '#f6d548', '#f3f0e6'
  FROM categorias WHERE nombre = 'Hamburguesas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'h3', id, 'Hamburguesa a lo pobre', 'Carne, huevo, plátano frito, tocino y queso. Con papas.', 19.00, 'hamburguesa', '#7a3b22', '#f6d548', '#c8452c'
  FROM categorias WHERE nombre = 'Hamburguesas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'h4', id, 'Doble queso tocino', 'Doble carne, doble cheddar y tocino crocante. Con papas.', 22.00, 'hamburguesa', '#6a3019', '#f3a21b', '#c8452c'
  FROM categorias WHERE nombre = 'Hamburguesas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'h5', id, 'Hamburguesa de pollo', 'Filete de pollo apanado, lechuga, tomate y mayonesa.', 15.00, 'hamburguesa', '#d49a4a', '#7cc35a', '#e04b3a'
  FROM categorias WHERE nombre = 'Hamburguesas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 's1', id, 'Salchipapa clásica', 'Papas fritas con hot dog en rodajas y cremas al gusto.', 12.00, 'papas', '#f2c94c', '#c8523a', '#f3f0e6'
  FROM categorias WHERE nombre = 'Salchipapas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 's2', id, 'Salchipapa especial', 'Papas, hot dog, huevo frito y queso derretido.', 16.00, 'papas', '#f2c94c', '#c8523a', '#f6d548'
  FROM categorias WHERE nombre = 'Salchipapas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 's3', id, 'Salchipollo', 'Papas, hot dog y trozos de pollo broaster.', 18.00, 'papas', '#f2c94c', '#c8523a', '#c98a3c'
  FROM categorias WHERE nombre = 'Salchipapas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 's4', id, 'Salchipapa familiar', 'Fuente grande para 3–4 personas con chorizo y huevos.', 32.00, 'papas', '#f2c94c', '#a8402a', '#f6d548'
  FROM categorias WHERE nombre = 'Salchipapas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'a1', id, 'Alitas BBQ (6 und)', 'Alitas bañadas en salsa barbacoa ahumada. Con papas.', 22.00, 'alitas', '#8a3a1c', '#f2c94c', NULL
  FROM categorias WHERE nombre = 'Alitas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'a2', id, 'Alitas búfalo (6 und)', 'Salsa picante estilo búfalo con dip de queso azul.', 22.00, 'alitas', '#d1491f', '#f2c94c', NULL
  FROM categorias WHERE nombre = 'Alitas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'a3', id, 'Alitas acevichadas (6 und)', 'Con salsa acevichada, cebolla china y ajonjolí.', 24.00, 'alitas', '#e8b25a', '#f2c94c', NULL
  FROM categorias WHERE nombre = 'Alitas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'a4', id, 'Alitas maracuyá (6 und)', 'Glaseadas en salsa dulce de maracuyá.', 23.00, 'alitas', '#f0a020', '#f2c94c', NULL
  FROM categorias WHERE nombre = 'Alitas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'a5', id, 'Alitas mix (12 und)', 'Elige dos sabores. Ideal para compartir. Con papas.', 40.00, 'alitas', '#b8451f', '#f2c94c', NULL
  FROM categorias WHERE nombre = 'Alitas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'p1', id, 'Anticuchos (2 palitos)', 'Corazón de res en ají panca, con papa dorada y choclo.', 20.00, 'parrilla', '#6e2a16', '#f2c94c', '#f3e3a0'
  FROM categorias WHERE nombre = 'Parrillas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'p2', id, 'Chorizo parrillero', 'Chorizo artesanal a la brasa con papas y chimichurri.', 18.00, 'parrilla', '#9a3a22', '#f2c94c', '#5a8a3c'
  FROM categorias WHERE nombre = 'Parrillas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'p3', id, 'Pollo a la parrilla', 'Pierna de pollo marinada a la brasa con papas y ensalada.', 28.00, 'parrilla', '#c47a33', '#f2c94c', '#7cc35a'
  FROM categorias WHERE nombre = 'Parrillas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'p4', id, 'Churrasco 300 g', 'Corte de res a la brasa, papas fritas y ensalada.', 38.00, 'parrilla', '#5a2414', '#f2c94c', '#7cc35a'
  FROM categorias WHERE nombre = 'Parrillas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'p5', id, 'Parrilla personal', 'Churrasco, chorizo, pollo y anticucho con papas.', 45.00, 'parrilla', '#5a2414', '#9a3a22', '#c47a33'
  FROM categorias WHERE nombre = 'Parrillas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'p6', id, 'Parrilla familiar (4 pers.)', 'Carnes, chorizos, pollo, anticuchos, papas y ensalada.', 120.00, 'parrilla', '#5a2414', '#9a3a22', '#c47a33'
  FROM categorias WHERE nombre = 'Parrillas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'g1', id, 'Inca Kola 500 ml', 'Personal, helada.', 5.00, 'botella', '#f4d000', '#0a6fb5', NULL
  FROM categorias WHERE nombre = 'Gaseosas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'g2', id, 'Coca-Cola 500 ml', 'Personal, helada.', 5.00, 'botella', '#3a1a12', '#d92b2b', NULL
  FROM categorias WHERE nombre = 'Gaseosas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'g3', id, 'Inca Kola 1.5 L', 'Para compartir en la mesa.', 10.00, 'botella', '#f4d000', '#0a6fb5', NULL
  FROM categorias WHERE nombre = 'Gaseosas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'g4', id, 'Coca-Cola 1.5 L', 'Para compartir en la mesa.', 10.00, 'botella', '#3a1a12', '#d92b2b', NULL
  FROM categorias WHERE nombre = 'Gaseosas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'g5', id, 'Sprite 500 ml', 'Personal, helada.', 5.00, 'botella', '#cfeccf', '#1f8a4c', NULL
  FROM categorias WHERE nombre = 'Gaseosas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'g6', id, 'Agua mineral 625 ml', 'Sin gas.', 4.00, 'botella', '#e3f1f8', '#3a8cc1', NULL
  FROM categorias WHERE nombre = 'Gaseosas' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'r1', id, 'Chicha morada (vaso)', 'Maíz morado con piña, canela y clavo.', 6.00, 'vaso', '#4b1846', '#7d2c74', NULL
  FROM categorias WHERE nombre = 'Refrescos' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'r2', id, 'Chicha morada (jarra 1 L)', 'Para compartir, bien helada.', 15.00, 'vaso', '#4b1846', '#7d2c74', NULL
  FROM categorias WHERE nombre = 'Refrescos' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'r3', id, 'Limonada frozen', 'Limón y hielo frappé.', 9.00, 'vaso', '#e8ef9a', '#c9d65a', NULL
  FROM categorias WHERE nombre = 'Refrescos' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'r4', id, 'Limonada (jarra 1 L)', 'Limón recién exprimido.', 15.00, 'vaso', '#eef3b0', '#c9d65a', NULL
  FROM categorias WHERE nombre = 'Refrescos' ON CONFLICT (id) DO NOTHING;
INSERT INTO productos (id, categoria_id, nombre, descripcion, precio, dibujo, color_1, color_2, color_3)
  SELECT 'r5', id, 'Maracuyá (jarra 1 L)', 'Refresco natural de maracuyá.', 15.00, 'vaso', '#f7b733', '#e08a1e', NULL
  FROM categorias WHERE nombre = 'Refrescos' ON CONFLICT (id) DO NOTHING;

-- Etiquetas para el bot
INSERT INTO etiquetas (nombre) VALUES ('alitas'), ('bebida'), ('carne'), ('compartir'), ('dulce'), ('economico'), ('gaseosa'), ('hambre'), ('hamburguesa'), ('parrilla'), ('picante'), ('pollo'), ('refresco'), ('salchipapa') ON CONFLICT (nombre) DO NOTHING;

-- Etiquetas de cada producto
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'h1', id FROM etiquetas WHERE nombre IN ('hamburguesa', 'carne', 'economico') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'h2', id FROM etiquetas WHERE nombre IN ('hamburguesa', 'carne', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'h3', id FROM etiquetas WHERE nombre IN ('hamburguesa', 'carne', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'h4', id FROM etiquetas WHERE nombre IN ('hamburguesa', 'carne', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'h5', id FROM etiquetas WHERE nombre IN ('hamburguesa', 'pollo', 'economico') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 's1', id FROM etiquetas WHERE nombre IN ('salchipapa', 'economico') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 's2', id FROM etiquetas WHERE nombre IN ('salchipapa', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 's3', id FROM etiquetas WHERE nombre IN ('salchipapa', 'pollo', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 's4', id FROM etiquetas WHERE nombre IN ('salchipapa', 'compartir', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'a1', id FROM etiquetas WHERE nombre IN ('alitas', 'pollo') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'a2', id FROM etiquetas WHERE nombre IN ('alitas', 'pollo', 'picante') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'a3', id FROM etiquetas WHERE nombre IN ('alitas', 'pollo', 'picante') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'a4', id FROM etiquetas WHERE nombre IN ('alitas', 'pollo', 'dulce') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'a5', id FROM etiquetas WHERE nombre IN ('alitas', 'pollo', 'compartir') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'p1', id FROM etiquetas WHERE nombre IN ('parrilla', 'carne', 'picante') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'p2', id FROM etiquetas WHERE nombre IN ('parrilla', 'carne') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'p3', id FROM etiquetas WHERE nombre IN ('parrilla', 'pollo') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'p4', id FROM etiquetas WHERE nombre IN ('parrilla', 'carne', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'p5', id FROM etiquetas WHERE nombre IN ('parrilla', 'carne', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'p6', id FROM etiquetas WHERE nombre IN ('parrilla', 'carne', 'compartir', 'hambre') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'g1', id FROM etiquetas WHERE nombre IN ('bebida', 'gaseosa', 'economico') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'g2', id FROM etiquetas WHERE nombre IN ('bebida', 'gaseosa', 'economico') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'g3', id FROM etiquetas WHERE nombre IN ('bebida', 'gaseosa', 'compartir') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'g4', id FROM etiquetas WHERE nombre IN ('bebida', 'gaseosa', 'compartir') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'g5', id FROM etiquetas WHERE nombre IN ('bebida', 'gaseosa', 'economico') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'g6', id FROM etiquetas WHERE nombre IN ('bebida', 'economico') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'r1', id FROM etiquetas WHERE nombre IN ('bebida', 'refresco', 'economico') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'r2', id FROM etiquetas WHERE nombre IN ('bebida', 'refresco', 'compartir') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'r3', id FROM etiquetas WHERE nombre IN ('bebida', 'refresco') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'r4', id FROM etiquetas WHERE nombre IN ('bebida', 'refresco', 'compartir') ON CONFLICT DO NOTHING;
INSERT INTO producto_etiquetas (producto_id, etiqueta_id) SELECT 'r5', id FROM etiquetas WHERE nombre IN ('bebida', 'refresco', 'compartir') ON CONFLICT DO NOTHING;

COMMIT;
