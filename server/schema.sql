-- =====================================================================
--  BASE DE DATOS DE LA BRASA RESTOBAR — PostgreSQL / Supabase
--  Diseño en Tercera Forma Normal (3FN). Ver BASE_DE_DATOS.md
--  Incluye pedidos en mesa (QR / mozo) y pedidos por internet (delivery / recojo).
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
  origen             VARCHAR(5)   NOT NULL,                     -- caja, qr o web
  UNIQUE (serie, numero),
  CONSTRAINT comprobantes_origen_check CHECK (origen IN ('caja', 'qr', 'web'))
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
-- 4. PEDIDOS POR INTERNET (delivery o recojo en el local)
-- =====================================================================

CREATE TABLE IF NOT EXISTS distritos_reparto (
  id           SMALLSERIAL  PRIMARY KEY,
  nombre       VARCHAR(40)  NOT NULL UNIQUE,
  activo       BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Datos de contacto y entrega de un pedido hecho desde la página web
CREATE TABLE IF NOT EXISTS pedidos_web (
  id                 VARCHAR(20)  PRIMARY KEY,
  codigo             CHAR(6)      NOT NULL UNIQUE,              -- para que el cliente siga su pedido
  tipo_entrega       VARCHAR(8)   NOT NULL CHECK (tipo_entrega IN ('delivery', 'recojo')),
  nombre_contacto    VARCHAR(80)  NOT NULL,
  telefono           CHAR(9)      NOT NULL CHECK (telefono ~ '^9[0-9]{8}$'),
  distrito_id        SMALLINT     REFERENCES distritos_reparto(id),
  direccion          VARCHAR(200),
  referencia         VARCHAR(200),
  creado             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (tipo_entrega = 'recojo' OR (distrito_id IS NOT NULL AND direccion IS NOT NULL))
);

-- =====================================================================
-- 5. PEDIDOS (COMANDAS)
-- =====================================================================

-- Una mesa puede tener varias comandas; al cobrar, las pendientes apuntan al mismo comprobante.
-- REGLA: cocina solo prepara comandas pagadas (comprobante_id NOT NULL).
-- Cada comanda es de una MESA o de un PEDIDO WEB (exactamente uno de los dos)
CREATE TABLE IF NOT EXISTS comandas (
  id                 VARCHAR(20)  PRIMARY KEY,
  mesa_id            SMALLINT     REFERENCES mesas(id),
  pedido_web_id      VARCHAR(20)  UNIQUE REFERENCES pedidos_web(id),
  estado             VARCHAR(12)  NOT NULL REFERENCES estados_comanda(codigo),
  origen             VARCHAR(5)   NOT NULL,
  nota               VARCHAR(200) NOT NULL DEFAULT '',
  creado             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  comprobante_id     VARCHAR(20)  REFERENCES comprobantes(id),  -- NULL = pendiente de pago
  -- no se puede avanzar en cocina sin haber pagado
  CONSTRAINT comanda_pagada_para_cocina CHECK (estado = 'nuevo' OR comprobante_id IS NOT NULL),
  CONSTRAINT comanda_mesa_o_web CHECK (num_nonnulls(mesa_id, pedido_web_id) = 1),
  CONSTRAINT comandas_origen_check CHECK (origen IN ('qr', 'mozo', 'web'))
);
-- Para bases ya creadas con una versión anterior: agrega lo que falte
-- (NOT VALID: no revisa pedidos de prueba antiguos, sí todos los nuevos)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comanda_pagada_para_cocina') THEN
    ALTER TABLE comandas ADD CONSTRAINT comanda_pagada_para_cocina
      CHECK (estado = 'nuevo' OR comprobante_id IS NOT NULL) NOT VALID;
  END IF;
  -- pedidos por internet: la comanda puede no tener mesa
  ALTER TABLE comandas ALTER COLUMN mesa_id DROP NOT NULL;
  ALTER TABLE comandas ADD COLUMN IF NOT EXISTS pedido_web_id VARCHAR(20) UNIQUE REFERENCES pedidos_web(id);
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comanda_mesa_o_web') THEN
    ALTER TABLE comandas ADD CONSTRAINT comanda_mesa_o_web CHECK (num_nonnulls(mesa_id, pedido_web_id) = 1) NOT VALID;
  END IF;
  ALTER TABLE comandas DROP CONSTRAINT IF EXISTS comandas_origen_check;
  ALTER TABLE comandas ADD CONSTRAINT comandas_origen_check CHECK (origen IN ('qr', 'mozo', 'web'));
  ALTER TABLE comprobantes DROP CONSTRAINT IF EXISTS comprobantes_origen_check;
  ALTER TABLE comprobantes ADD CONSTRAINT comprobantes_origen_check CHECK (origen IN ('caja', 'qr', 'web'));
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
-- 7. DATOS DE LOS CATÁLOGOS
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
  ('nuevo', 'Pagado, en cola de cocina', 1), ('preparando', 'En preparación', 2), ('listo', 'Listo', 3),
  ('en_camino', 'En camino (delivery)', 4), ('entregado', 'Entregado', 5)
  ON CONFLICT DO NOTHING;
UPDATE estados_comanda SET orden = 5, descripcion = 'Entregado' WHERE codigo = 'entregado' AND orden = 4;   -- bases anteriores
INSERT INTO estados_comanda (codigo, descripcion, orden) VALUES ('en_camino', 'En camino (delivery)', 4) ON CONFLICT DO NOTHING;
UPDATE estados_comanda SET descripcion = 'Pagado, en cola de cocina' WHERE codigo = 'nuevo';
UPDATE estados_comanda SET descripcion = 'Listo' WHERE codigo = 'listo';
INSERT INTO distritos_reparto (nombre) VALUES ('San Miguel'), ('Magdalena del Mar'), ('Pueblo Libre')
  ON CONFLICT (nombre) DO NOTHING;

-- =====================================================================
-- 8. VISTAS (los importes se calculan, no se guardan)
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
  SELECT DISTINCT ON (comprobante_id) comprobante_id, mesa_id, pedido_web_id FROM comandas
  WHERE comprobante_id IS NOT NULL ORDER BY comprobante_id, creado
)
SELECT c.id, c.serie, c.numero, s.tipo_comprobante, tc.nombre AS tipo_nombre,
       c.serie || '-' || LPAD(c.numero::TEXT, 8, '0') AS numero_completo,
       c.fecha_emision, m.mesa_id, c.origen,
       cl.tipo_documento, td.nombre AS tipo_documento_nombre, cl.numero_documento,
       COALESCE(cl.nombre, 'CLIENTES VARIOS') AS cliente, cl.direccion,
       ROUND(t.total / (1 + c.tasa_igv), 2)          AS op_gravada,
       t.total - ROUND(t.total / (1 + c.tasa_igv), 2) AS igv,
       t.total,
       pw.codigo AS codigo_web, pw.tipo_entrega
