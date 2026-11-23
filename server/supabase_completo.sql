-- =====================================================================
--  LA BRASA RESTOBAR — SCRIPT COMPLETO PARA SUPABASE (SQL Editor → Run)
--  1) Tablas en 3FN, catálogos, vistas y seguridad   2) Datos iniciales
--  Se puede ejecutar varias veces sin duplicar datos.
-- =====================================================================

-- =====================================================================
--  BASE DE DATOS DE LA BRASA RESTOBAR — PostgreSQL / Supabase
--  Diseño en Tercera Forma Normal (3FN). Ver BASE_DE_DATOS.md
--
--  El servidor ejecuta este archivo al arrancar (crea lo que falte).
--  También puedes pegarlo en Supabase → SQL Editor → Run.
--  Datos iniciales (carta, mesas): server/datos_iniciales.sql
-- =====================================================================

-- Si existe la versión anterior (no normalizada) de las tablas, se elimina.
-- Solo contenía datos de prueba. Se detecta por la columna productos.categoria (texto).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'productos' AND column_name = 'categoria') THEN
    DROP TABLE IF EXISTS resenas, comprobante_items, comprobantes, correlativos,
                         solicitudes, comanda_items, comandas, productos CASCADE;
    RAISE NOTICE 'Se eliminaron las tablas de la versión anterior (no normalizada).';
  END IF;
END $$;

-- =====================================================================
-- 1. CATÁLOGOS (tablas de referencia)
-- =====================================================================

-- Catálogo 06 de SUNAT: tipos de documento de identidad
CREATE TABLE IF NOT EXISTS tipos_documento (
  codigo       CHAR(1)      PRIMARY KEY,           -- '1' DNI, '6' RUC
  nombre       VARCHAR(30)  NOT NULL UNIQUE,
  longitud     SMALLINT     NOT NULL CHECK (longitud > 0)
);

