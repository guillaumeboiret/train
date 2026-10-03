
/* ============================================================ TV REMOTE (kid build, appended after the kid mode)
   The playground on a TV, its controls on an iPad: ⚙️ then 📱 shows a QR code and a code of 4 letters, the iPad opens /remote/
   (site/remote.html) and both join a room on the site's relay (site/server.mjs, /relay). The iPad's taps arrive here as commands and run
   as the kid buttons do; the train's state goes back to the iPad as it changes. The first iPad in hides the TV's controls (no GUI).
   In the Passenger view the iPad is a game controller: its sticks walk and look, its buttons sit, stand and order at the bar.
   On the site only: the relay is its server. Off when the page loads, on from the menu; it comes back under the code it had
   (sessionStorage), so the iPad finds the TV again. */
Object.assign(KID_T.fr, { rm_menu:"Télécommande", rm_title:"📱 Télécommande", rm_how:"Scanne ce code avec l'iPad, ou ouvre cette adresse et tape les 4 lettres :",
  rm_conn:"Connexion…", rm_wait:"En attente de l'iPad…", rm_on:"iPad relié", rm_offline:"Hors ligne, nouvel essai…", rm_other:"Relié dans un autre onglet",
  rm_stopped:"Télécommande arrêtée", rm_full:"Plein écran", rm_off:"Déconnecter", rm_connect:"Relier", rm_close:"Fermer" });
Object.assign(KID_T.en, { rm_menu:"Remote", rm_title:"📱 Remote", rm_how:"Scan this code with the iPad, or open this address and type the 4 letters:",
  rm_conn:"Connecting…", rm_wait:"Waiting for the iPad…", rm_on:"iPad connected", rm_offline:"Offline, trying again…", rm_other:"Paired in another tab",
  rm_stopped:"Remote stopped", rm_full:"Full screen", rm_off:"Disconnect", rm_connect:"Connect", rm_close:"Close" });

/* ---- QR code (ISO 18004): byte mode, error correction M, versions 1 to 6 (up to 106 bytes), as an SVG with its quiet zone.
   After Project Nayuki's QR Code generator (MIT); only what a short address needs */
