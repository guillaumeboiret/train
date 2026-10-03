
/* ============================================================ UI */
const $ = id => document.getElementById(id);
const t = key => T[S.lang][key] ?? key;
let selected = null, focusId = null, stepIdx = 0, autoOn = false, autoT = 0, shellLevel = 0.18;
let cutAxis = 'none', cutPos = 0, cutFlip = false, cutPlane = null, infoCollapsed = false;
const HIL = new THREE.Color(0xf28c28);
const kvLine = () => S.dc ? t('kv_dc') : '25';
const T5_S = ROUTE_DATA.fast;   // where step 5 carries the tour: 3.8 km into the first 20 km of LGV cleared for 320 north of Bordeaux, 25 kV (baked by route/build_route.py)
const stepV = st => S.dc && st.dc ? { ...st, ...st.dc } : st;   // under 1.5 kV DC some steps tell another story (text, and sometimes camera and focus)
function voltChanged(){ buildStepList(); refreshInfo(); if (!selected) setFocus(stepV(STEPS[S.mode][stepIdx]).focus); }

/* ---- i18n: the page starts in the site's language (site/lang.js); a switch here is saved for every page of the site */
function setLang(l){ S.lang = l; try { localStorage.setItem('lang', l); } catch (e) {} applyLang(); }
function applyLang(){
  document.documentElement.lang = S.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = T[S.lang][el.dataset.i18n]; if (v != null) el.textContent = v; });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  $('lampSrcTxt').textContent = t(S.mode === 'diesel' ? 'lamp_engine' : 'lamp_line');
  $('gAk').textContent = t(S.mode === 'diesel' ? 'g_rpm' : 'g_line');
  $('gAu').textContent = t(S.mode === 'diesel' ? 'unit_rpm' : 'unit_kv');
  $('autoPlay').textContent = t(autoOn ? 'autoplay_on' : 'autoplay');
  document.title = t('title'); $('routeBar').title = t('rb_title');
  $('langSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
  buildPartList(); buildStepList(); refreshInfo(); syncControls();   // syncControls: the control panel's state labels (doors, platform, coupling)
  for (const id in labels) labels[id].textContent = PARTS[id][S.lang].name;
  if (document.body.classList.contains('bar-open')) barRender();   // its names and prices (2,80€ or 2.80€)
  document.documentElement.removeAttribute('data-i18n-wait');
}

/* ---- mode */
function applyVisibility(p){ p.group.visible = p.modes.includes(S.mode) && !p.hidden && !((p.id === 'shell' || p.id === 'tgvShell') && shellLevel === 0); }
function resetSim(){   // home is Bordeaux Saint-Jean, where the tour starts, even though the line now begins at Toulouse
  const home = (ROUTE.stations.find(x => x.id === 'bdx') || ROUTE.stations[0]).s - TGV.PLAT_FRONT;
  Object.assign(S, { battery:false, engine:'off', crankT:0, rpm:0, rpmN:0, fuel:0, notch:0, brake:0, throttleN:0, brakeN:0, panto:false, pantoF:0, lineOn:false, vcb:false,
    dcV:0, dcN:0, excitation:0, powerN:0, tractionN:0, regenN:0, current:0, effort:0, speed:0, temp:0.2, fans:0, fanOn:false, gridHeat:0, gridFan:0, autoShutdown:false, shutdownT:0,
    sets:1, coupling:0, set2Off:-40, hatchF:0, doors:false, doorsF:0, autoStop:false, atStation:true, autoDoors:false, stationT:0, service:false,
    dist:home, stopS:home, dir:1, timeScale:1, holdN:0, track:0, trackF:0 });
  trk.from = trk.to = 0; trk.s0 = -1e9;
  voltSnap(); S.vMaxEff = Math.min(specNow().vMax, ROUTE.lineLimit(S.dist) / 3.6);
  setPanto(0); paxResolve(true); syncControls();
}
function setMode(mode){
  S.mode = mode; document.body.dataset.mode = mode;
  $('modeSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  const tgv = mode === 'tgv';
  orbit.maxR = tgv ? 420 : 90;
  fogK = tgv ? 1.6 : 1; applyTheme();
  wagons.visible = !tgv;
  setTgvVisible(tgv);
  stopAuto(); stepIdx = 0; resetSim();   // the new mode may have fewer steps: the info card must not read past its end
  for (const p of Object.values(parts)) applyVisibility(p);
  setShell(shellLevel);
  buildFlows(); selected = null; setFocus(null);
  if (tgv) updateTgv(0);
  applyLang();
  goStep(0);
}

/* ---- parts list */
const EYE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
function buildPartList(){
  const root = $('partList'); root.innerHTML = '';
  for (const cat of CAT_ORDER){
    const ids = Object.keys(PARTS).filter(id => PARTS[id].cat === cat && PARTS[id].modes.includes(S.mode));
    if (!ids.length) continue;
    const h = document.createElement('div');
    h.style.cssText = 'font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600;margin:12px 8px 4px';
    h.textContent = t('cat_' + cat); root.appendChild(h);
    for (const id of ids){
      const row = document.createElement('div'); row.className = 'part'; row.dataset.part = id; row.setAttribute('role', 'button'); row.tabIndex = 0;
      row.setAttribute('aria-pressed', String(selected === id));
      row.innerHTML = `<span class="sw" style="background:${PARTS[id].color}"></span><span>${PARTS[id][S.lang].name}</span><button type="button" class="eye" aria-pressed="${parts[id].hidden}" aria-label="${t('aria_hide')}">${EYE}</button>`;
      row.addEventListener('click', e => {
        if (e.target.closest('.eye')){ toggleHidden(id); return; }
        select(selected === id ? null : id); flyToPart(id);
      });
      row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); select(selected === id ? null : id); flyToPart(id); } });
      root.appendChild(row);
    }
  }
}
function toggleHidden(id){
  const p = parts[id]; p.hidden = !p.hidden; applyVisibility(p);
  const eye = $('partList').querySelector(`[data-part="${id}"] .eye`); if (eye) eye.setAttribute('aria-pressed', String(p.hidden));
  if (p.hidden && selected === id) select(null);
}
const FLY_DIST = { shell:16, frame:16, catenary:16, bogies:16, tgvShell:22, powerCars:26, roofLine:20, trailers:30, jacobs:12, doors:9 };
function flyToPart(id){
  const p = parts[id]; if (!p) return;
  orbit.free();   // out of a seat first, so the way in is measured from where the eye really is
  const a = p.anchor.clone().add(p.group.position); curveLocal(a.x, a.y, a.z, a);
  const target = a.clone(); target.y -= 0.6;
  const dir = camera.position.clone().sub(orbit.target).normalize();
  if (dir.lengthSq() < 0.01) dir.set(0.6, 0.35, 0.7);
  const dist = FLY_DIST[id] ?? 8;
  orbit.flyTo(target.clone().addScaledVector(dir, dist), target);
}

/* ---- highlight / selection / infocard */
function setHighlight(p, on){
  for (const m of p.mats){
    if (!m.emissive) continue;
    if (on){ if (!m.userData.hl) m.userData.hl = { e:m.emissive.clone(), i:m.emissiveIntensity }; m.emissive.copy(HIL); m.emissiveIntensity = 0.5; }
    else if (m.userData.hl){ m.emissive.copy(m.userData.hl.e); m.emissiveIntensity = m.userData.hl.i; delete m.userData.hl; }
  }
}
function setFocus(id){
  if (focusId && parts[focusId]) setHighlight(parts[focusId], false);
  focusId = id && parts[id] ? id : null;
  if (focusId) setHighlight(parts[focusId], true);
}
function select(id){
  selected = id && parts[id] ? id : null;
  if (selected) infoCollapsed = false;
  setFocus(selected ?? stepV(STEPS[S.mode][stepIdx]).focus);
  $('partList').querySelectorAll('.part').forEach(r => r.setAttribute('aria-pressed', String(r.dataset.part === selected)));
  refreshInfo(); if (selected) readFor($('infoText').textContent);
}
function legendFor(partIds){
  const seen = new Set(), out = [];
  for (const f of FLOW_DEFS[S.mode]){
    if (!partIds || !flowLive(f) || !f.parts.some(p => partIds.includes(p))) continue;
    if (seen.has(f.key)) continue; seen.add(f.key);
    out.push(`<span><i ${f.plume ? 'class="shim"' : `style="background:var(${f.token})"`}></i>${t(f.key)}</span>`);   // heat has no colour: a wavy line
  }
  return out.join('');
}
const CHAIN = { diesel:['fuelTank','alternator','rectifier','motors'], electric:['catenary','transformer','converter4q','motors','bogies'], tgv:['catenary','powerCars','roofLine','transformer','converter4q','motors','jacobs'] };
function refreshInfo(){
  const L = S.lang;
  if (selected){
    const P = PARTS[selected], d = P[L].desc;
    $('infoEyebrow').textContent = `${t('part')} · ${t('cat_' + P.cat)}`;
    $('infoTitle').textContent = P[L].name;
    $('infoText').textContent = typeof d === 'string' ? d : (d[S.mode] ?? d.electric);
    $('infoLegend').innerHTML = legendFor([selected]);
    $('infoMini').textContent = P[L].name;
  } else {
    const steps = STEPS[S.mode], st = stepV(steps[stepIdx]);
    $('infoEyebrow').textContent = `${t('step')} ${stepIdx + 1}/${steps.length}`;
    $('infoTitle').textContent = st[L].t;
    $('infoText').textContent = st[L].x;
    $('infoLegend').innerHTML = legendFor(st.focus ? [st.focus] : CHAIN[S.mode]);
    $('infoMini').textContent = st[L].t;
  }
  $('infocard').classList.toggle('collapsed', infoCollapsed); $('infocard').classList.toggle('is-part', !!selected);   // the parts tab shows a part's text only
  $('infoClose').textContent = infoCollapsed ? '+' : '×';
  $('infoClose').setAttribute('aria-label', t(infoCollapsed ? 'info_show' : 'info_hide'));
  $('infoClose').setAttribute('aria-expanded', String(!infoCollapsed));
}
$('infoClose').addEventListener('click', e => { e.stopPropagation(); infoCollapsed = !infoCollapsed; refreshInfo(); });
$('infocard').addEventListener('click', () => { if (infoCollapsed){ infoCollapsed = false; refreshInfo(); } });

