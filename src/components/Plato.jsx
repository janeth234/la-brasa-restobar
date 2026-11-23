import React from "react";

/* Imagen del producto: la FOTO real si se subió desde la pestaña "Carta";
   si no hay foto, un dibujo SVG según arte.forma. */
const Sombra = ({ y = 88, rx = 34 }) => <ellipse cx="50" cy={y} rx={rx} ry="5" fill="rgba(0,0,0,.15)" />;
const PlatoBase = () => (
  <>
    <ellipse cx="50" cy="58" rx="46" ry="34" fill="rgba(0,0,0,.12)" />
    <ellipse cx="50" cy="54" rx="45" ry="32" fill="#ffffff" stroke="#e2ddd2" strokeWidth="2" />
    <ellipse cx="50" cy="54" rx="34" ry="23" fill="#f6f3ec" />
  </>
);
// papas fritas en palitos
const Papas = ({ x = 0, y = 0, c = "#f2c94c" }) => (
  <g transform={`translate(${x} ${y})`} stroke="#d9a72a" strokeWidth=".8">
    {[[30, 50, -20], [36, 46, 10], [42, 52, -35], [48, 47, 25], [54, 53, -10], [60, 48, 40], [38, 58, 70], [52, 60, -60]].map(([px, py, r], i) => (
      <rect key={i} x={px} y={py} width="16" height="4.5" rx="1.5" fill={c} transform={`rotate(${r} ${px + 8} ${py + 2})`} />
    ))}
  </g>
);

export default function Plato({ arte, foto, size = 96 }) {
  if (foto) {
    return <img className="foto-producto" src={foto} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }} />;
  }
  arte = arte || { forma: "hamburguesa", c: ["#7a3b22", "#7cc35a", "#e04b3a"] };
  const [a, b, c] = arte.c;
  const svg = (contenido) => (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">{contenido}</svg>
  );

  switch (arte.forma) {
    case "hamburguesa":
      return svg(<>
        <Sombra y={86} rx={36} />
        <path d="M16 74 Q50 86 84 74 L82 68 L18 68 Z" fill="#d89a4e" />
        <path d="M14 64 Q50 70 86 64 Q86 72 50 73 Q14 72 14 64 Z" fill={a} />
        <path d="M14 58 L86 58 L80 66 L72 60 L64 66 L56 60 L48 66 L40 60 L32 66 L24 60 L18 66 Z" fill={c} />
        <path d="M12 55 Q50 50 88 55 Q86 61 50 61 Q14 61 12 55 Z" fill={b} />
        <path d="M14 54 Q14 24 50 22 Q86 24 86 54 Z" fill="#e3a352" />
        <path d="M24 44 Q30 30 46 28" stroke="#f3c98a" strokeWidth="4" fill="none" strokeLinecap="round" />
        {[[38, 34], [52, 31], [62, 38], [46, 42], [70, 46], [30, 46]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx="2.2" ry="1.2" fill="#fbecc9" />
        ))}
      </>);

    case "papas":
      return svg(<>
        <PlatoBase />
        <Papas x={-2} y={-2} c={a} />
        {[[36, 50], [56, 46], [64, 58], [44, 62], [30, 60]].map(([x, y], i) => (
          <g key={i}><ellipse cx={x} cy={y} rx="6" ry="4.5" fill={b} /><ellipse cx={x} cy={y} rx="3.5" ry="2.4" fill="#e9876d" /></g>
        ))}
        <path d="M34 42 Q44 38 52 44 Q60 50 70 46" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />
      </>);

    case "alitas":
      return svg(<>
        <PlatoBase />
        <Papas x={14} y={4} c={b} />
        {[[34, 48, -25], [46, 58, 15], [30, 62, 30], [50, 44, -5]].map(([x, y, r], i) => (
          <g key={i} transform={`rotate(${r} ${x} ${y})`}>
            <ellipse cx={x} cy={y} rx="11" ry="7" fill={a} />
            <ellipse cx={x - 3} cy={y - 2.5} rx="4" ry="1.8" fill="#fff" opacity=".25" />
          </g>
        ))}
        <circle cx="40" cy="52" r="1" fill="#2f6b2a" /><circle cx="46" cy="50" r="1" fill="#2f6b2a" />
      </>);

    case "parrilla":
      return svg(<>
        <Sombra y={84} rx={40} />
        <rect x="10" y="40" width="80" height="40" rx="8" fill="#9b6a3c" />
        <rect x="13" y="43" width="74" height="34" rx="6" fill="#b98250" />
        <path d="M18 70 Q30 46 52 52 Q66 56 60 70 Z" fill={a} />
        {[24, 32, 40, 48].map((x) => <path key={x} d={`M${x} 66 L${x + 8} 54`} stroke="#2a120a" strokeWidth="2" opacity=".55" />)}
        <rect x="58" y="48" width="26" height="9" rx="4.5" fill={b} />
        <rect x="56" y="60" width="26" height="9" rx="4.5" fill={c} />
        {[62, 70, 78].map((x) => <path key={x} d={`M${x} 48 L${x - 2} 57`} stroke="#2a120a" strokeWidth="1.5" opacity=".5" />)}
        <circle cx="28" cy="50" r="3" fill="#5a8a3c" /><circle cx="33" cy="47" r="2" fill="#5a8a3c" />
      </>);

    case "botella":
      return svg(<>
        <Sombra y={92} rx={18} />
        <path d="M43 8 L57 8 L57 18 Q66 26 66 40 L66 86 Q66 92 60 92 L40 92 Q34 92 34 86 L34 40 Q34 26 43 18 Z" fill={a} stroke="rgba(0,0,0,.15)" strokeWidth="1.5" />
        <rect x="42" y="4" width="16" height="7" rx="2" fill={b} />
        <rect x="34" y="48" width="32" height="22" fill={b} />
        <rect x="38" y="54" width="24" height="10" rx="5" fill="#ffffff" opacity=".85" />
        <path d="M39 30 L39 84" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".35" />
      </>);

    default: // vaso o jarra de refresco
      return svg(<>
        <Sombra y={90} rx={26} />
        <path d="M30 18 L70 18 L64 88 L36 88 Z" fill="#ffffff" stroke="#d8d2c4" strokeWidth="2" />
        <path d="M32.5 34 L67.5 34 L63.5 85 L36.5 85 Z" fill={a} />
        <path d="M32.5 34 L67.5 34 L66.6 44 L33.4 44 Z" fill={b} opacity=".7" />
        <path d="M38 38 L41 82" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".45" />
        <path d="M58 10 L52 40" stroke="#d92b2b" strokeWidth="3" strokeLinecap="round" />
        <circle cx="44" cy="28" r="6" fill="#9fd36a" stroke="#6f9e3f" strokeWidth="1.5" />
      </>);
  }
}
