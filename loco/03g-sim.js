
/* ============================================================ SIMULATION */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const approach = (v, target, step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step);
const SPEC = {
  diesel:  { pMax:3300, fAdh:400, vMax:44, regenP:2500, fBrakeMax:200, mass:300 },
  electric:{ pMax:5600, fAdh:320, vMax:56, regenP:5000, fBrakeMax:160, mass:300 },
  tgv:     { pMax:8800, pDc:3680, fAdh:220, vMax:89, regenP:8000, fBrakeMax:380, fDisc:300, mass:380, r0:2.5, r1:0.02, r2:0.0075 },
};
const SIM_MUL = { p:1, a:1, b:1 };   // power, adhesion and brake multipliers: 1 = real physics (explainer); the kid build raises them in 03i-kid.js
function specNow(){   // a double TGV (UM) doubles power, adhesion, brakes and mass; under 1.5 kV DC a TGV set gives 3,680 kW, not 8,800
  const b = SPEC[S.mode], n = S.mode === 'tgv' ? S.sets : 1, m = SIM_MUL, dc = S.dc && b.pDc !== undefined;
  if (n === 1 && m.p === 1 && m.a === 1 && m.b === 1 && !dc) return b;
  const sp = { ...b, pMax:(dc ? b.pDc : b.pMax) * n * m.p, fAdh:b.fAdh * n * m.a, regenP:b.regenP * n * m.b, fBrakeMax:b.fBrakeMax * n * m.b, mass:b.mass * n };
  if (b.fDisc !== undefined){ sp.fDisc = b.fDisc * n * m.b; sp.r0 = b.r0 * n; sp.r1 = b.r1 * n; sp.r2 = b.r2 * (n === 2 ? 1.15 : 1); }
  return sp;
}
const S = {
  mode:'diesel', lang:T[document.documentElement.lang] ? document.documentElement.lang : 'en',
  battery:false, engine:'off', crankT:0, rpm:0, rpmN:0, fuel:0,
  notch:0, brake:0, dir:1, throttleN:0, brakeN:0,
  panto:false, pantoF:0, pantoDcF:0, dc:false, lineOn:false, vcb:false,
  dcV:0, dcN:0, excitation:0, powerN:0, tractionN:0, regenN:0,
  current:0, effort:0, speed:0, dist:0,
  temp:0.2, fans:0, fanOn:false, gridHeat:0, gridFan:0,
  flowsOn:true, labelsOn:false, explode:0, autoShutdown:false, shutdownT:0, time:0,
  sets:1, coupling:0, set2Off:-40, hatchF:0, doors:false, doorsF:0, autoStop:false, atStation:false, autoDoors:false, stationT:0, service:false, lights:true,
};
function startEngine(){ if (S.mode !== 'diesel' || !S.battery || S.engine !== 'off') return; S.engine = 'cranking'; S.crankT = 0; }
function stopEngine(){ if (S.engine === 'running') S.engine = 'stopping'; else if (S.engine === 'cranking') S.engine = 'off'; }

/* line voltage under the train: 25 kV AC on the high-speed lines, 1.5 kV DC on the older network (Toulouse to Angoulême, through Poitiers, through Saint-Pierre-des-Corps, into Paris) */
function lineDc(){ return S.mode !== 'diesel' && ROUTE.voltAt(S.dist) < 3000; }
function syncVolt(){ const dc = lineDc(); if (dc !== S.dc){ S.dc = dc; voltChanged(); } }
function voltSnap(){ syncVolt(); S.pantoDcF = S.dc ? 1 : 0; }   // after a jump: the pantographs are already set for the line there
const dcNominal = () => S.mode !== 'diesel' && S.dc ? 1500 : 2800;   // the DC link: rectified from the transformer under AC, the line itself (through a filter) under DC