-- Catálogo 01 de SUNAT: tipos de comprobante
CREATE TABLE IF NOT EXISTS tipos_comprobante (
  codigo       CHAR(2)      PRIMARY KEY,           -- '01' Factura, '03' Boleta
  nombre       VARCHAR(40)  NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS metodos_pago (
  id           SMALLSERIAL  PRIMARY KEY,
  nombre       VARCHAR(20)  NOT NULL UNIQUE,       -- Efectivo, Tarjeta, Yape, Plin
  en_linea     BOOLEAN      NOT NULL DEFAULT FALSE -- se puede pagar desde el celular
);

CREATE TABLE IF NOT EXISTS estados_comanda (
  codigo       VARCHAR(12)  PRIMARY KEY,           -- nuevo, preparando, listo, entregado
  descripcion  VARCHAR(40)  NOT NULL,
  orden        SMALLINT     NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS mesas (
  id           SMALLINT     PRIMARY KEY,           -- número de mesa
  activa       BOOLEAN      NOT NULL DEFAULT TRUE
);

-- =====================================================================
-- 2. CARTA
-- =====================================================================

CREATE TABLE IF NOT EXISTS categorias (
  id           SERIAL       PRIMARY KEY,
  nombre       VARCHAR(40)  NOT NULL UNIQUE,
  orden        SMALLINT     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS productos (
  id           VARCHAR(20)  PRIMARY KEY,
  categoria_id INTEGER      NOT NULL REFERENCES categorias(id),
  nombre       VARCHAR(80)  NOT NULL,
  descripcion  VARCHAR(250) NOT NULL DEFAULT '',
  precio       NUMERIC(10,2) NOT NULL CHECK (precio > 0),    -- precio actual, con IGV
  disponible   BOOLEAN      NOT NULL DEFAULT TRUE,           -- FALSE = agotado hoy
  activo       BOOLEAN      NOT NULL DEFAULT TRUE,           -- FALSE = eliminado de la carta
  dibujo       VARCHAR(15)  NOT NULL DEFAULT 'hamburguesa',  -- ilustración si no hay foto
  color_1      CHAR(7),
  color_2      CHAR(7),
  color_3      CHAR(7),
  orden        SERIAL
);

-- Foto real del producto (relación 1 a 1; separada para no cargar la imagen al leer la carta)
CREATE TABLE IF NOT EXISTS producto_fotos (
  producto_id  VARCHAR(20)  PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  imagen       BYTEA        NOT NULL,
  tipo_mime    VARCHAR(20)  NOT NULL CHECK (tipo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  version      BIGINT       NOT NULL               -- cambia en cada foto nueva (evita caché vieja)
);

-- Palabras clave para el bot (relación muchos a muchos)
CREATE TABLE IF NOT EXISTS etiquetas (
  id           SERIAL       PRIMARY KEY,
  nombre       VARCHAR(30)  NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS producto_etiquetas (
  producto_id  VARCHAR(20)  NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  etiqueta_id  INTEGER      NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (producto_id, etiqueta_id)
);

-- =====================================================================
-- 3. CLIENTES Y COMPROBANTES
-- =====================================================================

CREATE TABLE IF NOT EXISTS clientes (
  id                 SERIAL       PRIMARY KEY,
  tipo_documento     CHAR(1)      NOT NULL REFERENCES tipos_documento(codigo),
  numero_documento   VARCHAR(11)  NOT NULL,
  nombre             VARCHAR(150) NOT NULL,          -- nombre o razón social
  direccion          VARCHAR(200),                   -- dirección fiscal (facturas)
  UNIQUE (tipo_documento, numero_documento)
);

-- Una serie pertenece a un tipo de comprobante y lleva su propio correlativo
CREATE TABLE IF NOT EXISTS series (
  serie              CHAR(4)      PRIMARY KEY,       -- B001, F001
  tipo_comprobante   CHAR(2)      NOT NULL REFERENCES tipos_comprobante(codigo),
  ultimo_numero      INTEGER      NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0)
);

-- El tipo (boleta/factura) se obtiene de la serie; los importes, del detalle (ver vistas)
CREATE TABLE IF NOT EXISTS comprobantes (
  id                 VARCHAR(20)  PRIMARY KEY,
  serie              CHAR(4)      NOT NULL REFERENCES series(serie),
  numero             INTEGER      NOT NULL CHECK (numero > 0),
  fecha_emision      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  cliente_id         INTEGER      REFERENCES clientes(id),     -- NULL = "clientes varios"
  tasa_igv           NUMERIC(4,2) NOT NULL DEFAULT 0.18,       -- tasa vigente al emitir
  origen             VARCHAR(5)   NOT NULL CHECK (origen IN ('caja', 'qr')),
  UNIQUE (serie, numero)
);

CREATE TABLE IF NOT EXISTS pagos (
  id                 SERIAL       PRIMARY KEY,
  comprobante_id     VARCHAR(20)  NOT NULL REFERENCES comprobantes(id) ON DELETE CASCADE,
  metodo_pago_id     SMALLINT     NOT NULL REFERENCES metodos_pago(id),
  monto              NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  monto_recibido     NUMERIC(10,2) NOT NULL,                   -- el vuelto = recibido - monto
  numero_operacion   VARCHAR(30),
  CHECK (monto_recibido >= monto)
);

-- =====================================================================
-- 4. PEDIDOS (COMANDAS)
-- =====================================================================

-- Una mesa puede tener varias comandas; al cobrar, las pendientes apuntan al mismo comprobante.
-- REGLA: cocina solo prepara comandas pagadas (comprobante_id NOT NULL).
CREATE TABLE IF NOT EXISTS comandas (
  id                 VARCHAR(20)  PRIMARY KEY,
  mesa_id            SMALLINT     NOT NULL REFERENCES mesas(id),
  estado             VARCHAR(12)  NOT NULL REFERENCES estados_comanda(codigo),
  origen             VARCHAR(5)   NOT NULL CHECK (origen IN ('qr', 'mozo')),
  nota               VARCHAR(200) NOT NULL DEFAULT '',
  creado             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  comprobante_id     VARCHAR(20)  REFERENCES comprobantes(id),  -- NULL = pendiente de pago
  -- no se puede avanzar en cocina sin haber pagado
  CONSTRAINT comanda_pagada_para_cocina CHECK (estado = 'nuevo' OR comprobante_id IS NOT NULL)
);
-- Para bases ya creadas con una versión anterior: agrega la regla si falta
-- (NOT VALID: no revisa pedidos de prueba antiguos, sí todos los nuevos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comanda_pagada_para_cocina') THEN
    ALTER TABLE comandas ADD CONSTRAINT comanda_pagada_para_cocina
      CHECK (estado = 'nuevo' OR comprobante_id IS NOT NULL) NOT VALID;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_comandas_abiertas ON comandas (mesa_id) WHERE comprobante_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_comandas_cocina ON comandas (estado) WHERE comprobante_id IS NOT NULL AND estado <> 'entregado';
CREATE INDEX IF NOT EXISTS idx_comandas_comprobante ON comandas (comprobante_id);

-- precio_unitario: precio cobrado en ese momento (dato histórico: el precio del producto puede cambiar)
CREATE TABLE IF NOT EXISTS comanda_items (
  comanda_id         VARCHAR(20)  NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
  producto_id        VARCHAR(20)  NOT NULL REFERENCES productos(id),
  cantidad           SMALLINT     NOT NULL CHECK (cantidad BETWEEN 1 AND 50),
  precio_unitario    NUMERIC(10,2) NOT NULL CHECK (precio_unitario > 0),
  PRIMARY KEY (comanda_id, producto_id)
);

-- Avisos de una mesa: "llama al mozo" o "pide la cuenta" (con el comprobante que quiere)
CREATE TABLE IF NOT EXISTS solicitudes (
  id                 VARCHAR(20)  PRIMARY KEY,
  mesa_id            SMALLINT     NOT NULL REFERENCES mesas(id),
  tipo               VARCHAR(6)   NOT NULL CHECK (tipo IN ('mozo', 'cuenta')),
  tipo_comprobante   CHAR(2)      REFERENCES tipos_comprobante(codigo),
  cliente_id         INTEGER      REFERENCES clientes(id),
  creado             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (mesa_id, tipo)
);

-- Calificación del cliente (una por comprobante)
CREATE TABLE IF NOT EXISTS resenas (
  id                 VARCHAR(20)  PRIMARY KEY,
  comprobante_id     VARCHAR(20)  NOT NULL UNIQUE REFERENCES comprobantes(id) ON DELETE CASCADE,
  estrellas          SMALLINT     NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario         VARCHAR(300),
  fecha              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =====================================================================
-- 5. DATOS DE LOS CATÁLOGOS
-- =====================================================================
INSERT INTO tipos_documento (codigo, nombre, longitud) VALUES ('1', 'DNI', 8), ('6', 'RUC', 11)
  ON CONFLICT (codigo) DO NOTHING;
INSERT INTO tipos_comprobante (codigo, nombre) VALUES ('01', 'Factura electrónica'), ('03', 'Boleta de venta electrónica')
  ON CONFLICT (codigo) DO NOTHING;
INSERT INTO series (serie, tipo_comprobante) VALUES ('F001', '01'), ('B001', '03')
  ON CONFLICT (serie) DO NOTHING;
INSERT INTO metodos_pago (nombre, en_linea) VALUES ('Efectivo', FALSE), ('Tarjeta', TRUE), ('Yape', TRUE), ('Plin', TRUE)
  ON CONFLICT (nombre) DO NOTHING;
INSERT INTO estados_comanda (codigo, descripcion, orden) VALUES
  ('nuevo', 'Recibido', 1), ('preparando', 'En preparación', 2), ('listo', 'Listo para servir', 3), ('entregado', 'Entregado en la mesa', 4)
  ON CONFLICT (codigo) DO NOTHING;

-- =====================================================================
-- 6. VISTAS (los importes se calculan, no se guardan)
-- =====================================================================

-- Detalle de cada comprobante: los productos de todas las comandas que pagó
CREATE OR REPLACE VIEW v_comprobante_detalle AS
SELECT co.comprobante_id,
       ci.producto_id,
       p.nombre                              AS descripcion,
       ci.precio_unitario,
       SUM(ci.cantidad)::INTEGER             AS cantidad,
       SUM(ci.cantidad * ci.precio_unitario) AS importe
FROM comandas co
JOIN comanda_items ci ON ci.comanda_id = co.id
JOIN productos p      ON p.id = ci.producto_id
WHERE co.comprobante_id IS NOT NULL
GROUP BY co.comprobante_id, ci.producto_id, p.nombre, ci.precio_unitario;

-- Comprobante completo con totales calculados (op. gravada, IGV, total)
CREATE OR REPLACE VIEW v_comprobantes AS
WITH totales AS (
  SELECT comprobante_id, SUM(importe) AS total FROM v_comprobante_detalle GROUP BY comprobante_id
), mesa AS (
  SELECT DISTINCT ON (comprobante_id) comprobante_id, mesa_id FROM comandas
  WHERE comprobante_id IS NOT NULL ORDER BY comprobante_id, creado
)
SELECT c.id, c.serie, c.numero, s.tipo_comprobante, tc.nombre AS tipo_nombre,
       c.serie || '-' || LPAD(c.numero::TEXT, 8, '0') AS numero_completo,
       c.fecha_emision, m.mesa_id, c.origen,
       cl.tipo_documento, td.nombre AS tipo_documento_nombre, cl.numero_documento,
       COALESCE(cl.nombre, 'CLIENTES VARIOS') AS cliente, cl.direccion,
       ROUND(t.total / (1 + c.tasa_igv), 2)          AS op_gravada,
       t.total - ROUND(t.total / (1 + c.tasa_igv), 2) AS igv,
       t.total
FROM comprobantes c
JOIN series s             ON s.serie = c.serie
JOIN tipos_comprobante tc ON tc.codigo = s.tipo_comprobante
JOIN totales t            ON t.comprobante_id = c.id
LEFT JOIN mesa m          ON m.comprobante_id = c.id
LEFT JOIN clientes cl     ON cl.id = c.cliente_id
LEFT JOIN tipos_documento td ON td.codigo = cl.tipo_documento;

-- Pantalla de cocina: solo comandas pagadas y no entregadas, con minutos desde el pago
CREATE OR REPLACE VIEW v_cocina AS
SELECT co.id, co.mesa_id, co.estado, ec.descripcion AS estado_nombre, co.origen, co.nota,
       cp.fecha_emision AS pagado_en,
       FLOOR(EXTRACT(EPOCH FROM (now() - cp.fecha_emision)) / 60)::INTEGER AS minutos,
       STRING_AGG(ci.cantidad || ' x ' || p.nombre, ', ' ORDER BY p.nombre) AS productos
FROM comandas co
JOIN comprobantes cp    ON cp.id = co.comprobante_id
JOIN estados_comanda ec ON ec.codigo = co.estado
JOIN comanda_items ci   ON ci.comanda_id = co.id
JOIN productos p        ON p.id = ci.producto_id
WHERE co.estado <> 'entregado'
GROUP BY co.id, ec.descripcion, ec.orden, cp.fecha_emision
ORDER BY ec.orden, cp.fecha_emision;

-- Ventas por día y método de pago (cierre de caja)
CREATE OR REPLACE VIEW v_cierre_caja AS
SELECT (c.fecha_emision AT TIME ZONE 'America/Lima')::DATE AS dia,
       mp.nombre                                          AS metodo_pago,
       COUNT(*)                                           AS operaciones,
       SUM(pg.monto)                                      AS total
FROM pagos pg
JOIN comprobantes c  ON c.id = pg.comprobante_id
JOIN metodos_pago mp ON mp.id = pg.metodo_pago_id
GROUP BY 1, 2;

-- Carta para mostrar (con categoría y etiquetas)
CREATE OR REPLACE VIEW v_carta AS
SELECT p.id, c.nombre AS categoria, p.nombre, p.descripcion, p.precio, p.disponible,
       (pf.producto_id IS NOT NULL) AS tiene_foto,
       COALESCE(STRING_AGG(e.nombre, ', ' ORDER BY e.nombre), '') AS etiquetas
FROM productos p
JOIN categorias c ON c.id = p.categoria_id
LEFT JOIN producto_fotos pf ON pf.producto_id = p.id
LEFT JOIN producto_etiquetas pe ON pe.producto_id = p.id
LEFT JOIN etiquetas e ON e.id = pe.etiqueta_id
WHERE p.activo
GROUP BY p.id, c.nombre, c.orden, pf.producto_id
ORDER BY c.orden, p.orden;

-- =====================================================================
-- 7. SEGURIDAD PARA SUPABASE
--  Supabase publica las tablas de "public" en su API REST (clave anon).
--  Se activa RLS y se quitan permisos a anon/authenticated: solo el servidor
--  de la app (dueño de las tablas) accede. En PostgreSQL normal no afecta.
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tipos_documento', 'tipos_comprobante', 'metodos_pago', 'estados_comanda', 'mesas',
    'categorias', 'productos', 'producto_fotos', 'etiquetas', 'producto_etiquetas', 'clientes', 'series',
    'comprobantes', 'pagos', 'comandas', 'comanda_items', 'solicitudes', 'resenas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['v_comprobante_detalle', 'v_comprobantes', 'v_cierre_caja', 'v_carta', 'v_cocina'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    END IF;
  END LOOP;
END $$;
-- Las vistas respetan los permisos de quien consulta (no saltan RLS desde la API)
ALTER VIEW v_comprobante_detalle SET (security_invoker = on);
ALTER VIEW v_comprobantes SET (security_invoker = on);
ALTER VIEW v_cierre_caja SET (security_invoker = on);
ALTER VIEW v_carta SET (security_invoker = on);
ALTER VIEW v_cocina SET (security_invoker = on);


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