FROM comprobantes c
JOIN series s             ON s.serie = c.serie
JOIN tipos_comprobante tc ON tc.codigo = s.tipo_comprobante
JOIN totales t            ON t.comprobante_id = c.id
LEFT JOIN mesa m          ON m.comprobante_id = c.id
LEFT JOIN clientes cl     ON cl.id = c.cliente_id
LEFT JOIN tipos_documento td ON td.codigo = cl.tipo_documento
LEFT JOIN pedidos_web pw  ON pw.id = m.pedido_web_id;

-- Pantalla de cocina: solo comandas pagadas y no entregadas, con minutos desde el pago
CREATE OR REPLACE VIEW v_cocina AS
SELECT co.id, co.mesa_id, co.estado, ec.descripcion AS estado_nombre, co.origen, co.nota,
       cp.fecha_emision AS pagado_en,
       FLOOR(EXTRACT(EPOCH FROM (now() - cp.fecha_emision)) / 60)::INTEGER AS minutos,
       STRING_AGG(ci.cantidad || ' x ' || p.nombre, ', ' ORDER BY p.nombre) AS productos,
       pw.codigo AS codigo_web, pw.tipo_entrega
FROM comandas co
JOIN comprobantes cp    ON cp.id = co.comprobante_id
JOIN estados_comanda ec ON ec.codigo = co.estado
JOIN comanda_items ci   ON ci.comanda_id = co.id
JOIN productos p        ON p.id = ci.producto_id
LEFT JOIN pedidos_web pw ON pw.id = co.pedido_web_id
WHERE co.estado NOT IN ('entregado', 'en_camino')
GROUP BY co.id, ec.descripcion, ec.orden, cp.fecha_emision, pw.codigo, pw.tipo_entrega
ORDER BY ec.orden, cp.fecha_emision;

-- Pedidos por internet activos, con datos de entrega (pestaña Delivery)
CREATE OR REPLACE VIEW v_pedidos_web AS
SELECT pw.codigo, pw.tipo_entrega, pw.nombre_contacto, pw.telefono, d.nombre AS distrito, pw.direccion, pw.referencia,
       co.estado, ec.descripcion AS estado_nombre, pw.creado,
       SUM(ci.cantidad * ci.precio_unitario) AS total
FROM pedidos_web pw
JOIN comandas co        ON co.pedido_web_id = pw.id
JOIN estados_comanda ec ON ec.codigo = co.estado
JOIN comanda_items ci   ON ci.comanda_id = co.id
LEFT JOIN distritos_reparto d ON d.id = pw.distrito_id
GROUP BY pw.id, d.nombre, co.estado, ec.descripcion;

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
-- 9. SEGURIDAD PARA SUPABASE
--  Supabase publica las tablas de "public" en su API REST (clave anon).
--  Se activa RLS y se quitan permisos a anon/authenticated: solo el servidor
--  de la app (dueño de las tablas) accede. En PostgreSQL normal no afecta.
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['tipos_documento', 'tipos_comprobante', 'metodos_pago', 'estados_comanda', 'mesas',
    'categorias', 'productos', 'producto_fotos', 'etiquetas', 'producto_etiquetas', 'clientes', 'series',
    'comprobantes', 'pagos', 'comandas', 'comanda_items', 'solicitudes', 'resenas', 'distritos_reparto', 'pedidos_web'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['v_comprobante_detalle', 'v_comprobantes', 'v_cierre_caja', 'v_carta', 'v_cocina', 'v_pedidos_web'] LOOP
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
ALTER VIEW v_pedidos_web SET (security_invoker = on);
