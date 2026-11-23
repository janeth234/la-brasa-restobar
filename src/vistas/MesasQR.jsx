import React, { useState, useEffect } from "react";
import { MESAS, EMISOR } from "../data.js";
import QR from "../components/QR.jsx";

/* Un QR por mesa. Al escanearlo, el celular abre la web en  <dirección>/#mesa-7
   - publicada en internet (Render): https://tu-restobar.onrender.com/  (se toma sola)
   - en la misma red Wi-Fi: http://192.168.x.x:3000/  (el servidor la detecta sola) */
export default function VistaMesasQR({ modo }) {
  const [base, setBase] = useState(() => {
    try { return localStorage.getItem("pos_qr_base") || ""; } catch (e) { return ""; }
  });
  const [detectada, setDetectada] = useState(window.location.href.split("#")[0]);

  useEffect(() => {
    // Publicada en internet: se usa la dirección actual. En localhost: la IP de la red Wi-Fi.
    if (modo !== "servidor" || !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return;
    fetch("/api/info").then((r) => r.json()).then((i) => setDetectada(i.url)).catch(() => {});
  }, [modo]);

  const url = (base.trim() || detectada).replace(/#.*$/, "");
  const final = url.endsWith("/") ? url : url + "/";
  const esLocal = /localhost|127\.0\.0\.1|^file:/.test(final);
  const [aviso, setAviso] = useState("");
  const imprimir = () => {
    document.body.classList.add("imprimir-qr");
    try { window.print(); } catch (e) { setAviso("La impresión no está disponible en esta vista."); }
    setTimeout(() => document.body.classList.remove("imprimir-qr"), 500);
  };
  const guardar = (v) => { setBase(v); try { localStorage.setItem("pos_qr_base", v); } catch (e) { /* nada */ } };

  return (
    <section className="panel">
      <h2>Códigos QR de las mesas</h2>
      <button className="btn no-print" onClick={imprimir}>Imprimir los QR</button>
      {aviso && <p className="err">{aviso}</p>}
      <label className="campo qr-url">
        <span>Dirección web que abrirán los QR</span>
        <input value={base} onChange={(e) => guardar(e.target.value)} placeholder={detectada} />
      </label>
      {modo !== "servidor" && (
        <p className="alerta">
          Modo demo: no hay servidor, así que un celular no podrá conectarse. Ejecuta <code>npm start</code> (ver README)
          y abre esta pantalla desde la dirección que muestra la terminal.
        </p>
      )}
      {modo === "servidor" && esLocal && (
        <p className="alerta">“localhost” solo funciona en esta computadora. Abre el sistema con la IP de la red ({detectada}) o escribe tu dirección pública.</p>
      )}
      {modo === "servidor" && !esLocal && (
        <p className="ok">
          {/^https:/.test(final) ? "Listo: cualquier celular con internet puede escanear y pedir." : "Listo: conecta el celular al mismo Wi-Fi y escanea."} Lo que pida llega a Cocina y Caja al instante.
        </p>
      )}
      <div className="qrs">
        <article className="qr-card general">
          <p className="qr-nombre">{EMISOR.nombreComercial}</p>
          <QR texto={`${final}#carta`} size={150} />
          <p className="qr-mesa">Nuestra carta</p>
          <p className="qr-sub">Para la entrada o el mostrador: el cliente elige su mesa y pide</p>
          <a className="btn chico no-print" href="#carta">Abrir como cliente</a>
        </article>
        {MESAS.map((m) => (
          <article key={m} className="qr-card">
            <p className="qr-nombre">{EMISOR.nombreComercial}</p>
            <QR texto={`${final}#mesa-${m}`} size={150} />
            <p className="qr-mesa">Mesa {m}</p>
            <p className="qr-sub">Escanea, pide y paga desde tu celular</p>
            <a className="btn chico no-print" href={`#mesa-${m}`}>Abrir como cliente</a>
          </article>
        ))}
      </div>
    </section>
  );
}
