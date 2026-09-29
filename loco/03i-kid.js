
/* ============================================================ KID MODE (separate build: same module scope, appended after the UI) */
/* One screen, no panels: pick a train, push the lever, honk, stop at stations, change the camera and the weather. */
const KID_T = {
  fr:{ title:"Conducteur de train", diesel:"Diesel", electric:"Électrique", tgv:"TGV", stop:"Stop", horn:"Klaxon", lever:"Manette", station:"Prochaine gare",
       back:"Retour à Bordeaux", auto:"Pilote auto…", doors:"Portes", cam:"Caméra", wx:"Météo", xray:"Rayons X", hint:"Pousse la manette pour partir !",
       hint_doors:"Ferme les portes… et c'est parti !", hint_pax:"Attends, tout le monde descend !", hint_end:"Terminus ! Appuie sur 🔄 pour faire demi-tour.", hint_stopped:"Le train doit être arrêté.",
       terminus:"Terminus", next:"Prochaine gare", full:"Version complète ↗", game:"Jeu des aiguillages ↗", lang:"Langue",
       panto:"Pantographe", dir_par:"Vers Paris", dir_tls:"Vers Toulouse", turn:"Demi-tour", hint_panto:"Lève le pantographe !", hint_wait:"Le pantographe monte…", sound:"Son" },
  en:{ title:"Train driver", diesel:"Diesel", electric:"Electric", tgv:"TGV", stop:"Stop", horn:"Horn", lever:"Lever", station:"Next station",
       back:"Back to Bordeaux", auto:"Autopilot…", doors:"Doors", cam:"Camera", wx:"Weather", xray:"X-ray", hint:"Push the lever to go!",
       hint_doors:"Closing the doors… off we go!", hint_pax:"Wait, everyone is getting off!", hint_end:"End of the line! Press 🔄 to turn around.", hint_stopped:"The train must be stopped first.",
       terminus:"Terminus", next:"Next station", full:"Full version ↗", game:"Switch game ↗", lang:"Language",
       panto:"Pantograph", dir_par:"To Paris", dir_tls:"To Toulouse", turn:"Turn around", hint_panto:"Raise the pantograph!", hint_wait:"Pantograph rising…", sound:"Sound" },
};
const kt = k => KID_T[S.lang][k] ?? k;
const KID_WX = [['sun', '☀️'], ['cloud', '☁️'], ['rain', '🌧️'], ['dusk', '🌆']];
const KID_CAMS = ['overview', 'driver', 'door', 'seatUp', 'seatLo', 'side', 'train', 'far'], KID_TGV_CAMS = ['door', 'seatUp', 'seatLo'];   // one tap: next view (the door and the two window seats on the TGV only)
Object.assign(CAMS, {
  door: () => {   // on the platform just ahead of coach 1's door, over the heads of the queue: the leaf slides toward the camera
    const x = TGV.TRAILERS[0][0] + TR.doorX, V = THREE.Vector3;
    return [curveLocal(x + 5.5, 2.9, 6.0, new V()).toArray(), curveLocal(x, 1.7, 1.5, new V()).toArray()];
  },
  train: () => S.mode === 'tgv' ? [[-60, 40, 150], [-85, 2, 0]] : [[-28, 9, 14], [6, 2.5, 0]],       // the whole train: a 200 m TGV from the side, a loco chased from behind
});
// toy physics per train: top speed in about a minute, STOP in well under one; the explainer keeps the real numbers (all 1)
const KID_MUL = { tgv:{ p:3, a:3, b:2 }, electric:{ p:3, a:1.2, b:3 }, diesel:{ p:3, a:1.2, b:3 } };

