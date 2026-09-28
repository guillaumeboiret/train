/* ============================================================ game logic */
const I18N = {
  fr:{ sub:'Le jeu des aiguillages', levels:'Niveaux', restart:'Recommencer', pause:'Pause', resume:'Reprendre', loco:'Anatomie d\'une locomotive ↗', locoShort:'Locomotive ↗',
       chooseLevel:'Choisir un niveau', close:'Fermer', level:'Niveau', arrived:'arrivés', tutorial:'Tutoriel', goal:'Objectif',
       win:'Niveau réussi', winText:'Tous les trains sont arrivés en {t} s.', next:'Niveau suivant', replay:'Rejouer', fail:'Raté', retry:'Réessayer',
       crash:'Collision entre deux trains.', wrong:'Le train → {to} est arrivé en {at}.', buffer:'Le train → {to} a heurté un butoir.',
       allDone:'Bravo, les 10 niveaux sont terminés. Temps: {t} s.', trains:'{n} trains', train:'1 train',
       aria_speed:'Vitesse', aria_lang:'Langue', aria_map:'Plan des voies' },
  en:{ sub:'The railway switch game', levels:'Levels', restart:'Restart', pause:'Pause', resume:'Resume', loco:'Locomotive Anatomy ↗', locoShort:'Locomotive ↗',
       chooseLevel:'Choose a level', close:'Close', level:'Level', arrived:'arrived', tutorial:'Tutorial', goal:'Goal',
       win:'Level complete', winText:'All trains arrived in {t} s.', next:'Next level', replay:'Replay', fail:'Failed', retry:'Retry',
       crash:'Two trains collided.', wrong:'Train → {to} arrived at {at}.', buffer:'Train → {to} hit a buffer stop.',
       allDone:'Well done, all 10 levels finished. Time: {t} s.', trains:'{n} trains', train:'1 train',
       aria_speed:'Speed', aria_lang:'Language', aria_map:'Track plan' },
};
let lang = I18N[document.documentElement.lang] ? document.documentElement.lang : 'en';   // the site's language (site/lang.js)
function tt(k, vars){ let s = (I18N[lang] && I18N[lang][k]) || I18N.fr[k] || k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(b); return s; }

const STORE_KEY = 'aiguillages.v1';
function loadStore(){ try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (e){ return {}; } }
function saveStore(patch){ try { localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign(loadStore(), patch))); } catch (e){} }

const ACC = 2.4, DEC = 3.2, SAMPLES = [0.3, 2.3, 4.6, 7.2, 9.0], CRASH_D = 1.3, BUSY_D = 2.4, PORTAL_CLEAR = 11;
const G = { level:0, spec:null, track:null, trains:[], time:0, elapsed:0, paused:false, speedMul:1, over:null, failMsg:'', failT:0, tut:null, tutStep:0, arrived:0, callout:null };

const el = {
  lvlNum:$('lvlNum'), lvlName:$('lvlName'), btnLevels:$('btnLevels'), btnRestart:$('btnRestart'), btnPause:$('btnPause'), speedSeg:$('speedSeg'), langSeg:$('langSeg'),
  status:$('status'), hint:$('hint'), bannerHost:$('bannerHost'), modal:$('modal'), mTitle:$('mTitle'), mText:$('mText'), mBtns:$('mBtns'),
  levelsModal:$('levelsModal'), levelsGrid:$('levelsGrid'), btnCloseLevels:$('btnCloseLevels'),
};