function qrSvg(text){
  const data = new TextEncoder().encode(text);
  const V = [null, [26, 10, 1], [44, 16, 1], [70, 26, 1], [100, 18, 2], [134, 24, 2], [172, 16, 4]];   // codewords in all, error correction per block, blocks
  let ver = 1; while (ver <= 6 && data.length > V[ver][0] - V[ver][1] * V[ver][2] - 2) ver++;
  if (ver > 6) return '';
  const [tot, ec, nb] = V[ver], D = tot - ec * nb, size = 17 + 4 * ver;
  // the data codewords: mode, length, the bytes, a terminator, then the pad bytes
  const bits = [], put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push(v >>> i & 1); };
  put(4, 4); put(data.length, 8); for (const b of data) put(b, 8);
  put(0, Math.min(4, D * 8 - bits.length)); put(0, (8 - bits.length % 8) % 8);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(bits.slice(i, i + 8).reduce((a, b) => a << 1 | b, 0));
  for (let p = 0xEC; cw.length < D; p ^= 0xEC ^ 0x11) cw.push(p);
  // Reed-Solomon over GF(256), x^8+x^4+x^3+x^2+1; the generator's roots are α^0 … α^(ec-1)
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++){ EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
  let gen = [1];
  for (let i = 0; i < ec; i++){ const g = new Array(gen.length + 1).fill(0); for (let j = 0; j < gen.length; j++){ g[j] ^= gen[j]; g[j + 1] ^= mul(gen[j], EXP[i]); } gen = g; }
  const rs = blk => { const r = new Array(ec).fill(0); for (const b of blk){ const f = b ^ r.shift(); r.push(0); for (let i = 0; i < ec; i++) r[i] ^= mul(gen[i + 1], f); } return r; };
  const k = D / nb, blocks = [];   // blocks of equal length at level M up to version 6
  for (let i = 0; i < nb; i++){ const b = cw.slice(i * k, (i + 1) * k); blocks.push([b, rs(b)]); }
  const all = [];
  for (let i = 0; i < k; i++) for (const [b] of blocks) all.push(b[i]);
  for (let i = 0; i < ec; i++) for (const [, e] of blocks) all.push(e[i]);
  // the matrix: function patterns first (marked in F), then the data in the zigzag
  const M = Array.from({ length:size }, () => new Uint8Array(size)), F = Array.from({ length:size }, () => new Uint8Array(size));
  const fn = (x, y, dark) => { M[y][x] = dark ? 1 : 0; F[y][x] = 1; };
  for (let i = 0; i < size; i++){ fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }   // timing
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])                    // finders, with their light border
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++){
      const x = cx + dx, y = cy + dy, r = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && y >= 0 && x < size && y < size) fn(x, y, r !== 2 && r !== 4);
    }
  if (ver > 1) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fn(size - 7 + dx, size - 7 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);   // the one alignment pattern
  const format = mask => {   // level M is 00; BCH(15,5), masked with 0x5412; the dark module beside the lower finder
    let rem = mask; for (let i = 0; i < 10; i++) rem = rem << 1 ^ (rem >>> 9) * 0x537;
    const b = (mask << 10 | rem) ^ 0x5412, bit = i => b >>> i & 1;
    for (let i = 0; i <= 5; i++) fn(8, i, bit(i));
    fn(8, 7, bit(6)); fn(8, 8, bit(7)); fn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fn(8, size - 15 + i, bit(i));
    fn(8, size - 8, 1);
  };
  format(0);   // reserves its modules
  let n = 0;
  for (let right = size - 1; right >= 1; right -= 2){
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++){
      const x = right - j, y = (right + 1 & 2) === 0 ? size - 1 - v : v;
      if (!F[y][x] && n < all.length * 8){ M[y][x] = all[n >>> 3] >>> 7 - (n & 7) & 1; n++; }
    }
  }
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  const flip = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] ^= 1; };
  const penalty = () => {   // the standard's four rules: runs, 2×2 blocks, finder look-alikes, the balance of dark and light
    let p = 0, dark = 0;
    const line = get => {
      let run = 1;
      for (let i = 1; i <= size; i++){
        if (i < size && get(i) === get(i - 1)) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
      for (let i = 0; i + 11 <= size; i++){
        const s = Array.from({ length:11 }, (_, j) => get(i + j)).join('');
        if (s === '10111010000' || s === '00001011101') p += 40;
      }
    };
    for (let y = 0; y < size; y++) line(x => M[y][x]);
    for (let x = 0; x < size; x++) line(y => M[y][x]);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
      dark += M[y][x];
      if (x < size - 1 && y < size - 1){ const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
    }
    return p + 10 * Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size));
  };
  let best = 0, low = Infinity;
  for (let m = 0; m < 8; m++){ flip(m); format(m); const p = penalty(); if (p < low){ low = p; best = m; } flip(m); }
  flip(best); format(best);
  let path = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (M[y][x]) path += `M${x + 4} ${y + 4}h1v1h-1z`;
  const w = size + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" shape-rendering="crispEdges" role="img"><rect width="${w}" height="${w}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

