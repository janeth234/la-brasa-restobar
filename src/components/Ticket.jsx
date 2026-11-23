import React, { useState } from "react";
import { EMISOR, IGV } from "../data.js";
import { fechaHora } from "../utils.js";

/* Representación impresa del comprobante (formato ticket 80 mm) */
export function TicketPapel({ comp }) {
  const titulo = comp.tipo === "factura" ? "FACTURA ELECTRÓNICA" : "BOLETA DE VENTA ELECTRÓNICA";
  return (
    <div className="ticket">
      <p className="c"><b>{EMISOR.razonSocial}</b></p>
      <p className="c">RUC: {EMISOR.ruc}</p>
      <p className="c">{EMISOR.direccion}</p>
      <p className="c">Tel. {EMISOR.telefono}</p>
      <hr />
      <p className="c"><b>{titulo}</b></p>
      <p className="c"><b>{comp.serie}-{comp.numero}</b></p>
      <hr />
      <p>Fecha: {fechaHora(comp.fecha)}</p>
      {comp.web
        ? <p>Pedido web: #{comp.web.codigo} ({comp.web.tipo === "delivery" ? "delivery" : "recojo"})</p>
        : <p>Mesa: {comp.mesa}</p>}
      <p>{comp.cliente.tipoDoc === "RUC" ? "RUC" : "DNI"}: {comp.cliente.doc}</p>
      <p>{comp.tipo === "factura" ? "Razón social" : "Cliente"}: {comp.cliente.nombre}</p>
      {comp.cliente.direccion && <p>Dirección: {comp.cliente.direccion}</p>}
      <hr />
      {comp.items.map((i) => (
        <div key={i.id} className="fila"><span>{i.cant} {i.nombre}</span><span>{(i.precio * i.cant).toFixed(2)}</span></div>
      ))}
      <hr />
      <div className="fila"><span>OP. GRAVADA</span><span>{comp.gravada.toFixed(2)}</span></div>
      <div className="fila"><span>IGV {IGV * 100}%</span><span>{comp.igv.toFixed(2)}</span></div>
      <div className="fila grande"><span>TOTAL S/</span><span>{comp.total.toFixed(2)}</span></div>
      <p className="letras">{comp.letras}</p>
      <hr />
      <div className="fila"><span>Pago: {comp.pago.metodo}</span><span>{comp.pago.recibido.toFixed(2)}</span></div>
      {comp.pago.vuelto > 0 && <div className="fila"><span>Vuelto</span><span>{comp.pago.vuelto.toFixed(2)}</span></div>}
      {comp.pago.operacion && <p>N° operación: {comp.pago.operacion}</p>}
      <hr />
      <p className="c peq">Representación impresa del comprobante electrónico.</p>
      <p className="c peq">¡Gracias por su preferencia!</p>
    </div>
  );
}

export default function ModalTicket({ comp, onCerrar }) {
  const [msg, setMsg] = useState("");
  const imprimir = () => {
    try { window.print(); } catch (e) { setMsg("La impresión no está disponible en esta vista."); }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Comprobante">
      <div className="modal-caja">
        <TicketPapel comp={comp} />
        <div className="modal-acciones no-print">
          <button className="btn primario" onClick={imprimir}>Imprimir</button>
          <button className="btn" onClick={onCerrar}>Cerrar</button>
        </div>
        {msg && <p className="err no-print">{msg}</p>}
      </div>
    </div>
  );
}