/* ------------------------------------------------------------ train geometry helpers */
function trainPoint(tr, back){ // -> [x, z, tx, tz, tunnel] ; tunnel = how deep this point sits inside a portal (0 when on the open track)
  const T = G.track;
  if (!tr.route.length){ const d = outDir(T, tr.from); return [tr.from.x, tr.from.y, -d[0], -d[1], 99]; }   // not spawned yet: deep inside its portal
  if (tr.state === 'done' || tr.state === 'gone'){
    const over = tr.exit - back;
    if (over > 0){ const n = tr.to, d = outDir(T, n); return [n.x + d[0] * over, n.y + d[1] * over, d[0], d[1], over]; }
    const p = posBehind(T, tr, -over);
    return [p[0], p[1], p[2], p[3], p[4] ? Math.hypot(p[0] - tr.from.x, p[1] - tr.from.y) : 0];
  }
  const p = posBehind(T, tr, back);
  return [p[0], p[1], p[2], p[3], p[4] ? Math.hypot(p[0] - tr.from.x, p[1] - tr.from.y) : 0];
}
const isActive = (tr) => tr.state === 'run' || tr.state === 'stop';
const isPlaced = (tr) => tr.state !== 'wait' && tr.state !== 'gone';
function portalBlocked(node){ // a train still on (or emerging onto) this portal's own track, within PORTAL_CLEAR of the mouth
  const d = outDir(G.track, node);
  for (const tr of G.trains){
    if (!isPlaced(tr)) continue;
    for (const b of SAMPLES){
      const p = trainPoint(tr, b), dx = p[0] - node.x, dy = p[1] - node.y;
      const along = -(dx * d[0] + dy * d[1]), perp = Math.abs(dx * d[1] - dy * d[0]);
      if (perp < 1.6 && along > -12 && along < PORTAL_CLEAR) return true;
    }
  }
  return false;
}
function nearAnyTrain(x, y, radius, includeDone){
  for (const tr of G.trains){
    if (!(isActive(tr) || tr.state === 'crash' || (includeDone && tr.state === 'done'))) continue;
    for (const b of SAMPLES){ const p = trainPoint(tr, b); if (Math.hypot(p[0] - x, p[1] - y) < radius) return true; }
  }
  return false;
}
function updateTrainVisual(tr){
  const g = tr.vis;
  g.visible = isPlaced(tr);
  if (!g.visible) return;
  g.userData.vehicles.forEach((veh, k) => {
    const p = trainPoint(tr, TRAIN_BACKS[k]);
    veh.visible = p[4] < TRAIN_HALF[k];
    veh.position.set(p[0], 0, p[1]);
    veh.rotation.set(0, Math.atan2(-p[3], p[2]), tr.tilt ? 0.22 : 0);
  });
  const st = tr.state === 'crash' ? 'crash' : tr.state === 'stop' ? 'stop' : 'run';
  if (tr.labelState !== st){
    tr.labelState = st;
    tr.label.el.innerHTML = '→ ' + tr.spec.to + (st === 'stop' ? '<span class="s">■</span>' : st === 'crash' ? '<span class="s">✕</span>' : '');
    tr.label.el.classList.toggle('stopped', st === 'stop');
  }
}