/* ---- the card, and its entry in the ⚙️ menu */
document.head.insertAdjacentHTML('beforeend', `<style>
.kid-menu .rm-open{display:flex;align-items:center;gap:8px;padding:9px 12px;border:0;border-radius:10px;background:#f1f4f7;color:#1b2430;font-weight:600;text-align:left}
.kid-menu .rm-open[hidden]{display:none}
.rm-dot{width:10px;height:10px;border-radius:50%;margin-left:auto;flex:none}
.rm-st .rm-dot{margin:0;background:#9aa5b1}
.rm-dot.wait{background:#ffb02e}.rm-dot.on{background:#2fbf5b}.rm-dot.bad{background:#e5484d}
.rm-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(380px,calc(100% - 20px));max-height:calc(100% - 20px);overflow:auto;box-sizing:border-box;padding:14px 18px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;pointer-events:auto;z-index:5}
.rm-card[hidden]{display:none}
.rm-head{align-self:stretch;display:flex;align-items:center;justify-content:space-between;gap:10px;font:700 22px/1 var(--font-display);letter-spacing:.04em;text-transform:uppercase}
.rm-x{width:44px;height:44px;flex:none;border:0;border-radius:50%;background:#eef2f6;color:#1b2430;font-size:20px;line-height:1}
.rm-qr{width:min(240px,48vh);aspect-ratio:1;border-radius:12px;overflow:hidden;background:#fff}
.rm-qr svg{display:block;width:100%;height:100%}
.rm-how{margin:0;font:500 14px/1.35 var(--font-body);color:#3b4754}
.rm-url{font:600 17px/1.2 var(--font-body)}
.rm-code{font:700 60px/1 var(--font-display);letter-spacing:.18em;padding-left:.18em;font-variant-numeric:tabular-nums}
.rm-card.off .rm-qr,.rm-card.off .rm-code{opacity:.3}
.rm-st{display:flex;align-items:center;gap:8px;font:600 15px/1.2 var(--font-body)}
.rm-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:4px}
.rm-b{border:0;border-radius:12px;background:#eef2f6;color:#1b2430;padding:11px 16px;font-weight:700}
@media (max-height:520px){ .rm-qr{width:min(150px,40vh)}.rm-code{font-size:40px}.rm-how{font-size:12.5px} }
</style>`);
$('kidToast').insertAdjacentHTML('beforebegin', `<div class="kid-panel rm-card" id="rmCard" role="dialog" aria-labelledby="rmTitle" hidden>
  <div class="rm-head"><span id="rmTitle" data-kid="rm_title"></span><button type="button" class="rm-x" id="rmClose" data-kid-aria="rm_close">✕</button></div>
  <div class="rm-qr" id="rmQr"></div>
  <p class="rm-how" data-kid="rm_how"></p>
  <div class="rm-url" id="rmUrl"></div>
  <div class="rm-code" id="rmCode">····</div>
  <div class="rm-st" id="rmSt"><i class="rm-dot" id="rmStDot"></i><span id="rmStT"></span><span id="rmStN"></span></div>
  <div class="rm-btns"><button type="button" class="rm-b" id="rmFull">⛶ <span data-kid="rm_full"></span></button><button type="button" class="rm-b" id="rmOff"></button></div>
</div>`);
$('kidMenu').querySelector('a').insertAdjacentHTML('beforebegin', `<button type="button" class="rm-open" id="rmOpen" hidden>📱 <span data-kid="rm_menu"></span><i class="rm-dot" id="rmDot"></i></button>`);