function tgvRemaining(){ return (S.stopS - S.dist) * S.dir; }   // distance to the planned stop mark along the running direction (negative once past it)
function simulateTgv(dt){
  const v = S.speed, aB = 0.85;
  // doors: platform side, only at standstill; about 3 s to open or close
  if (S.doors && v > 0.1) S.doors = false;
  S.doorsF = approach(S.doorsF, S.doors ? 1 : 0, dt / 3);
  // coupling: the second set rolls in from behind at walking pace, or backs away
  if (S.coupling !== 0 && v > 0.05) S.coupling = 0;
  if (S.coupling > 0){
    const sp = clamp(1.6 * Math.sqrt(Math.max(0, -S.set2Off)), 0.25, 4);
    S.set2Off = Math.min(0, S.set2Off + sp * dt);
    if (S.set2Off >= 0){ S.set2Off = 0; S.sets = 2; S.coupling = 0; syncControls(); }
  } else if (S.coupling < 0){
    const sp = clamp(1.6 * Math.sqrt(Math.max(0.05, -S.set2Off)), 0.35, 4);
    S.set2Off -= sp * dt;
    if (S.sets === 2 && S.set2Off <= -0.6){ S.sets = 1; syncControls(); }
    if (S.set2Off <= -40){ S.set2Off = -40; S.coupling = 0; syncControls(); }
  }
  S.hatchF = approach(S.hatchF, S.sets === 2 || (S.coupling !== 0 && S.set2Off > -8) ? 1 : 0, dt / 1.5);
}

// station autopilot (any train): run at the line speed, ease off ahead of lower limits, brake to a stop with the nose at the platform mark
function simulateAutoStop(dt){
  const v = S.speed, aB = 0.85;
  if (S.autoStop){
    const rr = tgvRemaining(), vm = ROUTE.vmax;
    let vLim = S.vMaxEff;
    for (let k = 0; k < vm.length; k++){   // lower limits ahead: a breakpoint met going backwards opens the section before it
      const ds = (vm[k][0] - S.dist) * S.dir; if (ds <= 0 || ds >= 6000) continue;
      const kmh = S.dir > 0 ? vm[k][1] : vm[Math.max(0, k - 1)][1];
      vLim = Math.min(vLim, Math.sqrt((kmh / 3.6) ** 2 + 2 * aB * ds));
    }
    const vDes = Math.min(vLim, Math.sqrt(2 * aB * Math.max(0, rr)));   // aims at the mark itself: the cap in simulateStep brings the last metres in
    if (v > vDes + 0.15){ S.notch = 0; S.brake = clamp(Math.round(1 + (v - vDes) * 3.5), 1, 8); }
    else if (v < vDes - 1.0 || rr > 5000){ S.notch = clamp(Math.ceil(vDes / (S.vMaxEff / 8) - 0.01), 1, 8); S.brake = 0; }
    else { S.notch = 0; S.brake = 0; }
    if (rr < -3){ S.autoStop = false; S.notch = 0; S.brake = 0; syncControls(); }   // overshot the mark: hand back to the driver
    else if (rr < 0.6 && v < 0.02){   // at rest on the mark or a few cm short of it, where it stands: no jump, no speed step
      S.speed = 0; S.notch = 0; S.brake = 0; S.autoStop = false; S.atStation = true; S.stationT = 0;
      if (S.autoDoors){ S.doors = true; S.autoDoors = false; }
      syncControls();
    }
  }
  if (S.atStation){ S.stationT += dt; if (Math.abs(stationOffset()) > 2) S.atStation = false; }
}

