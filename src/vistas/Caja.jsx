import React, { useState, useEffect } from "react";
import { IGV, METODOS } from "../data.js";
import { soles, r2, calcularTotales, consolidar, validarCliente, armarCliente } from "../utils.js";
import FormComprobante, { DATOS_VACIOS } from "../components/FormComprobante.jsx";

/* Caja: cobra las cuentas abiertas y emite boleta o factura */
export default function VistaCaja({ pos, onEmitido }) {
  const abiertas = pos.comandas.filter((c) => c.estado !== "pagado");
  const mesas = [...new Set(abiertas.map((c) => c.mesa))];
  const [mesa, setMesa] = useState(null);
  const [datos, setDatos] = useState(DATOS_VACIOS);
  const [metodo, setMetodo] = useState("Efectivo");
  const [recibido, setRecibido] = useState("");
  const [error, setError] = useState("");

  const actual = mesa && mesas.includes(mesa) ? mesa : mesas[0] || null;
  const delaMesa = abiertas.filter((c) => c.mesa === actual);
  const items = consolidar(delaMesa);
  const tot = calcularTotales(items);
  const enCocina = delaMesa.some((c) => c.estado === "nuevo" || c.estado === "preparando");
  const vuelto = metodo === "Efectivo" && recibido ? r2(Number(recibido) - tot.total) : 0;
  const pideCuenta = pos.solicitudes.find((s) => s.mesa === actual && s.tipo === "cuenta");

  // si el cliente pidió la cuenta desde su celular, sus datos (DNI/RUC) llegan llenos
  useEffect(() => {
    setDatos(pideCuenta && pideCuenta.datos ? pideCuenta.datos : DATOS_VACIOS);
    setRecibido(""); setError("");
  }, [actual, pideCuenta ? pideCuenta.id : ""]);

  const [enviando, setEnviando] = useState(false);
  const cobrar = async () => {
    const err = validarCliente(datos, tot.total);
    if (err) return setError(err);
    if (metodo === "Efectivo" && recibido && Number(recibido) < tot.total)
      return setError("El monto recibido es menor al total.");
    setEnviando(true);
    try {
      const comp = await pos.emitir({
        mesa: actual, tipo: datos.tipo, origen: "caja",
        datosCliente: datos, cliente: armarCliente(datos),
        pago: { metodo, recibido: metodo === "Efectivo" ? Number(recibido || tot.total) : tot.total, vuelto: Math.max(vuelto, 0) },
      });
      setMesa(null);
      onEmitido(comp);
    } catch (e) {
      setError(e.message);
    }
    setEnviando(false);
  };

  if (!mesas.length)
    return (
      <section className="panel">
        <h2>Caja</h2>
        <p className="vacio">No hay cuentas abiertas. Los pedidos del mozo o del QR aparecerán aquí.</p>
      </section>
    );

  return (
    <div className="grid-caja">
      <section className="panel">
        <h2>Cuentas abiertas</h2>
        <div className="cuentas">
          {mesas.map((m) => {
            const t = calcularTotales(consolidar(abiertas.filter((c) => c.mesa === m))).total;
            const pide = pos.solicitudes.some((s) => s.mesa === m && s.tipo === "cuenta");
            return (
              <button key={m} className={"cuenta" + (m === actual ? " sel" : "") + (pide ? " pide" : "")} onClick={() => setMesa(m)}>
                <span>Mesa {m}{pide ? " · pide cuenta" : ""}</span><b>{soles(t)}</b>
              </button>
            );
          })}
        </div>

        <h2>Detalle · Mesa {actual}</h2>
        {enCocina && <p className="alerta">Hay platos que aún se están preparando en cocina.</p>}
        <table className="detalle">
          <thead><tr><th>Cant.</th><th>Descripción</th><th className="num">P. unit.</th><th className="num">Importe</th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}><td>{i.cant}</td><td>{i.nombre}</td><td className="num">{soles(i.precio)}</td><td className="num">{soles(i.precio * i.cant)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="totales">
          <dt>Op. gravada</dt><dd>{soles(tot.gravada)}</dd>
          <dt>IGV ({IGV * 100}%)</dt><dd>{soles(tot.igv)}</dd>
          <dt className="grande">Total</dt><dd className="grande">{soles(tot.total)}</dd>
        </dl>
      </section>

      <aside className="panel cobro">
        <h2>Comprobante</h2>
        {pideCuenta && pideCuenta.datos && <p className="ok">Datos enviados por el cliente desde su celular.</p>}
        <FormComprobante datos={datos} onChange={(d) => { setDatos(d); setError(""); }} total={tot.total} />

        <h2>Pago</h2>
        <div className="chips">
          {METODOS.map((m) => (
            <button key={m} className={m === metodo ? "chip on" : "chip"} onClick={() => setMetodo(m)}>{m}</button>
          ))}
        </div>
        {metodo === "Efectivo" && (
          <label className="campo">
            <span>Monto recibido</span>
            <input inputMode="decimal" value={recibido} onChange={(e) => setRecibido(e.target.value.replace(/[^\d.]/g, ""))} placeholder={tot.total.toFixed(2)} />
            {recibido && <small className={vuelto >= 0 ? "ok" : "err"}>Vuelto: {soles(Math.max(vuelto, 0))}</small>}
          </label>
        )}

        {error && <p className="err">{error}</p>}
        <button className="btn primario" disabled={enviando} onClick={cobrar}>
          Cobrar {soles(tot.total)} y emitir {datos.tipo}
        </button>
      </aside>
    </div>
  );
}
