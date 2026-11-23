# La Brasa Restobar — POS web con carta QR (React + Node + Supabase/PostgreSQL)

Sistema web para restobar (hamburguesas, salchipapas, alitas, parrillas, gaseosas y refrescos):
el cliente escanea el QR de su mesa **con cualquier celular**, ve la carta con fotos, pide y paga;
el pedido llega a cocina y la caja emite **boleta o factura (RUC)**. Todo se guarda en **Supabase (PostgreSQL)**.

## Módulos
| Vista | Quién | Qué hace |
|---|---|---|
| **Bot** (botón "¿Te ayudo?") | Cliente | Chat que recomienda, **toma pedidos escritos** ("2 royal y una Inca Kola grande"), dice el estado del pedido y la cuenta, responde horario/delivery/pagos y llama al mozo. Con **Ollama** conversa con IA. |
| **Cliente** `#mesa-7` | Cliente (sin clave) | Carta con fotos, bot, pedido, seguimiento, llamar al mozo, boleta/factura, pago desde el celular o en caja, calificación. Solo ve SU mesa. |
| **QR general** `#carta` | Cliente | El cliente elige su mesa y ve la carta. |
| **Mozo** | Personal | Toma pedidos y ve los avisos de las mesas. |
| **Cocina** | Personal | Pantalla oscura con cronómetro por comanda. |
| **Caja** | Personal | Cobra, valida RUC/DNI, calcula vuelto, emite B001/F001. |
| **Comprobantes** | Personal | Historial, cierre de caja y reseñas. |
| **Carta** | Personal | Agregar/editar productos, precios, "agotado" y **subir fotos reales**. |
| **Mesas y QR** | Personal | QR por mesa + QR general, listos para imprimir. |

Las vistas del personal piden la **clave del personal** (variable `CLAVE_PERSONAL`).

---

## 1. Probar en tu computadora
```bash
npm install
npm run build
npm start
```
Abre http://localhost:3000 (clave por defecto: `1234`). Sin `DATABASE_URL` los datos se guardan en
`server/datos.json`, útil solo para practicar.

Con Supabase (o PostgreSQL en tu PC) desde Windows PowerShell:
```powershell
$env:DATABASE_URL="postgresql://postgres.abcdefghijk:TU_CLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres"; $env:CLAVE_PERSONAL="mi-clave"; npm start
```
Las tablas se crean solas al arrancar (`server/schema.sql`) y se carga la carta inicial.

---

## 2. Publicar en internet (para que abra cualquier celular)

### Paso A — Base de datos en Supabase
1. Entra a tu proyecto en https://supabase.com y pulsa **Connect** (arriba).
2. Elige **Session pooler** (no "Direct connection": Render no se conecta por IPv6) y copia la cadena. Se ve así:
   `postgresql://postgres.abcdefghijk:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres`
3. Reemplaza `[YOUR-PASSWORD]` por la contraseña de la base de datos (Project Settings → Database).
   Si la contraseña tiene símbolos como `@ # / ?`, cámbiala por una solo con letras y números, o la conexión fallará.
4. No crees tablas a mano: el servidor las crea solo al arrancar (`server/schema.sql`) y carga la carta.
   Después las verás en **Table Editor**: productos, comandas, comprobantes, etc.

Seguridad: Supabase publica las tablas de `public` en su API REST con la clave `anon`. El esquema activa
**RLS** y quita los permisos de `anon` y `authenticated` en todas las tablas, así nadie puede leer comprobantes
ni datos de clientes con esa clave; solo el servidor de la app accede (se conecta como dueño de las tablas).

