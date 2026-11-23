import React, { useState } from "react";
import { FORMAS } from "../data.js";
import { soles, categoriasDe } from "../utils.js";
import Plato from "../components/Plato.jsx";

const VACIO = { id: "", cat: "", nombre: "", precio: "", desc: "", disponible: true, tags: "", arte: null, foto: null };

// Achica la foto antes de subirla (máx. 800 px, JPEG) para que la carta cargue rápido en el celular
function reducirImagen(archivo, max = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen.")); };
    img.src = url;
  });
}

/* Pestaña "Carta": productos, precios, disponibilidad y fotos reales */
export default function VistaProductos({ pos }) {
  const categorias = categoriasDe(pos.productos);
  const [form, setForm] = useState(null);          // producto en edición
  const [fotoNueva, setFotoNueva] = useState(null); // dataURL pendiente de subir
  const [quitar, setQuitar] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [borrar, setBorrar] = useState(null);
  const [aviso, setAviso] = useState("");

  const abrir = (p) => {
    setForm(p ? { ...p, tags: (p.tags || []).join(", ") } : { ...VACIO, cat: categorias[0] || "" });
    setFotoNueva(null); setQuitar(false); setError("");
  };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(""), 2500); };

  const elegirFoto = async (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;
    try { setFotoNueva(await reducirImagen(archivo)); setQuitar(false); setError(""); } catch (err) { setError(err.message); }
  };

  const guardar = async () => {
    setError(""); setGuardando(true);
    try {
      const datos = { ...form, arte: form.arte || { forma: "hamburguesa", c: ["#7a3b22", "#7cc35a", "#e04b3a"] } };
      const p = await pos.guardarProducto(datos);
      if (fotoNueva) await pos.subirFoto(p.id, fotoNueva);
      else if (quitar && form.foto) await pos.quitarFoto(p.id);
      setForm(null);
      avisar(`“${p.nombre}” guardado`);
    } catch (err) {
      setError(err.message);
    }
    setGuardando(false);
  };

  const alternar = async (p) => {
    try { await pos.guardarProducto({ ...p, disponible: !p.disponible }); } catch (err) { avisar(err.message); }
  };

  const fotoVista = quitar ? null : fotoNueva || (form && form.foto);
  const conFoto = pos.productos.filter((p) => p.foto).length;

  return (
    <div className="grid-caja">
      <section className="panel">
        <div className="fila-titulo">
          <h2>Carta · {pos.productos.length} productos · {conFoto} con foto</h2>
          <button className="btn primario corto" onClick={() => abrir(null)}>Agregar producto</button>
        </div>
        {aviso && <p className="ok">{aviso}</p>}
        {categorias.map((c) => (
          <div key={c} className="grupo-productos">
            <h3>{c}</h3>
            <ul className="lista-productos">
              {pos.productos.filter((p) => p.cat === c).map((p) => (
                <li key={p.id} className={p.disponible ? "" : "agotado"}>
                  <Plato arte={p.arte} foto={p.foto} size={56} />
                  <span className="lp-txt"><b>{p.nombre}</b><small>{p.foto ? "Con foto" : "Sin foto (se ve el dibujo)"}</small></span>
                  <span className="num">{soles(p.precio)}</span>
                  <button className={"interruptor" + (p.disponible ? " on" : "")} onClick={() => alternar(p)}
                    aria-pressed={p.disponible} title="Disponible en la carta">
                    {p.disponible ? "Disponible" : "Agotado"}
                  </button>
                  <button className="btn chico" onClick={() => abrir(p)}>Editar</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <aside className="panel cobro">
        {!form ? (
          <>
            <h2>Fotos reales de los productos</h2>
            <p className="vacio">
              Toca “Editar” en un producto y sube su foto. Desde el celular puedes tomarla con la cámara.
              Las fotos se achican solas y se guardan en la base de datos.
            </p>
            <p className="vacio">Consejo: foto cuadrada, de cerca, con buena luz y fondo limpio.</p>
            <p className="vacio">“Agotado” oculta el producto de la carta de los clientes sin borrarlo.</p>
          </>
        ) : (
          <>
            <h2>{form.id ? "Editar producto" : "Nuevo producto"}</h2>
            <div className="foto-editor">
              <Plato arte={form.arte} foto={fotoVista} size={140} />
              <div className="foto-botones">
                <label className="btn subir">
                  {fotoVista ? "Cambiar foto" : "Subir foto"}
                  <input type="file" accept="image/*" onChange={elegirFoto} hidden />
                </label>
                {fotoVista && <button className="btn" onClick={() => { setFotoNueva(null); setQuitar(true); }}>Quitar foto</button>}
              </div>
            </div>
            <label className="campo"><span>Nombre *</span>
              <input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
            </label>
            <label className="campo"><span>Categoría * (elige o escribe una nueva)</span>
              <input list="lista-categorias" value={form.cat} onChange={(e) => set("cat", e.target.value)} />
              <datalist id="lista-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="campo"><span>Precio con IGV (S/) *</span>
              <input inputMode="decimal" value={form.precio} onChange={(e) => set("precio", e.target.value.replace(/[^\d.]/g, ""))} />
            </label>
            <label className="campo"><span>Descripción</span>
              <input value={form.desc} onChange={(e) => set("desc", e.target.value)} />
            </label>
            <label className="campo"><span>Palabras para el asistente (separadas por comas)</span>
              <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="carne, picante, compartir" />
            </label>
            {!fotoVista && (
              <label className="campo"><span>Dibujo si no hay foto</span>
                <select value={(form.arte && form.arte.forma) || "hamburguesa"}
                  onChange={(e) => set("arte", { ...(form.arte || { c: ["#7a3b22", "#7cc35a", "#e04b3a"] }), forma: e.target.value })}>
                  {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            )}
            <label className="check-linea">
              <input type="checkbox" checked={form.disponible} onChange={(e) => set("disponible", e.target.checked)} />
              Disponible en la carta
            </label>
            {error && <p className="err">{error}</p>}
            <button className="btn primario" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
            <button className="btn ancho" onClick={() => setForm(null)}>Cancelar</button>
            {form.id && (borrar !== form.id
              ? <button className="link" onClick={() => setBorrar(form.id)}>Eliminar producto</button>
              : (
                <div className="confirmar">
                  <p>¿Eliminar “{form.nombre}” de la carta? Los comprobantes ya emitidos no cambian.</p>
                  <button className="btn peligro" onClick={async () => {
                    try { await pos.eliminarProducto(form.id); setForm(null); avisar("Producto eliminado"); } catch (err) { setError(err.message); }
                    setBorrar(null);
                  }}>Sí, eliminar</button>
                  <button className="btn" onClick={() => setBorrar(null)}>Cancelar</button>
                </div>
              ))}
          </>
        )}
      </aside>
    </div>
  );
}
