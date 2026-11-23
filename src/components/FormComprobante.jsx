import React from "react";
import { LIMITE_DNI } from "../data.js";
import { validarRUC } from "../utils.js";

/* Selector Boleta / Factura + campos del cliente.
   datos = { tipo, doc, nombre, direccion }  — lo usan la Caja y el celular del cliente */
export default function FormComprobante({ datos, onChange, total }) {
  const set = (campo, valor) => onChange({ ...datos, [campo]: valor });
  const esFactura = datos.tipo === "factura";
  return (
    <div className="form-comp">
      <div className="segmento" role="group" aria-label="Tipo de comprobante">
        <button type="button" className={!esFactura ? "on" : ""} onClick={() => onChange({ ...datos, tipo: "boleta", doc: "" })}>Boleta</button>
        <button type="button" className={esFactura ? "on" : ""} onClick={() => onChange({ ...datos, tipo: "factura", doc: "" })}>Factura (RUC)</button>
      </div>

      <label className="campo">
        <span>{esFactura ? "RUC *" : `DNI ${total > LIMITE_DNI ? "*" : "(opcional)"}`}</span>
        <input inputMode="numeric" maxLength={esFactura ? 11 : 8} value={datos.doc}
          onChange={(e) => set("doc", e.target.value.replace(/\D/g, ""))}
          placeholder={esFactura ? "20XXXXXXXXX" : "8 dígitos"} />
        {esFactura && datos.doc.length === 11 && (
          <small className={validarRUC(datos.doc) ? "ok" : "err"}>
            {validarRUC(datos.doc) ? "RUC válido" : "Dígito verificador incorrecto"}
          </small>
        )}
      </label>
      <label className="campo">
        <span>{esFactura ? "Razón social *" : "Nombre (opcional)"}</span>
        <input value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} />
      </label>
      {esFactura && (
        <label className="campo">
          <span>Dirección fiscal *</span>
          <input value={datos.direccion} onChange={(e) => set("direccion", e.target.value)} />
        </label>
      )}
    </div>
  );
}

export const DATOS_VACIOS = { tipo: "boleta", doc: "", nombre: "", direccion: "" };