function simulateStep(dt){
  syncVolt();
  const sp = specNow();
  S.time += dt;
  if (S.mode === 'tgv') simulateTgv(dt);
  simulateAutoStop(dt);
  // the notch is a speed target: 8 = the line limit here (or the train's own maximum), 4 = half of it; the regulator eases off near the target
  S.vMaxEff = (S.autoStop || autoOn) ? Math.min(sp.vMax, ROUTE.lineLimit(S.dist) / 3.6) : sp.vMax;   // line limits bind only the autopilot
  const vSet = S.vMaxEff * S.notch / 8, demand = S.notch > 0 ? clamp((vSet - S.speed) / 2, 0, 1) * (0.35 + 0.65 * S.notch / 8) : 0;
  S.throttleN = approach(S.throttleN, demand, dt * (demand > S.throttleN ? 0.8 : 2.5));
  S.brakeN = approach(S.brakeN, S.brake / 8, dt * 1.2);
  S.holdN = S.notch > 0 && S.brake === 0 ? clamp((S.speed - vSet - 0.6) / 4, 0, 0.6) : 0;   // gentle electric brake when the limit drops below the set speed
  let srcOK = false;
  if (S.mode === 'diesel'){
    if (!S.battery && (S.engine === 'running' || S.engine === 'cranking')) S.engine = S.engine === 'cranking' ? 'off' : 'stopping';
    let rpmT = 0, rate = 200;
    if (S.engine === 'cranking'){ S.crankT += dt; rpmT = 120; rate = 150; if (S.crankT > 2.4) S.engine = 'running'; }
    else if (S.engine === 'running'){ rpmT = 300 + 600 * S.throttleN; if (S.brakeN > 0.02) rpmT = Math.max(rpmT, 450); rate = rpmT > S.rpm ? 260 : 160; }
    else if (S.engine === 'stopping'){ rpmT = 0; rate = 140; if (S.rpm < 5){ S.rpm = 0; S.engine = 'off'; } }
    S.rpm = approach(S.rpm, rpmT, rate * dt);
    S.rpmN = clamp((S.rpm - 300) / 600, 0, 1);
    const running = S.engine === 'running' && S.rpm > 250;
    S.fuel = S.engine === 'cranking' ? 0.5 : (running ? 0.12 + 0.88 * S.throttleN * (0.5 + 0.5 * S.rpmN) : 0);
    S.excitation = approach(S.excitation, running && S.throttleN > 0.01 ? 0.3 + 0.7 * S.throttleN : 0, dt * 1.5);
    srcOK = running;
    const dcT = running ? (S.throttleN > 0.01 ? 900 + 1900 * S.throttleN : (S.brakeN > 0.02 && S.speed > 0.5 ? 1500 : 0)) : 0;
    S.dcV = approach(S.dcV, dcT, dt * 1800);
    S.lineOn = false;
  } else {
    if (!S.battery) S.panto = false;
    S.pantoF = approach(S.pantoF, S.panto ? 1 : 0, dt * (S.panto ? 1 / 7 : 1 / 3));
    S.pantoDcF = approach(S.pantoDcF, S.dc ? 1 : 0, dt * (S.dc ? 1 / 7 : 1 / 3));   // under DC every power car raises its own pantograph
    S.lineOn = S.pantoF > 0.97;
    if (!S.lineOn || !S.battery) S.vcb = false;
    S.dcV = approach(S.dcV, S.vcb ? dcNominal() : 0, dt * (S.vcb ? 1500 : 900));
    srcOK = S.vcb && S.dcV > 0.7 * dcNominal();
    S.rpm = 0; S.rpmN = 0; S.fuel = 0; S.excitation = S.vcb ? 1 : 0;
  }
  S.dcN = clamp(S.dcV / dcNominal(), 0, 1);

  // traction physics: adhesion-limited then power-limited effort, quadratic resistance
  const v = S.speed;
  let F = 0, Fb = 0, Fair = 0, Fe = 0;
  let pAvail = srcOK ? sp.pMax * S.throttleN * (S.mode === 'diesel' ? 0.15 + 0.85 * S.rpmN : 1) : 0;
  if (S.mode === 'tgv' && (S.doors || S.doorsF > 0.02 || S.coupling !== 0)) pAvail = 0;   // traction interlock: doors commanded open or not closed and locked, or a coupling manoeuvre
  if (pAvail > 0) F = Math.min(sp.fAdh * Math.min(1, S.throttleN * 1.5 + 0.1), pAvail / Math.max(v, 1.5));
  S.powerN = clamp(pAvail / sp.pMax, 0, 1);
  const brakeSrc = S.mode === 'diesel' ? S.engine === 'running' : (S.dcN > 0.36 || S.mode === 'tgv');
  const bN = Math.max(S.brakeN, S.holdN);
  if (bN > 0.02 && v > 0.05 && brakeSrc){
    Fe = bN * Math.min(sp.fBrakeMax, S.mode === 'tgv' && S.dcN <= 0.36 ? 0 : sp.regenP / Math.max(v, 3));   // electric (regenerative) share
    if (v < 2) Fe *= v / 2;                                   // electric brake fades out below ~7 km/h
    Fb = Math.min(sp.fBrakeMax, Fe + bN * (sp.fDisc || 0));   // TGV: blended with the disc brakes
  }
  if (v > 0 && ((S.brakeN > 0.02 && v < 2.5) || S.autoShutdown || (!brakeSrc && S.brakeN > 0.02))) Fair = 0.6 * sp.mass;   // air brake, 0.6 m/s²
  const R = sp.r0 !== undefined ? sp.r0 + sp.r1 * v + sp.r2 * v * v : 4.5 + 0.02 * v + 0.012 * v * v;
  const Fg = sp.mass * 9.81 * ROUTE.gradeAt(S.dist) * S.dir;   // kN, uphill positive in the running direction
  const a = (F - Fb - Fair - Fg - (v > 0.01 ? R : 0)) / sp.mass;
  S.speed = clamp(v + a * dt, 0, sp.vMax);
  if (F <= 0 && S.speed < 0.05) S.speed = 0;
  S.effort = F - Fb;
  S.regenN = clamp((S.mode === 'tgv' ? Fe : Fb) / sp.fBrakeMax, 0, 1);
  S.tractionN = clamp(F / sp.fAdh, 0, 1) + S.regenN;
  S.current = (F / sp.fAdh) * 2400 + S.regenN * 1400;
  S.dist += S.speed * S.dir * dt;
  const tail = S.mode === 'tgv' ? (S.sets === 2 || S.coupling !== 0 ? 382.5 - Math.min(0, S.set2Off) : 185.4) : 82;
  const d2 = clamp(S.dist, 8 + tail, ROUTE.L - 15.5);   // buffer stops at both ends of the data
  if (d2 !== S.dist){ S.dist = d2; S.speed = 0; }
  if (S.autoStop) S.speed = Math.min(S.speed, Math.sqrt(2 * 1.1 * Math.max(0, tgvRemaining())));   // never overrun the mark: looser than the autopilot's 0.85 m/s², so the brakes do the stopping and this only lands the last metres on it

  // cooling
  const pFrac = (F * v) / sp.pMax;
  const heatIn = S.mode === 'diesel' ? (S.rpm > 0 ? 0.012 + 0.09 * (0.3 * S.rpmN + 0.7 * pFrac) : 0) : (S.vcb ? 0.01 + 0.06 * pFrac : 0);
  S.temp = clamp(S.temp + (heatIn - 0.005 - 0.07 * S.fans) * dt, 0.2, 1);
  let fanT = 0;
  if (S.mode === 'diesel'){
    if (S.rpm > 30){ if (S.temp > 0.62) S.fanOn = true; if (S.temp < 0.48) S.fanOn = false; } else S.fanOn = false;
    fanT = S.fanOn ? 1 : 0;
  } else fanT = S.dcN > 0.2 ? 1 : 0;
  S.fans = approach(S.fans, fanT, dt * 0.5);

  // braking resistor grids
  const gridIn = S.regenN * (S.mode === 'diesel' ? 1 : 0.6) * 0.5;
  S.gridHeat = clamp(S.gridHeat + (gridIn - 0.12 * (0.3 + S.gridFan)) * dt, 0, 1);
  S.gridFan = approach(S.gridFan, S.regenN > 0.02 || S.gridHeat > 0.15 ? 1 : 0, dt * 0.8);

  // guided shutdown (last step): stop, then cut the source, then open the battery switch
  if (S.autoShutdown && S.speed < 0.05){
    S.shutdownT += dt;
    if (S.mode === 'diesel'){
      if (S.engine === 'running' && S.shutdownT > 1.0) S.engine = 'stopping';
      if (S.engine === 'off' && S.shutdownT > 5){ S.battery = false; S.autoShutdown = false; }
    } else {
      if (S.shutdownT > 1.0) S.vcb = false;
      if (S.shutdownT > 3.5) S.panto = false;
      if (S.pantoF < 0.02 && S.shutdownT > 6){ S.battery = false; S.autoShutdown = false; }
    }
    syncControls();
  }
}

