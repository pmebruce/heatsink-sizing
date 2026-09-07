import { DEFAULT_INPUT, calculate, validateInput, toDraft, airProperties, SIGMA, type Input, type Orientation } from "./thermal.ts";

export const MODEL_VERSION = "3.0.0";
export const DEFAULT_NUMBERS = {
  ...DEFAULT_INPUT, conductivity: 200, density: 2700, heatLoad: 100, margin: 20,
  altitude: 0, pressureKPa: 101.325, clearanceIn: 100, clearanceOut: 100, clearanceSide: 100,
  convectionFactor: 1, uncertainty: 20, velocity: 1, flowCFM: 10,
  sourceWidth: 50, sourceLength: 50, timThickness: 0.2, timK: 3, contactR: 0.05, sourceLimit: 100,
};
export type Numbers = typeof DEFAULT_NUMBERS;
export type NumberKey = keyof Numbers;
export type Options = {
  orientation: Orientation; cooling: "natural" | "forced"; caseModel: "none" | "linked" | "fixed";
  pressureMode: "altitude" | "direct"; flowMode: "velocity" | "volume";
  efficiency: boolean; blockBottom: boolean;
};
export const DEFAULT_OPTIONS: Options = { orientation: "vertical", cooling: "natural", caseModel: "linked", pressureMode: "altitude", flowMode: "velocity", efficiency: true, blockBottom: false };
export type Config = { values: Numbers; options: Options };
export const DEFAULT_CONFIG: Config = { values: DEFAULT_NUMBERS, options: DEFAULT_OPTIONS };
export type NumberDraft = Record<NumberKey, string>;
export const numberDraft = (v: Numbers): NumberDraft => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)])) as NumberDraft;
export function validateDesign(draft: NumberDraft, options: Options) {
  const values = {} as Numbers, errors: Partial<Record<NumberKey, string>> = {};
  for (const key of Object.keys(DEFAULT_NUMBERS) as NumberKey[]) {
    const raw = String(draft[key] ?? "").trim();
    values[key] = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(values[key])) errors[key] = "請輸入有效數字";
  }
  const v = values;
  const old = validateInput(toDraft({ ...v, chassisTemperature: options.caseModel === "linked" ? v.sinkTemperature : v.chassisTemperature }), options.caseModel !== "none");
  Object.assign(errors, old.errors);
  const range = (key: NumberKey, low: number, high: number, strict = false) => {
    if (!Number.isFinite(v[key]) || (strict ? v[key] <= low : v[key] < low) || v[key] > high) errors[key] = `${strict ? "大於" : "至少"} ${low}，不超過 ${high}`;
  };
  range("conductivity", 0, 2500, true); range("density", 0, 30000, true);
  range("heatLoad", 0, 100000); range("margin", 0, 200); range("altitude", -500, 11000);
  range("pressureKPa", 20, 120); range("convectionFactor", 0, 1); range("uncertainty", 0, 80);
  range("velocity", 0, 100); range("flowCFM", 0, 100000);
  for (const k of ["clearanceIn", "clearanceOut", "clearanceSide"] as NumberKey[]) range(k, 0, 10000);
  range("sourceWidth", 0, v.width, true); range("sourceLength", 0, v.height, true);
  range("timThickness", 0, 20); range("timK", 0, 2500, true); range("contactR", 0, 100);
  range("sourceLimit", v.ambient, 300);
  const enums = options && [
    [options.orientation, ["vertical", "horizontal-up"]], [options.cooling, ["natural", "forced"]],
    [options.caseModel, ["none", "linked", "fixed"]], [options.pressureMode, ["altitude", "direct"]], [options.flowMode, ["velocity", "volume"]],
  ] as [string, string[]][];
  const optionsValid = !!enums && enums.every(([x, allowed]) => allowed.includes(x)) && typeof options.efficiency === "boolean" && typeof options.blockBottom === "boolean";
  return { values, errors, valid: optionsValid && Object.keys(errors).length === 0 };
}
export function pressure(config: Config) {
  return config.options.pressureMode === "direct" ? config.values.pressureKPa * 1000 : 101325 * (1 - 0.0065 * config.values.altitude / 288.15) ** 5.25588;
}
export function thermalPath(v: Numbers) {
  const area = v.sourceWidth * v.sourceLength * 1e-6;
  const tim = v.timThickness / 1000 / (v.timK * area), base = v.baseThickness / 1000 / (v.conductivity * area);
  return { area, tim, base, contact: v.contactR, total: tim + base + v.contactR };
}
/** Teertstra composite inlet-referenced channel Nu; no second NTU correction. */
export function forcedChannel(v: Numbers, surface: number, p: number) {
  const s = (v.width - v.fins * v.finThickness) / (v.fins - 1) / 1000;
  const l = v.finLength / 1000, length = v.height / 1000;
  const flowArea = (v.fins - 1) * s * l;
  const air = airProperties(surface, v.ambient, p);
  return { s, l, length, flowArea, air };
}
/** Surface capacity: geometry in mm, temperature in °C; SI internally. */
export function capacity(config: Config, surface = config.values.sinkTemperature, scale = 1) {
  const v = config.values, o = config.options, p = pressure(config);
  const i: Input = { ...v, sinkTemperature: surface, chassisTemperature: o.caseModel === "linked" ? surface : v.chassisTemperature };
  const b = calculate(i, o.caseModel !== "none", o.orientation, p);
  const delta = surface - v.ambient, n = v.fins, w = v.width / 1000, h = v.height / 1000;
  const l = v.finLength / 1000, tb = v.baseThickness / 1000, tf = v.finThickness / 1000;
  const cf = v.convectionFactor * scale, warnings = [...b.warnings];
  const finArea = 2 * n * l * h + n * tf * h + 2 * n * l * tf;
  const finDirect = 2 * l * h + n * tf * h + 2 * n * l * tf;
  const baseDirect = 2 * tb * (h + w);
  let finG = o.orientation === "vertical" ? b.channelH * b.finFaces + b.sinkPlate.h * (2 * l * h + n * tf * h) : b.horizontalArray.h * finArea;
  let baseG = o.orientation === "vertical" ? b.channelH * b.exposedBase + b.sinkPlate.h * 2 * tb * h : b.horizontalArray.h * (b.exposedBase + baseDirect);
  let forced = { active: false, velocity: 0, flowCFM: 0, re: 0, nu: 0, h: 0, heatCapacityRate: 0, inRange: true };
  let channelFinG = 0, channelBaseG = 0;
  if (o.cooling === "forced") {
    const f = forcedChannel(v, surface, p);
    const velocity = o.flowMode === "velocity" ? v.velocity : v.flowCFM * 0.00047194745 / f.flowArea;
    const re = velocity * f.s * f.s / (f.air.nu * f.length);
    const a = re * f.air.pr / 2;
    const developing = re > 0 ? 0.664 * Math.sqrt(re) * f.air.pr ** (1 / 3) * Math.sqrt(1 + 3.65 / Math.sqrt(re)) : 0;
    const nu = re > 0 ? (a ** -3 + developing ** -3) ** (-1 / 3) : 0;
    const hc = nu * f.air.k / f.s;
    forced = { active: velocity > 0, velocity, flowCFM: velocity * f.flowArea / 0.00047194745, re, nu, h: hc,
      heatCapacityRate: f.air.rho * f.air.cp * velocity * f.flowArea, inRange: re > 0.26 && re < 175 };
    if (forced.active) {
      // Forced stream crosses the H direction, enclosed/baffled between fins.
      // Outermost faces and case remain naturally cooled; no mixing multiplier.
      channelFinG = hc * b.finFaces; channelBaseG = hc * b.exposedBase;
      finG = channelFinG + b.sinkPlate.h * (2 * l * h + n * tf * h);
      baseG = channelBaseG + b.sinkPlate.h * 2 * tb * h;
      for (let j = warnings.length - 1; j >= 0; j--) if (warnings[j].startsWith("水平")) warnings.splice(j, 1);
      if (!forced.inRange) warnings.push("強制通道式超出 0.26 < Re* < 175 的驗證範圍；僅供外推，不列入尺寸建議。");
      if (hc < (o.orientation === "vertical" ? b.channelH : b.horizontalArray.h)) warnings.push("風速偏低：強制式預測低於自然對流；混合對流與逆向流動未建模，請改用自然模式交叉檢查。");
      warnings.push("強制估算假設有效風量全數沿 H 穿過鰭片通道、有導流且均勻；未求風扇工作點、旁通及壓降。外表面與機殼仍採自然對流。");
    } else warnings.push("風速／風量為零，已回到自然對流計算。");
  }
  finG *= cf; baseG *= cf;
  const tk = surface + 273.15, ak = v.ambient + 273.15;
  const blackHr = SIGMA * (tk + ak) * (tk * tk + ak * ak) * scale;
  const cavityArea = b.effectiveEmissivity * b.openingArea;
  const finRadG = blackHr * (cavityArea * b.finFaces / b.channelArea + v.emissivity * finDirect);
  const baseRadG = blackHr * (cavityArea * b.exposedBase / b.channelArea + v.emissivity * baseDirect);
  const ac = h * tf, perimeter = 2 * (h + tf), lc = l + ac / perimeter;
  const mLc = Math.sqrt(Math.max(0, (finG + finRadG) * lc / (n * v.conductivity * ac)));
  const efficiency = o.efficiency && mLc > 1e-10 ? Math.tanh(mLc) / mLc : 1;
  let sinkConvection = (baseG + efficiency * finG) * delta;
  // The inlet-reference model already includes air warming. This explicit
  // upper bound handles the added channel base area without double counting.
  if (forced.active) {
    const channelQ = (channelBaseG + efficiency * channelFinG) * cf * delta;
    const cap = forced.heatCapacityRate * delta;
    sinkConvection -= Math.max(0, channelQ - cap);
  }
  const sinkRadiation = (baseRadG + efficiency * finRadG) * delta;
  let caseConv = b.chassisConvection * cf, caseRad = b.chassisRadiation * scale;
  if (o.blockBottom && o.caseModel !== "none") {
    const tc = i.chassisTemperature, area = b.chassisHorizontalArea;
    caseConv = Math.max(0, caseConv - b.horizontal.down * area * (tc - v.ambient) * cf);
    caseRad = Math.max(0, caseRad - v.emissivity * SIGMA * area * ((tc + 273.15) ** 4 - ak ** 4) * scale);
    warnings.push("機殼朝下表面視為絕熱遮蔽，已移除其對流與輻射；未加計接觸到桌面／固定座的導熱。");
  }
  if (v.clearanceIn < b.spacing || v.clearanceOut < Math.max(b.spacing, v.finLength) || v.clearanceSide < b.spacing) warnings.push("淨空偏小：自由進出氣與開放空間假設可能不成立。淨空檢核不會自動套用通用係數，請依試驗設定對流保留係數。");
  if (v.convectionFactor < 1) warnings.push(`對流已乘使用者設定的 ${v.convectionFactor.toFixed(2)} 保留係數；這不是通用淨空關係式。`);
  if (o.caseModel === "fixed") warnings.push("機殼採獨立指定溫度：只加總容量，不反推系統溫度、不判定負載，也不做尺寸建議。");
  if (o.caseModel === "linked") warnings.push("機殼與鰭片根部假設同溫，等同理想熱連接；連接熱阻較大時請改用不計機殼。");
  const convection = sinkConvection + caseConv, radiation = sinkRadiation + caseRad;
  const total = convection + radiation, massGrams = b.massGrams * v.density / 2700;
  return { ...b, total, convection, radiation, sinkConvection, sinkRadiation, chassisConvection: caseConv, chassisRadiation: caseRad,
    sinkTotal: sinkConvection + sinkRadiation, chassisTotal: caseConv + caseRad, massGrams, efficiency, mLc, forced,
    radiationPercent: total > 0 ? radiation / total * 100 : 0, wattsPerKg: total / (massGrams / 1000),
    pressurePa: p, surface, warnings, correlationInRange: forced.active ? forced.inRange : b.correlationInRange };
}
export function solveTemperature(config: Config, watts = config.values.heatLoad, scale = 1) {
  if (config.options.caseModel === "fixed") return { temperature: null, residual: null, reason: "獨立機殼溫度無法反推" };
  if (watts < 0 || !Number.isFinite(watts)) throw new RangeError("Invalid heat load");
  const ambient = config.values.ambient;
  if (watts === 0) return { temperature: ambient, residual: 0, reason: "" };
  if (capacity(config, 200, scale).total < watts) return { temperature: null, residual: null, reason: "超過 200 °C 求解上限" };
  let low = ambient, high = 200;
  for (let k = 0; k < 55; k++) {
    const mid = (low + high) / 2;
    if (capacity(config, mid, scale).total < watts) low = mid; else high = mid;
  }
  const temperature = (low + high) / 2;
  return { temperature, residual: capacity(config, temperature, scale).total - watts, reason: "" };
}
export function evaluate(config: Config) {
  const v = config.values, path = thermalPath(v), designLoad = v.heatLoad * (1 + v.margin / 100);
  const sourceAllowedBase = v.sourceLimit - designLoad * path.total;
  const allowedBase = Math.min(v.sinkTemperature, sourceAllowedBase);
  const fixed = config.options.caseModel === "fixed";
  const temperature = fixed ? v.sinkTemperature : Math.max(v.ambient, allowedBase);
  const nominal = capacity(config, temperature), low = capacity(config, temperature, 1 - v.uncertainty / 100), high = capacity(config, temperature, 1 + v.uncertainty / 100);
  const possible = allowedBase >= v.ambient;
  const status: "capacity-only" | "insufficient" | "review" | "adequate" = fixed ? "capacity-only" : !possible || nominal.total < designLoad ? "insufficient" : low.total < designLoad || !nominal.correlationInRange ? "review" : "adequate";
  const operating = solveTemperature(config);
  const hot = solveTemperature(config, v.heatLoad, 1 - v.uncertainty / 100);
  const cool = solveTemperature(config, v.heatLoad, 1 + v.uncertainty / 100);
  return { nominal, low, high, designLoad, allowedBase, sourceAllowedBase, path, status, operating, hot, cool,
    sourceTemperature: operating.temperature == null ? null : operating.temperature + v.heatLoad * path.total,
    requiredR: designLoad > 0 && possible ? (allowedBase - v.ambient) / designLoad : null,
    operatingR: v.heatLoad > 0 && operating.temperature != null ? (operating.temperature - v.ambient) / v.heatLoad : null,
    availableMarginPercent: v.heatLoad > 0 ? (nominal.total / v.heatLoad - 1) * 100 : null,
  };
}
export function designSweep(config: Config, surface: number) {
  const points = [];
  for (let fins = Math.max(2, config.values.fins - 6); fins <= Math.min(200, config.values.fins + 6); fins++) {
    if (fins * config.values.finThickness >= config.values.width) continue;
    const r = capacity({ ...config, values: { ...config.values, fins } }, surface);
    points.push({ fins, total: r.total, convection: r.convection, radiation: r.radiation, spacing: r.spacing, massGrams: r.massGrams, eligible: r.correlationInRange && r.spacing >= 4 });
  }
  return points;
}
export const DEFAULT_BOUNDS = { minN: 4, maxN: 40, minH: 200, maxH: 400, minL: 15, maxL: 60, stepH: 20, stepL: 5, minGap: 4, maxMassKg: 5 };
export type Bounds = typeof DEFAULT_BOUNDS;
export function searchSizes(config: Config, bounds: Bounds) {
  if (config.options.caseModel === "fixed") throw new RangeError("請先改用不計機殼，或機殼同溫模式。");
  if (Object.values(bounds).some(x => !Number.isFinite(x) || x <= 0) || bounds.minN < 2 || bounds.maxN > 200 || !Number.isInteger(bounds.minN) || !Number.isInteger(bounds.maxN) || bounds.minN > bounds.maxN || bounds.minH > bounds.maxH || bounds.minL > bounds.maxL || bounds.maxH > 3000 || bounds.maxL > 3000) throw new RangeError("請檢查尺寸上下限、正數步距及 2–200 的整數片數。");
  const hn = Math.floor((bounds.maxH - bounds.minH) / bounds.stepH + 1e-9) + 1, ln = Math.floor((bounds.maxL - bounds.minL) / bounds.stepL + 1e-9) + 1;
  const count = (bounds.maxN - bounds.minN + 1) * hn * ln;
  if (count > 30000) throw new RangeError("網格超過 30,000 組，請加大步距或縮小範圍。");
  const candidates: { values: Numbers; total: number; low: number; massKg: number; spacing: number; surface: number }[] = [];
  let checked = 0, outside = 0, meets = 0;
  const load = config.values.heatLoad * (1 + config.values.margin / 100);
  for (let fins = bounds.minN; fins <= bounds.maxN; fins++) for (let hi = 0; hi < hn; hi++) for (let li = 0; li < ln; li++) {
    const values = { ...config.values, fins, height: bounds.minH + hi * bounds.stepH, finLength: bounds.minL + li * bounds.stepL };
    if (fins * values.finThickness >= values.width || values.sourceLength > values.height) continue;
    const c = { ...config, values }, surface = Math.min(values.sinkTemperature, values.sourceLimit - load * thermalPath(values).total);
    if (surface < values.ambient) continue;
    const r = capacity(c, surface), low = capacity(c, surface, 1 - values.uncertainty / 100).total;
    checked++;
    if (!r.correlationInRange) { outside++; continue; }
    if (r.spacing + 1e-9 < bounds.minGap || r.massGrams / 1000 > bounds.maxMassKg || low < load) continue;
    meets++;
    candidates.push({ values, total: r.total, low, massKg: r.massGrams / 1000, spacing: r.spacing, surface });
  }
  candidates.sort((a, b) => a.massKg - b.massKg || b.low - a.low);
  return { candidates: candidates.slice(0, 8), count, checked, outside, meets };
}
export type Scenario = { id: string; name: string; savedAt: string; config: Config };
export function parseScenarios(raw: string): Scenario[] {
  if (raw.length > 500000) throw new RangeError("方案檔案過大");
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > 30) throw new RangeError("方案格式錯誤或超過 30 筆");
  return data.map((x: Scenario) => {
    if (!x || typeof x.name !== "string" || x.name.length > 80 || typeof x.id !== "string" || !x.config?.options || !x.config?.values || !validateDesign(numberDraft(x.config.values), x.config.options).valid) throw new RangeError("方案內容無效");
    return { id: x.id.slice(0, 100), name: x.name, savedAt: typeof x.savedAt === "string" ? x.savedAt.slice(0, 40) : "", config: { values: { ...x.config.values }, options: { ...x.config.options } } };
  });
}
export function scenariosCSV(scenarios: Scenario[]) {
  const esc = (value: unknown) => { let text = String(value ?? ""); if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
  const keys = Object.keys(DEFAULT_NUMBERS) as NumberKey[], optionKeys = Object.keys(DEFAULT_OPTIONS) as (keyof Options)[];
  const header = ["name", "savedAt", "model", ...keys, ...optionKeys, "capacity_W", "low_W", "high_W", "status", "sink_C", "source_C", "mass_kg", "efficiency"];
  const rows = scenarios.map(s => { const r = evaluate(s.config); return [s.name, s.savedAt, MODEL_VERSION, ...keys.map(k => s.config.values[k]), ...optionKeys.map(k => s.config.options[k]), r.nominal.total, r.low.total, r.high.total, r.status, r.operating.temperature, r.sourceTemperature, r.nominal.massGrams / 1000, r.nominal.efficiency]; });
  return "\uFEFF" + [header, ...rows].map(row => row.map(esc).join(",")).join("\r\n");
}