document.body.classList.add('kid');
document.head.insertAdjacentHTML('beforeend', `<style>
body.kid .topbar,body.kid .dock,body.kid .infocard,body.kid .gauges,body.kid #hud{display:none!important}
body.in-cab:not(.cab-ui) :is(.kid-top,.kid-menu,.kid-bottom){display:none}
body.kid .lbl{font:600 15px/1 var(--font-body);padding:8px 12px;border-radius:10px;background:#fff;color:#1b2430;border-color:#fff}
body.kid .lbl::after{background:#fff;height:18px}
#kid{position:absolute;inset:0;pointer-events:none;color:#1b2430;font-family:var(--font-body);-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#kid button,#kid input,#kid a{touch-action:manipulation}
#kid button{font:inherit;cursor:pointer}
#kid button:focus-visible,#kid a:focus-visible{outline:3px solid #f28c28;outline-offset:2px}
.kid-top{position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:flex-start;gap:10px;pointer-events:none}
.kid-top>*{pointer-events:auto}
.kid-panel{background:rgba(255,255,255,.93);border-radius:22px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.kid-trains{display:flex;gap:4px;padding:6px}
.kt{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:78px;padding:6px 8px;border-radius:16px;border:0;background:transparent;color:#1b2430}
.kt .ico{font-size:30px;line-height:1.1}
.kt .lab,.kb .lab,.kid-lever-lab b{font:700 12px/1 var(--font-display);letter-spacing:.06em;text-transform:uppercase}
.kt[aria-pressed="true"]{background:#f28c28;color:#1b1206}
.kid-speed{flex:1;display:flex;flex-direction:column;align-items:center;align-self:flex-start;margin:0 auto;padding:8px 18px 9px;min-width:170px;max-width:360px}
.kid-speed .n{font:700 46px/1 var(--font-display);font-variant-numeric:tabular-nums;letter-spacing:.01em}
.kid-speed .n small{font-size:16px;margin-left:5px;letter-spacing:.06em}
.kid-next{font:600 13.5px/1.2 var(--font-body);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
body.kid .compass{top:64px;right:10px;background:rgba(255,255,255,.93);border:0;box-shadow:0 6px 18px rgba(0,0,0,.25);-webkit-backdrop-filter:none;backdrop-filter:none;--ink:#1b2430;--muted:#5d6b78;--panel-solid:#fff;--accent:#f28c28}
.kid-gear{width:46px;height:46px;border-radius:50%;border:0;background:rgba(255,255,255,.85);font-size:22px;line-height:1;box-shadow:0 4px 12px rgba(0,0,0,.25);flex:0 0 auto}
body.kid .cab-bar{top:10px;right:10px;gap:10px;flex-direction:column}
body.kid.in-cab :is(.kid-gear,.kid-menu){display:none}body.kid.in-cab .kid-top{right:76px}body.kid.in-cab .compass{top:142px}   /* in the cab its two buttons take the menu's corner */
body.kid .cab-bar button{width:56px;height:56px;border:0;background:rgba(255,255,255,.93);color:#1b2430;font-size:28px;box-shadow:0 4px 12px rgba(0,0,0,.25);-webkit-backdrop-filter:none;backdrop-filter:none;touch-action:manipulation}
.kid-menu{position:absolute;top:64px;right:10px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:220px;pointer-events:auto}
.kid-menu[hidden]{display:none}
.kid-menu .seg{display:flex;border:2px solid #1b2430;border-radius:10px;overflow:hidden}
.kid-menu .seg button{flex:1;border:0;background:#fff;padding:8px;font-weight:700;color:#1b2430}
.kid-menu .seg button[aria-pressed="true"]{background:#1b2430;color:#fff}
.kid-menu a{display:block;padding:9px 12px;border-radius:10px;background:#f1f4f7;color:#1b2430;text-decoration:none;font-weight:600}
.kid-menu .lab{font:700 11px/1 var(--font-display);letter-spacing:.08em;text-transform:uppercase;color:#5d6b78}
.kid-toast{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);background:#f28c28;color:#1b1206;font:700 22px/1.2 var(--font-display);padding:14px 22px;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:min(90%,520px);text-align:center;opacity:0;transition:opacity .3s;pointer-events:none}
.kid-toast.show{opacity:1}
.kid-bottom{position:absolute;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:10px;pointer-events:none}
.kid-bottom>*{pointer-events:auto}
.kid-route{padding:12px 22px 2px}
body.kid #routeBar{height:46px;margin:0;cursor:pointer}
body.kid #routeBar::before{left:12px;right:12px;top:10px;height:5px;border-radius:3px;background:#c9d0d8}
body.kid .rb-in{inset:0 12px}
body.kid .rb-st{width:26px;height:25px}
body.kid .rb-st i{width:18px;height:18px;border:3px solid #1b2430;background:#fff}
body.kid .rb-lb{top:27px;font:700 13px/1 var(--font-display);letter-spacing:.04em;color:#1b2430}
body.kid .rb-lb.r{transform:translateX(-9px)}body.kid .rb-lb.l{transform:translateX(calc(9px - 100%))}
body.kid #rbTrain{width:24px;height:18px;top:3.5px;border-radius:5px;background:#f28c28;box-shadow:0 0 0 3px #fff,0 2px 6px rgba(0,0,0,.3)}
body.kid #rbTip{font-size:13px;padding:5px 9px;top:-30px;border-radius:8px}
.kid-controls{display:flex;gap:10px;align-items:stretch;justify-content:center;flex-wrap:wrap;padding:10px}
.kb{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:86px;height:86px;padding:6px 10px;border-radius:20px;border:0;background:#f1f4f7;color:#1b2430;box-shadow:0 4px 0 rgba(0,0,0,.2);transition:transform .05s,box-shadow .05s}
.kb .ico{font-size:34px;line-height:1}
.kb:active,.kb.on{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.2)}
.kb[aria-pressed="true"]{box-shadow:0 0 0 4px #f28c28 inset,0 4px 0 rgba(0,0,0,.2)}
.kb:disabled{opacity:.4;cursor:default}
.elec-only{display:contents}body[data-mode="diesel"] .elec-only{display:none}
.kb.red{background:#e5484d;color:#fff}.kb.yellow{background:#ffcf33}.kb.green{background:#3ccf6f;color:#0b2e17}.kb.blue{background:#4c8dff;color:#fff}
.kb.auto .ico{animation:kidPulse 1s infinite}
@keyframes kidPulse{50%{transform:scale(1.25)}}
.kid-lever{flex:1 1 300px;min-width:220px;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:0 6px}
.kid-lever-lab{display:flex;justify-content:space-between;align-items:center;font-size:22px;line-height:1}
.kid-lever input{-webkit-appearance:none;appearance:none;width:100%;height:60px;margin:0;background:transparent;cursor:pointer}
.kid-lever input::-webkit-slider-runnable-track{height:26px;border-radius:13px;background:linear-gradient(90deg,#3ccf6f 0%,#ffcf33 55%,#e5484d 100%);box-shadow:inset 0 2px 4px rgba(0,0,0,.25)}
.kid-lever input::-moz-range-track{height:26px;border-radius:13px;background:linear-gradient(90deg,#3ccf6f 0%,#ffcf33 55%,#e5484d 100%)}
.kid-lever input::-webkit-slider-thumb{-webkit-appearance:none;width:58px;height:58px;margin-top:-16px;border-radius:50%;background:#fff;border:5px solid #1b2430;box-shadow:0 4px 10px rgba(0,0,0,.35)}
.kid-lever input::-moz-range-thumb{width:48px;height:48px;border-radius:50%;background:#fff;border:5px solid #1b2430;box-shadow:0 4px 10px rgba(0,0,0,.35)}
.kid-lever.auto input::-webkit-slider-thumb{border-color:#f28c28}
@media (max-width:960px){
  .kt{min-width:60px;padding:5px 6px}.kt .ico{font-size:26px}
  .kid-speed{min-width:0;padding:6px 12px}.kid-speed .n{font-size:34px}.kid-next{font-size:12px}
  .kb{min-width:66px;height:70px;border-radius:16px;gap:3px}.kb .ico{font-size:28px}.kb .lab{font-size:10.5px}
  .kid-lever{flex-basis:100%;order:-1}
  .kid-controls{gap:8px;padding:8px}
  .kid-route{padding:10px 16px 0}
}
@media (max-width:520px){
  .kid-top{gap:6px}.kt{min-width:52px}.kt .lab{display:none}.kt .ico{font-size:28px}
  .kid-speed{padding:4px 10px}.kid-speed .n{font-size:30px}.kid-next{display:none}
  .kb .lab{display:none}.kb{min-width:60px;height:60px}
  body.kid .rb-st{width:18px}body.kid .rb-st i{width:12px;height:12px}   /* 13 stops 26 px apart: room to tap between two dots */
}
@media (max-height:520px){   /* phone held sideways: one thin row of controls, the view stays visible */
  .kid-top{top:6px;left:6px;right:6px;gap:6px}
  .kt{min-width:46px;padding:3px 6px}.kt .ico{font-size:22px}.kt .lab{display:none}
  .kid-speed{padding:2px 12px 3px;min-width:0}.kid-speed .n{font-size:26px}.kid-speed .n small{font-size:12px}.kid-next{display:block;font-size:11px;margin-top:0}
  .kid-gear{width:36px;height:36px;font-size:17px}.kid-menu{top:48px;right:6px}
  body.kid .compass{top:48px;right:6px;width:44px;height:44px}
  body.kid .cab-bar{top:6px;right:6px;gap:8px}body.kid .cab-bar button{width:46px;height:46px;font-size:23px}body.kid.in-cab .kid-top{right:58px}body.kid.in-cab .compass{top:114px}
  .kid-toast{font-size:17px;padding:10px 16px;top:32%}
  .kid-bottom{left:6px;right:6px;bottom:calc(6px + env(safe-area-inset-bottom,0px));gap:6px}
  .kid-route{padding:4px 12px 0}
  body.kid #routeBar{height:34px}body.kid #routeBar::before{top:7px;height:4px}
  body.kid #routeBar::before{left:10px;right:10px}body.kid .rb-in{inset:0 10px}
  body.kid .rb-st{width:20px;height:18px}body.kid .rb-st i{width:14px;height:14px;border-width:2px}
  body.kid .rb-lb{top:19px;font-size:11px}body.kid .rb-lb.r{transform:translateX(-7px)}body.kid .rb-lb.l{transform:translateX(calc(7px - 100%))}
  body.kid #rbTrain{width:18px;height:14px;top:2px}
  .kid-controls{gap:6px;padding:6px;flex-wrap:nowrap}
  .kb{min-width:50px;height:52px;border-radius:14px;gap:0;padding:4px}.kb .ico{font-size:24px}.kb .lab{display:none}
  .kid-lever{flex:1 1 100px;min-width:100px;order:0;gap:0}.kid-lever-lab{display:none}
  .kid-lever input{height:44px}
  .kid-lever input::-webkit-slider-runnable-track{height:20px;border-radius:10px}
  .kid-lever input::-webkit-slider-thumb{width:44px;height:44px;margin-top:-12px;border-width:4px}
  .kid-lever input::-moz-range-thumb{width:38px;height:38px;border-width:4px}
}
</style>`);
$('c3d').parentElement.insertAdjacentHTML('beforeend', `<div id="kid">
  <div class="kid-top">
    <div class="kid-panel kid-trains" id="kidTrains" role="group">
      <button type="button" class="kt" data-mode="diesel" aria-pressed="false"><span class="ico">🚂</span><span class="lab" data-kid="diesel"></span></button>
      <button type="button" class="kt" data-mode="electric" aria-pressed="false"><span class="ico">🚆</span><span class="lab" data-kid="electric"></span></button>
      <button type="button" class="kt" data-mode="tgv" aria-pressed="true"><span class="ico">🚄</span><span class="lab" data-kid="tgv"></span></button>
    </div>
    <div class="kid-panel kid-speed"><div class="n"><span id="kidSpeed">0</span><small>km/h</small></div><div class="kid-next" id="kidNext"></div></div>
    <button type="button" class="kid-gear" id="kidGear" aria-expanded="false" aria-label="Menu">⚙️</button>
  </div>
  <div class="kid-panel kid-menu" id="kidMenu" hidden>
    <span class="lab" data-kid="lang"></span>
    <div class="seg" id="kidLang"><button type="button" data-lang="fr" aria-pressed="true">Français</button><button type="button" data-lang="en" aria-pressed="false">English</button></div>
    <span class="lab" data-kid="sound"></span>
    <div class="seg" id="kidSound"><button type="button" data-m="0" aria-pressed="true">🔊</button><button type="button" data-m="1" aria-pressed="false">🔇</button></div>
    <a href="https://claude.ai/artifact/EMVu67YYfT7DzW8UozZAj6" target="_blank" rel="noopener" data-kid="full"></a>
    <a href="https://claude.ai/artifact/YTRJvuYiFZpzyjxXD6vqQR" target="_blank" rel="noopener" data-kid="game"></a>
  </div>
  <div class="kid-toast" id="kidToast"></div>
  <div class="kid-bottom">
    <div class="kid-panel kid-route" id="kidRoute"></div>
    <div class="kid-panel kid-controls">
      <button type="button" class="kb red" id="kidStop"><span class="ico">🛑</span><span class="lab" data-kid="stop"></span></button>
      <div class="kid-lever" id="kidLeverBox"><input type="range" id="kidLever" min="0" max="8" step="1" value="0" aria-label="Manette"><div class="kid-lever-lab"><span>🐢</span><b data-kid="lever"></b><span>🚀</span></div></div>
      <button type="button" class="kb yellow" id="kidHorn"><span class="ico">📣</span><span class="lab" data-kid="horn"></span></button>
      <span class="elec-only"><button type="button" class="kb" id="kidPanto" aria-pressed="true"><span class="ico">⚡</span><span class="lab" data-kid="panto"></span></button></span>
      <button type="button" class="kb green" id="kidStation"><span class="ico">🚉</span><span class="lab" id="kidStationLab"></span></button>
      <button type="button" class="kb" id="kidDir"><span class="ico">🔄</span><span class="lab" id="kidDirLab"></span></button>
      <span class="tgv-only"><button type="button" class="kb blue" id="kidDoors" aria-pressed="false"><span class="ico">🚪</span><span class="lab" data-kid="doors"></span></button></span>
      <button type="button" class="kb" id="kidCam"><span class="ico">📷</span><span class="lab" data-kid="cam"></span></button>
      <button type="button" class="kb" id="kidWx"><span class="ico" id="kidWxIco">☀️</span><span class="lab" data-kid="wx"></span></button>
      <button type="button" class="kb" id="kidXray" aria-pressed="false"><span class="ico">👀</span><span class="lab" data-kid="xray"></span></button>
    </div>
  </div>
</div>`);
$('kidRoute').appendChild($('routeBar'));   // the line with its station dots keeps its own click, drag and teleport handlers
{ const b = $('cabLeave'); b.textContent = '📷'; delete b.dataset.i18nAria; delete b.dataset.i18nTitle; }   // in the cab the way out is the camera button: next view

