/* Generador de códigos QR propio (sin librerías ni internet).
   Modo byte (UTF-8), corrección de errores nivel M, versiones 1 a 10 (hasta ~180 caracteres).
   generarQR("https://...") -> matriz de booleanos (true = módulo negro) */

const ECC_POR_BLOQUE = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];  // nivel M, versiones 1..10
const NUM_BLOQUES = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

function modulosDeDatos(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const codewordsDeDatos = (ver) =>
  Math.floor(modulosDeDatos(ver) / 8) - ECC_POR_BLOQUE[ver - 1] * NUM_BLOQUES[ver - 1];

/* ---- Reed-Solomon en GF(256) ---- */
function mul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function divisorRS(grado) {
  const r = new Array(grado).fill(0);
  r[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = mul(r[j], raiz);
      if (j + 1 < r.length) r[j] ^= r[j + 1];
    }
    raiz = mul(raiz, 0x02);
  }
  return r;
}
function restoRS(datos, divisor) {
  const r = new Array(divisor.length).fill(0);
  for (const b of datos) {
    const f = b ^ r.shift();
    r.push(0);
    divisor.forEach((d, i) => { r[i] ^= mul(d, f); });
  }
  return r;
}

export function generarQR(texto) {
  const bytes = Array.from(new TextEncoder().encode(texto));

  // 1. Elegir la versión más pequeña donde entra el texto
  let ver = 1;
  const bitsNecesarios = (v) => 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
  while (ver <= 10 && bitsNecesarios(ver) > codewordsDeDatos(ver) * 8) ver++;
  if (ver > 10) throw new Error("Texto demasiado largo para el QR");

  // 2. Armar la cadena de bits: modo byte + longitud + datos + relleno
  const bits = [];
  const poner = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  poner(0b0100, 4);
  poner(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => poner(b, 8));
  const capacidad = codewordsDeDatos(ver) * 8;
  poner(0, Math.min(4, capacidad - bits.length));
  poner(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacidad; pad ^= 0xec ^ 0x11) poner(pad, 8);
  const datos = [];
  for (let i = 0; i < bits.length; i += 8) datos.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  // 3. Dividir en bloques, agregar corrección de errores e intercalar
  const nb = NUM_BLOQUES[ver - 1], eccLen = ECC_POR_BLOQUE[ver - 1];
  const crudos = Math.floor(modulosDeDatos(ver) / 8);
  const cortos = nb - (crudos % nb), largoCorto = Math.floor(crudos / nb);
  const div = divisorRS(eccLen);
  const bloques = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = datos.slice(k, k + largoCorto - eccLen + (i < cortos ? 0 : 1));
    k += dat.length;
    const ecc = restoRS(dat, div);
    if (i < cortos) dat.push(0);
    bloques.push(dat.concat(ecc));
  }
  const final = [];
  for (let i = 0; i < bloques[0].length; i++)
    bloques.forEach((b, j) => { if (i !== largoCorto - eccLen || j >= cortos) final.push(b[i]); });

  // 4. Dibujar patrones fijos
  const n = ver * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(false));
  const fijo = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (x, y, v) => { m[y][x] = v; fijo[y][x] = true; };
  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const buscador = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4);
    }
  };
  buscador(3, 3); buscador(n - 4, 3); buscador(3, n - 4);
  if (ver > 1) {
    const na = Math.floor(ver / 7) + 2;
    const paso = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
    const pos = [6];
    for (let p = n - 7; pos.length < na; p -= paso) pos.splice(1, 0, p);
    pos.forEach((y, i) => pos.forEach((x, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
        set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
  }
  const formato = (mascara) => {
    const d = (0 << 3) | mascara;          // nivel M = 00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412;
    const bit = (i) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(i));
    set(8, n - 8, true);
  };
  formato(0);
  if (ver >= 7) {
    let r = ver;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (ver << 12) | r;
    for (let i = 0; i < 18; i++) {
      const v = ((b >>> i) & 1) === 1, a = n - 11 + (i % 3), c = Math.floor(i / 3);
      set(a, c, v); set(c, a, v);
    }
  }

  // 5. Colocar los datos en zigzag
  let i = 0;
  for (let der = n - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5;
    for (let v = 0; v < n; v++) for (let j = 0; j < 2; j++) {
      const x = der - j, arriba = ((der + 1) & 2) === 0, y = arriba ? n - 1 - v : v;
      if (!fijo[y][x] && i < final.length * 8) {
        m[y][x] = ((final[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }

  // 6. Probar las 8 máscaras y quedarse con la de menor penalidad
  const condicion = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const aplicarMascara = (k) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++)
      if (!fijo[y][x] && condicion[k](x, y)) m[y][x] = !m[y][x];
  };
  const penalidad = () => {
    let p = 0, oscuros = 0;
    for (let a = 0; a < n; a++) {
      let rf = 1, rc = 1;
      for (let b = 1; b < n; b++) {
        if (m[a][b] === m[a][b - 1]) { rf++; if (rf === 5) p += 3; else if (rf > 5) p++; } else rf = 1;
        if (m[b][a] === m[b - 1][a]) { rc++; if (rc === 5) p += 3; else if (rc > 5) p++; } else rc = 1;
      }
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (m[y][x]) oscuros++;
      if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
    return p + Math.floor(Math.abs(oscuros * 20 - n * n * 10) / (n * n)) * 10;
  };
  let mejor = 0, minimo = Infinity;
  for (let k = 0; k < 8; k++) {
    aplicarMascara(k); formato(k);
    const p = penalidad();
    if (p < minimo) { minimo = p; mejor = k; }
    aplicarMascara(k);                       // deshacer (XOR)
  }
  aplicarMascara(mejor); formato(mejor);
  return m;
}

// Devuelve el QR como texto SVG (con margen blanco de 4 módulos)
export function qrSVG(texto, color = "#000") {
  const m = generarQR(texto), n = m.length, t = n + 8;
  let d = "";
  m.forEach((fila, y) => fila.forEach((v, x) => { if (v) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`;
}