(Alternativa: Neon, https://neon.com, también funciona; pegas su cadena de conexión igual.)

### Paso B — Subir el código a GitHub
1. Crea un repositorio en https://github.com (puede ser privado).
2. Sube **todo el contenido de esta carpeta** (sin `node_modules` ni `dist`).

### Paso C — Servidor web en Render
1. Crea una cuenta en https://render.com → **New → Web Service** → conecta tu repositorio.
2. Configura:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Region:** la más cercana a la región de tu proyecto Supabase (si Supabase está en *US East*, elige *Virginia*)
   - **Instance type:** Free
3. En **Environment** agrega:
   - `DATABASE_URL` = la cadena **Session pooler** de Supabase (paso A)
   - `CLAVE_PERSONAL` = una clave para el personal (no uses 1234)
4. **Deploy**. Render te da una dirección como `https://la-brasa-restobar.onrender.com`.

(También puedes usar **New → Blueprint**: el archivo `render.yaml` ya trae esta configuración.)

### Paso D — Dejarlo listo
1. Abre tu dirección de Render, entra con la clave.
2. **Carta** → sube la foto de cada producto (desde el celular puedes tomarla con la cámara).
3. **Mesas y QR** → los QR ya usan tu dirección `https://…onrender.com` → **Imprimir los QR**.
4. Escanea un QR con cualquier celular (con datos móviles o cualquier Wi-Fi): se abre la carta de esa mesa.

### Cosas a saber del plan gratuito
- **Render Free se duerme** tras 15 minutos sin visitas; la siguiente visita tarda ~1 minuto en despertar.
  Para un restobar real conviene el plan pagado (Starter), que no se duerme.
- Render borra los archivos del servidor en cada reinicio; por eso **las fotos se guardan en la base de datos**.
- Supabase Free: el proyecto se pausa si pasa una semana sin uso; lo reactivas desde su panel.
  La base de datos alcanza para miles de comprobantes y las fotos de la carta (cada foto ≈ 60–120 KB).

### Fotos de los productos
Usa fotos propias de tus platos. Si usas fotos de bancos gratuitos (Pexels, Unsplash), revisa su licencia;
no uses fotos de otros restaurantes o marcas sin permiso. La app las achica a 800 px automáticamente.

---

## Bot con IA (Ollama)
El bot funciona de dos formas a la vez:
- **Reglas** (`src/bot.js`): pedidos escritos, cuenta, estado del pedido, precios, horario, delivery, pagos y mozo.
  Son respuestas exactas e instantáneas, y funcionan aunque no haya IA.
- **Ollama** (`server/ollama.js`): recomendaciones y conversación libre ("¿cuál es más picante?", "¿qué lleva la royal?").
  El servidor le envía la carta disponible, los datos del local y el pedido de la mesa, y valida su respuesta
  (solo puede recomendar productos que existen y están disponibles). Si Ollama no responde, el bot sigue con las reglas.

Los datos que responde el bot (horario, delivery, Wi-Fi, promociones) están en `NEGOCIO`, dentro de `src/data.js`.

### Opción 1 — Ollama en tu computadora (gratis)
1. Instala Ollama desde https://ollama.com/download
2. Descarga un modelo:  `ollama pull llama3.2`  (≈2 GB; con más memoria prueba `qwen2.5:7b`, que va mejor en español)
3. Ejecuta `npm start`. La terminal dirá **"Bot con IA: Ollama (llama3.2)"**. No hace falta configurar nada más.
   Para usar otro modelo: `$env:OLLAMA_MODELO="qwen2.5:7b"; npm start`

### Opción 2 — Ollama Cloud (para la web publicada en Render)
Render no puede ejecutar Ollama, pero sí puede usar los modelos de Ollama en la nube:
1. Crea una cuenta en https://ollama.com y una API key en https://ollama.com/settings/keys
2. En Render → Environment agrega:
   - `OLLAMA_URL` = `https://ollama.com`
   - `OLLAMA_API_KEY` = tu API key
   - `OLLAMA_MODELO` = un modelo de la nube, por ejemplo `gpt-oss:120b`
3. Revisa en ollama.com los límites y costos de su plan antes de abrirlo al público.

(Otra opción: dejar el servidor en una PC del local con Ollama y publicarlo con un túnel como Cloudflare Tunnel.)

## Base de datos (PostgreSQL / Supabase, 3FN)
18 tablas en **Tercera Forma Normal** + 4 vistas que calculan los importes. Diagrama entidad-relación,
diccionario de datos y justificación de 1FN, 2FN y 3FN en **[BASE_DE_DATOS.md](BASE_DE_DATOS.md)**.

- `server/schema.sql`: tablas, catálogos SUNAT, vistas y seguridad.
- `server/datos_iniciales.sql`: mesas, categorías y carta.

El servidor ejecuta ambos al arrancar. También puedes pegarlos en Supabase → SQL Editor.
Cada acción se guarda en una **transacción**, y la numeración de comprobantes se procesa en cola para que no se repita.

## Seguridad
- Clientes: sin clave, solo ven la carta y su mesa; solo pueden pedir, avisar, pagar y calificar **su** mesa.
- Precios: el servidor toma el precio de la base de datos, nunca del celular.
- Personal: todas las demás vistas y acciones exigen `CLAVE_PERSONAL`.

## Estructura
```
server/
  server.js        API, tiempo real (SSE), fotos, clave del personal; sirve la web
  db.js            PostgreSQL (DATABASE_URL) o archivo JSON de respaldo
  ollama.js        conexión del bot con Ollama (local o Ollama Cloud)
  schema.sql       tablas en 3FN, vistas y seguridad
  datos_iniciales.sql  carta, categorías y mesas (generado con scripts/generar-datos-iniciales.mjs)
src/
  data.js          datos del negocio, IGV, mesas y carta inicial  ← edita aquí
  logica.js        reglas del negocio (las usa el servidor y el modo demo)
  usePOS.js        conexión con el servidor en tiempo real
  bot.js           bot por reglas: pedidos escritos, cuenta, estado, info del local
  utils.js         RUC/DNI, totales, monto en letras, recomendaciones
  qr.js            generador de códigos QR propio
  components/      Bot, Plato (foto o dibujo), FormComprobante, Ticket, QR
  vistas/          Cliente, Mozo, Cocina, Caja, Historial, Productos, MesasQR
render.yaml        configuración para Render
```

## Limitaciones y siguiente paso
- **SUNAT:** se genera la representación impresa. Para validez legal, el servidor debe enviar el XML firmado
  a un OSE/PSE (p. ej. Nubefact) en la acción `emitir` y guardar el CDR.
- **Pagos:** el pago desde el celular está simulado; en producción se integra una pasarela (Niubiz, Culqi, Izipay, Mercado Pago).
- **Clave única:** todo el personal comparte una clave; el siguiente paso sería usuarios con roles (cajero, cocinero, administrador).