/* ---- helpers */
function kidPower(full){ ensureBattery(); if (S.mode === 'diesel') ensureRunning(); else if (full) ensureLive(); }   // full: pantograph up and line closed at once (start, train change)
const kidAtEnd = () => S.dir > 0 ? S.dist >= ROUTE.L - 15.6 : S.dist <= 8 + tailLen() + 0.2;
let toastTimer = 0;
function kidToast(key, ms = 3500){
  const el = $('kidToast'); el.textContent = kt(key); el.classList.add('show');
  clearTimeout(toastTimer); if (ms) toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function kidLever(v){
  manual(); kidPower();
  S.notch = v; S.brake = v === 0 ? 4 : 0;
  if (v > 0){
    if (paxHolding()){ kidToast('hint_pax', 3000); PX.closeWhenDone = true; }   // terminus: the doors close by themselves once everyone is through
    else {
      if (S.doorsF > 0.02) kidToast('hint_doors', 3000);
      else if (S.mode !== 'diesel' && !S.panto) kidToast('hint_panto', 3000);
      else if (S.mode !== 'diesel' && !S.lineOn) kidToast('hint_wait', 3000);
      S.doors = false;
    }
    if (kidAtEnd()) kidToast('hint_end', 5000);
  }
  syncControls();
}
function kidStop(){ manual(); S.notch = 0; S.brake = 8; $('kidLever').value = 0; syncControls(); }
function kidPanto(){                                 // electric trains: pantograph up or down; down = no power, the line breaker closes again by itself once it is up
  if (S.mode === 'diesel') return;
  manual(); ensureBattery();
  S.panto = !S.panto;
  if (!S.panto){ S.notch = 0; $('kidLever').value = 0; }
  syncControls();
}
function kidTurn(){                                  // stopped train: face the other way (Paris <-> Toulouse)
  if (S.speed > 0.3){ kidToast('hint_stopped', 2500); return; }
  manual(); S.dir = -S.dir; S.notch = 0; S.brake = 4; $('kidLever').value = 0; syncControls();   // in the driver's place the frame loop moves the view to the other cab
  kidToast(S.dir > 0 ? 'dir_par' : 'dir_tls', 2500);
}
function kidStation(){
  const st = nextStation(0);
  if (!st){ kidTurn(); return; }                     // terminus: turn around
  manual(); kidPower(true);
  if (paxHolding()){ kidToast('hint_pax', 3000); PX.closeWhenDone = true; } else S.doors = false;
  const mark = st.s - TGV.PLAT_FRONT;
  if ((mark - S.dist) * S.dir > 5500) jumpTo(mark - 5000 * S.dir);   // skip the long straight bits, keep the speed
  S.stopS = mark; S.autoStop = true; S.autoDoors = S.mode === 'tgv'; syncControls();
}
function kidDoors(stay){   // stay: pressed from the cab desk, the view stays in the cab
  if (S.mode !== 'tgv') return;
  if (S.speed > 0.1){ kidToast('hint_stopped', 2500); return; }
  if (S.doors && paxHolding()){ kidToast('hint_pax', 3000); PX.closeWhenDone = true; return; }
  S.doors = !S.doors; syncControls();
  if (S.doors && !stay){ camIdx = KID_CAMS.indexOf('door'); flyPreset('door'); }   // opening: land beside the first door to watch it
}
let camIdx = 0, wxIdx = 0;
function kidCam(){
  do camIdx = (camIdx + 1) % KID_CAMS.length; while (S.mode !== 'tgv' && KID_TGV_CAMS.includes(KID_CAMS[camIdx]));
  flyPreset(KID_CAMS[camIdx]);
}
function kidWx(){ wxIdx = (wxIdx + 1) % KID_WX.length; setWeather(KID_WX[wxIdx][0]); $('kidWxIco').textContent = KID_WX[wxIdx][1]; }
function kidXray(){ setShell(shellLevel >= 1 ? 0.18 : 1); $('kidXray').setAttribute('aria-pressed', String(shellLevel < 1)); }
function kidTrain(mode){
  const d = S.dist, dir = S.dir;
  setMode(mode);                 // resets the sim at Bordeaux and rebuilds the flows
  Object.assign(SIM_MUL, KID_MUL[mode]);
  S.dir = dir; jumpTo(d, true);  // back to where the child was, stopped, same way round
  kidPower(true); S.brake = 4; S.notch = 0; $('kidLever').value = 0; syncControls();
  $('kidTrains').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  camIdx = 0; flyPreset(KID_CAMS[0]);
  kidLang();
}
function kidLang(){
  document.title = kt('title');
  document.querySelectorAll('[data-kid]').forEach(el => { el.textContent = kt(el.dataset.kid); });
  $('kidLang').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === S.lang)));
  $('kidLever').setAttribute('aria-label', kt('lever'));
  $('cabLeave').setAttribute('aria-label', kt('cam')); $('cabLeave').title = kt('cam');
}
function kidTick(){
  $('kidSpeed').textContent = Math.round(S.speed * 3.6);
  const st = nextStation(0), d = st ? (st.s - TGV.PLAT_FRONT - S.dist) * S.dir : 0;
  $('kidNext').textContent = st ? `🚉 ${st.name} · ${d < 950 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(d < 10000 ? 1 : 0)} km`}` : `🏁 ${kt('terminus')}`;
  const sb = $('kidStation'); sb.classList.toggle('auto', S.autoStop); sb.disabled = S.autoStop;
  $('kidStationLab').textContent = kt(S.autoStop ? 'auto' : st ? 'station' : 'turn');
  $('kidDirLab').textContent = kt(S.dir > 0 ? 'dir_par' : 'dir_tls');
  $('kidPanto').setAttribute('aria-pressed', String(S.panto));
  const lv = $('kidLever'); if (document.activeElement !== lv) lv.value = S.notch; $('kidLeverBox').classList.toggle('auto', S.autoStop);
  $('kidDoors').setAttribute('aria-pressed', String(S.doorsF > 0.5)); $('kidDoors').disabled = S.speed > 0.1 && S.doorsF < 0.02;
  $('kidHorn').classList.toggle('on', horn.active);
}

/* ---- wiring */
$('kidTrains').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.mode !== S.mode) kidTrain(b.dataset.mode); });
$('kidLever').addEventListener('input', e => kidLever(+e.target.value));
$('kidStop').addEventListener('click', kidStop);
$('kidStation').addEventListener('click', kidStation);
$('kidPanto').addEventListener('click', kidPanto);
$('kidDir').addEventListener('click', kidTurn);
$('kidDoors').addEventListener('click', () => kidDoors());
$('kidCam').addEventListener('click', kidCam);
$('kidWx').addEventListener('click', kidWx);
$('kidXray').addEventListener('click', kidXray);
{
  const hb = $('kidHorn');
  hb.addEventListener('pointerdown', e => { e.preventDefault(); horn.press(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) hb.addEventListener(ev, () => horn.release());
  hb.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); if (!e.repeat) horn.press(); } });
  hb.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') horn.release(); });
}
$('kidGear').addEventListener('click', () => { const m = $('kidMenu'); m.hidden = !m.hidden; $('kidGear').setAttribute('aria-expanded', String(!m.hidden)); });
$('kidLang').addEventListener('click', e => { const b = e.target.closest('button'); if (b && b.dataset.lang !== S.lang){ setLang(b.dataset.lang); kidLang(); } });
function kidMute(m){
  SND.setMuted(m);
  $('kidSound').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.m === +m)));
  try { localStorage.setItem('kid.mute', m ? '1' : '0'); } catch (e) {}
}
$('kidSound').addEventListener('click', e => { const b = e.target.closest('button'); if (b) kidMute(+b.dataset.m === 1); });
try { if (localStorage.getItem('kid.mute') === '1') kidMute(true); } catch (e) {}
document.addEventListener('pointerdown', e => { if (!$('kidMenu').hidden && !e.target.closest('#kidMenu,#kidGear')){ $('kidMenu').hidden = true; $('kidGear').setAttribute('aria-expanded', 'false'); } });

/* ---- hooks into the engine: both pantographs of the first TGV set follow the switch; the desk buttons in the cab work as the kid buttons, its 📷 as the camera button */
pantoHook = f => { if (S.mode !== 'tgv') return false; for (const p of tgvSets[0].pantos) posePanto(p, f); posePanto(panto, f); return true; };   // kid mode: the front pantograph rises too, so the ⚡ button shows on the car the child looks at
frameHook = () => { if (S.mode !== 'diesel' && S.battery && S.lineOn && S.panto && !S.vcb) S.vcb = true; };   // the child only handles the pantograph: the line breaker follows it
Object.assign(cabActions, { panto:kidPanto, doors:() => kidDoors(true), stop:kidStop, leave:kidCam });

/* ---- start: a TGV at Bordeaux, powered up, body opaque, ready to go */
setMode('tgv'); Object.assign(SIM_MUL, KID_MUL.tgv); setShell(1); kidPower(true); S.brake = 4; syncControls();
flyPreset(KID_CAMS[0]); orbit.autoRotate = false;
kidLang(); kidTick(); setInterval(kidTick, 100);
kidToast('hint', 6000);
Object.assign(window.locoDebug, { kidLever, kidStop, kidStation, kidDoors, kidCam, kidWx, kidXray, kidTrain, kidTick, kidPanto, kidTurn, kidMute });
