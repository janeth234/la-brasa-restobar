import { useState, useEffect, useRef } from "react";

/* ALERTAS DEL MOZO
   - "listo":   cocina terminó un pedido pagado -> el mozo debe llevarlo (botón Entregado)
   - "mozo":    una mesa llama al mozo          -> botón Atendido
   - "cuenta":  una mesa pide pagar en caja     -> botón Atendido
   - "nuevo":   una mesa pidió por QR           -> botón Visto (se recuerda en este dispositivo)
   Cuando aparece una alerta nueva: sonido, vibración (celular) y notificación del sistema
   si el mozo las activó con el botón "Activar alertas". */

const leer = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin storage */ } };

let audio = null;
function sonar(urgente) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const notas = urgente ? [880, 1175, 880, 1175] : [660, 880];
    notas.forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      const t = audio.currentTime + i * 0.18;
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + 0.17);
    });
  } catch (e) { /* el navegador no permite sonido */ }
  try { if (navigator.vibrate) navigator.vibrate(urgente ? [250, 120, 250, 120, 250] : [200]); } catch (e) { /* nada */ }
}

function notificar(texto) {
  try {
    if (document.visibilityState === "visible") return;
    if ("Notification" in window && Notification.permission === "granted") new Notification("La Brasa Restobar", { body: texto, tag: texto });
  } catch (e) { /* sin notificaciones */ }
}

export function useAlertasMozo(pos, activo) {
  const [vistos, setVistos] = useState(() => leer("pos_alertas_vistas", []));
  const [sonido, setSonido] = useState(() => leer("pos_alertas_sonido", false));
  const conocidas = useRef(null);   // ids ya avisados (para sonar solo con las nuevas)

  // Armar la lista de alertas a partir de los datos en tiempo real
  const alertas = [
    ...pos.comandas.filter((c) => c.comprobanteId && c.estado === "listo").map((c) => ({
      id: "listo-" + c.id, tipo: "listo", mesa: c.mesa, desde: c.listo || c.pagadoEn || c.creado, urgente: true,
      texto: `Mesa ${c.mesa}: pedido LISTO para servir`, detalle: c.items.map((i) => `${i.cant}× ${i.nombre}`).join(", "),
      accion: "Entregado", hacer: () => pos.cambiarEstado(c.id, "entregado"),
    })),
    ...pos.solicitudes.map((s) => ({
      id: "sol-" + s.id, tipo: s.tipo, mesa: s.mesa, desde: s.creado, urgente: s.tipo === "mozo",
      texto: s.tipo === "cuenta" ? `Mesa ${s.mesa} quiere pagar en caja` : `Mesa ${s.mesa} llama al mozo`,
      detalle: s.tipo === "cuenta" && s.datos ? (s.datos.tipo === "factura" ? "Pide factura" : "Pide boleta") : "",
      accion: "Atendido", hacer: () => pos.atender(s.id),
    })),
    ...pos.comandas.filter((c) => c.origen === "qr" && !c.comprobanteId && !vistos.includes(c.id)).map((c) => ({
      id: "nuevo-" + c.id, tipo: "nuevo", mesa: c.mesa, desde: c.creado, urgente: false,
      texto: `Mesa ${c.mesa}: nuevo pedido por QR (pendiente de pago)`, detalle: c.items.map((i) => `${i.cant}× ${i.nombre}`).join(", "),
      accion: "Visto", hacer: () => setVistos((v) => { const n = [...v, c.id].slice(-200); guardar("pos_alertas_vistas", n); return n; }),
    })),
  ].sort((a, b) => new Date(a.desde) - new Date(b.desde));

  // Sonar / vibrar / notificar cuando aparece una alerta que no estaba antes
  const ids = alertas.map((a) => a.id).join("|");
  useEffect(() => {
    if (!activo) return;
    const actuales = new Set(alertas.map((a) => a.id));
    if (conocidas.current === null) { conocidas.current = actuales; return; }   // al abrir no suena lo que ya había
    const nuevas = alertas.filter((a) => !conocidas.current.has(a.id));
    conocidas.current = actuales;
    if (!nuevas.length) return;
    if (sonido) sonar(nuevas.some((a) => a.urgente));
    nuevas.forEach((a) => notificar(a.texto));
  }, [ids, activo]);

  // Título de la pestaña con el número de alertas (se ve aunque esté en otra pestaña)
  useEffect(() => {
    if (!activo) return undefined;
    const base = "La Brasa Restobar";
    document.title = alertas.length ? `(${alertas.length}) ${base}` : base;
    return () => { document.title = base; };
  }, [alertas.length, activo]);

  const activarSonido = async () => {
    setSonido(true); guardar("pos_alertas_sonido", true);
    sonar(false);   // el navegador exige un toque del usuario para permitir sonido
    try { if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission(); } catch (e) { /* nada */ }
  };
  const desactivarSonido = () => { setSonido(false); guardar("pos_alertas_sonido", false); };

  // Tras recargar la página, el primer toque en cualquier parte vuelve a habilitar el audio
  useEffect(() => {
    if (!sonido) return undefined;
    const desbloquear = () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) { /* nada */ } };
    window.addEventListener("pointerdown", desbloquear, { once: true });
    return () => window.removeEventListener("pointerdown", desbloquear);
  }, [sonido]);

  return { alertas, sonido, activarSonido, desactivarSonido, probar: () => sonar(true) };
}