/* ------------------------------------------------------------ level lifecycle */
function loadLevel(i){
  i = Math.max(0, Math.min(LEVELS.length - 1, i));
  G.level = i; G.spec = LEVELS[i]; G.track = buildTrack(G.spec);
  G.time = -1; G.elapsed = 0; G.paused = false; G.over = null; G.failT = 0; G.arrived = 0;
  G.tut = G.spec.tutorial || null; G.tutStep = 0; G.callout = null;
  buildLevelScene(G.track, 1234 + i * 77);
  resize(); fitCamera(G.track.bounds);
  G.trains = G.spec.trains.map((spec, k) => {
    const tr = { i:k, spec, color:TRAIN_COLORS[k % TRAIN_COLORS.length], state:'wait', go:!!spec.go, v:0, exit:0, tilt:false, labelState:'',
                 from:G.track.byLetter(spec.from), to:G.track.byLetter(spec.to), edge:0, dir:1, s:0, route:[] };
    tr.vis = makeTrainVisual(tr.color, tr);
    tr.label = addLabel('lbl tr', '', () => { const p = trainPoint(tr, 2.3); return [p[0], 3.3, p[1]]; }, { tf:'translate(-50%,-100%)', hide:() => !isPlaced(tr) || trainPoint(tr, 2.3)[4] > 1.5 });
    tr.label.el.style.background = '#' + tr.color.toString(16).padStart(6, '0');
    return tr;
  });
  el.btnPause.setAttribute('aria-pressed', 'false');
  hideModals(); refreshTexts(); refreshTutorial(); showBanner(); renderLevelsGrid();
  saveStore({ last:i });
  updateVisuals(0); render();
}
function showBanner(){
  el.bannerHost.innerHTML = `<div class="banner"><div class="n">${tt('level')} ${G.level + 1}</div><div class="t">${G.spec.name[lang]}</div></div>`;
  clearTimeout(showBanner.t); showBanner.t = setTimeout(() => { el.bannerHost.innerHTML = ''; }, 2000);
}
function refreshTexts(){
  if (!G.spec) return;
  document.querySelectorAll('[data-i18n]').forEach(n => { const k = n.dataset.i18n; if (k === 'pause') n.textContent = tt(G.paused ? 'resume' : 'pause'); else n.textContent = tt(k); });
  document.querySelectorAll('[data-i18n-aria]').forEach(n => n.setAttribute('aria-label', tt(n.dataset.i18nAria)));
  document.documentElement.removeAttribute('data-i18n-wait');
  el.lvlNum.textContent = String(G.level + 1).padStart(2, '0');
  el.lvlName.textContent = G.spec.name[lang];
  el.hint.innerHTML = `<span class="k">${tt('goal')}</span>${G.spec.hint[lang]}`;
  refreshStatus(true);
  if (G.callout) refreshTutorial();
}
let lastStatus = '';
function refreshStatus(force){
  const s = `<span class="chip">${tt('arrived')} <b>${G.arrived}/${G.trains.length}</b></span><span class="chip"><b>${Math.max(0, G.elapsed).toFixed(0)} s</b></span>`;
  if (force || s !== lastStatus){ lastStatus = s; el.status.innerHTML = s; }
}

/* ------------------------------------------------------------ tutorial callouts */
function refreshTutorial(){
  if (G.callout){ removeLabel(G.callout); G.callout = null; }
  if (!G.tut || G.tutStep >= G.tut.length) return;
  const step = G.tut[G.tutStep];
  const [kind, ref] = step.anchor.split(':');
  let pos;
  if (kind === 'switch'){ const n = G.track.nodes.get(ref); pos = () => [n.x, 0.6, n.y]; }
  else { const tr = G.trains[+ref]; pos = () => { if (isPlaced(tr)){ const p = trainPoint(tr, 2.3); return [p[0], 3.4, p[1]]; } return [tr.from.x, 4.5, tr.from.y]; }; }
  G.callout = addLabel('callout', `<span class="k">${tt('tutorial')} ${G.tutStep + 1}/${G.tut.length}</span>${step[lang]}`, pos, { tf:'translate(-50%, calc(-100% - 22px))' });
}
function checkTutorial(){
  if (!G.tut || G.tutStep >= G.tut.length) return;
  if (G.tut[G.tutStep].done(G)){ G.tutStep++; refreshTutorial(); }
}