function simulate(dtReal){   // time scale: several physics steps of at most 50 ms per frame
  const dt = dtReal * S.timeScale, n = Math.max(1, Math.ceil(dt / 0.05 - 1e-9));
  for (let i = 0; i < n; i++) simulateStep(dt / n);
}

/* ------------------------------------------------------------ animation */
let crankAngle = 0, lastPanto = -1, lastPantoDc = -1;
function animate(dt){
  if (S.mode === 'diesel'){
    crankAngle = (crankAngle + (S.rpm / 60) * Math.PI * 2 * dt) % (Math.PI * 2);
    updateEngine(crankAngle);
    const w = (S.rpm / 60) * Math.PI * 2;
    altRotor.rotation.x -= w * dt;
    turboWheel.rotation.z += (S.rpm > 0 ? 12 + 50 * S.rpmN : 0) * dt;
    compPulley.rotation.z += (S.rpm > 30 ? 6 : 0) * dt;
  } else {
    compPulley.rotation.z += (S.dcN > 0.2 ? 6 : 0) * dt;
    if (S.pantoF !== lastPanto || S.pantoDcF !== lastPantoDc){ setPanto(S.pantoF); lastPanto = S.pantoF; lastPantoDc = S.pantoDcF; }
  }
  const w = (S.speed / WHEEL_R) * S.dir;
  for (const ax of axles) ax.rotation.z -= (S.speed * S.dir / (ax.userData.r || WHEEL_R)) * dt;   // each at its own wheels' radius (a trailer's are smaller)
  for (const r of motorRotors) r.rotation.z += w * 3.67 * dt;
  updateRoute(dt);
  for (const f of roofFans){
    let sp = 0;
    if (f.kind === 'rad' || f.kind === 'cool') sp = S.fans * 14;
    else if (f.kind === 'brakeGrids' || f.kind === 'roofResistors') sp = S.gridFan * 16;
    else if (f.kind === 'inv') sp = S.dcN > 0.2 ? 10 : 0;
    else if (f.kind === 'aux') sp = S.vcb ? 10 : 0;
    if (sp) f.obj.rotation.y += sp * dt;
  }
  for (const l of cabLevers) l.rotation.z = -(S.notch / 8) * 0.6 + (S.brake / 8) * 0.4;
  for (const m of lampMats){ if (m.userData.hl) continue; m.emissiveIntensity = approach(m.emissiveIntensity, S.battery && S.lights ? m.userData.lamp : 0, dt * 4); }
  for (const k in gridMats){ const m = gridMats[k]; if (m.userData.hl) continue; m.emissiveIntensity = S.gridHeat * 3; }
  const rate = S.mode === 'diesel' && S.rpm > 0 ? 22 + 90 * S.fuel : 0;
  const darkness = S.engine === 'cranking' ? 0.85 : clamp(S.fuel * 0.6, 0.15, 0.55);
  smoke.update(dt, rate, darkness, clamp(-S.speed * S.dir, -12, 12) - 0.3);
  if (S.mode === 'tgv') updateTgv(dt);
  coachLod();   // every mode: the parked and passing sets show their interiors near the camera too
}

