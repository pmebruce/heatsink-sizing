/** Isothermal plate-fin sizing model. Inputs mm/°C; internal geometry m. */
export type Orientation = "vertical" | "horizontal-up";
export const DEFAULT_INPUT = {
  fins: 14, emissivity: 0.8, chassisDepth: 67, width: 195.2, height: 312.4,
  finLength: 32, baseThickness: 10, finThickness: 2,
  ambient: 25, sinkTemperature: 70, chassisTemperature: 65,
};
export type Input = typeof DEFAULT_INPUT;
export type InputKey = keyof Input;
export type Draft = Record<InputKey, string>;
export const INPUT_KEYS = Object.keys(DEFAULT_INPUT) as InputKey[];
export const MIN_RECOMMENDED_GAP = 4;
export const ALUMINUM_DENSITY = 2700;
export const SIGMA = 5.670374419e-8;
export function toDraft(input: Input): Draft {
  return Object.fromEntries(INPUT_KEYS.map((key) => [key, String(input[key])])) as Draft;
}
export function validateInput(draft: Draft, includeChassis: boolean) {
  const errors: Partial<Record<InputKey, string>> = {};
  const input = {} as Input;
  for (const key of INPUT_KEYS) {
    const raw = String(draft[key] ?? "").trim().replace(/,/g, ".");
    input[key] = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(input[key])) errors[key] = "請輸入有效數字";
  }
  for (const key of ["width", "height", "finLength", "baseThickness", "finThickness"] as InputKey[]) {
    if (Number.isFinite(input[key]) && (input[key] <= 0 || input[key] > 3000)) errors[key] = "需大於 0 且不超過 3,000 mm";
  }
  if (Number.isFinite(input.chassisDepth) && (input.chassisDepth < 0 || input.chassisDepth > 3000 || (includeChassis && input.chassisDepth === 0))) errors.chassisDepth = includeChassis ? "需大於 0 且不超過 3,000 mm" : "需介於 0–3,000 mm";
  if (Number.isFinite(input.fins) && (!Number.isInteger(input.fins) || input.fins < 2 || input.fins > 200)) errors.fins = "請輸入 2–200 的整數";
  if (Number.isFinite(input.emissivity) && (input.emissivity < 0 || input.emissivity > 1)) errors.emissivity = "放射率需介於 0–1";
  for (const key of ["ambient", "sinkTemperature", "chassisTemperature"] as InputKey[]) {
    if (Number.isFinite(input[key]) && (input[key] < -40 || input[key] > 200)) errors[key] = "此模型支援 −40 至 200 °C";
  }
  if (!errors.sinkTemperature && !errors.ambient && input.sinkTemperature < input.ambient) errors.sinkTemperature = "散熱評估需不低於環境溫度";
  if (includeChassis && !errors.chassisTemperature && !errors.ambient && input.chassisTemperature < input.ambient) errors.chassisTemperature = "機殼溫度需不低於環境溫度";
  if (!errors.fins && !errors.width && !errors.finThickness && input.fins * input.finThickness >= input.width) errors.finThickness = "N × 鰭片厚度需小於寬度 W";
  return { input, errors, valid: Object.keys(errors).length === 0 };
}
export function airProperties(surface: number, ambient: number, pressurePa = 101325) {
  const temperature = (surface + ambient) / 2 + 273.15;
  // COMSOL Sutherland constants; dry air at 1 atm with constant cp approximation.
  const mu = 1.716e-5 * (temperature / 273) ** 1.5 * (273 + 111) / (temperature + 111);
  const k = 0.0241 * (temperature / 273) ** 1.5 * (273 + 194) / (temperature + 194);
  const rho = pressurePa / (287.05 * temperature);
  const cp = 1006, nu = mu / rho, alpha = k / (rho * cp);
  return { temperature, mu, k, rho, cp, nu, alpha, pr: nu / alpha, beta: 1 / temperature };
}
export function verticalPlate(surface: number, ambient: number, height: number, pressurePa = 101325) {
  const air = airProperties(surface, ambient, pressurePa);
  if (height <= 0) return { h: 0, rayleigh: 0, nusselt: 0, air };
  const rayleigh = 9.80665 * air.beta * Math.abs(surface - ambient) * height ** 3 / (air.nu * air.alpha);
  const laminar = 0.68 + 0.670 * rayleigh ** 0.25 / (1 + (0.492 / air.pr) ** (9 / 16)) ** (4 / 9);
  const general = (0.825 + 0.387 * rayleigh ** (1 / 6) / (1 + (0.492 / air.pr) ** (9 / 16)) ** (8 / 27)) ** 2;
  const nusselt = rayleigh <= 1e9 ? laminar : general;
  return { h: nusselt * air.k / height, rayleigh, nusselt, air };
}
export function horizontalPlate(surface: number, ambient: number, width: number, depth: number, pressurePa = 101325) {
  const air = airProperties(surface, ambient, pressurePa);
  const characteristicLength = width * depth / (2 * (width + depth));
  if (characteristicLength <= 0) return { up: 0, down: 0, rayleigh: 0, characteristicLength: 0 };
  const rayleigh = 9.80665 * air.beta * Math.abs(surface - ambient) * characteristicLength ** 3 / (air.nu * air.alpha);
  const nuUp = rayleigh <= 1e7 ? 0.54 * rayleigh ** 0.25 : 0.15 * rayleigh ** (1 / 3);
  const nuDown = 0.27 * rayleigh ** 0.25;
  return { up: nuUp * air.k / characteristicLength, down: nuDown * air.k / characteristicLength, rayleigh, characteristicLength };
}
/**
 * Tari & Mehrtash (2013), upward-facing horizontal plate-fin arrays.
 * https://doi.org/10.1016/j.applthermaleng.2013.09.003
 * Equation and geometry limits also tabulated in González Gallero et al. (2019),
 * Table 4: https://doi.org/10.1016/j.applthermaleng.2019.04.086
 * Modified Ra < 5000: Liou et al. (2022),
 * https://www.sciencedirect.com/science/article/abs/pii/S1290072921003938
 * Their fin height H and fin length L map to this app's L and H, respectively.
 */