/* ------------------------------------------------------------ simulation */
function spawn(tr){
  placeTrain(G.track, tr, tr.from, tr.go ? 0 : 5.5);   // a waiting train sits at the tunnel mouth, clear of the first switch
  tr.state = tr.go ? 'run' : 'stop'; tr.v = 0;
}
function arrive(tr, node){
  if (node.station && node.station.letter === tr.spec.to){ tr.state = 'done'; tr.exit = 0; G.arrived++; return; }
  tr.state = 'crash'; tr.v = 0; tr.tilt = !node.station;
  fail(node.station ? tt('wrong', { to:tr.spec.to, at:node.station.letter }) : tt('buffer', { to:tr.spec.to }));
}
function fail(msg){ if (G.over) return; G.over = 'fail'; G.failMsg = msg; G.failT = 0.9; }
function checkCollisions(){
  const act = G.trains.filter(isActive);
  const S = act.map(tr => SAMPLES.map(b => trainPoint(tr, b)));
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++){
    let hit = false;
    for (const a of S[i]){ for (const b of S[j]){ if (Math.hypot(a[0] - b[0], a[1] - b[1]) < CRASH_D){ hit = true; break; } } if (hit) break; }
    if (hit){ for (const tr of [act[i], act[j]]){ tr.state = 'crash'; tr.tilt = true; tr.v = 0; } fail(tt('crash')); }
  }
}
function simStep(h){
  G.time += h;
  if (G.time > 0 && !G.over) G.elapsed += h;
  const T = G.track;
  for (const tr of G.trains){
    if (tr.state === 'wait' && G.time >= tr.spec.t0 && !portalBlocked(tr.from)) spawn(tr);
  }
  for (const tr of G.trains){
    if (isActive(tr)){
      const vT = tr.go ? G.spec.speed : 0;
      if (tr.v < vT) tr.v = Math.min(vT, tr.v + ACC * h); else if (tr.v > vT) tr.v = Math.max(vT, tr.v - DEC * h);
      tr.state = (tr.go || tr.v > 1e-3) ? 'run' : 'stop';
      if (tr.v > 0){
        for (const e of advanceTrain(T, tr, tr.v * h)){
          if (e.type === 'flip') refreshSwitch(e.node);
          else if (e.type === 'end') arrive(tr, e.node);
        }
      }
    } else if (tr.state === 'done'){
      tr.v = Math.min(G.spec.speed, tr.v + ACC * h);
      tr.exit += tr.v * h;
      if (tr.exit > TRAIN_LEN + 2.5) tr.state = 'gone';
    }
  }
  checkCollisions();
  checkTutorial();
  if (!G.over && G.trains.every(tr => tr.state === 'gone')) win();
  if (G.over === 'fail' && G.failT > 0){ G.failT -= h; if (G.failT <= 0) showFail(); }
}

/* ------------------------------------------------------------ player actions */
function toggleSwitch(node){
  if (G.over || node.kind !== 'switch') return false;
  if (nearAnyTrain(node.x, node.y, BUSY_D, false)){ switchBusy(node); return false; }
  node.state = 1 - node.state; refreshSwitch(node); return true;
}
function clickTrain(tr){
  if (G.over || !isActive(tr)) return false;
  tr.go = !tr.go; return true;
}

/* ------------------------------------------------------------ modals */
function modalOpen(){ return !el.modal.hidden || !el.levelsModal.hidden; }
function hideModals(){ el.modal.hidden = true; el.levelsModal.hidden = true; }
function showModal(title, cls, text, buttons){
  el.mTitle.textContent = title; el.mTitle.className = cls; el.mText.textContent = text; el.mBtns.innerHTML = '';
  buttons.forEach((b, i) => { const n = document.createElement('button'); n.type = 'button'; n.className = 'btn' + (b.primary ? ' primary' : ''); n.textContent = b.label; n.addEventListener('click', b.fn); el.mBtns.appendChild(n); if (b.primary) setTimeout(() => n.focus(), 0); });
  el.levelsModal.hidden = true; el.modal.hidden = false;
}
function win(){
  G.over = 'win';
  const store = loadStore(), done = Object.assign({}, store.done || {}); done[G.level] = true; saveStore({ done });
  const t = G.elapsed.toFixed(1), last = G.level === LEVELS.length - 1;
  const btns = [{ label:tt('replay'), fn:() => loadLevel(G.level) }];
  if (last) btns.push({ label:tt('levels'), primary:true, fn:openLevels });
  else btns.push({ label:tt('next'), primary:true, fn:() => loadLevel(G.level + 1) });
  showModal(tt('win'), 'ok', last ? tt('allDone', { t }) : tt('winText', { t }), btns);
  renderLevelsGrid();
}
function showFail(){
  showModal(tt('fail'), 'bad', G.failMsg, [{ label:tt('levels'), fn:openLevels }, { label:tt('retry'), primary:true, fn:() => loadLevel(G.level) }]);
}
function openLevels(){ renderLevelsGrid(); el.modal.hidden = true; el.levelsModal.hidden = false; }
function renderLevelsGrid(){
  const done = loadStore().done || {};
  el.levelsGrid.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.className = done[i] ? 'done' : ''; if (i === G.level) b.setAttribute('aria-current', 'true');
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t">${L.name[lang]}</span>`;
    b.addEventListener('click', () => loadLevel(i));
    el.levelsGrid.appendChild(b);
  });
}

