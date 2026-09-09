"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, Check, ChevronRight, CircleHelp, Minus, Plus, Ruler, Thermometer, Wind, ChartNoAxesCombined, AlertTriangle, BookOpen, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HorizontalHeatsinkDrawing } from "@/components/horizontal-heatsink-drawing";
import { calculate, DEFAULT_INPUT, finSweep, toDraft, validateInput, type Draft, type Input, type InputKey, type Result, type Orientation } from "@/lib/thermal";

const fmt = (n: number | undefined | null, digits = 1) => n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const sci = (n: number | undefined) => n == null ? "—" : n.toExponential(2);
const colors = { total: "#087f83", convection: "#3477c1", radiation: "#c97324" };
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

type FieldProps = {
  name: InputKey; label: string; symbol: string; unit: string; value: string;
  onChange: (key: InputKey, value: string) => void; error?: string;
};
function Field({ name, label, symbol, unit, value, onChange, error }: FieldProps) {
  return <div className="field">
    <label htmlFor={name}>{label}<span className="field-symbol">{symbol}</span></label>
    <div className={`input-box${error ? " invalid" : ""}`}>
      <input id={name} name={name} type="text" inputMode={name === "fins" ? "numeric" : "decimal"}
        value={value} autoComplete="off" spellCheck={false} aria-invalid={!!error}
        aria-describedby={error ? `${name}-error ${name}-unit` : `${name}-unit`}
        onChange={(event) => onChange(name, event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      <span className="field-unit" id={`${name}-unit`}>{unit}</span>
    </div>
    {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
  </div>;
}

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

function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: { fins: number; total: number; convection: number; radiation: number; spacing: number } }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return <div className="chart-tooltip"><strong>{point.fins} 片 · S = {fmt(point.spacing)} mm</strong>
    <p style={{color:colors.total}}>總散熱量　{fmt(point.total)} W</p>
    <p style={{color:colors.convection}}>自然對流　{fmt(point.convection)} W</p>
    <p style={{color:colors.radiation}}>熱輻射　　{fmt(point.radiation)} W</p>
  </div>;
}

function HorizontalConvectionDetails({ result: r, input: i, includeChassis }: { result: Result; input: Input; includeChassis: boolean }) {
  const a = r.horizontalArray;
  return <>
    <h3 className="formula-heading">2. 水平基板、鰭片朝上的自然對流</h3>
    <div className="formula-block">
      <p>採用 Tari & Mehrtash 水平鰭片陣列平均對流式。此處 H 是水平通道長度、L 是向上的鰭片高度，與原論文的 H、L 定義相反。</p>
      <p className="formula-line">T<sub>film</sub> = (T<sub>hs</sub> + T<sub>a</sub>)/2 + 273.15 = {fmt(a.air.temperature,2)} K</p>
      <p>乾空氣、1 atm；Sutherland 式計算 μ 與 k，cₚ = 1,006 J/(kg·K)，ρ = p/(287.05·T)，β = 1/T。</p>
      <p>k = {fmt(a.air.k,5)} W/(m·K)，ν = {sci(a.air.nu)} m²/s，α = {sci(a.air.alpha)} m²/s，Pr = {fmt(a.air.pr,3)}。</p>
      <p className="formula-line">Ra<sub>S</sub> = g·β·ΔT·S³/(ν·α) = {sci(a.rayleigh)}</p>
      <p className="formula-line">Ra′ = Ra<sub>S</sub>·(L/H)<sup>0.5</sup>·(S/L)<sup>0.38</sup> = {fmt(a.modifiedRayleigh,2)}</p>
      <p className="formula-line">Nu<sub>S</sub> = 0.0915·(Ra′)<sup>0.436</sup> = {fmt(a.nusselt,3)}</p>
      <p className="formula-line">h<sub>array</sub> = k·Nu<sub>S</sub>/S = <strong>{fmt(a.h,3)} W/(m²·K)</strong></p>
      <p className="formula-line">A<sub>array</sub> = WH + 2NLH + 2NLt𝒻 + 2tᵦ(W + H) = {fmt(r.arrayArea,5)} m²</p>
      <p>面積包含鰭片雙側、頂端、兩端面、槽底與基板邊緣；不含貼合背面。平均 h 近似套用於全部外露面積，基板小邊緣亦採相同 h。</p>
      <p className="formula-line">Q<sub>conv,hs</sub> = h<sub>array</sub>·A<sub>array</sub>·(T<sub>hs</sub> − T<sub>a</sub>) = <strong>{fmt(r.sinkConvection)} W</strong></p>
      <p><strong>幾何適用範圍：</strong>{a.outsideLimits.length === 0 ? "目前符合下列三項條件。" : "目前超出部分條件，結果為外推粗估。"}</p>
      {a.limits.map(limit => <p key={limit.name}>{limit.min} ≤ {limit.name} ≤ {limit.max}；目前 {fmt(limit.value,4)}{a.outsideLimits.includes(limit) ? "（超出）" : ""}</p>)}
      <p><strong>熱傳條件：</strong>Ra′ &lt; 5,000；目前 {fmt(a.modifiedRayleigh,2)}{a.rayleighInRange ? "（符合）" : "（超出，外推粗估）"}。零溫差時散熱量為零。</p>
      <p>空氣由水平通道兩端進入並從上方上升；上方與兩端需保持開放。比較曲線中的建議點另需符合 S ≥ 4 mm。</p>
    </div>
    <h3 className="formula-heading">3. 下方機殼的自然對流</h3>
    <div className="formula-block">
      <p>機殼頂面與散熱片貼合，不計入；四個側面採垂直平板式，底面採熱面朝下的水平平板式。各面以機殼與環境的膜溫計算物性。</p>
      <p className="formula-line">A<sub>case,v</sub> = 2X(W + H) = {fmt(r.chassisVerticalArea,5)} m²</p>
      <p className="formula-line">Ra<sub>X</sub> = g·β·(T<sub>case</sub> − T<sub>a</sub>)·X³/(ν·α) = {sci(r.chassisPlate.rayleigh)}</p>
      <p className="formula-line">Nu<sub>X</sub> = 0.68 + 0.670·Ra<sub>X</sub><sup>1/4</sup> / [1 + (0.492/Pr)<sup>9/16</sup>]<sup>4/9</sup></p>
      <p>Ra ≤ 10⁹ 採上式；較高 Ra 採 Churchill–Chu 全域式：</p>
      <p className="formula-line">Nu<sub>X</sub> = [0.825 + 0.387·Ra<sub>X</sub><sup>1/6</sup> / [1 + (0.492/Pr)<sup>9/16</sup>]<sup>8/27</sup>]²</p>
      <p>h<sub>v</sub> = Nu<sub>X</sub>·k/X = {fmt(r.chassisPlate.h,3)} W/(m²·K)。</p>
      <p className="formula-line">A<sub>case,down</sub> = WH = {fmt(r.chassisHorizontalArea,5)} m²；L<sub>c</sub> = WH/[2(W + H)] = {fmt(r.horizontal.characteristicLength,5)} m</p>
      <p className="formula-line">Nu<sub>down</sub> = 0.27·Ra<sub>Lc</sub><sup>1/4</sup>；h<sub>down</sub> = Nu<sub>down</sub>·k/L<sub>c</sub></p>
      <p>底面 Ra = {sci(r.horizontal.rayleigh)}，h<sub>down</sub> = {fmt(r.horizontal.down,3)} W/(m²·K)。</p>
      {includeChassis && r.horizontal.rayleigh < 1e5 && i.chassisTemperature > i.ambient && <p className="model-note">底面 Ra 低於常用 10⁵ 下限，此面對流為外推粗估。</p>}
      <p className="formula-line">Q<sub>conv,case</sub> = [h<sub>v</sub>·2X(W + H) + h<sub>down</sub>·WH]·(T<sub>case</sub> − T<sub>a</sub>) = <strong>{fmt(r.chassisConvection)} W</strong></p>
      <p>{includeChassis ? "此估算假設機殼底面懸空通風；若貼在桌面或安裝板上，底面散熱條件會改變。" : "目前選擇僅散熱片，機殼對流與輻射皆設為零。"}</p>
    </div>
  </>;
}

export function ResultDetails({ result: r, input: i, includeChassis, orientation }: { result: Result | null; input: Input; includeChassis: boolean; orientation: Orientation }) {
  const finsUp = orientation === "horizontal-up";
  return <section className="panel details-panel" id="calculation-details">
    <Accordion type="multiple">
      <AccordionItem value="breakdown"><AccordionTrigger className="accordion-trigger"><span className="flex items-center gap-3"><ChartNoAxesCombined size={20}/>各部分散熱量</span></AccordionTrigger><AccordionContent className="accordion-body">
        <Table className="data-table"><TableHeader><TableRow><TableHead>部位</TableHead><TableHead>對流 W</TableHead><TableHead>輻射 W</TableHead><TableHead>合計 W</TableHead></TableRow></TableHeader><TableBody>
          <TableRow><TableCell>散熱片</TableCell><TableCell>{fmt(r?.sinkConvection)}</TableCell><TableCell>{fmt(r?.sinkRadiation)}</TableCell><TableCell>{fmt(r?.sinkTotal)}</TableCell></TableRow>
          <TableRow><TableCell>機殼{!includeChassis && "（未納入）"}</TableCell><TableCell>{fmt(r?.chassisConvection)}</TableCell><TableCell>{fmt(r?.chassisRadiation)}</TableCell><TableCell>{fmt(r?.chassisTotal)}</TableCell></TableRow>
          <TableRow className="current-row"><TableCell>總計</TableCell><TableCell>{fmt(r?.convection)}</TableCell><TableCell>{fmt(r?.radiation)}</TableCell><TableCell>{fmt(r?.total)}</TableCell></TableRow>
        </TableBody></Table>
        <p className="model-note">結果表示表面維持在指定溫度時，可向環境散出的熱量。散熱片與機殼使用各自的溫差；基板背面為貼合面，不重複計入。</p>
      </AccordionContent></AccordionItem>
      <AccordionItem value="formulas"><AccordionTrigger className="accordion-trigger"><span className="flex items-center gap-3"><BookOpen size={20}/>公式與目前計算過程</span></AccordionTrigger><AccordionContent className="accordion-body">
        {!r ? <p>請先修正輸入欄位，即可顯示完整計算過程。</p> : <>
          <p>以下長度代入公式前皆換算為 m；溫差用 K 或 °C，四次方輻射溫度使用 K。</p>
          <h3 className="formula-heading">1. 幾何與鋁材重量</h3>
          <div className="formula-block"><p className="formula-line">S = (W − N·t𝒻) / (N − 1)</p><p>({fmt(i.width)} − {i.fins} × {fmt(i.finThickness)}) / ({i.fins} − 1) = <strong>{fmt(r.spacing,2)} mm</strong></p><p className="formula-line">m = ρ<sub>Al</sub> · (W·H·tᵦ + N·H·L·t𝒻)</p><p>ρ<sub>Al</sub> = 2,700 kg/m³ → <strong>{fmt(r.massGrams)} g</strong>；重量只含基板與鰭片。</p></div>
          {finsUp ? <HorizontalConvectionDetails result={r} input={i} includeChassis={includeChassis}/> : <>
          <h3 className="formula-heading">2. 空氣物性與鰭片通道對流</h3>
          <div className="formula-block"><p className="formula-line">T<sub>film</sub> = (T<sub>hs</sub> + T<sub>a</sub>) / 2 + 273.15 = {fmt(r.sinkPlate.air.temperature,2)} K</p><p>乾空氣、1 atm；Sutherland 式計算 μ 與 k。cₚ = 1,006 J/(kg·K)，ρ = p/(287.05·T)，β = 1/T。</p><p>k = {fmt(r.sinkPlate.air.k,5)} W/(m·K)，ν = {sci(r.sinkPlate.air.nu)} m²/s，α = {sci(r.sinkPlate.air.alpha)} m²/s，Pr = {fmt(r.sinkPlate.air.pr,3)}。</p><p className="formula-line">E = g·β·ΔT·S⁴ / (ν·α·H) = {fmt(r.elenbaas,2)}</p><p className="formula-line">Nu<sub>S</sub> = [576/E² + 2.873/E<sup>0.5</sup>]<sup>−0.5</sup></p><p className="formula-line">h<sub>ch</sub> = k·Nu<sub>S</sub>/S = <strong>{fmt(r.channelH,3)} W/(m²·K)</strong></p><p className="formula-line">A<sub>ch</sub> = (N − 1)·H·(2L + S) = {fmt(r.channelArea,5)} m²</p><p>通道式採 Bar-Cohen / Rohsenow 平行等溫板關係式；本工具以同一 h<sub>ch</sub> 近似槽底表面。</p></div>
          <h3 className="formula-heading">3. 外側表面與機殼對流</h3>
          <div className="formula-block"><p className="formula-line">Ra<sub>H</sub> = g·β·ΔT·H³ / (ν·α) = {sci(r.sinkPlate.rayleigh)}</p><p className="formula-line">Nu<sub>H</sub> = 0.68 + 0.670·Ra<sub>H</sub><sup>1/4</sup> / [1 + (0.492/Pr)<sup>9/16</sup>]<sup>4/9</sup></p><p>Ra ≤ 10⁹ 採上式；較高 Ra 改用 Churchill–Chu 全域式：</p><p className="formula-line">Nu<sub>H</sub> = [0.825 + 0.387·Ra<sub>H</sub><sup>1/6</sup> / [1 + (0.492/Pr)<sup>9/16</sup>]<sup>8/27</sup>]²</p><p>h = Nu·k/H；散熱片外側 h = <strong>{fmt(r.sinkPlate.h,3)} W/(m²·K)</strong>。</p><p className="formula-line">A<sub>out,v</sub> = 2LH + N·t𝒻·H + 2tᵦ·H = {fmt(r.outerVerticalArea,5)} m²</p><p className="formula-line">Q<sub>conv,hs</sub> = (h<sub>ch</sub>·A<sub>ch</sub> + h<sub>out</sub>·A<sub>out,v</sub>)·(T<sub>hs</sub> − T<sub>a</sub>)</p><p>散熱片對流 = <strong>{fmt(r.sinkConvection)} W</strong>。鰭片與基板的頂底小端面對流忽略。</p><p className="formula-line">A<sub>case,v</sub> = WH + 2XH；A<sub>case,top</sub> = WX</p><p>機殼以自己的膜溫求 h；背面及兩側用垂直板式，頂底面用水平板式，特徵長度 L<sub>c</sub> = WX/[2(W + X)]。</p><p className="formula-line">Nu<sub>up</sub> = 0.54·Ra<sup>1/4</sup> (Ra ≤ 10⁷)，0.15·Ra<sup>1/3</sup> (Ra &gt; 10⁷)</p><p className="formula-line">Nu<sub>down</sub> = 0.27·Ra<sup>1/4</sup></p><p>水平面 Ra = {sci(r.horizontal.rayleigh)}；向上 h = {fmt(r.horizontal.up,3)}，向下 h = {fmt(r.horizontal.down,3)} W/(m²·K)。</p>{includeChassis && r.horizontal.rayleigh < 1e5 && i.chassisTemperature > i.ambient && <p className="model-note">目前水平面 Ra 偏低，底面已低於常用 10⁵ 下限；頂底對流屬外推粗估。上表保留其貢獻，供設計比對。</p>}<p className="formula-line">Q<sub>conv,case</sub> = [h<sub>v</sub>·(WH + 2XH) + (h<sub>up</sub> + h<sub>down</sub>)·WX]·(T<sub>case</sub> − T<sub>a</sub>)</p><p>機殼對流 = <strong>{fmt(r.chassisConvection)} W</strong>{!includeChassis && "（此模式未納入）"}。</p></div>
          </>}
          <h3 className="formula-heading">4. 輻射與鰭片遮蔽</h3>
          <div className="formula-block"><p>相鄰鰭片採長 U 形灰體腔的集中近似，以{finsUp ? "上方" : "前方"}開口向環境輻射；假設周圍輻射溫度等於環境溫度。</p><p className="formula-line">A<sub>open</sub> = (N − 1)SH = {fmt(r.openingArea,5)} m²</p><p className="formula-line">A<sub>ch</sub> = (N − 1)H(2L + S) = {fmt(r.channelArea,5)} m²</p><p className="formula-line">ε<sub>eff</sub> = 1 / [1 + (1 − ε)·A<sub>open</sub>/(ε·A<sub>ch</sub>)] = {fmt(r.effectiveEmissivity,4)}</p><p>ε = 0 時，所有輻射項直接設為 0。</p><p className="formula-line">A<sub>direct</sub> = 2LH + Nt𝒻H + 2tᵦH + 2Wtᵦ + 2NLt𝒻 = {fmt(r.directRadiationArea,5)} m²</p><p className="formula-line">Q<sub>rad,hs</sub> = σ·(ε<sub>eff</sub>A<sub>open</sub> + εA<sub>direct</sub>)·(T<sub>hs,K</sub>⁴ − T<sub>a,K</sub>⁴)</p><p className="formula-line">Q<sub>rad,case</sub> = εσ·(WH + 2XH + 2WX)·(T<sub>case,K</sub>⁴ − T<sub>a,K</sub>⁴)</p><p>σ = 5.670374419 × 10⁻⁸ W/(m²·K⁴)。散熱片輻射 = {fmt(r.sinkRadiation)} W；機殼輻射 = {fmt(r.chassisRadiation)} W。</p><p>此腔體模型忽略通道沿 H 方向的兩端開口、局部視角係數與非均勻 radiosity，屬尺寸評估近似。</p></div>
          <h3 className="formula-heading">5. 總散熱量與輻射占比</h3>
          <div className="formula-block"><p className="formula-line">Q<sub>total</sub> = Q<sub>conv</sub> + Q<sub>rad</sub> = {fmt(r.convection)} + {fmt(r.radiation)} = <strong>{fmt(r.total)} W</strong></p><p className="formula-line">輻射占比 = Q<sub>rad</sub> / Q<sub>total</sub> × 100% = <strong>{r.total > 0 ? fmt(r.radiationPercent) + "%" : "無熱交換，不適用"}</strong></p></div>
        </>}
      </AccordionContent></AccordionItem>
      <AccordionItem value="assumptions"><AccordionTrigger className="accordion-trigger"><span className="flex items-center gap-3"><CircleHelp size={20}/>適用條件與參考資料</span></AccordionTrigger><AccordionContent className="accordion-body">
        <p><strong>適用：</strong>{finsUp ? "開放空間、無風扇，基板 W × H 水平、鰭片沿 L 朝上，通道兩端與上方暢通。X 為基板下方機殼高度，不包含 tᵦ 或 L。" : "開放空間、無風扇、鰭片通道沿 H 垂直、上下進出口暢通的自然對流初步尺寸評估。X 定義為基板後方的機殼深度，不包含 tᵦ 或 L。"}</p>
        {finsUp && <p className="model-note">水平式採 Tari & Mehrtash (2013)，以本工具符號表示，幾何範圍為 0.35 ≤ S/L ≤ 2.94、0.015 ≤ L/H ≤ 0.1、0.026 ≤ S/H ≤ 0.059，且修正 Ra′ &lt; 5,000。圖片尺寸的 L/H ≈ 0.1024，切換水平後會標示外推估算。</p>}
        <p className="model-note">輸入的散熱片溫度視為整個散熱片的均勻表面溫度，等效鰭片效率 η = 1；若把它當作局部基板最高溫，可能高估散熱能力。未求解熱源接觸熱阻、基板擴散、鰭片溫度梯度及殼內熱傳。</p>
        <p>{finsUp ? "機殼假設四側及下底面完全暴露於空氣，底面懸空；頂面與散熱片貼合。" : "機殼假設背面、左右及上下共五面完全暴露於空氣。"}機殼與散熱片使用同一放射率。安裝壁面、障礙物或鰭片較短時，需再修正遮蔽與氣流影響。周圍均溫且表面暴露條件相同時，旋轉只改變本模型的對流，輻射面積與估算值維持相同。</p>
        <p>圖片範例：14 片、ε = 0.8、X/W/H = 67/195.2/312.4 mm、L/tᵦ/t𝒻 = 32/10/2 mm、環境/散熱片/機殼 = 25/70/65 °C。圖片標示 156.9 W、輻射占比 38.0%；本工具以公開關係式與上述面積近似重新估算，結果不必相同。</p>
        <ul className="sources">
          <li><a href="https://doi.org/10.1016/j.applthermaleng.2013.09.003" target="_blank" rel="noreferrer">Tari & Mehrtash (2013) — 水平及小傾角鰭片散熱片</a></li>
          <li><a href="https://pure-oai.bham.ac.uk/ws/files/68301412/Revised_Manuscript.pdf" target="_blank" rel="noreferrer">González Gallero 等 (2019) — 表 4：水平式與幾何適用範圍</a></li>
          <li><a href="https://www.sciencedirect.com/science/article/abs/pii/S1290072921003938" target="_blank" rel="noreferrer">Liou 等 (2022) — 水平陣列流動與修正 Ra 適用範圍</a></li>
          <li><a href="https://asmedigitalcollection.asme.org/heattransfer/article/106/1/116/414436/Thermally-Optimum-Spacing-of-Vertical-Natural" target="_blank" rel="noreferrer">Bar-Cohen & Rohsenow (1984) — 垂直平行板自然對流</a></li>
          <li><a href="https://www.iieta.org/journals/ijht/paper/10.18280/ijht.340217" target="_blank" rel="noreferrer">IIETA (2016) — Plate-fin 散熱片模型，式 (11)</a></li>
          <li><a href="https://doi.org/10.1016/0017-9310(75)90243-4" target="_blank" rel="noreferrer">Churchill & Chu (1975) — 垂直平板自然對流</a></li>
          <li><a href="https://www.comsol.com/blogs/understanding-classical-gray-body-radiation-theory" target="_blank" rel="noreferrer">COMSOL — 灰體輻射與 radiosity 的物理基礎</a></li>
          <li><a href="https://doc.comsol.com/6.4/doc/com.comsol.help.cfd/cfd_ug_fluidflow_high_mach.08.46.html" target="_blank" rel="noreferrer">COMSOL — Sutherland 空氣物性參數</a></li>
        </ul>
      </AccordionContent></AccordionItem>
    </Accordion>
  </section>;
}

export default function HeatsinkApp() {
  const [draft, setDraft] = useState<Draft>(() => toDraft(DEFAULT_INPUT));
  const [includeChassis, setIncludeChassis] = useState(true);
  const [orientation, setOrientation] = useState<Orientation>("vertical");
  const finsUp = orientation === "horizontal-up";
  const [sampleMessage, setSampleMessage] = useState("");
  const [online, setOnline] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineFailed, setOfflineFailed] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const validation = useMemo(() => validateInput(draft, includeChassis), [draft, includeChassis]);
  const { input, errors, valid } = validation;
  const result = useMemo(() => valid ? calculate(input, includeChassis, orientation) : null, [input, valid, includeChassis, orientation]);
  const sweep = useMemo(() => valid ? finSweep(input, includeChassis, orientation) : { points: [], best: null }, [input, valid, includeChassis, orientation]);
  const update = (key: InputKey, value: string) => { setDraft((previous) => ({ ...previous, [key]: value })); setSampleMessage(""); };

  useEffect(() => {
    setOnline(navigator.onLine);
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const onOnline = () => setOnline(true), onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const onInstalled = () => { setInstallEvent(null); setStandalone(true); setInstallOpen(false); };
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstall); window.addEventListener("appinstalled", onInstalled);
    let alive = true;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(new URL("./sw.js", document.baseURI), { scope: "./", updateViaCache: "none" })
        .then((registration) => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "redundant" && !registration.active && alive) setOfflineFailed(true);
          });
          return navigator.serviceWorker.ready;
        })
        .then(() => { if (alive) setOfflineReady(true); })
        .catch(() => { if (alive) setOfflineFailed(true); });
    } else { setOfflineFailed(true); }
    return () => { alive = false; window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("beforeinstallprompt", onInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  function loadExample() { setDraft(toDraft(DEFAULT_INPUT)); setIncludeChassis(true); setOrientation("vertical"); setSampleMessage("已載入圖片的全部範例數值與直立擺放方式"); }
  async function install() {
    if (!installEvent) { setInstallOpen(true); return; }
    try { await installEvent.prompt(); await installEvent.userChoice; setInstallEvent(null); } catch { setInstallOpen(true); }
  }
  const field = (name: InputKey, label: string, symbol: string, unit = "mm") => <Field key={name} name={name} label={label} symbol={symbol} unit={unit} value={draft[name]} onChange={update} error={errors[name]}/>;
  const status = !online ? "離線計算" : offlineReady ? "可離線使用" : offlineFailed ? "線上使用中" : "準備離線功能";

  return <div data-heatsink-app="v2">
    <header className="app-header"><div className="header-inner">
      <div className="brand"><img className="brand-icon brand-icon-image" src="./icons/icon-192.png" alt="散熱片計算 Logo"/><div><div className="brand-title">散熱片計算</div><div className="brand-caption">HEATSINK SIZING</div></div></div>
      <div className="header-actions"><span className={`connection${!online ? " offline" : ""}`}><span className="status-dot"/>{status}</span>
        {!standalone && <Button className="app-button" variant="outline" onClick={install}><ArrowDownToLine/>加入主畫面</Button>}
      </div>
    </div></header>
    <main className="page">
      <div className="page-intro"><div><div className="eyebrow">THERMAL DESIGN / 自然對流</div><h1>散熱片尺寸評估</h1><p className="intro-description">調整幾何、擺放方式與溫度，即時比較散熱能力。</p></div><div className="environment-tag"><Wind size={17}/>{finsUp ? "水平朝上" : "直立鰭片"} · 無風扇</div></div>
      <div className="mobile-live" aria-live="polite" aria-atomic="true"><div><div className="mobile-live-label">預估總散熱量</div><a href="#results">查看完整結果 ↓</a></div><div><strong>{fmt(result?.total)}</strong><small>W</small></div></div>
      <div className="workbench">
        <div className="input-column">
          <section className="panel"><div className="panel-body"><h2 className="panel-heading"><span className="heading-number">01</span>尺寸設定<button type="button" className="subtle-button heading-action" onClick={loadExample}>載入圖片範例</button></h2>
            <div className="orientation-setting">
              <label className="setting-label" htmlFor="orientation">擺放方式</label>
              <Select value={orientation} onValueChange={(value) => { setOrientation(value as Orientation); setSampleMessage(""); }}><SelectTrigger id="orientation" className="app-select" aria-describedby="orientation-hint"><SelectValue/></SelectTrigger><SelectContent position="popper"><SelectItem className="app-select-item" value="vertical">直立擺放・通道垂直</SelectItem><SelectItem className="app-select-item" value="horizontal-up">水平擺放・鰭片朝上</SelectItem></SelectContent></Select>
              <p className="settings-hint" id="orientation-hint">{finsUp ? "基板 W × H 水平，L 為向上的鰭片高度。通道兩端與上方需保持暢通。" : "H 為垂直方向，鰭片通道上下需保持暢通。"}切換時保留尺寸數值。</p>
            </div>
            <div className="field-grid">
              {field("fins", "鰭片數量", "N", "片")}{field("emissivity", "放射率", "ε", "0–1")}
              {field("width", "散熱片寬", "W")}{field("height", finsUp ? "基板長度" : "垂直高度", "H")}
              {field("finLength", finsUp ? "鰭片高度" : "鰭片伸出", "L")}{field("chassisDepth", finsUp ? "機殼高度" : "機殼深度", "X")}
              {field("baseThickness", "基板厚度", "tᵦ")}{field("finThickness", "鰭片厚度", "t𝒻")}
            </div>
            <dl className="derived-values"><div><dt>鰭片間距 S</dt><dd>{fmt(result?.spacing)} <small>mm</small></dd></div><div><dt>散熱片重量</dt><dd>{fmt(result?.massGrams)} <small>g</small></dd></div></dl>
            <p className="mass-note">鋁材 ρ = 2,700 kg/m³；不含機殼重量。</p>
            {sampleMessage && <p role="status" className="settings-hint" style={{color:"#087f83"}}><Check size={16} className="inline mr-1"/>{sampleMessage}</p>}
          </div></section>
          <section className="panel"><div className="panel-body"><h2 className="panel-heading"><span className="heading-number">02</span>溫度條件<Thermometer className="heading-action"/></h2>
            <div className="temperature-fields">{field("ambient", "環境溫度", "Tₐ", "°C")}{field("sinkTemperature", "散熱片表面", "Tₕₛ", "°C")}{field("chassisTemperature", "機殼表面", "T꜀", "°C")}</div>
            <p className="settings-hint">散熱片採均勻表面溫度；環境同時作為輻射周圍溫度。</p>
          </div></section>
          <section className="panel"><div className="panel-body"><label className="setting-label" htmlFor="calculation-scope">計算範圍</label>
            <Select value={includeChassis ? "full" : "sink"} onValueChange={(value) => setIncludeChassis(value === "full")}><SelectTrigger id="calculation-scope" className="app-select"><SelectValue/></SelectTrigger><SelectContent position="popper"><SelectItem className="app-select-item" value="full">散熱片＋機殼</SelectItem><SelectItem className="app-select-item" value="sink">僅散熱片（背面貼合）</SelectItem></SelectContent></Select>
            <p className="settings-hint">{includeChassis ? finsUp ? "機殼在基板下方；四側與底面皆暴露於空氣，底面需懸空通風。" : "機殼背面、左右、頂底五面皆暴露於環境。" : "僅計算散熱片；機殼散熱量設為零。"}基板背面視為貼合面。</p>
          </div></section>
          {result?.warnings.map((warning)=><div className="inline-notice" key={warning}><AlertTriangle/><span>{warning}</span></div>)}
        </div>
        <div className="result-column">
          <section className="panel summary-panel" id="results"><div className="panel-body">
            <div className="summary-top"><h2 className="summary-title">預估總散熱量</h2><span className="estimate-tag">{result && !result.correlationInRange ? "外推估算" : "自然對流＋輻射"}</span></div>
            <div className="capacity-line"><output className="capacity-value" aria-live="polite">{fmt(result?.total)}</output><span className="capacity-unit">W</span></div>
            {result ? <p className="capacity-subtitle">{finsUp ? "水平・鰭片朝上" : "直立擺放"} · {includeChassis ? "散熱片與機殼合計" : "僅散熱片"}<br/>環境 {fmt(input.ambient,0)} °C / 散熱片 {fmt(input.sinkTemperature,0)} °C</p> : <p className="invalid-result">請修正標示的欄位，再計算散熱量。</p>}
            <div className="heat-bar" aria-hidden="true"><div className="conv-bar" style={{width:`${result && result.total > 0 ? 100-result.radiationPercent : 0}%`}}/><div className="rad-bar" style={{width:`${result?.radiationPercent ?? 0}%`}}/></div>
            <dl className="summary-details"><div><dt><i className="legend-dot" style={{background:"#81b7fb"}}/>自然對流</dt><dd>{fmt(result?.convection)} <small>W</small></dd></div><div><dt><i className="legend-dot" style={{background:"#f3bc76"}}/>熱輻射</dt><dd>{fmt(result?.radiation)} <small>W</small></dd></div><div><dt>輻射占比</dt><dd>{fmt(result && result.total > 0 ? result.radiationPercent : null)} <small>%</small></dd></div></dl>
          </div></section>
          <section className="panel drawing-panel"><div className="panel-body"><h2 className="panel-heading"><Ruler/>尺寸示意</h2>
            <div className="drawing-layout"><DimensionDrawing fins={input.fins} includeChassis={includeChassis} orientation={orientation}/><dl className="drawing-meta"><div><dt>{finsUp ? "水平基板 W × H" : "散熱片外形 W × H"}</dt><dd>{fmt(valid ? input.width : null)} × {fmt(valid ? input.height : null)} <small>mm</small></dd></div><div><dt>散熱片{finsUp ? "高度" : "深度"} L + tᵦ</dt><dd>{fmt(valid ? input.finLength + input.baseThickness : null)} <small>mm</small></dd></div><div className="model-count"><dt>{includeChassis ? `組裝總${finsUp ? "高度" : "深度"} X + tᵦ + L` : "鰭片數量"}</dt><dd>{includeChassis ? fmt(result?.totalDepth) : fmt(valid ? input.fins : null,0)} <small>{includeChassis ? "mm" : "片"}</small></dd></div></dl></div>
            <p className="diagram-footnote">{finsUp ? "L 向上；H 沿水平通道，X 是基板下方機殼高度。" : "氣流沿 H 向上。X 為基板後方機殼深度。"}示意圖非等比例{input.fins > 24 ? "，以 24 片代表實際鰭片" : ""}。</p>
          </div></section>
          <section className="panel chart-panel"><div className="panel-body"><h2 className="panel-heading"><ChartNoAxesCombined/>鰭片數量比較<div className="fin-adjust heading-action"><button aria-label="減少一片鰭片" disabled={!valid || input.fins<=2} onClick={()=>update("fins",String(input.fins-1))}><Minus size={17}/></button><span>{valid ? input.fins : "—"} 片</span><button aria-label="增加一片鰭片" disabled={!valid || input.fins>=200 || (input.fins+1)*input.finThickness>=input.width} onClick={()=>update("fins",String(input.fins+1))}><Plus size={17}/></button></div></h2>
            <p className="chart-description">{finsUp ? "水平鰭片朝上" : "直立擺放"}；固定其他條件，比較目前數量前後各 5 片。圓點為目前設定。</p>
            <div className="chart-legend">{([["total","總散熱量"],["convection","自然對流"],["radiation","熱輻射"]] as const).map(([key,label])=><span key={key}><i className="legend-line" style={{background:colors[key]}}/>{label}</span>)}</div>
            {result ? <><div className="chart-container"><ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={sweep.points} margin={{top:15,right:17,left:-10,bottom:5}} accessibilityLayer>
              <CartesianGrid vertical={false} stroke="#e3eaee" strokeDasharray="3 4"/>
              <XAxis dataKey="fins" type="number" domain={["dataMin","dataMax"]} ticks={sweep.points.map(p=>p.fins)} allowDecimals={false} minTickGap={14} tick={{fill:"#5e7685",fontSize:14}} tickLine={false} axisLine={{stroke:"#cad7df"}}/>
              <YAxis domain={[0,"auto"]} width={55} tick={{fill:"#5e7685",fontSize:14}} tickLine={false} axisLine={false} label={{value:"W",position:"insideTopLeft",offset:15,fill:"#5e7685",fontSize:14}}/>
              <Tooltip content={<ChartTooltip/>} cursor={{stroke:"#9ab6c3",strokeDasharray:"4 4"}}/>
              <ReferenceLine x={input.fins} stroke="#becfd7" strokeDasharray="4 5"/>
              <Line dataKey="total" name="總散熱量" stroke={colors.total} strokeWidth={3} dot={{r:3,fill:colors.total,strokeWidth:0}} activeDot={{r:6}} isAnimationActive={false}/>
              <Line dataKey="convection" name="自然對流" stroke={colors.convection} strokeWidth={2} dot={false} strokeDasharray="7 3" isAnimationActive={false}/>
              <Line dataKey="radiation" name="熱輻射" stroke={colors.radiation} strokeWidth={2} dot={false} strokeDasharray="3 3" isAnimationActive={false}/>
              <ReferenceDot x={input.fins} y={result.total} r={7} fill="#123646" stroke="#fff" strokeWidth={2}/>
            </LineChart></ResponsiveContainer></div><div className="chart-caption">鰭片數量 N（片）</div></> : <div className="inline-notice"><AlertTriangle/>修正輸入後即可顯示比較曲線。</div>}
            {sweep.best && result && <div className="chart-insight"><div><strong>此範圍最佳：{sweep.best.fins} 片 · {fmt(sweep.best.total)} W</strong><p>S = {fmt(sweep.best.spacing)} mm；只比較圖中間距 ≥ 4 mm{finsUp ? "且符合水平式適用範圍" : ""}的點。</p></div>{sweep.best.fins !== input.fins && <Button className="app-button" variant="outline" onClick={()=>update("fins",String(sweep.best!.fins))}>套用 {sweep.best.fins} 片<ChevronRight/></Button>}</div>}
            {valid && !sweep.best && <p className="settings-hint">{finsUp ? "此範圍沒有同時符合間距 ≥ 4 mm 與水平式適用範圍的點。曲線保留外推估算；適用條件見下方公式。" : "此比較範圍沒有間距 ≥ 4 mm 的點，請減少鰭片數或調整尺寸。"}</p>}
            <Accordion type="single" collapsible><AccordionItem value="table"><AccordionTrigger className="accordion-trigger">比較數據表</AccordionTrigger><AccordionContent className="accordion-body"><Table className="data-table"><TableHeader><TableRow><TableHead>片數</TableHead><TableHead>S mm</TableHead><TableHead>總量 W</TableHead><TableHead>對流 W</TableHead><TableHead>輻射 W</TableHead></TableRow></TableHeader><TableBody>{sweep.points.map(p=><TableRow key={p.fins} className={p.fins===input.fins?"current-row":""}><TableCell>{p.fins}{p.fins===input.fins?" ●":""}</TableCell><TableCell>{fmt(p.spacing)}{!p.recommended?" *":""}</TableCell><TableCell>{fmt(p.total)}</TableCell><TableCell>{fmt(p.convection)}</TableCell><TableCell>{fmt(p.radiation)}</TableCell></TableRow>)}</TableBody></Table><p className="settings-hint">* 間距小於 4 mm{finsUp ? "或超出水平式適用範圍" : ""}；最佳值僅限此比較範圍，並非全域最佳。</p></AccordionContent></AccordionItem></Accordion>
          </div></section>
        </div>
      </div>
      <ResultDetails result={result} input={input} includeChassis={includeChassis} orientation={orientation}/>
      <footer className="page-footer"><span>等溫近似 · 乾空氣 1 atm · 初步尺寸評估</span><span>{status} · HS 2.0</span></footer>
    </main>
    <Dialog open={installOpen} onOpenChange={setInstallOpen}><DialogContent className="install-dialog"><DialogHeader><DialogTitle>加入「散熱片計算」</DialogTitle><DialogDescription>主畫面會顯示散熱片圖示，點一下即可開啟計算器。</DialogDescription></DialogHeader>
      {ios ? <ol className="install-steps"><li>在 <strong>Safari</strong> 開啟此頁。</li><li>點選瀏覽器的<strong>分享 <Share2 size={17} className="inline"/></strong>。</li><li>選擇<strong>「加入主畫面」</strong>，再點「加入」。若有「以網頁 App 開啟」，請保持開啟。</li></ol> : <ol className="install-steps"><li>使用 Chrome 或 Edge 開啟此頁。</li><li>開啟瀏覽器選單，選擇<strong>「安裝應用程式」</strong>或<strong>「加入主畫面」</strong>。</li><li>若沒有安裝選項，可先將此頁加入書籤。</li></ol>}
      <p className="install-offline">{offlineReady ? "離線功能已就緒。首次開啟可能需要登入；完成載入後，計算可在離線狀態執行。" : offlineFailed ? "此瀏覽器尚未啟用離線功能；目前可正常在線上計算。" : "請保持網路連線，待頁面顯示「可離線使用」後再離線。"}</p>
      <Button className="app-button install-close" onClick={()=>setInstallOpen(false)}>知道了<Check/></Button>
    </DialogContent></Dialog>
  </div>;
}