/* ---- the link to the relay: opened from the menu, back by itself after a network loss or a redeploy */
const RM_ON = /^https?:$/.test(location.protocol);   // a file has no relay
const RM = { ws:null, want:false, code:'', key:'', n:0, tries:0, timer:0, last:0, why:'', sent:'', horn:false, hornT:0, padT:0, lock:null, locking:false };
const rmSave = () => { try { sessionStorage.setItem('remote.tv', JSON.stringify({ code:RM.code, key:RM.key })); } catch (e) {} };
const rmSend = text => { if (RM.ws?.readyState === 1) RM.ws.send(text); };
function rmConnect(){
  clearTimeout(RM.timer);
  if (!RM_ON || !RM.want || RM.ws) return;
  const q = new URLSearchParams({ role:'tv' }); if (RM.code && RM.key){ q.set('code', RM.code); q.set('key', RM.key); }
  let ws; try { ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/relay?${q}`); } catch (e) { RM.why = 'offline'; rmShow(); rmRetry(); return; }
  RM.ws = ws; RM.last = performance.now(); if (RM.why !== 'offline') RM.why = 'conn';
  ws.onmessage = e => { RM.last = performance.now(); let m; try { m = JSON.parse(e.data); } catch (err) { return; } if (m && typeof m === 'object') rmOn(m); };
  ws.onclose = e => { if (RM.ws === ws) rmLost(e.code); };
  rmShow();
}
function rmLost(code){   // the socket is gone: 4001, this TV taken over by another tab, which keeps it; anything else, try again
  const ws = RM.ws; RM.ws = null;
  if (ws){ ws.onclose = ws.onmessage = null; try { ws.close(); } catch (e) {} }
  if (RM.horn){ RM.horn = false; horn.release(); }
  padReset(); rmWake(false);
  if (code === 4001){ RM.want = false; RM.why = 'other'; rmSave(); }
  else if (RM.want){ RM.why = 'offline'; rmRetry(); }
  rmShow();
}
function rmRetry(){ clearTimeout(RM.timer); if (RM.want) RM.timer = setTimeout(rmConnect, Math.min(30e3, 1000 * 2 ** RM.tries++)); }
function rmStop(){ RM.want = false; RM.why = ''; rmSave(); clearTimeout(RM.timer); const ws = RM.ws; RM.ws = null; if (ws){ ws.onclose = ws.onmessage = null; try { ws.close(1000); } catch (e) {} } rmWake(false); rmShow(); }
function rmStart(){ RM.want = true; RM.tries = 0; RM.why = ''; rmSave(); rmConnect(); rmShow(); }
function rmOn(m){
  const was = RM.n;
  if (m.t === 'room'){
    RM.tries = 0; RM.why = '';
    if (m.code !== RM.code){ RM.code = String(m.code); $('rmQr').innerHTML = qrSvg(`${location.origin}/remote/#${RM.code}`); }
    RM.key = String(m.key); RM.n = m.n | 0; rmSave();
    rmSend(rmLine()); RM.sent = ''; rmPush();   // the iPads waiting in the room get the line and the train at once
    rmWake(true);
  } else if (m.t === 'peers'){ RM.n = m.n | 0; if (RM.n > was) RM.sent = ''; }   // a new iPad: the state again, for it
  else if (m.t === 'cmd'){ rmCmd(m.c, m.v); return; }
  else return;
  if (!was && RM.n){ rmCard(false); setNoGui(true); }   // the first iPad in: the TV shows only the trip
  rmShow();
}
setInterval(() => {   // the line's own check: a ping every 10 s, and nothing heard for 25 s means it is dead (a TV woken from sleep)
  if (RM.ws?.readyState !== 1) return;
  if (performance.now() - RM.last > 25e3){ rmLost(1006); return; }
  RM.ws.send('{"t":"ping"}');
}, 10e3);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !RM.want) return;
  if (!RM.ws){ RM.tries = 0; rmConnect(); } else rmWake(true);
});
async function rmWake(on){   // paired, the screen stays on: nobody touches the TV's computer while the iPad drives
  try {
    if (on && !RM.lock && !RM.locking && navigator.wakeLock && document.visibilityState === 'visible'){
      RM.locking = true; const l = await navigator.wakeLock.request('screen'); RM.locking = false;
      if (!RM.ws){ l.release(); return; }
      RM.lock = l; l.addEventListener('release', () => { if (RM.lock === l) RM.lock = null; });
    } else if (!on && RM.lock){ const l = RM.lock; RM.lock = null; await l.release(); }
  } catch (e) { RM.locking = false; }
}

/* ---- what the iPad shows: the line once (and the bar's icons), the train's state whenever it changes (checked 8 times a second), the kid's messages */
const rmLine = () => {
  const st = ROUTE.stations, last = st.length - 1, order = Object.keys(ST_SHORT);
  return JSON.stringify({ t:'line', st:st.map((x, i) => ({ id:x.id, name:x.name, short:ST_SHORT[x.id] || x.name,
    rank:i === 0 || i === last ? -1 : (k => k < 0 ? 99 : k)(order.indexOf(x.id)), f:+RB.f(x.s).toFixed(4) })), bar:BAR_MENU.map(m => [m.id, m.e]) });
};
const rmBar = () => ({ w:money(BAR.wallet), pocket:!$('barPocket').hidden, tray:BAR.tray,   // the bar's menu open: its names and prices as the TV says them, what is on the tray
  it:BAR_MENU.map(m => [barName(m.id), price(m.p), m.p > BAR.wallet ? 1 : 0]) });
