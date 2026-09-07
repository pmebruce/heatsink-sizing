import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, DEFAULT_BOUNDS, numberDraft, validateDesign, capacity, evaluate, solveTemperature, pressure, thermalPath, searchSizes, parseScenarios, scenariosCSV } from '../lib/design.ts';
import { calculate } from '../lib/thermal.ts';
const config = (values = {}, options = {}) => ({ values: { ...DEFAULT_CONFIG.values, ...values }, options: { ...DEFAULT_CONFIG.options, ...options } });
const close = (a,b,tol=1e-7) => assert.ok(Math.abs(a-b)<tol, `${a} != ${b}`);
test('isothermal design preserves legacy convection, cavity radiation and mass in both orientations', () => {
  for (const orientation of ['vertical','horizontal-up']) {
    const c = config({}, { efficiency:false, caseModel:'fixed', orientation });
    const r = capacity(c), old = calculate(c.values,true,orientation);
    close(r.total,old.total); close(r.convection,old.convection); close(r.radiation,old.radiation); close(r.massGrams,old.massGrams);
  }
});
test('finite conductivity reduces capacity; infinite k approaches isothermal limit', () => {
  const c=config({}, {caseModel:'none'}), finite=capacity(c), iso=capacity(config({}, {caseModel:'none',efficiency:false}));
  assert.ok(finite.efficiency>0 && finite.efficiency<1); assert.ok(finite.total<iso.total);
  assert.ok(capacity(config({conductivity:1e12},{caseModel:'none'})).total > iso.total*.999999);
  assert.ok(capacity(config({conductivity:20},{caseModel:'none'})).total < finite.total);
});
test('inverse solves energy balance for natural, horizontal and forced models', () => {
  for (const orientation of ['vertical','horizontal-up']) for (const cooling of ['natural','forced']) for (const caseModel of ['none','linked']) {
    const c=config({heatLoad:75}, {orientation,cooling,caseModel}), r=solveTemperature(c);
    assert.ok(r.temperature>c.values.ambient && r.temperature<200); close(capacity(c,r.temperature).total,75,1e-6);
  }
  close(solveTemperature(config({heatLoad:0})).temperature,25);
  assert.equal(solveTemperature(config({heatLoad:100000})).temperature,null);
  assert.equal(solveTemperature(config({}, {caseModel:'fixed'})).temperature,null);
});
test('radiation vanishes at zero emissivity; all heat vanishes at ambient', () => {
  close(capacity(config({emissivity:0})).radiation,0);
  close(capacity(config(),25).total,0);
});
test('pressure lowers natural convection without changing radiation or solid mass', () => {
  close(pressure(config()),101325);
  const sea=capacity(config()), high=capacity(config({altitude:3000}));
  assert.ok(high.convection<sea.convection); close(high.massGrams,sea.massGrams);
  const iso=config({altitude:3000},{efficiency:false}); close(capacity(iso).radiation,capacity(config({}, {efficiency:false})).radiation);
  close(pressure(config({pressureKPa:80},{pressureMode:'direct'})),80000);
});
test('blocking bottom removes only case downward convection and radiation', () => {
  for(const orientation of ['vertical','horizontal-up']) {
    const a=capacity(config({}, {orientation})), b=capacity(config({}, {orientation,blockBottom:true}));
    assert.ok(b.chassisConvection<a.chassisConvection); assert.ok(b.chassisRadiation<a.chassisRadiation); close(a.sinkTotal,b.sinkTotal);
  }
});
test('zero flow falls back to natural; velocity and actual volume flow agree', () => {
  const c=config({}, {cooling:'forced'}), a=capacity(c);
  const b=capacity(config({flowCFM:a.forced.flowCFM},{cooling:'forced',flowMode:'volume'})); close(a.total,b.total);
  close(capacity(config({velocity:0},{cooling:'forced'})).total,capacity(config()).total);
  const r=capacity(config({velocity:.0001,emissivity:0},{cooling:'forced',caseModel:'none'}));
  assert.ok(Number.isFinite(r.total)); assert.equal(r.correlationInRange,false);
});
test('margin changes design demand, not actual-load inverse temperature', () => {
  const a=evaluate(config({margin:0})), b=evaluate(config({margin:50}));
  close(b.designLoad,150); close(a.operating.temperature,b.operating.temperature);
  assert.ok(b.requiredR<a.requiredR);
  const fixed=evaluate(config({}, {caseModel:'fixed'})); assert.equal(fixed.status,'capacity-only');
});
test('source resistance obeys Fourier law and tight source limit fails sizing', () => {
  const c=config(), p=thermalPath(c.values); close(p.tim,.0002/(3*.0025)); close(p.base,.01/(200*.0025));
  const r=evaluate(c); close(r.sourceTemperature,r.operating.temperature+c.values.heatLoad*p.total);
  assert.equal(evaluate(config({sourceLimit:26})).status,'insufficient');
});
test('sensitivity brackets capacity and temperatures and collapses at zero', () => {
  const r=evaluate(config()); assert.ok(r.low.total<r.nominal.total && r.high.total>r.nominal.total);
  assert.ok(r.cool.temperature<r.operating.temperature && r.hot.temperature>r.operating.temperature);
  const z=evaluate(config({uncertainty:0})); close(z.low.total,z.high.total); close(z.hot.temperature,z.cool.temperature);
});
test('validation rejects incomplete, overlapping, out-of-bounds and malformed scenarios', () => {
  const d=numberDraft(config().values); assert.equal(validateDesign(d,config().options).valid,true);
  for(const patch of [{fins:'1.5'},{width:'1'},{heatLoad:''},{emissivity:'1.2'},{sourceWidth:'999'},{timK:'0'},{convectionFactor:'1.1'}]) assert.equal(validateDesign({...d,...patch},config().options).valid,false);
  assert.throws(()=>parseScenarios('[{"name":"bad"}]'));
  assert.throws(()=>parseScenarios(JSON.stringify([{id:'a',name:'a',config:config({}, {cooling:'invalid'})}])));
});
test('size search respects constraints, excludes horizontal extrapolation and sorts by mass', () => {
  const c=config({heatLoad:30}), b={...DEFAULT_BOUNDS,minN:8,maxN:12,minH:300,maxH:340,minL:20,maxL:30,maxMassKg:3};
  const r=searchSizes(c,b); assert.ok(r.candidates.length>0);
  r.candidates.forEach((x,i)=>{assert.ok(x.spacing>=b.minGap && x.massKg<=b.maxMassKg && x.low>=36); if(i) assert.ok(x.massKg>=r.candidates[i-1].massKg);});
  const h=searchSizes(config({heatLoad:1},{orientation:'horizontal-up'}),{...b,minL:100,maxL:100}); assert.equal(h.candidates.length,0); assert.ok(h.outside>0);
  assert.throws(()=>searchSizes(c,{...b,stepH:.00001}));
});
test('scenario backup round-trips and CSV protects spreadsheet formula strings', () => {
  const s=[{id:'1',name:'=SUM(1,2)',savedAt:'2026-09-07',config:config()}];
  assert.deepEqual(parseScenarios(JSON.stringify(s)),s);
  const csv=scenariosCSV(s); assert.ok(csv.includes('"\'=SUM(1,2)"')); assert.ok(csv.includes('capacity_W')); assert.ok(csv.includes('conductivity'));
});
