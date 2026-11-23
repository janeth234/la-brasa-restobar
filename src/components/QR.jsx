import React, { useMemo } from "react";
import { qrSVG } from "../qr.js";

/* Código QR dibujado en SVG con el generador propio (src/qr.js), sin internet */
export default function QR({ texto, size = 160 }) {
  const svg = useMemo(() => {
    try { return qrSVG(texto); } catch (e) { return ""; }
  }, [texto]);
  if (!svg) return <div className="qr-falla" style={{ width: size, height: size }}>Dirección muy larga</div>;
  return <div className="qr" style={{ width: size, height: size }} role="img" aria-label={`Código QR: ${texto}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