/* -------------------------------------------------------------- gauges */
const G = id => document.getElementById(id);
function bar(el, v){ el.style.width = `${clamp(v, 0, 1) * 100}%`; }
function updateGauges(){
  const sp = specNow();
  if (S.mode === 'diesel'){ G('gAv').textContent = Math.round(S.rpm); bar(G('gAb'), S.rpm / 1000); }
  else { G('gAv').textContent = S.lineOn ? kvLine() : '0'; bar(G('gAb'), S.lineOn ? (S.dc ? 0.06 : 1) : 0); }   // the bar reads out of 25 kV
  G('gVv').textContent = Math.round(S.dcV); bar(G('gVb'), S.dcV / 2800);
  G('gIv').textContent = Math.round(S.current); bar(G('gIb'), S.current / 3000);
  G('gFv').textContent = Math.round(S.effort); bar(G('gFb'), Math.abs(S.effort) / sp.fAdh);
  G('gSv').textContent = Math.round(S.speed * 3.6); bar(G('gSb'), S.speed / sp.vMax);
  const dot = (id, state) => { const el = G(id); el.classList.toggle('on', state === 'on'); el.classList.toggle('warn', state === 'warn'); };
  dot('lampBatt', S.battery ? 'on' : 'off');
  if (S.mode === 'diesel') dot('lampSrc', S.engine === 'running' ? 'on' : (S.engine === 'off' ? 'off' : 'warn'));
  else dot('lampSrc', S.lineOn ? 'on' : (S.pantoF > 0.02 ? 'warn' : 'off'));
  dot('lampDc', S.dcN > 0.3 ? 'on' : (S.dcN > 0.03 ? 'warn' : 'off'));
  dot('lampTr', S.tractionN > 0.02 ? 'on' : 'off');
  if (S.mode === 'tgv'){ dot('lampDoors', S.doorsF > 0.9 ? 'on' : (S.doorsF > 0.02 ? 'warn' : 'off')); syncTgvControls(); }
}