function rmState(){
  const st = nextStation(0), d = st ? (st.s - TGV.PLAT_FRONT - S.dist) * S.dir : 0;
  return JSON.stringify({ t:'state', kmh:Math.round(S.speed * 3.6), notch:Math.round(S.notch), auto:S.autoStop, svc:S.service, mode:S.mode, dir:S.dir,
    panto:!!S.panto, doors:S.doorsF > 0.5, doorsOk:!(S.speed > 0.1 && S.doorsF < 0.02), horn:horn.active, view:kidWhere(), cam:kidOut,
    wx:wxPick(), plan:WX_PLAN.slots, tod:todPick(), todIco:todIcon(), clock:hhmm(CLOCK.min), xray:shellLevel < 1, nogui:noGui, mute:SND.muted, snd:SND.ctx?.state === 'running',
    next:st ? st.name : null, dist:st ? distText(d) : '', f:+RB.f(S.dist).toFixed(3),
    walk:walking ? { act:$('walkSit').dataset.i18n, bar:barIsOpen() ? rmBar() : null } : null });
}
function rmPush(){ if (!RM.n) return; const s = rmState(); if (s !== RM.sent){ RM.sent = s; rmSend(s); } }
setInterval(() => {
  if (RM.horn && performance.now() - RM.hornT > 1500){ RM.horn = false; horn.release(); }   // the iPad repeats its press every 0.5 s: silence means it was lost
  if ((PAD.move.on || PAD.look.on) && performance.now() - RM.padT > 700) padReset();   // a stick held says so 4 times a second at least
  rmPush();
}, 125);
kidToastHook = (text, ms) => { if (RM.n) rmSend(JSON.stringify({ t:'toast', text, ms })); };

/* ---- the iPad's commands, each the kid button's own; anything unknown or out of range is ignored */
const RM_CAMS = ['overview', 'side', 'train', 'far', 'door'], RM_MODES = ['diesel', 'electric', 'tgv'];
function rmCmd(c, v){
  switch (c){
    case 'lever': { const n = Math.round(+v); if (!(n >= 0 && n <= 8)) return; $('kidLever').value = n; kidLever(n); break; }
    case 'stop': kidStop(); break;
    case 'horn': if (v){ RM.hornT = performance.now(); if (!RM.horn){ RM.horn = true; horn.press(); } } else if (RM.horn){ RM.horn = false; horn.release(); } break;
    case 'panto': kidPanto(); break;
    case 'next': kidStation(); break;
    case 'service': kidService(); break;
    case 'turn': kidTurn(); break;
    case 'doors': kidDoors(); break;
    case 'wx': setWeather(v); break;
    case 'plan': wxPlanCycle(v); break;
    case 'tod': if (TOD.includes(v)){ setTod(v); updateWeather(0); kidTick(); } break;
    case 'xray': kidXray(); break;
    case 'view': if (v === 'driver' || v === 'pax' || v === 'cine') kidView(v); else if (v === 'out' && kidWhere() !== 'out') kidGo(kidOut); break;
    case 'cam': if (RM_CAMS.includes(v)) kidGo(v); break;
    case 'train': if (RM_MODES.includes(v) && v !== S.mode) kidTrain(v); break;
    case 'station': { const st = ROUTE.stations.find(x => x.id === v); if (st) jumpToStation(st); break; }
    case 'at': { const f = +v; if (Number.isFinite(f)) jumpTo(RB.s(clamp(f, 0, 1))); break; }
    case 'nogui': setNoGui(!!v); break;
    case 'mute': kidMute(!!v); break;
    case 'walk': rmWalk(v); return;   // up to 20 times a second while a stick is held: the state follows by itself
    case 'act': if (walking && !barIsOpen()) walkSitNear(); break;   // the walker's own button: sit, stand up, or order at the counter
    case 'buy': if (barIsOpen() && barItem(v)) barBuy(v); break;
    case 'eat': if (barIsOpen()) barEat(v | 0); break;
    case 'pocket': if (barIsOpen() && !$('barPocket').hidden) $('barPocket').click(); break;
    case 'barx': barClose(); break;
    default: return;
  }
  rmPush();
}
function rmWalk(v){   // the iPad's sticks, walk then look: x, y each, -1..1 (y down), null when let go
  if (!Array.isArray(v) || v.length !== 4) return;
  const put = (p, x, y) => { p.on = walking && Number.isFinite(x) && Number.isFinite(y); p.x = p.on ? clamp(x, -1, 1) : 0; p.y = p.on ? clamp(y, -1, 1) : 0; };
  put(PAD.move, v[0], v[1]); put(PAD.look, v[2], v[3]); RM.padT = performance.now();
}

