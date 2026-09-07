import assert from "node:assert/strict";
import test from "node:test";
import { calculate, DEFAULT_INPUT as sample, toDraft, validateInput, finSweep, airProperties } from "../lib/thermal.ts";

test("image benchmark: spacing and aluminium mass match the supplied dimensions",()=>{
  const r=calculate(sample);
  assert.equal(r.spacing.toFixed(1),"12.9");
  assert.equal(r.massGrams.toFixed(1),"2402.2");
  assert.ok(r.total>140 && r.total<180,"Independent estimate remains near the 156.9 W reference without calibrating to it");
  assert.ok(Math.abs(r.total-161.80822220997885)<1e-9,"Existing vertical model remains unchanged");
});
test("thermal equilibrium gives exactly zero heat flow",()=>{
  const r=calculate({...sample,sinkTemperature:25,chassisTemperature:25});
  assert.equal(r.total,0); assert.equal(r.convection,0); assert.equal(r.radiation,0);
  assert.equal(r.radiationPercent,0);
});
test("zero emissivity removes all radiation and leaves convection unchanged",()=>{
  const normal=calculate(sample), mirror=calculate({...sample,emissivity:0});
  assert.equal(mirror.radiation,0); assert.equal(mirror.convection,normal.convection);
});
test("black surfaces and every permitted fin count stay finite and bounded",()=>{
  for(let n=2;n<=97;n++){
    const r=calculate({...sample,fins:n,emissivity:1});
    assert.ok(Number.isFinite(r.total)&&r.total>0);
    assert.ok(r.radiationPercent>=0&&r.radiationPercent<=100);
    assert.equal(r.effectiveEmissivity,1);
  }
});
test("case exclusion removes only its heat loss, never adding a second rear surface",()=>{
  const full=calculate(sample), sink=calculate(sample,false);
  assert.equal(sink.chassisTotal,0); assert.equal(sink.sinkTotal,full.sinkTotal);
  assert.ok(Math.abs(full.total-sink.total-full.chassisTotal)<1e-9);
  const deeper=calculate({...sample,chassisDepth:120},false);
  assert.equal(deeper.total,sink.total); assert.equal(deeper.massGrams,sink.massGrams);
});
test("more fins can impede natural convection; the best point respects the gap constraint",()=>{
  assert.ok(calculate({...sample,fins:50}).convection<calculate({...sample,fins:18}).convection);
  const {points,best}=finSweep(sample);
  assert.ok(points.some(p=>p.fins===14));
  assert.ok(best.spacing>=4); assert.ok(best.total>=calculate(sample).total);
});
test("numeric editing accepts decimal strings and rejects impossible configurations",()=>{
  assert.equal(validateInput({...toDraft(sample),finThickness:"3."},true).valid,true);
  assert.equal(validateInput({...toDraft(sample),finThickness:"3.5"},true).input.finThickness,3.5);
  for (const changes of [{width:""},{width:"NaN"},{emissivity:"1.1"},{fins:"14.5"},{finThickness:"20"},{sinkTemperature:"-5"},{fins:"201"}]) {
    assert.equal(validateInput({...toDraft(sample),...changes},true).valid,false,JSON.stringify(changes));
  }
});
test("air properties at room temperature remain physically reasonable",()=>{
  const a=airProperties(25,25);
  assert.ok(a.rho>1.16 && a.rho<1.20); assert.ok(a.k>.025 && a.k<.027);
  assert.ok(a.pr>.68 && a.pr<.75);
});

test("rotating fins upwards changes convection while preserving geometry and radiation",()=>{
  const vertical=calculate(sample), up=calculate(sample,true,"horizontal-up");
  assert.notEqual(up.sinkConvection,vertical.sinkConvection);
  assert.notEqual(up.chassisConvection,vertical.chassisConvection);
  for(const key of ["spacing","massGrams","sinkRadiation","chassisRadiation","totalDepth"])
    assert.equal(up[key],vertical[key],key);
  assert.ok(Math.abs(up.total-up.convection-up.radiation)<1e-9);
  assert.ok(up.horizontalArray.h>4 && up.horizontalArray.h<6);
});