/* ---- guided steps */
function buildStepList(){
  const root = $('stepList'); root.innerHTML = '';
  STEPS[S.mode].forEach((st, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'step' + (i < stepIdx ? ' done' : '');
    if (i === stepIdx) b.setAttribute('aria-current', 'step');
    b.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span><span>${stepV(st)[S.lang].t}</span>`;
    b.addEventListener('click', () => { stopAuto(); goStep(i); });
    root.appendChild(b);
  });
}
function ensureBattery(){ S.battery = true; }
function ensureRunning(){ ensureBattery(); if (S.engine !== 'running'){ S.engine = 'running'; S.rpm = Math.max(S.rpm, 300); S.crankT = 0; } }
function ensureLine(){ ensureBattery(); S.panto = true; if (S.pantoF < 0.97){ S.pantoF = 1; setPanto(1); } S.lineOn = true; }
function ensureLive(){ ensureLine(); S.vcb = true; S.dcV = Math.max(S.dcV, dcNominal()); S.dcN = 1; }
function applyStepState(id){
  S.autoShutdown = false; S.service = false;
  switch (id){
    case 'd0': case 'e0': resetSim(); break;
    case 'd1': case 'e1': if (S.mode === 'diesel' ? S.engine !== 'off' : S.pantoF > 0.02) resetSim(); ensureBattery(); break;
    case 'd2': ensureBattery(); S.notch = 0; S.brake = 0; if (S.engine === 'off') startEngine(); break;
    case 'd3': ensureRunning(); S.notch = 0; S.brake = 0; break;
    case 'd4': ensureRunning(); S.notch = 1; S.brake = 0; break;
    case 'd5': ensureRunning(); S.notch = 8; S.brake = 0; break;
    case 'd6': ensureRunning(); if (S.speed < 15) S.speed = 25; S.notch = 0; S.brake = 6; break;
    case 'd7': ensureRunning(); S.notch = 0; S.brake = 8; S.autoShutdown = true; S.shutdownT = 0; break;
    case 'e2': ensureBattery(); S.panto = true; break;
    case 'e3': ensureLine(); S.vcb = true; S.notch = 0; S.brake = 0; break;
    case 'e4': ensureLive(); S.notch = 2; S.brake = 0; break;
    case 'e5': ensureLive(); S.notch = 8; S.brake = 0; break;
    case 'e6': ensureLive(); if (S.speed < 15) S.speed = 30; S.notch = 0; S.brake = 6; break;
    case 'e7': ensureLive(); S.notch = 0; S.brake = 8; S.autoShutdown = true; S.shutdownT = 0; break;
    case 't0': resetSim(); break;
    case 't1': if (S.pantoF > 0.02) resetSim(); ensureBattery(); break;
    case 't2': ensureBattery(); S.panto = true; break;
    case 't3': ensureLine(); S.vcb = true; S.notch = 0; S.brake = 0; break;
    case 't4': ensureLive(); S.doors = false; S.autoStop = false; S.notch = 2; S.brake = 0; break;
    case 't5': ensureLive(); S.doors = false; S.autoStop = false; S.notch = 8; S.brake = 0;
      if (lineDc() || ROUTE.lineLimit(S.dist) < 300){   // off the high-speed line: carry the train onto the LGV (T5_S)
        S.dist = T5_S; S.stopS = S.dist; S.dir = 1; S.speed = 250 / 3.6; S.atStation = false; S.coupling = 0;
        trk.from = trk.to = 0; trk.s0 = -1e9; paxResolve(); voltSnap();
      } else if (S.speed < 60) S.speed = 75;
      break;
    case 't6': { ensureLive(); S.doors = false; S.coupling = 0; S.set2Off = S.sets === 2 ? 0 : -40; S.dir = 1;
      const st = ROUTE.stations.find(x => x.s - TGV.PLAT_FRONT - S.dist > 700) || ROUTE.stations[ROUTE.stations.length - 1];
      S.stopS = st.s - TGV.PLAT_FRONT; S.dist = S.stopS - 600; S.speed = 30; S.notch = 0; S.brake = 0; S.atStation = false; S.autoStop = true; S.autoDoors = true;
      trk.from = trk.to = 0; trk.s0 = -1e9; paxResolve(); voltSnap(); break; }
    case 't7': ensureLive(); S.autoStop = false; S.autoDoors = false; if (!S.atStation){ S.speed = 0; S.notch = 0; S.brake = 0; S.dist = nearestStation().s - TGV.PLAT_FRONT; S.stopS = S.dist; S.atStation = true; paxResolve(); voltSnap(); } if (S.sets === 1 && S.coupling === 0) S.coupling = 1; break;
    case 't8': ensureLive(); S.doors = false; S.autoStop = false; S.autoDoors = false; S.notch = 5; S.brake = 0; break;
  }
  syncControls();
}
function goStep(i){
  const steps = STEPS[S.mode];
  stepIdx = clamp(i, 0, steps.length - 1);
  applyStepState(steps[stepIdx].id); syncVolt();
  const st = stepV(steps[stepIdx]);
  flyPreset(st.cam);
  selected = null; setFocus(st.focus);
  $('partList').querySelectorAll('.part').forEach(r => r.setAttribute('aria-pressed', 'false'));
  $('stepList').querySelectorAll('.step').forEach((b, k) => { b.classList.toggle('done', k < stepIdx); if (k === stepIdx) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  $('stepList').querySelector('[aria-current]')?.scrollIntoView({ block:'nearest' });
  $('prevStep').disabled = stepIdx === 0; $('nextStep').disabled = stepIdx === steps.length - 1;
  autoT = 0;
  refreshInfo(); readFor($('infoText').textContent);
}
function stopAuto(){ autoOn = false; $('autoPlay').textContent = t('autoplay'); $('autoPlay').setAttribute('aria-pressed', 'false'); }
function startAuto(){ autoOn = true; autoT = 0; $('autoPlay').textContent = t('autoplay_on'); $('autoPlay').setAttribute('aria-pressed', 'true'); if (stepIdx === STEPS[S.mode].length - 1) goStep(0); }
$('prevStep').addEventListener('click', () => { stopAuto(); goStep(stepIdx - 1); });
$('nextStep').addEventListener('click', () => { stopAuto(); goStep(stepIdx + 1); });
$('autoPlay').addEventListener('click', () => autoOn ? stopAuto() : startAuto());
window.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select')) return;
  if (walking){   // WASD or the arrows walk (the keys below); E or Enter sits down, stands up or orders at the bar; Esc closes the bar's menu or stops walking
    const sitKey = e.code === 'KeyE' || e.key === 'Enter' && !e.target.closest('button,a');
    if (e.key === 'Escape'){ if (barIsOpen()) barClose(); else cabActions.leave(); }
    else if (sitKey && e.repeat) e.preventDefault();   // held: not once more
    else if (sitKey && !barIsOpen()){ e.preventDefault(); walkSitNear(); }
    return;
  }
  if (e.key === 'ArrowRight'){ stopAuto(); goStep(stepIdx + 1); }
  else if (e.key === 'ArrowLeft'){ stopAuto(); goStep(stepIdx - 1); }
  else if (e.key === 'Escape'){ if (inCab) cabActions.leave(); else select(null); }
  else if (inCab && (e.key === 'ArrowUp' || e.key === 'ArrowDown')){ e.preventDefault(); cabLever.step(e.key === 'ArrowUp' ? 1 : -1); }   // the driver's lever
});

/* ---- controls */
function syncControls(){
  $('swBattery').checked = S.battery;
  $('swPanto').checked = S.panto; $('swVcb').checked = S.vcb;
  $('rgThrottle').value = S.notch; $('throttleVal').textContent = `${S.notch} · ${Math.round(S.vMaxEff * S.notch / 8 * 3.6)} km/h`;
  $('trackSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.track === trk.to)));
  $('timeSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.time === S.timeScale)));
  $('rgBrake').value = S.brake; $('brakeVal').textContent = S.brake; cabLever.sync();
  document.querySelectorAll('#dirSeg button, #cabDir button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.dir === S.dir)));
  $('cabNext').setAttribute('aria-pressed', String(S.autoStop || S.service)); $('cabNextIco').textContent = S.service ? '🔁' : '🚉';   // held down it stays pressed: the whole line
  $('btnStart').disabled = !(S.battery && S.engine === 'off');
  $('btnStop').disabled = !(S.engine === 'running' || S.engine === 'cranking');
  syncTgvControls();
}
function syncTgvControls(){
  const canSets = S.speed < 0.05 && S.coupling === 0;
  $('setsSeg').querySelectorAll('button').forEach(b => { b.setAttribute('aria-pressed', String(+b.dataset.sets === S.sets)); b.disabled = !canSets; });
  $('setsHint').textContent = t(S.coupling > 0 ? 'coupling' : S.coupling < 0 ? 'uncoupling' : 'sets_hint');
  $('swDoors').checked = S.doors; $('swDoors').disabled = S.speed > 0.1;
  $('doorsVal').textContent = t(paxHolding() ? 'doors_pax' : S.doorsF > 0.5 ? 'doors_open' : 'doors_closed');
  $('stationVal').textContent = S.service ? t('station_service') : S.autoStop ? t('station_running') : S.atStation ? t('station_at') : '';
  $('btnStation').setAttribute('aria-pressed', String(S.service));
}
function manual(){ stopAuto(); S.autoShutdown = false; S.autoStop = false; S.service = false; }
$('setsSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (!(S.speed < 0.05 && S.coupling === 0)) return;
  manual();
  const want = +b.dataset.sets; if (want === S.sets) return;
  S.coupling = want === 2 ? 1 : -1;
  syncControls();
});
$('swDoors').addEventListener('change', e => {
  manual(); if (S.speed > 0.1){ e.target.checked = S.doors; return; }
  if (!e.target.checked && paxHolding()){ PX.closeWhenDone = true; e.target.checked = true; syncControls(); return; }   // terminus: they close once the last passenger is through
  S.doors = e.target.checked; syncControls();
});
function goNextStation(st = nextStation()){   // the station autopilot (Go to platform, the cab desk's Next stop): to the next platform it can still stop at, at the train's own pace; null at a terminus
  if (!st){ syncControls(); return null; }
  manual(); if (S.mode === 'diesel') ensureRunning(); else ensureLive();
  if (S.doors){ if (paxHolding()) PX.closeWhenDone = true; else S.doors = false; }   // the last passengers through first, as the doors switch does
  S.stopS = st.s - TGV.PLAT_FRONT; S.autoStop = true; S.autoDoors = S.mode === 'tgv'; syncControls();
  return st;
}
/* ---- Next stop held down: the train serves the whole line by itself, again and again. On to the next station, the doors open, people get
   off and on, the doors close, on to the next; at either end it turns round. A tap on Next stop ends it, as any other control taken does
   (manual); a jump along the line keeps it */
const SERVICE_DWELL = 25, SERVICE_MAX = 120;   // s at a platform with the doors open, at least; s of people getting off and on (on their own clock, PX.t), at most
function serviceTick(now = false){   // now: just held down, so no dwell first, only the people still getting off and on
  if (!S.service || S.autoStop || S.coupling) return;
  if (S.speed < 0.05 && S.atStation && (!now && S.stationT < (S.doors ? SERVICE_DWELL : 8) || PX.phase === 'exchange' && PX.t < SERVICE_MAX)) return;
  let st = nextStation() || nextStation(0);   // the last platform too close to stop at this speed: braked for all the same
  if (!st){   // the end of the line: stop, then turn round
    if (S.speed >= 0.05){ S.notch = 0; S.brake = 8; return; }
    S.dir = -S.dir; st = nextStation();
  }
  S.service = !!goNextStation(st); syncControls();
}
function serviceOn(){ S.service = true; serviceTick(true); syncControls(); }
function serviceOff(){ S.service = false; syncControls(); }
const HOLD_MS = 600;   // a press held this long is a long press
function holdable(el, tap, hold){   // a button with a long press: let go at once it taps, held it holds, and the click its release brings is swallowed; Enter taps
  let tm = 0, held = false;
  const end = () => { clearTimeout(tm); el.classList.remove('holding'); };
  el.addEventListener('pointerdown', e => { if (e.button) return; held = false; el.classList.add('holding'); tm = setTimeout(() => { end(); held = true; hold(); }, HOLD_MS); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, end);
  el.addEventListener('keydown', () => { held = false; });
  el.addEventListener('click', () => { if (held) held = false; else tap(); });
  el.addEventListener('contextmenu', e => e.preventDefault());   // a long press on a touch screen: no menu
}
function holdPress(tap, hold){   // the same for the cab desk's 3D button, from the press orbit hands over
  let done = false;
  const tm = setTimeout(() => { done = true; hold(); }, HOLD_MS);
  const off = () => { clearTimeout(tm); removeEventListener('pointerup', up); removeEventListener('pointercancel', off); };
  const up = () => { off(); if (!done) tap(); };
  addEventListener('pointerup', up); addEventListener('pointercancel', off);
}
holdable($('btnStation'), () => { if (S.service) serviceOff(); else if (!S.autoStop) goNextStation(); }, serviceOn);
$('swBattery').addEventListener('change', e => { manual(); S.battery = e.target.checked; syncControls(); });
$('btnStart').addEventListener('click', () => { manual(); startEngine(); syncControls(); });
$('btnStop').addEventListener('click', () => { manual(); stopEngine(); syncControls(); });
$('swPanto').addEventListener('change', e => { manual(); if (!S.battery){ e.target.checked = false; return; } S.panto = e.target.checked; });
$('swVcb').addEventListener('change', e => { manual(); if (!S.lineOn){ e.target.checked = false; return; } S.vcb = e.target.checked; });
$('rgThrottle').addEventListener('input', e => { manual(); S.notch = +e.target.value; if (S.notch > 0) S.brake = 0; syncControls(); });
$('rgBrake').addEventListener('input', e => { manual(); S.brake = +e.target.value; if (S.brake > 0) S.notch = 0; syncControls(); });
$('dirSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (S.speed > 0.3) return; S.dir = +b.dataset.dir; syncControls(); });
$('swFlows').addEventListener('change', e => { S.flowsOn = e.target.checked; });
$('swLabels').addEventListener('change', e => { S.labelsOn = e.target.checked; });

/* ---- views */
function setShell(level){
  shellLevel = level;
  $('shellSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.shell === level)));
  const p = S.mode === 'tgv' ? parts.tgvShell : parts.shell;
  for (const m of S.mode === 'tgv' ? [...p.mats, ...pcShells.mats, ...trShells.mats] : p.mats){
    if (!m.userData.orig) m.userData.orig = { transparent:m.transparent, opacity:m.opacity, depthWrite:m.depthWrite, alphaTest:m.alphaTest };
    const o = m.userData.orig;
    if (level >= 1){ m.transparent = o.transparent; m.opacity = o.opacity; m.depthWrite = o.depthWrite; m.alphaTest = o.alphaTest; }
    else { m.transparent = true; m.opacity = Math.min(o.opacity, level); m.depthWrite = false; m.alphaTest = Math.min(o.alphaTest, level * 0.5); }   // cut-out windows: the test must stay under the faded opacity
    m.needsUpdate = true;
  }
  p.group.traverse(o => { if (o.isMesh) o.castShadow = level >= 1; });
  for (const o of [...pcShells.meshes, ...trShells.meshes]){ o.castShadow = level >= 1; o.visible = level > 0; }
  applyVisibility(p);
}
const CUT_EXT = { x:[0, 10.4], y:[2.9, 2.9], z:[0, 1.75] };   // center, half extent along the cut axis
const cutHelper = (() => {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color:0xf28c28, transparent:true, opacity:0.07, side:THREE.DoubleSide, depthWrite:false, toneMapped:false }));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineBasicMaterial({ color:0xf28c28, transparent:true, opacity:0.6, toneMapped:false }));
  g.add(fill, edge); g.visible = false; scene.add(g);
  return g;
})();
function setCut(axis){
  cutAxis = axis;
  $('cutSeg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cut === axis)));
  if (axis === 'none'){ cutPlane = null; for (const m of clipMats) m.clippingPlanes = null; cutHelper.visible = false; return; }
  if (!cutPlane){ cutPlane = new THREE.Plane(); }
  for (const m of clipMats) m.clippingPlanes = [cutPlane];
  updateCut();
}
function updateCut(){
  if (!cutPlane) return;
  const [c, h] = cutAxis === 'x' && S.mode === 'tgv' ? [0.85, 10.45] : CUT_EXT[cutAxis];
  const pos = c + cutPos * h;
  const n = new THREE.Vector3(); n[cutAxis] = cutFlip ? 1 : -1;
  cutPlane.set(n, cutFlip ? -pos : pos);
  cutHelper.visible = true;
  cutHelper.position.set(0, 2.9, 0); cutHelper.position[cutAxis] = pos;
  cutHelper.rotation.set(0, 0, 0);
  if (cutAxis === 'x'){ cutHelper.rotation.y = Math.PI / 2; cutHelper.scale.set(4.0, 6.4, 1); }
  else if (cutAxis === 'y'){ cutHelper.rotation.x = Math.PI / 2; cutHelper.scale.set(21.6, 4.0, 1); }
  else cutHelper.scale.set(21.6, 6.4, 1);
  $('cutVal').textContent = `${pos >= 0 ? '+' : ''}${pos.toFixed(2)} m`;
}
$('shellSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setShell(+b.dataset.shell); });
$('cutSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setCut(b.dataset.cut); });
$('rgCut').addEventListener('input', e => { cutPos = +e.target.value; if (cutAxis === 'none') setCut('z'); else updateCut(); });
$('swCutFlip').addEventListener('change', e => { cutFlip = e.target.checked; updateCut(); });
function setExplode(f){
  S.explode = f; $('explodeVal').textContent = `${Math.round(f * 100)} %`;
  for (const p of Object.values(parts)){ if (p.id === 'catenary') continue; p.group.position.copy(p.explode).multiplyScalar(f); }
}
$('rgExplode').addEventListener('input', e => setExplode(+e.target.value));
$('camRow').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.cam === 'driver' || b.dataset.cam === 'walk'){   // the passenger's or the driver's view: the body whole and opaque, the windows glazed
    if (shellLevel < 1) setShell(1);
    if (cutAxis !== 'none') setCut('none');
    if (S.explode > 0){ setExplode(0); $('rgExplode').value = 0; }
  }
  flyPreset(b.dataset.cam);
});
$('swRotate').addEventListener('change', e => { orbit.autoRotate = e.target.checked; });

/* ---- tabs, top bar, sheet */
function showTab(name){   // one panel at a time, the dock unfolded; the step's or the part's text shows with the guide and the parts only (the dock's data-tab, in the CSS)
  document.querySelectorAll('.tabs [role="tab"]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.tab === name)));
  document.querySelectorAll('.tabpanel').forEach(p => { p.hidden = p.dataset.tab !== name; });
  $('dock').dataset.tab = name; $('dock').classList.remove('collapsed');
  if (name === 'guide' && selected) select(null);   // back to the steps: the step's text and its part lit again
}
document.querySelectorAll('.tabs [role="tab"]').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
$('sheetToggle').addEventListener('click', () => $('dock').classList.toggle('collapsed'));
$('modeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.mode !== S.mode) setMode(b.dataset.mode); });
$('langSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.lang !== S.lang) setLang(b.dataset.lang); });

/* ---- picking */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
orbit.onClick = e => {
  if (inCab){ wakeTap = false; if (!cabRowTap(e)) cabTap(e); return; }   // the driver's seat, GUI or not: a stop on the line screen, else the view's edges jump along the line
  if (noGui){ wakeTap = false; if (!walking){ ngWake(); return; } }   // no GUI: a tap on the view outside only brings back the way back; the walker's still sit, order and climb on a stool
  else if (wakeTap){ wakeTap = false; return; }   // that tap only brought the controls back
  const r = canvas.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  if (walking){ if (barIsOpen()) barClose(); else walkPick(ray); return; }   // walking: a tap on a free seat sits there (the bar's menu open: a tap beside it puts it away)
  const catG = [...chunks.values()].map(c => c.cat);
  const hits = ray.intersectObjects(S.mode === 'tgv' ? [loco, catenary, tgvTrain, ...catG] : [loco, catenary, ...catG], true);
  for (const h of hits){
    const id = h.object.userData.partId;
    if (!id || !parts[id] || !parts[id].group.visible) continue;
    if ((id === 'shell' || id === 'tgvShell') && shellLevel < 1) continue;
    if (cutPlane && clipMats.includes(h.object.material) && cutPlane.distanceToPoint(h.point) < 0) continue;
    showTab('parts'); select(id); $('partList').querySelector(`[data-part="${id}"]`)?.scrollIntoView({ block:'nearest' });   // a part picked on the model: its text, and its row in the list
    return;
  }
  select(null);
};

/* ---- the driver's place: the screens (one canvas shared by every cab) and the push buttons on the desk */
const CAB_FONT = '"Barlow Condensed","Arial Narrow",Arial,sans-serif';
for (const w of [600, 700]) document.fonts?.load(`${w} 40px "Barlow Condensed"`);   // a canvas does not fetch a web font by itself
const cabActions = {   // what each desk button does, and the way out of the cab; the kid build swaps in its own
  horn(){   // sounds while held, like the horn button
    horn.press();
    const up = () => { horn.release(); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  },
  panto(){ if (!S.battery){ ensureBattery(); syncControls(); } $('swPanto').click(); },   // a cold train: its battery on first, as the lever does (no GUI has no battery switch)
  doors(){ $('swDoors').click(); },
  next(){   // the station autopilot, lit until the train stands at the platform; pressed again it says where it is going, or ends the whole line
    if (S.service){ cabSay(t(S.autoStop ? 'service_last' : 'service_off')); serviceOff(); return; }
    if (!S.autoStop && !goNextStation()){ cabSay(t('cab_end')); return; }
    cabSay(`${t('hud_next')}\n${stationText(cabTarget())}`);
  },
  service(){ serviceOn(); cabSay(`${t('service_on')}\n${stationText(cabTarget())}`); },   // Next stop held down: the whole line, again and again
  dir(d){   // the deck's Toulouse / Paris: at rest the train turns round, and the view moves to the other cab
    if (d === S.dir) return;
    if (S.speed > 0.3){ cabSay(t('cab_stopped')); return; }
    manual(); S.dir = d; syncControls();
  },
  lever(v){   // the combined lever: up powers (each notch a speed to hold), down brakes; pushed up it readies a cold train and closes its doors
    manual();
    if (v > 0){
      if (S.mode === 'diesel') ensureRunning(); else ensureLive();
      if (S.doors){ if (paxHolding()) PX.closeWhenDone = true; else S.doors = false; }   // the last passengers through first, as the doors switch does
    }
    S.notch = Math.max(0, v); S.brake = Math.max(0, -v); syncControls();
  },
  leverTip(){ cabSay(t('cab_lever_drag'), 'l'); },   // the 3D lever tapped, not dragged
  leave(){ flyPreset(stepV(STEPS[S.mode][stepIdx]).cam); },   // back to the guide's view
};
const deskRay = e => {   // the ray under a press or a tap, and the canvas' rectangle
  const r = canvas.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera); return r;
};
const deskHit = list => ray.intersectObjects(list, true).find(h => h.distance < 3 && shown(h.object));   // the driver's own desk, never a far train's
const LEVER_REACH = 36, _kn = new THREE.Vector3();   // px around the lever's knob that still take it: a fingertip is wider than the knob seen from the seat
function driverLever(){   // the lever of the cab the driver sits in: the nearest shown one, within 2 m (a loco backing up has none)
  let best = null, bd = 4;
  for (const l of cabLevers){ if (!shown(l)) continue; const d = l.getWorldPosition(_kn).distanceToSquared(camera.position); if (d < bd){ bd = d; best = l; } }
  return best;
}
const cellAt = (h, id) => { const [x0, y0] = CAB.cell[id], { width:cw, height:ch } = CAB.ctx.canvas; return [h.uv.x * cw - x0, (1 - h.uv.y) * ch - y0]; };   // a hit on a cab screen, in its cell's px
const PWR_Y = 256, PWR_PX = 25;   // the speed screen's brake and power bar: all of the screen under the dial (cell px), a notch every 25 px either side of its middle
orbit.onPress = e => {   // in the driver's place, GUI or not, a press on a desk button works it, the lever is dragged, and so is the speed screen's brake and power bar; anywhere else it turns the head
  if (orbit.fp?.name !== 'driver' || e.button !== 0) return false;
  const r = deskRay(e), lv = driverLever(), h = deskHit(lv ? [...CAB.btns, ...CAB.scrs, lv] : [...CAB.btns, ...CAB.scrs]);
  let o = h?.object; while (o && !o.userData.cabBtn && !o.userData.lever) o = o.parent;
  const id = o?.userData.cabBtn;
  if (id){ if (id === 'next') holdPress(() => cabActions.next(), () => cabActions.service()); else cabActions[id](); return true; }
  if (h?.object.userData.cabScr === 'speed' && cellAt(h, 'speed')[1] > PWR_Y){ pwrDrag(e, h.object); return true; }
  const knob = lv && !h && lv.children[1].getWorldPosition(_kn).project(camera);   // nothing hit: near enough to the knob
  if (o || knob && knob.z < 1 && Math.hypot(r.left + (knob.x + 1) / 2 * r.width - e.clientX, r.top + (1 - knob.y) / 2 * r.height - e.clientY) < LEVER_REACH){ leverDrag(e, r); return true; }
  return false;   // a screen is left to the tap (cabRowTap) or to the head
};
function leverDrag(e, r){   // up for power, down to brake (to 🐢 on the playground), a notch every few pixels, so the whole range fits between the press and the view's edges
  const y0 = e.clientY, v0 = cabLever.pos(), { min, max } = cabLever, room = (px, n) => n > 0 ? px / n : Infinity;   // px a notch, for the n notches left that way
  const step = clamp(Math.min(room(r.bottom - 8 - y0, v0 - min), room(y0 - r.top - 8, max - v0)), 6, 24);
  let moved = false;
  const move = m => { if (m.pointerId !== e.pointerId || !moved && Math.abs(m.clientY - y0) < 6) return; moved = true; cabLever.set(v0 + (y0 - m.clientY) / step); };
  const end = m => {
    if (m.pointerId !== e.pointerId) return;
    removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end);
    if (!moved && m.type === 'pointerup') cabActions.leverTip();
  };
  canvas.setPointerCapture(e.pointerId);
  addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
}
function pwrDrag(e, scr){   // the bar pressed: the lever to the notch under the finger, and after it as it slides (the lever's own range: 0 to 8 on the playground, where 0 brakes gently)
  const at = m => { deskRay(m); const h = ray.intersectObject(scr, false)[0]; if (h){ cabLever.set((cellAt(h, 'speed')[0] - 256) / PWR_PX); cabT = 1; } };   // the screen drawn again at once
  const move = m => { if (m.pointerId === e.pointerId) at(m); };
  const end = m => { if (m.pointerId !== e.pointerId) return; removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); };
  canvas.setPointerCapture(e.pointerId);
  addEventListener('pointermove', move); addEventListener('pointerup', end); addEventListener('pointercancel', end);
  at(e);
}
function cabRowTap(e){   // a tap on the line screen's row of stops: that station, as a tap on its dot on the line bar
  deskRay(e);
  const h = deskHit(CAB.scrs); if (h?.object.userData.cabScr !== 'line') return false;
  const [x, y] = cellAt(h, 'line'), w = CAB.cell.line[2];
  if (y < CAB_ROW_Y - 40) return false;   // the words above the row
  let st = null, bd = 30;   // canvas px: the nearest dot, the stops being about 38 apart
  for (const s of ROUTE.stations){ const d = Math.abs(cabRowX(s.s, w) - x); if (d < bd){ bd = d; st = s; } }
  if (!st) return false;
  jumpToStation(st); cabSay(st.name);
  return true;
}
let inCab = false, cabDirMv = false;
function keepDriver(){   // in the driver's place the page's controls step aside (🎛️ shows and hides them); the view moves to the other end when the train turns round
  const on = orbit.fp?.name === 'driver';
  if (on !== inCab){ inCab = on; document.body.classList.toggle('in-cab', on); showCabUi(false); }
  if (on && orbit.fp.obj !== driverSeat()) flyPreset('driver');
  if (on && (S.speed > 0.3) !== cabDirMv){ cabDirMv = !cabDirMv; $('cabDir').classList.toggle('moving', cabDirMv); }
}
/* the cab view's outer fifths: a double tap moves the train 1 km on (right) or back (left), each further tap within a second 1 km more, as a video skips;
   the speed, the lever and a station stop ahead stay as they were */
const SKIP_EDGE = 0.2, SKIP_DBL = 500, SKIP_MORE = 1000;
let skip = { side:0, t:0, n:0, m:0 }, cabSayT = 0;
function cabTap(e){
  const r = canvas.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, now = e.timeStamp;   // when the finger lifted, not when a slow frame let the page see it
  const side = u > 1 - SKIP_EDGE ? 1 : u < SKIP_EDGE ? -1 : 0;
  if (!side || side !== skip.side || now - skip.t > (skip.n ? SKIP_MORE : SKIP_DBL)){ skip = { side, t:now, n:0, m:0 }; return; }   // a first tap: one more makes it a double tap
  skip.t = now; skip.n++; cabSkip();
}
function cabSkip(){
  const d = S.dir, v = Math.abs(S.speed), from = S.dist, keep = S.autoStop && { autoStop:true, stopS:S.stopS, autoDoors:S.autoDoors };
  let to = from + 1000 * skip.side * d;
  if (skip.side > 0){   // never nearer where the train must stop than its braking distance and a margin: the platform it brakes for, or the end of the line
    const list = ROUTE.stations, mark = keep ? keep.stopS : (d > 0 ? list[list.length - 1] : list[0]).s - TGV.PLAT_FRONT, lim = mark - Math.max(400, v * v / 1.7 + 200) * d;
    if ((to - lim) * d > 0) to = (lim - from) * d > 0 ? lim : from;
  }
  if (Math.abs(to - from) > 1){ jumpTo(to); if (keep && (keep.stopS - S.dist) * d > 0){ Object.assign(S, keep); syncControls(); } }
  const m = (S.dist - from) * d, km = Math.abs(skip.m += m) / 1000, n = Math.abs(km - Math.round(km)) < 0.05 ? Math.round(km) : km.toFixed(1);
  const head = Math.abs(m) < 1 ? t(keep && skip.side > 0 ? 'station_running' : 'hud_end') : skip.m > 0 ? `▶▶ +${n} km` : `◀◀ −${n} km`;   // nothing moved: why
  cabSay(`${head}\n${stationText(cabTarget())}`, skip.side > 0 ? 'r' : 'l');
}
function cabTarget(){ return S.autoStop && ROUTE.stations.find(x => Math.abs(x.s - TGV.PLAT_FRONT - S.stopS) < 1) || nextStation(0); }   // the platform the autopilot brakes for, else the next one
function cabSay(txt, side = ''){   // a word over the windshield for a moment, beside the edge tapped or in the middle
  const el = $('cabSay'); clearTimeout(cabSayT);
  el.textContent = txt; el.className = `cab-say ${side}`; el.hidden = false;
  cabSayT = setTimeout(() => { el.hidden = true; }, 2000);
}
let rbHome = null;   // where the line bar lives with the page's controls (the HUD, or the kid page's bottom panel) while it sits over the windshield
function showCabUi(on){
  document.body.classList.toggle('cab-ui', on); $('cabUi').setAttribute('aria-pressed', String(on));
  const rb = $('routeBar');
  if (inCab && !on){ if (!rbHome){ rbHome = [rb.parentElement, rb.nextSibling]; $('cabLine').prepend(rb); } }
  else if (rbHome){ rbHome[0].insertBefore(rb, rbHome[1]); rbHome = null; }
}
$('cabUi').addEventListener('click', () => showCabUi(!document.body.classList.contains('cab-ui')));
$('cabLeave').addEventListener('click', () => cabActions.leave());
$('cabDir').addEventListener('click', e => { const b = e.target.closest('button'); if (b) cabActions.dir(+b.dataset.dir); });
holdable($('cabNext'), () => cabActions.next(), () => cabActions.service());   // the desk's Next stop, within reach where the desk is out of view (a phone held upright)
/* ---- walking through the train (CAMS.walk, 03f3), as in a game: the page's controls step aside for Sit and ✕; WASD or the arrows walk and
   a click on the view hands the mouse to the head (pointer lock, Esc frees it); on a touch screen the left stick walks and the right one
   looks. A tap on a free seat, or a click with the crosshair on it, sits there */
let walking = false, walkSayT = 0;
function walkSay(key, n, ms = 2200){   // a word over the view: the car just entered, why that seat cannot be taken, how to walk; no key: away
  const el = $('walkSay'); clearTimeout(walkSayT);
  if (!key){ el.hidden = true; return; }
  el.textContent = key === 'walk_car' ? `${t('walk_car')} ${n}${n % 10 <= 3 ? ' · ' + t('walk_first') : n % 10 === 4 ? ' · ' + t('walk_bar') : ''}` : t(key);
  el.hidden = false; readFor(el.textContent);
  walkSayT = setTimeout(() => { el.hidden = true; }, ms);
}
function keepWalker(dt){
  const on = orbit.fp?.name === 'walk';
  if (on !== walking){
    walking = on; document.body.classList.toggle('walking', on);
    if (on){ document.activeElement?.blur?.(); walkSay(document.body.classList.contains('touch') ? 'walk_hint_touch' : 'walk_hint', 0, 8000); }   // off the Passenger button: Enter now sits
    else { barClose(); walkAway(); walkSay(null); keys.clear(); stickReset(); }
  }
  if (!on) return;
  const open = barIsOpen(), k = m => !open && keys.has(m) ? 1 : 0, mv = STICK.move, lk = STICK.look;   // the bar's menu open: the keys are the menu's
  if (open && BAR.choco !== S.dist < CHOCOLATINE_S) barRender();   // in or out of chocolatine country, the menu open: the pastry's name follows
  let f = k('fwd') - k('back'), s = k('right') - k('left'), v = keys.has('shift') ? 2.6 : 1.3;
  if (mv.on && !open){ f = -mv.y; s = mv.x; v = 2; }
  if (lk.on && !open) orbit.turn(-lk.x * 2 * dt, -lk.y * 1.2 * dt);
  walkMove(dt, f, s, v);
  WK.yaw = orbit.fp.yaw; WK.pitch = orbit.fp.pitch;   // the look, for coming back to it (walkView)
  if (f || s || mv.on || lk.on) idleT = Math.min(idleT, 0);   // walking or looking round: the controls stay up
  const sit = barNear() ? 'bar_order' : WK.seat >= 0 || WK.stool >= 0 ? 'walk_stand' : 'walk_sit', b = $('walkSit');
  if (b.dataset.i18n !== sit){ b.dataset.i18n = sit; b.textContent = t(sit); }
}
const STICK = {};   // {x, y}: where the stick is pushed, -1..1 each way (y down); on: held; id: by which finger
document.querySelectorAll('.walk-stick').forEach(el => {   // the knob follows the thumb within the ring; the middle is dead, then the push grows gently so a small one stays small
  const st = STICK[el.dataset.stick] = { x:0, y:0, on:false, id:-1, el }, knob = el.firstElementChild;
  const put = e => {
    const r = el.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - r.left - R, dy = e.clientY - r.top - R, a = Math.hypot(dx, dy) / R || 1e-9, m = Math.min(1, a);
    const g = m < 0.12 ? 0 : ((m - 0.12) / 0.88) ** 2 / a / R;
    st.x = dx * g; st.y = dy * g;
    knob.style.transform = `translate(calc(-50% + ${(dx / a * m * 0.55).toFixed(1)}px), calc(-50% + ${(dy / a * m * 0.55).toFixed(1)}px))`;
  };
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); if (st.on) return;
    st.on = true; st.id = e.pointerId; el.setPointerCapture(e.pointerId); el.classList.add('on'); put(e);
  });
  el.addEventListener('pointermove', e => { if (st.on && e.pointerId === st.id) put(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, e => { if (e.pointerId === st.id) stickUp(st); });
  el.addEventListener('contextmenu', e => e.preventDefault());
});
function stickUp(st){ st.on = false; st.id = -1; st.x = st.y = 0; st.el.classList.remove('on'); st.el.firstElementChild.style.transform = ''; }
function stickReset(){ for (const st of Object.values(STICK)) stickUp(st); }
orbit.onWheel = e => {   // walking, two fingers swiped on a trackpad turn the head as a drag does, the view following them (a pinch still zooms); the mouse stays free for the buttons
  if (!walking || e.ctrlKey || !orbit.fp) return false;
  const k = orbit.cam.fov * Math.PI / 180 / Math.max(1, canvas.clientHeight) * (e.deltaMode === 1 ? 16 : 1);
  orbit.turn(-e.deltaX * k, -e.deltaY * k);
  return true;
};
$('walkSit').addEventListener('click', () => walkSitNear());
$('walkLeave').addEventListener('click', () => cabActions.leave());
/* ---- the bar car's counter (03f3): its menu, a purse of play money (in cents, for this visit only) and a tray of what was bought, the
   last wait of them still being fetched by the barista (the 3D tray shows the others) */
const BAR = { wallet:2000, tray:[], wait:0, choco:false }, BAR_TRAY = 12, BAR_DEAREST = Math.max(...BAR_MENU.map(m => m.p));
const barIsOpen = () => !$('barMenu').hidden;
const money = c => (c / 100).toFixed(2).replace('.', S.lang === 'fr' ? ',' : '.') + '€';
const price = p => p ? money(p) : t('bar_free');
const barItem = id => BAR_MENU.find(m => m.id === id);
const barName = id => t(id === 'painchoc' && BAR.choco ? 'bar_i_chocolatine' : 'bar_i_' + id);   // BAR.choco: the menu last shown in chocolatine country (CHOCOLATINE_S)
function barRender(){
  const box = $('barItems'); BAR.choco = S.dist < CHOCOLATINE_S;
  if (!box.children.length) for (const it of BAR_MENU){
    const b = document.createElement('button'); b.type = 'button'; b.className = 'bar-item'; b.dataset.id = it.id;
    b.innerHTML = `<span class="bar-e" aria-hidden="true">${it.e}</span><span class="bar-n"></span><span class="bar-p"></span>`;
    b.addEventListener('click', () => barBuy(it.id)); box.append(b);
  }
  for (const b of box.children){
    const it = barItem(b.dataset.id);
    b.querySelector('.bar-n').textContent = barName(it.id); b.querySelector('.bar-p').textContent = price(it.p);
    b.classList.toggle('dear', it.p > BAR.wallet);
  }
  $('barWallet').textContent = `👛 ${money(BAR.wallet)}`;
  const tray = $('barTray'); tray.textContent = '';
  BAR.tray.forEach((id, k) => {
    const b = document.createElement('button'), n = barName(id); b.type = 'button'; b.className = 'bar-chip'; b.innerHTML = barItem(id).e;   // an emoji, or the madeleine's drawing
    b.setAttribute('aria-label', n); b.title = n; b.addEventListener('click', () => barEat(k)); tray.append(b);
  });
  $('barTrayHint').textContent = t(BAR.tray.length ? 'bar_tray_hint' : 'bar_empty');
  $('barPocket').hidden = BAR.wallet >= BAR_DEAREST;   // pocket money once the dearest thing is out of reach
  if (barIsOpen()) barFit();
}
function barFit(){   // a name longer than its button can hold (Chocolatine on an iPad) comes down in size until it fits, rather than running out of it
  for (const n of $('barItems').querySelectorAll('.bar-n')){
    n.style.fontSize = '';
    for (let f = parseFloat(getComputedStyle(n).fontSize); n.scrollWidth > n.clientWidth && f > 10; ) n.style.fontSize = `${f = Math.max(10, Math.floor(f * n.clientWidth / n.scrollWidth * 2) / 2)}px`;
  }
}
addEventListener('resize', () => { if (barIsOpen()) barFit(); });
function barOpen(){
  if (!walking) return;
  $('barMenu').hidden = false; barRender(); document.body.classList.add('bar-open'); keys.clear(); stickReset(); walkSay(null); barFace();   // shown first: barRender measures the names
  $('barItems').firstElementChild.focus({ preventScroll:true });
}
function barClose(){
  const m = $('barMenu'); if (m.hidden) return;
  m.hidden = true; document.body.classList.remove('bar-open');
  if (m.contains(document.activeElement)) document.activeElement.blur();
}
function barBuy(id){   // paid from the purse onto the tray; the till rings and the barista fetches it
  const it = barItem(id);
  if (it.p > BAR.wallet){ walkSay('bar_broke'); return; }
  if (BAR.tray.length >= BAR_TRAY){ walkSay('bar_full'); return; }
  BAR.wallet -= it.p; BAR.tray.push(id); BAR.wait++; tillDing(); barServe(it.st); walkSay('bar_thanks'); barRender();
}
function barEat(k){   // off the tray: eaten or drunk
  const id = BAR.tray[k]; if (!id) return;
  const st = barItem(id).st; if (k >= BAR.tray.length - BAR.wait) BAR.wait--; BAR.tray.splice(k, 1); eatSound(st); walkSay(st === 'food' ? 'bar_yum' : 'bar_gulp'); barRender();
  const ch = $('barTray').children; (ch[Math.min(k, ch.length - 1)] ?? $('barItems').firstElementChild).focus({ preventScroll:true });
}
$('barPocket').addEventListener('click', () => { BAR.wallet += 1000; walkSay('bar_pocket_say'); barRender(); if ($('barPocket').hidden) $('barItems').firstElementChild.focus({ preventScroll:true }); });
$('barClose').addEventListener('click', () => barClose());
const cabLever = (() => {   // the HTML lever: drag or tap along it, or ↑ ↓; it follows the train when the autopilot or the page's controls move it
  const tr = $('clTrack'), knob = $('clKnob'), val = $('clVal'), L = { min:-8, max:8 };   // the kid build makes it 0 to 8, its own lever's range
  const at = v => `${((L.max - v) / (L.max - L.min) * 100).toFixed(2)}%`;   // the top is full power
  L.build = () => {
    tr.querySelectorAll('i').forEach(i => i.remove());
    for (let v = L.min; v <= L.max; v++){ const i = document.createElement('i'); i.style.top = at(v); if (!v && L.min < 0) i.className = 'z'; tr.prepend(i); }
    tr.setAttribute('aria-valuemin', L.min); L.sync();
  };
  L.pos = () => L.min < 0 && S.brake > 0 ? -S.brake : S.notch;
  L.sync = () => {
    const v = L.pos(); knob.style.top = at(v);
    val.textContent = v > 0 ? `${Math.round(S.vMaxEff * v / 8 * 3.6)} km/h` : v < 0 ? `${t('scr_brake')} ${-v}` : '0';
    tr.setAttribute('aria-valuenow', v); tr.setAttribute('aria-valuetext', val.textContent);
  };
  const set = v => { v = clamp(Math.round(v), L.min, L.max); if (v !== L.pos()) cabActions.lever(v); L.sync(); };
  L.set = set; L.step = d => set(L.pos() + d);
  const fromY = e => { const r = tr.getBoundingClientRect(); return L.max - clamp((e.clientY - r.top) / r.height, 0, 1) * (L.max - L.min); };
  let drag = false;
  tr.addEventListener('pointerdown', e => { if (e.button) return; drag = true; tr.setPointerCapture(e.pointerId); set(fromY(e)); });
  tr.addEventListener('pointermove', e => { if (drag) set(fromY(e)); });
  for (const ev of ['pointerup', 'pointercancel']) tr.addEventListener(ev, () => { drag = false; });
  tr.addEventListener('keydown', e => {   // its own keys only: the page's arrows would step the guide away from the cab
    const d = { ArrowUp:1, ArrowRight:1, PageUp:4, ArrowDown:-1, ArrowLeft:-1, PageDown:-4 }[e.key];
    if (d) L.step(d); else if (e.key === 'Home') set(L.min); else if (e.key === 'End') set(L.max); else return;
    e.preventDefault(); e.stopPropagation();
  });
  return L;
})();
cabLever.build();
let cabT = 1;   // seconds since the screens were last drawn
const _cabP = new THREE.Vector3();
function updateCab(dt){
  const hot = { horn:horn.active, panto:S.panto, doors:S.doorsF > 0.02, next:S.autoStop || S.service };   // a lit or pushed-in button: its function is on
  for (const b of CAB.btns){ const id = b.userData.cabBtn; b.visible = id !== 'panto' || S.mode !== 'diesel'; b.position.x = hot[id] ? 0.008 : 0; }
  for (const id in CAB.mats){ const M = CAB.mats[id], k = !S.battery ? 0.06 : hot[id] ? 1 : 0.3; M.body.color.copy(M.base).multiplyScalar(k); M.cap.color.setScalar(k); }
  cabT += dt; if (cabT < 0.25) return;
  if (orbit.fp?.name !== 'driver' && camera.position.distanceToSquared(_cabP.set(9, 3, 0)) > 900) return;   // nobody close enough to a cab to read it
  cabT = 0; drawCab(); CAB.tex.needsUpdate = true;
}
function drawCab(){
  const c = CAB.ctx, cell = (id, fn) => { const [x, y, w, h] = CAB.cell[id]; c.save(); c.translate(x, y); c.beginPath(); c.rect(0, 0, w, h); c.clip(); fn(w, h); c.restore(); };
  cell('speed', (w, h) => { c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h); if (S.battery) cabSpeed(c); });
  cell('line', (w, h) => { c.fillStyle = '#05070a'; c.fillRect(0, 0, w, h); if (S.battery) cabLine(c, w); });
  cell('panel', (w, h) => cabPanel(c, w, h));
  for (const id in CAB.mats) cell(id, () => cabIcon(c, id));
}
function cabSpeed(c){   // 512 × 320: speed dial with the line's limit, what is live, brake and power
  const v = S.speed * 3.6, top = Math.round(SPEC[S.mode].vMax * 3.6 / 20) * 20, lim = ROUTE.lineLimit(S.dist);
  const a0 = 0.75 * Math.PI, ang = x => a0 + 1.5 * Math.PI * clamp(x / top, 0, 1);
  c.lineCap = 'round'; c.lineWidth = 16;
  c.strokeStyle = '#1a2a3a'; c.beginPath(); c.arc(256, 188, 122, a0, ang(top)); c.stroke();
  if (v >= 0.5){ c.strokeStyle = v > lim + 3 ? '#ff5a5f' : '#3ccf6f'; c.beginPath(); c.arc(256, 188, 122, a0, ang(v)); c.stroke(); }
  if (lim < top){ const a = ang(lim); c.strokeStyle = '#ffcf33'; c.lineWidth = 6; c.lineCap = 'butt'; c.beginPath(); c.moveTo(256 + 102 * Math.cos(a), 188 + 102 * Math.sin(a)); c.lineTo(256 + 142 * Math.cos(a), 188 + 142 * Math.sin(a)); c.stroke(); }
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#fff'; c.font = `700 104px ${CAB_FONT}`; c.fillText(Math.round(v), 256, 218);
  c.fillStyle = '#8fb3d9'; c.font = `600 28px ${CAB_FONT}`; c.fillText('km/h', 256, 252);
  c.fillStyle = '#fff'; c.beginPath(); c.arc(452, 58, 40, 0, Math.PI * 2); c.fill();   // the limit, as the sign by the track
  c.strokeStyle = '#e5484d'; c.lineWidth = 9; c.beginPath(); c.arc(452, 58, 35.5, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#111'; c.font = `700 34px ${CAB_FONT}`; c.textBaseline = 'middle'; c.fillText(lim, 452, 60);
  const chip = (x, txt, col) => { c.font = `700 26px ${CAB_FONT}`; const w = c.measureText(txt).width + 24; c.fillStyle = col; c.beginPath(); c.roundRect(x, 14, w, 38, 8); c.fill(); c.fillStyle = '#05070a'; c.textAlign = 'left'; c.fillText(txt, x + 12, 34); return x + w + 10; };
  let x = 16;
  if (S.mode === 'diesel') x = chip(x, t('scr_engine').toUpperCase(), S.engine === 'running' ? '#3ccf6f' : S.engine === 'cranking' ? '#ffcf33' : '#5b6773');
  else x = chip(x, S.lineOn ? `${kvLine()} kV` : t('scr_panto_dn').toUpperCase(), S.lineOn ? '#3ccf6f' : '#5b6773');
  if (S.mode === 'tgv' && S.doorsF > 0.02) chip(x, t('scr_doors').toUpperCase(), '#ffcf33');
  const y = 298, bw = S.brake / 8 * 200, tw = S.notch / 8 * 200;   // brake grows to the left, power to the right
  c.fillStyle = '#1a2a3a'; c.fillRect(56, y - 7, 400, 14);
  c.fillStyle = '#e5484d'; c.fillRect(256 - bw, y - 7, bw, 14);
  c.fillStyle = '#3ccf6f'; c.fillRect(256, y - 7, tw, 14);
  c.fillStyle = '#fff'; c.fillRect(255, y - 12, 2, 24);
  c.beginPath(); c.arc(256 + cabLever.pos() * PWR_PX, y, 11, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#05070a'; c.lineWidth = 3; c.stroke();   // its knob, where the lever stands: a slider the finger can take
  c.fillStyle = '#8fb3d9'; c.font = `600 20px ${CAB_FONT}`; c.textBaseline = 'bottom';
  c.textAlign = 'left'; c.fillText(t('scr_brake').toUpperCase(), 56, y - 11); c.textAlign = 'right'; c.fillText(t('scr_power').toUpperCase(), 456, y - 11);
}
const CAB_ROW_Y = 262, cabRowX = (s, w) => 30 + RB.f(s) * (w - 60);   // the line screen's row of stops, Toulouse on the left as on the line bar
function cabLine(c, w){   // 512 × 320: where the train is going, the next stop, the line with its stops
  const list = ROUTE.stations, st = nextStation(0), d = st ? (st.s - TGV.PLAT_FRONT - S.dist) * S.dir : 0, end = S.dir > 0 ? list[list.length - 1] : list[0];
  const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  c.fillStyle = '#0f2236'; c.fillRect(0, 0, w, 56);
  c.fillStyle = '#dce8f5'; c.font = `600 28px ${CAB_FONT}`; c.textBaseline = 'middle';
  c.textAlign = 'left'; c.fillText(`→ ${end.name}`, 18, 29, w - 130); c.textAlign = 'right'; c.fillText(hm, w - 18, 29);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#8fb3d9'; c.font = `600 24px ${CAB_FONT}`; c.fillText(t(st ? 'hud_next' : 'hud_end').toUpperCase(), 18, 96);
  c.fillStyle = '#fff'; c.font = `700 50px ${CAB_FONT}`; c.fillText((st || end).name, 18, 150, w - 36);
  if (st){ c.fillStyle = '#ffcf33'; c.font = `700 40px ${CAB_FONT}`; c.fillText(distText(d), 18, 202); }
  c.fillStyle = '#8fb3d9'; c.font = `600 24px ${CAB_FONT}`; c.textAlign = 'right'; c.fillText(`${t('hud_pk')} ${(S.dist / 1000).toFixed(1)}`, w - 18, 202);
  const X = s => cabRowX(s, w), y = CAB_ROW_Y;
  c.strokeStyle = '#3a4a5c'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(30, y); c.lineTo(w - 30, y); c.stroke();
  for (const s of list){ c.fillStyle = s === st ? '#ffcf33' : '#dce8f5'; c.beginPath(); c.arc(X(s.s), y, s === st ? 10 : 7, 0, Math.PI * 2); c.fill(); }
  const tx = X(S.dist), k = S.dir;
  c.fillStyle = '#ff8a3d'; c.beginPath(); c.moveTo(tx + 14 * k, y); c.lineTo(tx - 8 * k, y - 13); c.lineTo(tx - 8 * k, y + 13); c.closePath(); c.fill();
}
function cabPanel(c, w, h){   // 512 × 320: the print around the push buttons, which stand at y 130 in their columns
  const kind = S.mode === 'tgv' ? 'tgv' : 'loco';
  c.fillStyle = '#262e37'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#3a4550'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 30px ${CAB_FONT}`;
  CAB.cols[kind].forEach((id, i) => {
    if (id === 'panto' && S.mode === 'diesel') return;
    const x = CAB.px[kind][i];
    c.fillStyle = '#151a20'; c.beginPath(); c.arc(x, 130, 54, 0, Math.PI * 2); c.fill();
    const lab = t('btn_' + id).toUpperCase(), sp = lab.indexOf(' ');
    c.fillStyle = S.battery ? '#c9d4df' : '#56606b';
    if (sp > 0 && c.measureText(lab).width > 108){ c.fillText(lab.slice(0, sp), x, 234, 108); c.fillText(lab.slice(sp + 1), x, 266, 108); }   // as wide as the button at most: two words go on two lines
    else c.fillText(lab, x, 250, 108);
  });
}
function cabIcon(c, id){   // 128 × 128 on the button's cap, in the button's colour
  c.fillStyle = '#' + CAB.mats[id].base.getHexString(); c.fillRect(0, 0, 128, 128);
  c.fillStyle = c.strokeStyle = id === 'doors' ? '#fff' : '#14181d'; c.lineWidth = 9; c.lineCap = 'round';
  if (id === 'horn'){
    c.beginPath(); c.moveTo(30, 52); c.lineTo(74, 30); c.lineTo(74, 98); c.lineTo(30, 76); c.closePath(); c.fill(); c.fillRect(20, 54, 12, 20);
    for (const r of [22, 36]){ c.beginPath(); c.arc(78, 64, r, -0.7, 0.7); c.stroke(); }
  } else if (id === 'panto'){   // a bolt: the line's power
    c.beginPath(); [[72, 12], [36, 70], [60, 70], [50, 116], [94, 52], [68, 52], [80, 12]].forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill();
  } else if (id === 'doors'){   // two leaves with their windows, sliding apart
    c.fillRect(30, 22, 31, 84); c.fillRect(67, 22, 31, 84);
    for (const k of [-1, 1]){ c.beginPath(); c.moveTo(64 + 57 * k, 64); c.lineTo(64 + 45 * k, 52); c.lineTo(64 + 45 * k, 76); c.closePath(); c.fill(); }
    c.fillStyle = '#' + CAB.mats.doors.base.getHexString(); c.fillRect(36, 30, 19, 30); c.fillRect(73, 30, 19, 30);
  } else {   // a pin: the next platform
    c.beginPath(); c.arc(64, 52, 32, 0.8 * Math.PI, 0.2 * Math.PI); c.lineTo(64, 114); c.closePath(); c.fill();
    c.fillStyle = '#' + CAB.mats.next.base.getHexString(); c.beginPath(); c.arc(64, 52, 13, 0, Math.PI * 2); c.fill();
  }
}

/* ---- labels */
const labels = {}, labelRoot = $('labels'), _lp = new THREE.Vector3();
function updateLabels(){
  const w = canvas.clientWidth, hgt = canvas.clientHeight;
  for (const id in parts){
    const p = parts[id];
    const show = p.group.visible && (S.labelsOn || id === selected);
    let el = labels[id];
    if (!show){ if (el) el.style.display = 'none'; continue; }
    if (!el){ el = document.createElement('div'); el.className = 'lbl'; el.textContent = PARTS[id][S.lang].name; labelRoot.appendChild(el); labels[id] = el; }
    _lp.copy(p.anchor).add(p.group.position); curveLocal(_lp.x, _lp.y, _lp.z, _lp);
    if (cutPlane && cutPlane.distanceToPoint(_lp) < -0.2 && id !== 'catenary'){ el.style.display = 'none'; continue; }
    _lp.project(camera);
    if (_lp.z > 1 || Math.abs(_lp.x) > 1.1 || Math.abs(_lp.y) > 1.1){ el.style.display = 'none'; continue; }
    el.style.display = '';
    el.style.transform = `translate(${((_lp.x + 1) / 2 * w).toFixed(1)}px,${((1 - _lp.y) / 2 * hgt - 16).toFixed(1)}px) translate(-50%,-100%)`;
    el.style.opacity = id === selected ? '1' : '0.85';
  }
}

/* ---- route HUD, line bar, track choice, time scale, horn, free camera keys */
const KIND_KEY = ['', 'hud_bridge', 'hud_tunnel', 'hud_cutting', 'hud_viaduct'];
// The line bar is a line diagram, not a map: the stops are evenly spaced, as on the displays in the train, so the 14 km from Massy
// to Paris and the 10 km from Poitiers to Futuroscope keep a gap between their dots to aim at, even on a 264 px bar. The tip still shows the exact PK.
const RB = (() => {
  const st = ROUTE.stations, s = [0, ...st.map(x => x.s), ROUTE.L], inner = i => i > 0 && i < s.length - 2;
  const w = s.slice(1).map((v, i) => inner(i) ? 1 / Math.max(1, st.length - 1) : (v - s[i]) / ROUTE.L);   // the stubs behind the two end platforms keep their length
  const sum = w.reduce((a, b) => a + b, 0), f = [0];
  for (const v of w) f.push(f[f.length - 1] + v / sum);
  const lerp = (a, b, v) => { let i = 0; while (i < a.length - 2 && v > a[i + 1]) i++; const d = a[i + 1] - a[i]; return b[i] + (d > 0 ? (v - a[i]) / d : 0) * (b[i + 1] - b[i]); };
  return { f:v => lerp(s, f, v), s:v => lerp(f, s, v) };   // PK in metres to 0..1 along the bar, and back
})();
/* the weather's controls: Sun, Clouds, Rain or Auto, and under Auto the day's plan (03b-scene.js), the slot of the hour ringed */
let wxHook = null, wxSlotT = -1;   // the kid build shows the pick on its own button too; the slot last ringed
const wxPlanHtml = () => WX_PLAN.slots.map((w, i) => `<button type="button" data-slot="${i}"><small>${i * 3}h</small><span>${WX_ICO[w]}</span></button>`).join('');
function wxShow(){
  const pick = wxPick(); wxSlotT = planSlot();
  document.querySelectorAll('#wxSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wx === pick)));
  document.querySelectorAll('.wx-plan').forEach(p => p.querySelectorAll('button').forEach((b, i) => {
    b.lastChild.textContent = WX_ICO[WX_PLAN.slots[i]]; b.setAttribute('aria-current', i === wxSlotT ? 'time' : 'false');
  }));
  $('wxPlan').hidden = !WX_PLAN.auto;
  if (wxHook) wxHook(pick);
}
$('wxPlan').innerHTML = wxPlanHtml();
let hudClockT = '', todInT = -1e9;   // the clock last shown, and whether it was the real time; when the slider last moved by hand
function updateHud(){
  const s = S.dist;
  $('hudPk').textContent = (s / 1000).toFixed(1);
  $('hudAlt').textContent = Math.round(ROUTE.altAt(s));
  const g = Math.round(ROUTE.gradeAt(s) * 1000 * S.dir); $('hudGrade').textContent = (g > 0 ? '+' : '') + g;
  $('hudTracks').textContent = ROUTE.tracksAt(s);
  $('hudLimit').textContent = ROUTE.lineLimit(s);
  $('hudNext').textContent = stationText(nextStation(0));
  const k = ROUTE.kindAt(s); $('hudKind').textContent = k ? t(KIND_KEY[k]) : '';
  $('rbTrain').style.left = `${(RB.f(s) * 100).toFixed(2)}%`;
  $('throttleVal').textContent = `${S.notch} · ${Math.round(S.vMaxEff * S.notch / 8 * 3.6)} km/h`; cabLever.sync();
  const hm = hhmm(CLOCK.min), ti = $('todIn');
  if (hm + CLOCK.live !== hudClockT){ hudClockT = hm + CLOCK.live; $('hudClock').textContent = '🕒 ' + hm; $('todOut').textContent = hm; $('todNow').setAttribute('aria-pressed', String(CLOCK.live)); }
  if (performance.now() - todInT > 1000) ti.value = Math.round(CLOCK.min);   // not under a moving finger
  if (planSlot() !== wxSlotT) wxShow();
}
function distText(d){ return d < 950 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`; }
function stationText(st){ return st ? `${st.name} · ${distText((st.s - TGV.PLAT_FRONT - S.dist) * S.dir)}` : t('hud_end'); }   // a stop and how far to its mark
function tailLen(){ return S.mode === 'tgv' ? (S.sets === 2 || S.coupling !== 0 ? 382.5 - Math.min(0, S.set2Off) : 185.4) : 82; }
/* teleport along the line; the train keeps its speed unless asked to stop */
function jumpTo(s, stop = false){
  const svc = S.service; manual(); S.service = svc; S.autoStop = false; S.autoDoors = false; S.coupling = 0;   // a jump keeps the whole line going
  S.dist = clamp(s, 8 + tailLen(), ROUTE.L - 15.5);
  if (stop){ S.speed = 0; S.notch = 0; S.brake = 0; S.throttleN = 0; }   // no effort left over to nudge it off the mark
  S.stopS = S.dist; trk.from = trk.to; trk.s0 = -1e9; paxResolve(); voltSnap();
  S.atStation = S.speed < 0.05 && Math.abs(stationOffset()) < 2; S.stationT = 0; if (!S.atStation) S.doors = false;
  for (const o of opp){ o.active = false; o.group.visible = false; }
  syncControls(); updateHud();
}
function jumpToStation(st){ trk.from = trk.to = 0; trk.s0 = -1e9; jumpTo(st.s - TGV.PLAT_FRONT, true); S.doors = S.service && S.mode === 'tgv'; S.atStation = true; syncControls(); }   // on the whole line, the doors open for the people waiting
// the line bar's short names; their order is the order labels win a place when they would overlap, after the two ends (the TV remote's bar follows it too)
const ST_SHORT = { bdx:'Bordeaux', par:'Paris', tls:'Toulouse', pts:'Poitiers', spc:'St-Pierre-des-Corps', ang:'Angoulême', agn:'Agen', mtb:'Montauban', vdm:'Vendôme', msy:'Massy', lbn:'Libourne', chl:'Châtellerault', fut:'Futuroscope' };
{
  const rb = $('routeBar'), bar = document.createElement('div'), SHORT = ST_SHORT;
  const pct = s => `${(RB.f(s) * 100).toFixed(2)}%`, last = ROUTE.stations.length - 1;
  bar.className = 'rb-in'; rb.appendChild(bar);
  // a tap on a dot stops the train at that platform; any other press, a label included, or a press that slides off a dot
  // teleports to where it is let go, the tip showing the PK on the way
  const labels = ROUTE.stations.map((st, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'rb-st'; b.dataset.i = i; b.style.left = pct(st.s); b.title = st.name; b.setAttribute('aria-label', st.name);
    b.innerHTML = '<i></i>';
    b.addEventListener('click', e => { if (e.detail === 0) jumpToStation(st); });   // the keyboard; pointers are handled on the bar
    const l = document.createElement('span'); l.className = 'rb-lb'; l.style.left = pct(st.s); l.textContent = SHORT[st.id] || st.name;
    bar.append(b, l);
    return l;
  });
  const rank = i => i === 0 || i === last ? -1 : (k => k < 0 ? 99 : k)(Object.keys(SHORT).indexOf(ROUTE.stations[i].id));
  const order = labels.map((l, i) => i).sort((a, b) => rank(a) - rank(b));
  new ResizeObserver(() => {   // most important first; a label that does not fit centred under its dot may start or end at it instead, or hide
    const kept = [];
    for (const i of order){
      const l = labels[i];
      l.hidden = true;
      for (const al of i === 0 ? ['r'] : i === last ? ['l'] : ['', 'r', 'l']){
        l.className = 'rb-lb' + (al && ' ' + al); l.hidden = false;
        const r = l.getBoundingClientRect();
        if (!kept.some(k => r.left < k.right + 6 && r.right > k.left - 6)){ kept.push(r); break; }
        l.hidden = true;
      }
    }
  }).observe(rb);
  const tr = document.createElement('i'); tr.id = 'rbTrain';
  const tip = document.createElement('span'); tip.id = 'rbTip';
  bar.append(tr, tip);
  // click or drag anywhere on the line to teleport there
  rb.title = t('rb_title');
  const sAt = e => { const r = bar.getBoundingClientRect(); return RB.s(clamp((e.clientX - r.left) / Math.max(1, r.width), 0, 1)); };
  let drag = null;   // the press in progress: where it started, the station of the dot it started on, whether it has slid
  const showTip = e => {
    const b = e.target.closest('.rb-st'), st = drag ? !drag.moved && drag.st : b && ROUTE.stations[+b.dataset.i], s = st ? st.s : sAt(e);
    tip.style.display = 'block'; tip.style.left = pct(s); tip.textContent = st ? st.name : `PK ${(s / 1000).toFixed(1)}`;
  };
  rb.addEventListener('pointerdown', e => { const b = e.target.closest('.rb-st'); drag = { x:e.clientX, st:b && ROUTE.stations[+b.dataset.i], moved:false }; rb.setPointerCapture(e.pointerId); showTip(e); });
  rb.addEventListener('pointermove', e => { if (drag && Math.abs(e.clientX - drag.x) > 4) drag.moved = true; showTip(e); });
  rb.addEventListener('pointerup', e => { if (!drag) return; const d = drag; drag = null; tip.style.display = 'none'; if (d.st && !d.moved) jumpToStation(d.st); else jumpTo(sAt(e)); });
  rb.addEventListener('pointercancel', () => { drag = null; tip.style.display = 'none'; });
  rb.addEventListener('pointerleave', () => { if (!drag) tip.style.display = 'none'; });
  // kilometre post input
  const pkIn = $('pkIn'); pkIn.max = (ROUTE.L / 1000).toFixed(1);
  const pkGo = () => { const v = parseFloat(pkIn.value.replace(',', '.')); if (Number.isFinite(v)) jumpTo(v * 1000); pkIn.blur(); };
  $('pkGo').addEventListener('click', pkGo);
  pkIn.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); pkGo(); } e.stopPropagation(); });
  pkIn.addEventListener('keyup', e => e.stopPropagation());
}
$('wxSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setWeather(b.dataset.wx); });
$('wxPlan').addEventListener('click', e => { const b = e.target.closest('button'); if (b) wxPlanCycle(+b.dataset.slot); });
$('todIn').addEventListener('input', e => { todInT = performance.now(); setClock(+e.target.value); updateHud(); });   // the time of day by hand; Now: the real time again
$('todNow').addEventListener('click', () => { setClock(null); updateHud(); });
$('trackSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const res = requestTrack(+b.dataset.track);
  $('trackHint').textContent = t(res === 'busy' ? 'track_busy' : res === 'occupied' ? 'track_occupied' : 'track_hint');
  syncControls();
});
$('timeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.timeScale = +b.dataset.time; syncControls(); });
{
  const hb = $('btnHorn');
  hb.addEventListener('pointerdown', e => { e.preventDefault(); horn.press(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) hb.addEventListener(ev, () => horn.release());
  hb.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); if (!e.repeat) horn.press(); } });
  hb.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') horn.release(); });
}
const keys = new Set();
const KEY_MOVE = { w:'fwd', s:'back', a:'left', d:'right', e:'up', r:'up', q:'down', f:'down' };
const CODE_MOVE = { KeyW:'fwd', KeyS:'back', KeyA:'left', KeyD:'right', KeyE:'up', KeyQ:'down' };   // physical positions, so an AZERTY Z also goes forward
const WALK_MOVE = { KeyW:'fwd', ArrowUp:'fwd', KeyS:'back', ArrowDown:'back', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right' };   // walking: by the key's place (an AZERTY's ZQSD) and the arrows; elsewhere ← → step the guide
const moveOf = e => walking ? WALK_MOVE[e.code] || WALK_MOVE[e.key] || null : KEY_MOVE[e.key.toLowerCase()] || CODE_MOVE[e.code] || null;
window.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'shift'){ keys.add('shift'); return; }
  const mv = moveOf(e);
  if (mv){ keys.add(mv); e.preventDefault(); return; }
  if ((k === 'h' || k === ' ') && !e.target.matches('button,a,input,select,textarea')){ e.preventDefault(); if (!e.repeat) horn.press(); }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'shift') keys.delete('shift');
  for (const mv of [WALK_MOVE[e.code], WALK_MOVE[e.key], CODE_MOVE[e.code], KEY_MOVE[k]]) if (mv) keys.delete(mv);   // all it may have held: walking may have begun or ended since it went down
  if (k === 'h' || k === ' ') horn.release();
});
window.addEventListener('blur', () => { keys.clear(); horn.release(); });
const _pf = new THREE.Vector3(), _pr = new THREE.Vector3();
function panKeys(dt){   // the focus point moves in the train's frame, so the camera stays attached to it
  if (!keys.size || (keys.size === 1 && keys.has('shift'))) return;
  if (orbit.fp){   // first person: the keys turn the head (walking: they walk, keepWalker)
    if (orbit.fp.name === 'walk') return;
    const a = 1.3 * dt, on = m => keys.has(m) ? 1 : 0;
    orbit.turn((on('left') - on('right')) * a, (Math.max(on('fwd'), on('up')) - Math.max(on('back'), on('down'))) * a); return;
  }
  const sp = 0.6 * orbit.sph.radius * (keys.has('shift') ? 3 : 1) * dt, tt = orbit.tTarget;
  _pf.copy(orbit.target).sub(camera.position); _pf.y = 0; if (_pf.lengthSq() < 1e-6) _pf.set(1, 0, 0); _pf.normalize();
  _pr.crossVectors(_pf, Y_UP);
  if (keys.has('fwd')) tt.addScaledVector(_pf, sp); if (keys.has('back')) tt.addScaledVector(_pf, -sp);
  if (keys.has('right')) tt.addScaledVector(_pr, sp); if (keys.has('left')) tt.addScaledVector(_pr, -sp);
  if (keys.has('up')) tt.y += sp; if (keys.has('down')) tt.y -= sp;
  const xMin = S.mode === 'tgv' ? (S.sets === 2 || S.coupling !== 0 ? -460 : -260) : -120;
  tt.x = clamp(tt.x, xMin, 60); tt.z = clamp(tt.z, -80, 80); tt.y = clamp(tt.y, -2, 60);
}

/* ---- resize, theme, loop */
function resize(){
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
/* the view's centre: the middle of what the panels leave of the stage (the dock down the left or along the bottom, the line bar, a phone's row of gauges), so the model is not drawn under them; first person looks straight ahead */
const aim = { x:0, y:0, tx:0, ty:0, set:false, dirty:false }, aimEls = [$('dock'), $('hud'), $('gauges')];
function aimView(){
  const st = canvas.getBoundingClientRect(); let l = st.left, t = st.top, b = st.bottom;
  if (!st.width || !st.height) return;
  for (const el of aimEls){   // hidden (the cab, walking, the kid page): a 0×0 box, left out
    const r = el.getBoundingClientRect();
    if (r.height > st.height * 0.6) l = Math.max(l, r.right);   // a column down the left
    else if (r.width > st.width * 0.6){ if (r.top > st.top + st.height / 3) b = Math.min(b, r.top); else t = Math.max(t, r.bottom); }   // a band across, below or above
  }
  aim.tx = (st.left - l) / 2; aim.ty = (st.top + st.bottom - t - b) / 2; aim.dirty = true;
  if (!aim.set){ aim.set = true; aim.x = aim.tx; aim.y = aim.ty; }   // the page opens with the model already there
}
function stepAim(dt){   // glides to it as a panel folds or opens; in a seat with the panels shown the windshield moves clear of them too
  const tx = aim.tx, ty = aim.ty, k = Math.min(1, dt * 5);
  if (aim.x === tx && aim.y === ty && !aim.dirty) return;
  aim.x += (tx - aim.x) * k; aim.y += (ty - aim.y) * k; aim.dirty = false;
  if (Math.abs(tx - aim.x) + Math.abs(ty - aim.y) < 0.5){ aim.x = tx; aim.y = ty; }
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (aim.x || aim.y) camera.setViewOffset(w, h, aim.x, aim.y, w, h); else camera.clearViewOffset();
}
const aimRo = new ResizeObserver(aimView); [canvas.parentElement, ...aimEls].forEach(el => aimRo.observe(el));
darkMq.addEventListener('change', () => setTimeout(recolorFlows, 0));
new MutationObserver(() => recolorFlows()).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });

let last = performance.now(), gaugeT = 1;
function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (autoOn){ autoT += dt; if (autoT > STEPS[S.mode][stepIdx].dur){ if (stepIdx < STEPS[S.mode].length - 1) goStep(stepIdx + 1); else stopAuto(); } }
  frame(dt);
  renderer.render(scene, camera);
  updateLabels();
  gaugeT += dt; if (gaugeT > 0.1){ gaugeT = 0; updateGauges(); updateHud(); }
}
/* ---- compass: the rose turns so its N shows true north the way the camera looks (route frame: x east, -z north) */
const cpCard = $('cpCard'), cpL = ['cpN', 'cpE', 'cpS', 'cpW'].map(id => $(id)), _cpD = new THREE.Vector3(), _cpQ = new THREE.Quaternion();
let cpH = NaN;
function updateCompass(){
  _cpD.set(1, 0, 0).applyQuaternion(camera.quaternion).applyQuaternion(_cpQ.copy(world.quaternion).invert());   // the camera's right, in the route frame
  const h = Math.atan2(_cpD.z, _cpD.x);   // heading of up × right: where the camera faces at any pitch, the screen's top when it looks straight down
  if (Math.abs(h - cpH) < 0.002) return;
  cpH = h;
  cpCard.setAttribute('transform', `rotate(${(-h * 180 / Math.PI).toFixed(1)})`);
  cpL.forEach((el, k) => { const a = k * Math.PI / 2 - h; el.setAttribute('x', (20 * Math.sin(a)).toFixed(1)); el.setAttribute('y', (-20 * Math.cos(a)).toFixed(1)); });   // the letters go round but stay upright
}
/* ---- while the train runs and nobody touches the page, the overlays fade out of the way (the kid build keeps its big buttons in sight) */
const IDLE_S = 5, READ_WPS = 3.5;   // calm seconds before the fade; words read per second, so a new text stays up long enough to be read
let idleT = 0, wakeTap = false, lastPtr = 'mouse';
document.body.classList.toggle('touch', matchMedia('(pointer: coarse)').matches);
function wakeUi(e){
  if (e.type === 'pointermove' && e.pointerType === 'mouse' && !e.movementX && !e.movementY) return;   // the browser re-checking what lies under a still mouse
  const B = document.body.classList, was = B.contains('ui-idle');
  if (noGui) ngWake();
  if (e.pointerType) lastPtr = e.pointerType;
  if (e.type === 'pointerdown' && e.pointerType) document.body.classList.toggle('touch', e.pointerType !== 'mouse');   // the sticks for a finger, the mouse look for a mouse
  if (e.type === 'pointerdown') wakeTap = was && e.pointerType !== 'mouse';   // a finger on the bare view only wakes the page, it picks nothing
  idleT = Math.min(idleT, 0);
  if (was) B.remove('ui-idle');
}
for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, wakeUi, { capture:true, passive:true });
function readFor(txt){ idleT = Math.min(idleT, -txt.split(/\s+/).length / READ_WPS); if (document.body.classList.contains('ui-idle')) document.body.classList.remove('ui-idle'); }
function updateIdle(dt){
  const B = document.body.classList;
  if (noGui || B.contains('kid') || B.contains('bar-open')) return;   // the bar's menu stays up while open
  idleT += dt;
  if (Math.abs(S.speed) < 0.3){ idleT = Math.min(idleT, 0); if (B.contains('ui-idle')) B.remove('ui-idle'); return; }   // a train at rest brings them back
  if (idleT < IDLE_S || B.contains('ui-idle')) return;
  if (lastPtr === 'mouse' && document.querySelector(':is(.dock,.infocard,.hud,.gauges,.cab-bar,.cab-deck>*,.walk-bar>*):hover')){ idleT = 0; return; }   // the mouse rests on them: someone is reading
  B.add('ui-idle');
}
/* ---- no GUI ("a no-GUI mode button that hides the GUI to only see the travel"): every control away, only the trip on screen. The topbar's
   button (the playground's, under its compass) or G hides them; the corner's button, Esc or G bring them back. That button steps aside
   while nobody moves; a tap on the view outside only brings it back. In 3D everything still answers ("the 3D buttons, the 3D elements, and Power
   should be actionable even in no GUI"): the driver's desk, screens and lever, the walker's seats, counter and stools, with their words while someone is here */
const NG_CALM_MS = 2500, NG_SAY = '#cabSay:not([hidden]),#walkSay:not([hidden]),.kid-toast.show';   // the words a tap brings: the way back waits for them to go
let noGui = false, ngTm = 0;
function ngWake(){
  const B = document.body.classList; B.remove('ng-calm'); clearTimeout(ngTm);
  const calm = () => { if ($('guiBack').matches(':hover') || document.querySelector(NG_SAY)) ngTm = setTimeout(calm, 1000); else B.add('ng-calm'); };
  ngTm = setTimeout(calm, NG_CALM_MS);
}
function setNoGui(on){
  noGui = on; document.body.classList.toggle('nogui', on);
  document.querySelectorAll('#btnNoGui,#kidNoGui').forEach(b => b.setAttribute('aria-pressed', String(on)));
  if (on){ document.activeElement?.blur?.(); ngWake(); }
  else { clearTimeout(ngTm); document.body.classList.remove('ng-calm', 'ui-idle'); idleT = Math.min(idleT, 0); }
}
$('btnNoGui').addEventListener('click', () => setNoGui(true));
$('guiBack').addEventListener('click', () => setNoGui(false));
window.addEventListener('keydown', e => {   // ahead of the page's keys: this Esc does not also end the passenger's walk
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches('input,textarea,select')) return;
  if (e.key.toLowerCase() !== 'g' && !(noGui && e.key === 'Escape')) return;
  e.preventDefault(); e.stopPropagation();
  if (!e.repeat) setNoGui(!noGui);
}, true);
let frameHook = null;   // the kid build hangs its own rules here
function frame(dt){
  simulate(dt); serviceTick(); animate(Math.min(dt * S.timeScale, 0.25)); updateFlows(dt); updateWeather(dt); panKeys(dt); if (frameHook) frameHook(dt);
  keepDriver(); keepWalker(dt); updateIdle(dt);
  orbit.update(dt); updateLights(); stepAim(dt); updateCab(dt); updateCompass(); updateSound(dt);
}
window.tick = (sec, dt = 0.05) => { for (let t = 0; t < sec - 1e-9; t += dt) frame(dt); renderer.render(scene, camera); updateLabels(); updateGauges(); updateHud(); };

/* ---- init */
resize();
setShell(0.18); setCut('none'); setExplode(0);
setMode('diesel');
requestAnimationFrame(loop);
window.locoDebug = { BAR, BAR_MENU, barOpen, barClose, barBuy, barEat, barNear, barIsOpen, walkSitStool, updateBar, CAB, driverSeat, cabActions, cabLever, S, simulate, animate, updateFlows, updateGauges, orbit, renderer, scene, camera, goStep, setMode, setCut, setExplode, setShell, select, parts, TGV, tgvSets, station, updateTgv, syncControls, tick:window.tick, ROUTE, horn, chunks, requestTrack, trk, opp, parked, cars, curveLocal, updateHud, jumpToStation, jumpTo, setWeather, WX_PLAN, wxPick, wxPlanCycle, wxShow, CLOCK, setClock, setTod, todPick, todIcon, hhmm, solarNoon, sunTime, sunHAt, SUN_R, LIGHT_DIR, sky:() => ({ sunH, weatherId, wxW:{ ...wxW }, P:[...PAL] }), sun, hemi, fill, stars, DARK, beam, halos, winMats, SALOON, tunnelIn, updateLights, tunnelM, pcHosts, pcShells, flowObjs, landmarks, flyPreset, SND, PX, pool, paxResolve, paxHolding, allCoaches, world, keys, WK, walkMove, walkSitNear, walkPick, walkStand, walkZones, STICK, walkView, nextStation, goNextStation, serviceOn, serviceOff, driverLever, cabRowX, CAB_ROW_Y, OVER };