/* ---- the card's face */
function rmCard(open){ $('rmCard').hidden = !open; if (open){ $('kidMenu').hidden = true; $('kidGear').setAttribute('aria-expanded', 'false'); } }
function rmShow(){
  const on = RM.want && RM.ws?.readyState === 1 && !RM.why, k = !RM.want ? (RM.why === 'other' ? 'rm_other' : 'rm_stopped')
    : RM.why === 'offline' ? 'rm_offline' : !on ? 'rm_conn' : RM.n ? 'rm_on' : 'rm_wait';
  const cls = !RM.want ? 'bad' : RM.why === 'offline' ? 'bad' : on && RM.n ? 'on' : 'wait';
  $('rmStT').dataset.kid = k; $('rmStT').textContent = kt(k); $('rmStN').textContent = k === 'rm_on' && RM.n > 1 ? ` ×${RM.n}` : '';
  $('rmStDot').className = 'rm-dot ' + cls; $('rmDot').className = 'rm-dot ' + (RM.want || RM.why === 'other' ? cls : '');
  $('rmCode').textContent = RM.code || '····'; $('rmCard').classList.toggle('off', !on);
  $('rmOff').dataset.kid = RM.want ? 'rm_off' : 'rm_connect'; $('rmOff').textContent = kt($('rmOff').dataset.kid);
}
$('rmUrl').textContent = `${location.host}/remote`;
$('rmOpen').hidden = !RM_ON;
$('rmOpen').addEventListener('click', () => { if (!RM.want) rmStart(); rmCard(true); });
$('rmClose').addEventListener('click', () => rmCard(false));
$('rmOff').addEventListener('click', () => { if (RM.want) rmStop(); else rmStart(); });
$('rmFull').addEventListener('click', () => {
  const el = document.documentElement, go = el.requestFullscreen || el.webkitRequestFullscreen;
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else go?.call(el)?.catch?.(() => {});
});
document.addEventListener('pointerdown', e => { if (!$('rmCard').hidden && !e.target.closest('#rmCard,#rmOpen')) rmCard(false); });   // a tap elsewhere folds it, as the menu
document.querySelectorAll('[data-kid-aria]').forEach(el => el.setAttribute('aria-label', kt(el.dataset.kidAria)));
$('kidLang').addEventListener('click', () => document.querySelectorAll('[data-kid-aria]').forEach(el => el.setAttribute('aria-label', kt(el.dataset.kidAria))));

/* ---- start: off ("by default the remote should not be active, we should activate it in the menu"); turned on again after a reload, it
   takes back the code it had */
try { const p = JSON.parse(sessionStorage.getItem('remote.tv') || 'null'); if (p && /^[A-Z]{4}$/.test(p.code) && typeof p.key === 'string'){ RM.code = p.code; RM.key = p.key; } } catch (e) {}
if (RM.code) $('rmQr').innerHTML = qrSvg(`${location.origin}/remote/#${RM.code}`);
kidLang(); rmShow();
Object.assign(window.locoDebug, { RM, rmCmd, rmState, rmLine, qrSvg, rmStart, rmStop, PAD });