/* ------------------------------------------------------------ controls */
el.btnLevels.addEventListener('click', () => { if (el.levelsModal.hidden) openLevels(); else el.levelsModal.hidden = true; });
el.btnCloseLevels.addEventListener('click', () => { el.levelsModal.hidden = true; });
el.btnRestart.addEventListener('click', () => loadLevel(G.level));
function setPaused(p){ G.paused = p; el.btnPause.setAttribute('aria-pressed', String(p)); el.btnPause.textContent = tt(p ? 'resume' : 'pause'); }
el.btnPause.addEventListener('click', () => setPaused(!G.paused));
el.speedSeg.addEventListener('click', (e) => { const b = e.target.closest('button[data-speed]'); if (!b) return; G.speedMul = +b.dataset.speed; el.speedSeg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
function setLang(l){
  lang = I18N[l] ? l : 'en';
  el.langSeg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.lang === lang)));
  document.documentElement.lang = lang;
  refreshTexts(); renderLevelsGrid();
}
el.langSeg.addEventListener('click', (e) => {   // saved for every page of the site
  const b = e.target.closest('button[data-lang]'); if (!b || b.dataset.lang === lang) return;
  try { localStorage.setItem('lang', b.dataset.lang); } catch (err) {}
  setLang(b.dataset.lang);
});
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input,textarea')) return;
  if (e.key === 'Escape'){ el.levelsModal.hidden = true; }
  else if (e.key === ' '){ e.preventDefault(); if (!modalOpen()) setPaused(!G.paused); }
  else if (e.key === 'r' || e.key === 'R'){ loadLevel(G.level); }
});

/* pointer: tap picks, drag pans, wheel / pinch zooms */
const ptrs = new Map(); let dragMoved = false, pinchD = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY });
  if (ptrs.size === 1) dragMoved = false;
  if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); dragMoved = true; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p){ if (e.pointerType === 'mouse') canvas.classList.toggle('pick', !!pick(e.clientX, e.clientY, G.track)); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) dragMoved = true;
  if (ptrs.size === 1){ if (dragMoved){ panBy(dx, dy); canvas.classList.add('dragging'); } }
  else if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchD > 0 && d > 0) zoomBy(pinchD / d); pinchD = d; }
});
function endPointer(e, tap){
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  if (ptrs.size === 0) canvas.classList.remove('dragging');
  if (tap && p && !dragMoved && ptrs.size === 0 && !modalOpen()){
    const h = pick(e.clientX, e.clientY, G.track);
    if (h && h.kind === 'train') clickTrain(h.train); else if (h && h.kind === 'switch') toggleSwitch(h.node);
  }
}
canvas.addEventListener('pointerup', (e) => endPointer(e, true));
canvas.addEventListener('pointercancel', (e) => endPointer(e, false));
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive:false });
canvas.addEventListener('dblclick', () => fitCamera(G.track.bounds));

/* ------------------------------------------------------------ frame loop */
function updateVisuals(dt){
  for (const tr of G.trains) updateTrainVisual(tr);
  animateSwitches(dt);
  updateLabels();
  refreshStatus(false);
}
function render(){ renderer.render(scene, camera); }
function step(dt){ let rem = dt * G.speedMul; while (rem > 1e-6){ const h = Math.min(1 / 60, rem); simStep(h); rem -= h; } }
let last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (!G.paused && !modalOpen()) step(dt);
  updateVisuals(dt); render();
}

/* ------------------------------------------------------------ boot */
{
  const store = loadStore();
  setLang(lang);
  resize();
  loadLevel(Number.isInteger(store.last) ? store.last : 0);
  requestAnimationFrame(frame);
}
window.gameDebug = { G, LEVELS, loadLevel, step, render, updateVisuals, toggleSwitch, clickTrain, view, fitCamera, scene, camera, renderer, trainPoint, setLang };
</script>
