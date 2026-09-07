import { HorizontalHeatsinkDrawing } from "./horizontal-heatsink-drawing";
import type { Orientation } from "@/lib/thermal";

export function DimensionDrawing({ fins, includeChassis, orientation }: { fins: number; includeChassis: boolean; orientation: Orientation }) {
  if (orientation === "horizontal-up") return <HorizontalHeatsinkDrawing fins={fins} includeChassis={includeChassis}/>;
  const count = Math.min(24, Math.max(2, Number.isFinite(fins) ? Math.round(fins) : 14));
  const p = (u: number, v: number, z: number) => `${92 + u * 150 + z * 64},${65 + u * 27 - z * 32 + v * 174}`;
  const face = (points: [number, number, number][]) => points.map(([u, v, z]) => p(u, v, z)).join(" ");
  return <svg className="technical-drawing" viewBox="0 0 380 330" role="img" aria-label="直立散熱片尺寸示意圖，W 為寬度、H 為垂直高度、L 為鰭片伸出長度、X 為基板後方機殼深度；下方截面示意 S 間距與 t f 鰭片厚度。">
    <defs>
      <marker id="dimension-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 10 5 L 0 0 L 0 10 Z" fill="#587381" /></marker>
      <linearGradient id="fin-face" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#d4e4eb"/><stop offset="1" stopColor="#8baab8"/></linearGradient>
    </defs>
    <g opacity={includeChassis ? 1 : .18}>
      <polygon points={face([[0,0,0],[1,0,0],[1,0,1],[0,0,1]])} fill="#36596a" stroke="#264454"/>
      <polygon points={face([[1,0,0],[1,0,1],[1,1,1],[1,1,0]])} fill="#203e4e" stroke="#1f3e4d"/>
      <polygon points={face([[0,0,0],[1,0,0],[1,1,0],[0,1,0]])} fill="#496979"/>
    </g>
    <polygon points={face([[0,0,0],[1,0,0],[1,0,-.15],[0,0,-.15]])} fill="#b1c9d3" stroke="#7999a8"/>
    <polygon points={face([[1,0,0],[1,0,-.15],[1,1,-.15],[1,1,0]])} fill="#7e9eac" stroke="#698b9b"/>
    <polygon points={face([[0,0,-.15],[1,0,-.15],[1,1,-.15],[0,1,-.15]])} fill="#9fb9c5" stroke="#7599a9"/>
    {Array.from({length:count},(_,i)=>{
      const u = i / (count - 1), t = Math.min(.018, .3/count);
      return <g key={i}>
        <polygon points={face([[u,0,-.15],[u,0,-.85],[u,1,-.85],[u,1,-.15]])} fill="url(#fin-face)" stroke="#6c929f" strokeWidth=".65"/>
        <polygon points={face([[u,0,-.85],[u+t,0,-.85],[u+t,1,-.85],[u,1,-.85]])} fill="#e2eff3" stroke="#7e9dab" strokeWidth=".4"/>
        <polygon points={face([[u,0,-.15],[u+t,0,-.15],[u+t,0,-.85],[u,0,-.85]])} fill="#e2edf1"/>
      </g>;
    })}
    <g stroke="#69828f" strokeWidth="1" fill="none">
      <path d="M321 61v184M313 60h17M313 245h17"/>
      <path d="M321 67v171" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)"/>
      <path d="M89 280l142 26" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)"/>
      <path d="M85 268v18M235 296v16"/>
      <path d="M250 73l56-29" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)"/>
      <path d="M50 251l29-14" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)"/>
      <path d="M62 33l15 20M62 33H40"/>
    </g>
    <g className="drawing-label" fontSize="17">
      <text x="333" y="164">H</text><text x="153" y="320">W</text><text x="280" y="48">X</text><text x="45" y="243">L</text><text x="24" y="36">tᵦ</text>
    </g>
    <g transform="translate(14,282)">
      <path d="M0 28V0h6v28h31V0h6v28" fill="#c0d6df" stroke="#6b929f"/>
      <path d="M12 11h19" stroke="#587381" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)"/>
      <text x="18" y="4" className="drawing-label" fontSize="14">S</text>
      <path d="M42 7l11-9h12" stroke="#587381" fill="none"/>
      <text x="67" y="3" className="drawing-label" fontSize="14">t𝒻</text>
    </g>
    <g transform="translate(347,264)" fill="none" stroke="#0c8b83" strokeWidth="2"><path d="M0 28V0m-5 6 5-6 5 6"/></g>
    <text x="334" y="313" fill="#348079" fontSize="13">向上</text>
  </svg>;
}