export function horizontalFinArray(surface: number, ambient: number, spacing: number, finHeight: number, finLength: number, pressurePa = 101325) {
  const air = airProperties(surface, ambient, pressurePa);
  const rayleigh = 9.80665 * air.beta * Math.abs(surface - ambient) * spacing ** 3 / (air.nu * air.alpha);
  const heightLength = finHeight / finLength, spacingHeight = spacing / finHeight, spacingLength = spacing / finLength;
  const modifiedRayleigh = rayleigh * heightLength ** 0.5 * spacingHeight ** 0.38;
  const nusselt = 0.0915 * modifiedRayleigh ** 0.436;
  const limits = [
    { name: "S/L", value: spacingHeight, min: 0.35, max: 2.94 },
    { name: "L/H", value: heightLength, min: 0.015, max: 0.1 },
    { name: "S/H", value: spacingLength, min: 0.026, max: 0.059 },
  ];
  const outsideLimits = limits.filter(({ value, min, max }) => value < min - 1e-12 || value > max + 1e-12);
  const rayleighInRange = modifiedRayleigh < 5000;
  return { h: nusselt * air.k / spacing, nusselt, rayleigh, modifiedRayleigh, air,
    limits, outsideLimits, rayleighInRange, inRange: outsideLimits.length === 0 && rayleighInRange };
}
export function calculate(input: Input, includeChassis = true, orientation: Orientation = "vertical", pressurePa = 101325) {
  if (!validateInput(toDraft(input), includeChassis).valid) throw new RangeError("Invalid heatsink inputs");
  if (orientation !== "vertical" && orientation !== "horizontal-up") throw new RangeError("Invalid heatsink orientation");
  const finsUp = orientation === "horizontal-up";
  const { fins: n, emissivity: epsilon, ambient: ta, sinkTemperature: ts, chassisTemperature: tc } = input;
  const w = input.width / 1000, h = input.height / 1000, l = input.finLength / 1000;
  const x = input.chassisDepth / 1000, tb = input.baseThickness / 1000, tf = input.finThickness / 1000;
  const spacing = (w - n * tf) / (n - 1);
  const sinkPlate = verticalPlate(ts, ta, finsUp ? l : h, pressurePa), chassisPlate = verticalPlate(tc, ta, finsUp ? x : h, pressurePa);
  const air = sinkPlate.air, delta = ts - ta;
  const elenbaas = 9.80665 * air.beta * delta * spacing ** 4 / (air.nu * air.alpha * h);
  const nuChannel = elenbaas > 0 ? (576 / elenbaas ** 2 + 2.873 / Math.sqrt(elenbaas)) ** -0.5 : 0;
  const channelH = nuChannel * air.k / spacing;
  const finFaces = 2 * (n - 1) * l * h, exposedBase = (n - 1) * spacing * h;
  const channelArea = finFaces + exposedBase;
  const outerVerticalArea = 2 * l * h + n * tf * h + 2 * tb * h;
  const endFaceArea = 2 * w * tb + 2 * n * l * tf;
  const horizontalArray = horizontalFinArray(ts, ta, spacing, l, h, pressurePa);
  const arrayArea = channelArea + outerVerticalArea + endFaceArea;
  // Horizontal-array h is an overall mean; apply once to the exposed area.
  // Including the small base edges at that same h is an area approximation.
  const sinkConvection = finsUp ? horizontalArray.h * arrayArea * delta
    : (channelH * channelArea + sinkPlate.h * outerVerticalArea) * delta;
  // Lumped gray U-cavity with a front (vertical) or top (fins-up) opening.
  // Axial openings are omitted. A rigid rotation in isothermal surroundings
  // changes convection, not these radiation areas or view-factor approximations.
  const openingArea = exposedBase;
  const effectiveEmissivity = epsilon === 0 ? 0 : 1 / (1 + (1 - epsilon) / epsilon * openingArea / channelArea);
  const directRadiationArea = outerVerticalArea + endFaceArea;
  const radiationFactor = SIGMA * ((ts + 273.15) ** 4 - (ta + 273.15) ** 4);
  const sinkRadiation = (effectiveEmissivity * openingArea + epsilon * directRadiationArea) * radiationFactor;
  const chassisVerticalArea = finsUp ? 2 * x * (w + h) : w * h + 2 * x * h;
  const chassisHorizontalArea = finsUp ? w * h : w * x;
  const horizontal = horizontalPlate(tc, ta, w, finsUp ? h : x, pressurePa);
  const chassisConvection = includeChassis ? (chassisPlate.h * chassisVerticalArea + (finsUp ? horizontal.down : horizontal.up + horizontal.down) * chassisHorizontalArea) * (tc - ta) : 0;
  const chassisRadiationArea = w * h + 2 * x * h + 2 * w * x;
  const chassisRadiation = includeChassis ? epsilon * SIGMA * chassisRadiationArea * ((tc + 273.15) ** 4 - (ta + 273.15) ** 4) : 0;
  const convection = sinkConvection + chassisConvection, radiation = sinkRadiation + chassisRadiation;
  const total = convection + radiation;
  const massGrams = ALUMINUM_DENSITY * (w * h * tb + n * tf * h * l) * 1000;
  const warnings: string[] = [];
  if (spacing * 1000 < MIN_RECOMMENDED_GAP) warnings.push(`目前間距小於 ${MIN_RECOMMENDED_GAP} mm，低於圖片的間距條件；仍顯示估算，但不列為建議點。`);
  if (h < 5 * l || h < 5 * spacing) warnings.push("H 相對於 L 或間距 S 較短，長通道與二維輻射近似的誤差可能增加。");
  if (!finsUp && sinkPlate.rayleigh > 1e9) warnings.push("高度方向 Ra 超過 10⁹；外側平板已改用全域式，鰭片通道式的適用性需另外確認。");
  if (finsUp && horizontalArray.outsideLimits.length > 0) {
    const bounds = horizontalArray.outsideLimits.map(({ name, value, min, max }) => `${name} = ${value.toFixed(3)}（範圍 ${min}–${max}）`).join("、");
    warnings.push(`水平鰭片式超出幾何適用範圍：${bounds}。目前結果為外推粗估，不列為建議點。`);
  }
  if (finsUp && !horizontalArray.rayleighInRange) warnings.push(`水平式的修正 Ra′ = ${horizontalArray.modifiedRayleigh.toExponential(2)}，超出 Ra′ < 5,000 的範圍；結果為外推粗估，不列為建議點。`);
  if (includeChassis && tc > ts) warnings.push("機殼溫度高於散熱片；結果為兩個指定表面溫度下的散熱量加總，未求解兩者間的熱傳。");
  return {
    orientation, spacing: spacing * 1000, massGrams, convection, radiation, total,
    radiationPercent: total > 0 ? radiation / total * 100 : 0,
    sinkConvection, sinkRadiation, chassisConvection, chassisRadiation,
    sinkTotal: sinkConvection + sinkRadiation, chassisTotal: chassisConvection + chassisRadiation,
    channelH, nuChannel, elenbaas, sinkPlate, chassisPlate, horizontal, horizontalArray, arrayArea,
    channelArea, finFaces, exposedBase, outerVerticalArea, endFaceArea,
    openingArea, effectiveEmissivity, directRadiationArea, chassisVerticalArea, chassisHorizontalArea, chassisRadiationArea,
    correlationInRange: !finsUp || horizontalArray.inRange,
    warnings, totalDepth: input.chassisDepth + input.baseThickness + input.finLength,
  };
}
export type Result = ReturnType<typeof calculate>;
export function finSweep(input: Input, includeChassis = true, orientation: Orientation = "vertical") {
  const start = Math.max(2, input.fins - 5), end = Math.min(200, input.fins + 5);
  const points = [];
  for (let fins = start; fins <= end; fins++) {
    if (fins * input.finThickness >= input.width) continue;
    const result = calculate({ ...input, fins }, includeChassis, orientation);
    points.push({ fins, ...result, recommended: result.spacing >= MIN_RECOMMENDED_GAP - 1e-9 && result.correlationInRange });
  }
  const eligible = points.filter((point) => point.recommended);
  const best = eligible.reduce<(typeof points)[number] | null>((current, point) => !current || point.total > current.total + 1e-9 ? point : current, null);
  return { points, best };
}
