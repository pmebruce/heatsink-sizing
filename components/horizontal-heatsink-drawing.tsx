/** Dimension symbols stay attached to the same physical parts after rotation. */
export function HorizontalHeatsinkDrawing({ fins, includeChassis }: { fins: number; includeChassis: boolean }) {
  const count = Math.min(24, Math.max(2, Number.isFinite(fins) ? Math.round(fins) : 14));
  const p = (u: number, v: number, z: number) => `${58 + u * 162 + v * 105},${222 + u * 38 - v * 65 - z * 86}`;
  const face = (points: [number, number, number][]) => points.map(([u, v, z]) => p(u, v, z)).join(" ");
  return <svg className="technical-drawing" viewBox="0 0 380 340" role="img" aria-label="水平擺放、鰭片朝上的散熱片尺寸示意圖。W 與 H 是水平基板的寬與長，L 是鰭片向上的高度，X 是基板下方機殼高度。">
    <defs>
      <marker id="horizontal-dimension-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M10 5 0 0v10Z" fill="#587381"/></marker>
      <linearGradient id="horizontal-fin-face" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#d4e4eb"/><stop offset="1" stopColor="#8baab8"/></linearGradient>
    </defs>
    <g opacity={includeChassis ? 1 : .18}>
      <polygon points={face([[0,0,-.12],[1,0,-.12],[1,0,-.45],[0,0,-.45]])} fill="#36596a" stroke="#264454"/>
      <polygon points={face([[1,0,-.12],[1,1,-.12],[1,1,-.45],[1,0,-.45]])} fill="#203e4e" stroke="#1f3e4d"/>
    </g>
    <polygon points={face([[0,0,0],[1,0,0],[1,1,0],[0,1,0]])} fill="#a9c2ce" stroke="#7599a9"/>
    <polygon points={face([[0,0,0],[1,0,0],[1,0,-.12],[0,0,-.12]])} fill="#b1c9d3" stroke="#7999a8"/>
    <polygon points={face([[1,0,0],[1,1,0],[1,1,-.12],[1,0,-.12]])} fill="#7e9eac" stroke="#698b9b"/>
    {Array.from({ length: count }, (_, index) => {
      const t = Math.min(.018, .3 / count), u = index / (count - 1) * (1 - t);
      return <g key={index}>
        <polygon points={face([[u,0,0],[u,1,0],[u,1,1.1],[u,0,1.1]])} fill="url(#horizontal-fin-face)" stroke="#6c929f" strokeWidth=".65"/>
        <polygon points={face([[u,0,1.1],[u+t,0,1.1],[u+t,1,1.1],[u,1,1.1]])} fill="#e2eff3" stroke="#7e9dab" strokeWidth=".4"/>
        <polygon points={face([[u,0,0],[u+t,0,0],[u+t,0,1.1],[u,0,1.1]])} fill="#dcebf0" stroke="#7e9dab" strokeWidth=".4"/>
      </g>;
    })}
    <g stroke="#69828f" strokeWidth="1" fill="none">
      <path d="M348 102v94M336 100h18M336 195h18"/>
      <path d="M348 107v83M54 286l157 37M239 310l102-63M35 237v23" markerStart="url(#horizontal-dimension-arrow)" markerEnd="url(#horizontal-dimension-arrow)"/>
      <path d="M55 277l-4 16M213 308l-4 21M235 304l8 13M338 241l8 13M28 233h18M28 261h18M67 229l-17-14H28"/>
    </g>
    <g className="drawing-label" fontSize="17">
      <text x="358" y="154">L</text><text x="121" y="329">W</text><text x="300" y="294">H</text><text x="14" y="253">X</text><text x="9" y="219">tᵦ</text>
    </g>
    <g transform="translate(18,24)">
      <path d="M0 28V0h6v28h31V0h6v28" fill="#c0d6df" stroke="#6b929f"/>
      <path d="M12 12h19" stroke="#587381" markerStart="url(#horizontal-dimension-arrow)" markerEnd="url(#horizontal-dimension-arrow)"/>
      <text x="18" y="5" className="drawing-label" fontSize="14">S</text>
      <path d="M42 7l11-9h12" stroke="#587381" fill="none"/>
      <text x="67" y="3" className="drawing-label" fontSize="14">t𝒻</text>
    </g>
    <g transform="translate(348,40)" fill="none" stroke="#0c8b83" strokeWidth="2"><path d="M0 29V0m-5 6 5-6 5 6"/></g>
    <text x="334" y="28" fill="#348079" fontSize="13">向上</text>
  </svg>;
}