test("horizontal heat flow vanishes at equilibrium and emissivity only affects radiation",()=>{
  for(const includeCase of [true,false]){
    const equilibrium=calculate({...sample,sinkTemperature:25,chassisTemperature:25},includeCase,"horizontal-up");
    assert.equal(equilibrium.total,0);
    assert.equal(equilibrium.horizontalArray.h,0);
    const normal=calculate(sample,includeCase,"horizontal-up");
    const mirror=calculate({...sample,emissivity:0},includeCase,"horizontal-up");
    assert.equal(mirror.radiation,0);
    assert.equal(mirror.convection,normal.convection);
  }
});

test("horizontal chassis has four vertical sides and one downward-facing bottom",()=>{
  const up=calculate(sample,true,"horizontal-up");
  // Face dimensions in metres; the covered top face must not be counted.
  const sides=2*.067*.1952+2*.067*.3124, bottom=.1952*.3124;
  assert.ok(Math.abs(up.chassisVerticalArea-sides)<1e-12);
  assert.ok(Math.abs(up.chassisHorizontalArea-bottom)<1e-12);
  assert.ok(Math.abs(up.chassisRadiationArea-sides-bottom)<1e-12);
  const sink=calculate({...sample,chassisDepth:0},false,"horizontal-up");
  assert.equal(sink.chassisTotal,0);
  assert.equal(sink.sinkTotal,up.sinkTotal);
  assert.ok(Number.isFinite(sink.chassisPlate.h));
  const caseOnly=calculate({...sample,sinkTemperature:sample.ambient},true,"horizontal-up");
  assert.equal(caseOnly.sinkTotal,0);
  assert.equal(caseOnly.total,up.chassisTotal);
});

test("horizontal recommendations exclude geometric and Rayleigh extrapolation",()=>{
  assert.equal(calculate(sample,true,"horizontal-up").correlationInRange,false);
  assert.equal(finSweep(sample,true,"horizontal-up").best,null);
  const inside={...sample,finLength:30};
  assert.equal(calculate(inside,true,"horizontal-up").correlationInRange,true);
  const {points,best}=finSweep(inside,true,"horizontal-up");
  assert.ok(best && best.spacing>=4 && best.correlationInRange);
  assert.ok(points.some(p=>!p.recommended && p.total>best.total),"Higher extrapolated values must not become recommendations");
  assert.equal(best.total,Math.max(...points.filter(p=>p.recommended).map(p=>p.total)));
  const large={...inside};
  for(const key of ["width","height","finLength","finThickness","baseThickness","chassisDepth"]) large[key]*=4;
  const largeResult=calculate(large,true,"horizontal-up");
  assert.equal(largeResult.horizontalArray.outsideLimits.length,0,"Scaling preserves geometric ratios");
  assert.equal(largeResult.horizontalArray.rayleighInRange,false,"Buoyancy scales with length cubed");
  assert.equal(largeResult.correlationInRange,false);
  assert.ok(largeResult.warnings.some(w=>w.includes("5,000")));
});

test("horizontal calculation stays finite as spacing shrinks and rejects unknown mounting",()=>{
  for(let fins=2;fins<=97;fins++){
    const r=calculate({...sample,fins},true,"horizontal-up");
    assert.ok(Number.isFinite(r.total) && r.total>0);
    assert.ok(r.radiationPercent>=0 && r.radiationPercent<=100);
  }
  assert.ok(calculate({...sample,fins:97},false,"horizontal-up").sinkConvection<calculate(sample,false,"horizontal-up").sinkConvection);
  assert.throws(()=>calculate(sample,true,"horizontal-down"),RangeError);
});
