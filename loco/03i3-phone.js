
/* ============================================================ THE PASSENGER'S PHONE (kid build, after the film) */
/* Walking through the TGV, 📱 or P takes the phone out of the pocket: it comes up over the view, the train running on behind it, with three
   games: Tetris, Snake and 2048. The arrows under the screen, a swipe on it or the keyboard's arrows play (a tap turns a Tetris piece, a
   swipe down or Space drops it); a tap beside the phone, ✕, P or Esc puts it away, and each game waits where it was left. Records stay on
   this device */
Object.assign(KID_T.fr, { ph_take:"Mon téléphone", ph_away:"Ranger le téléphone", ph_home:"Accueil", ph_score:"Score", ph_best:"Record", ph_lines:"Lignes",
  ph_next:"Après", ph_over:"Perdu !", ph_again:"Touche pour rejouer", ph_go:"Touche une flèche !", ph_won:"2048 ! Bravo !" });
Object.assign(KID_T.en, { ph_take:"My phone", ph_away:"Put the phone away", ph_home:"Home", ph_score:"Score", ph_best:"Best", ph_lines:"Lines",
  ph_next:"Next", ph_over:"Game over!", ph_again:"Tap to play again", ph_go:"Press an arrow!", ph_won:"2048! Well done!" });

document.head.insertAdjacentHTML('beforeend', `<style>
.phone-btn{position:absolute;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));width:68px;height:68px;margin-left:-34px;padding:0;border-radius:50%;font-size:34px;line-height:1}
body:is(.bar-open,.phone-open) .phone-btn,body.phone-open :is(.walk-stick,#walkSit,#walkLeave){display:none}
.ph-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.phone{position:fixed;inset:0;z-index:20;font:500 15px/1.2 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.phone[hidden]{display:none}
.phone-back{position:absolute;inset:0;background:rgba(8,12,20,.35);opacity:0;transition:opacity .3s}
.phone.on .phone-back{opacity:1}
/* drawn at 360 × 740 and scaled to the screen (--k, phFit) from its bottom middle; out of view below until it comes up */
.phone-body{position:absolute;left:50%;bottom:2vh;width:360px;height:740px;margin-left:-180px;box-sizing:border-box;padding:12px;border-radius:56px;background:#1b1d22;box-shadow:inset 0 0 0 2px #50545c,0 24px 60px rgba(0,0,0,.55);transform-origin:50% 100%;transform:translateY(calc(120% + 4vh)) scale(var(--k,1));transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.phone.on .phone-body{transform:scale(var(--k,1))}
.phone-screen{position:relative;height:100%;display:flex;flex-direction:column;border-radius:44px;overflow:hidden;background:#0d1117;color:#fff}
.phone-screen.home{background:linear-gradient(160deg,#ff9a62,#c86dd7 55%,#4b6cd8)}
.phone-status{flex:0 0 48px;position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 30px 0 36px;font-weight:600;font-size:15px}
.phone-status i{position:absolute;left:50%;top:11px;width:110px;height:30px;margin-left:-55px;border-radius:15px;background:#000}
.phone-batt{position:relative;width:25px;height:12px;border:1.5px solid rgba(255,255,255,.9);border-radius:4px}
.phone-batt::after{content:'';position:absolute;top:1.5px;bottom:1.5px;left:1.5px;right:6px;border-radius:1.5px;background:#fff}
.phone-home{flex:1;display:grid;grid-template-columns:repeat(3,1fr);align-content:start;gap:24px 0;padding:26px 14px}
.phone-home[hidden],.phone-game[hidden]{display:none}
.phone-app{display:grid;justify-items:center;gap:8px;padding:0;border:0;background:none;color:#fff;font:600 13px/1 inherit;cursor:pointer;touch-action:manipulation}
.phone-app .ic{width:74px;height:74px;display:grid;place-items:center;border-radius:19px;font-size:40px;box-shadow:0 4px 12px rgba(0,0,0,.25)}
.phone-app .ic.t{background:linear-gradient(#3d4f94,#1d2752)}
.phone-app .ic.s{background:linear-gradient(#86d975,#3c9a37)}
.phone-app .ic.n{background:#edc22e;font:800 23px/1 system-ui,sans-serif}
.phone-game{flex:1;min-height:0;display:flex;flex-direction:column}
.phone-head{flex:0 0 44px;display:flex;align-items:center;gap:10px;padding:0 16px}
.phone-head button{width:38px;height:38px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:24px;line-height:1;cursor:pointer;touch-action:manipulation}
.phone-head b{font-size:18px}
.phone-head span{margin-left:auto;color:#c9d1d9;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;white-space:pre-line}
#phoneCv{flex:1;min-height:0;width:100%;display:block;touch-action:none}
.phone-pad{flex:0 0 156px;display:grid;grid-template-columns:repeat(3,76px);grid-template-rows:repeat(2,66px);gap:8px;justify-content:center;align-content:center}
.phone-pad button{padding:0;border:0;border-radius:18px;background:rgba(255,255,255,.15);color:#fff;font-size:28px;cursor:pointer;touch-action:none}
.phone-pad button.on{background:#f28c28}
.phone-pad [data-d=up]{grid-column:2}.phone-pad [data-d=left]{grid-area:2/1}.phone-pad [data-d=down]{grid-area:2/2}.phone-pad [data-d=right]{grid-area:2/3}
.phone-bar{flex:0 0 28px;display:grid;place-items:center;padding:0;border:0;background:none;cursor:pointer}
.phone-bar::before{content:'';width:130px;height:5px;border-radius:3px;background:rgba(255,255,255,.85)}
.phone-x{position:absolute;right:-70px;top:4px;width:56px;height:56px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.93);color:#1b2430;font-size:24px;box-shadow:0 4px 12px rgba(0,0,0,.3);cursor:pointer}
</style>`);
$('walkBar').insertAdjacentHTML('beforeend', `<button type="button" class="phone-btn" id="phoneBtn"><span aria-hidden="true">📱</span><span class="ph-vh" data-kid="ph_take"></span></button>`);
$('c3d').parentElement.insertAdjacentHTML('beforeend', `<div class="phone" id="phone" hidden>
  <div class="phone-back" id="phoneBack"></div>
  <div class="phone-body" role="dialog" aria-label="iPhone">
    <div class="phone-screen home" id="phoneScreen">
      <div class="phone-status"><b id="phoneTime">12:00</b><i></i><span class="phone-batt"></span></div>
      <div class="phone-home" id="phoneHome">
        <button type="button" class="phone-app" data-app="tetris"><span class="ic t" aria-hidden="true">🧱</span>Tetris</button>
        <button type="button" class="phone-app" data-app="snake"><span class="ic s" aria-hidden="true">🐍</span>Snake</button>
        <button type="button" class="phone-app" data-app="2048"><span class="ic n" aria-hidden="true">2048</span>2048</button>
      </div>
      <div class="phone-game" id="phoneGame" hidden>
        <div class="phone-head"><button type="button" id="phoneBackApp" aria-label="Accueil">‹</button><b id="phoneTitle"></b><span id="phoneScore"></span></div>
        <canvas id="phoneCv"></canvas>
        <div class="phone-pad" id="phonePad"><button type="button" data-d="up" aria-label="↑">▲</button><button type="button" data-d="left" aria-label="←">◀</button><button type="button" data-d="down" aria-label="↓">▼</button><button type="button" data-d="right" aria-label="→">▶</button></div>
      </div>
      <button type="button" class="phone-bar" id="phoneBar"><span class="ph-vh" data-kid="ph_home"></span></button>
    </div>
    <button type="button" class="phone-x" id="phoneX"><span aria-hidden="true">✕</span><span class="ph-vh" data-kid="ph_away"></span></button>
  </div>
</div>`);
document.querySelectorAll('#phoneBtn [data-kid],#phone [data-kid]').forEach(el => { el.textContent = kt(el.dataset.kid); });   // kidLang ran before they were here

const PHONE = { open:false, app:null, games:{}, best:{}, raf:0, last:0, cw:0, ch:0 };
try { PHONE.best = JSON.parse(localStorage.getItem('trainPhoneBest')) || {}; } catch { PHONE.best = {}; }
const phSave = () => { try { localStorage.setItem('trainPhoneBest', JSON.stringify(PHONE.best)); } catch {} };
const phRR = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
function phMsg(c, w, h, big, small){   // a band across the game: Game over, the way to start, 2048 reached
  c.fillStyle = 'rgba(10,14,22,.78)'; c.fillRect(0, h / 2 - 44, w, small ? 88 : 60);
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '800 26px system-ui,sans-serif'; c.fillText(big, w / 2, h / 2 - (small ? 14 : 14));
  if (small){ c.font = '500 15px system-ui,sans-serif'; c.fillStyle = '#c9d1d9'; c.fillText(small, w / 2, h / 2 + 22); }
}
function phShuffle(a){ for (let i = a.length - 1; i > 0; i--){ const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* Tetris: 10 × 20, the seven pieces dealt by sevens (each once in every seven), a piece turns against the walls by a step or two; a row a
   tenth of a second faster every ten lines */
const TET_SH = { I:[[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], O:[[1, 1], [1, 1]], T:[[0, 1, 0], [1, 1, 1], [0, 0, 0]], S:[[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z:[[1, 1, 0], [0, 1, 1], [0, 0, 0]], J:[[1, 0, 0], [1, 1, 1], [0, 0, 0]], L:[[0, 0, 1], [1, 1, 1], [0, 0, 0]] };
const TET_C = { I:'#3ec6e0', O:'#f6c945', T:'#a05bd6', S:'#5cc65a', Z:'#e5533d', J:'#3d6fe5', L:'#f28c28' };
const tetTurn = m => m[0].map((_, i) => m.map(r => r[i]).reverse());   // a quarter turn clockwise
function phTetris(){
  const b = Array.from({ length:20 }, () => Array(10).fill(0)), g = { score:0, lines:0, over:false, cur:null, next:null };
  let bag = [], t = 0;
  const deal = () => { if (!bag.length) bag = phShuffle([...'IOTSZJL']); return bag.pop(); };
  const hit = (m, x, y) => m.some((r, j) => r.some((v, i) => v && (x + i < 0 || x + i > 9 || y + j > 19 || y + j >= 0 && b[y + j][x + i])));
  const spawn = () => {
    const k = g.next ?? deal(), m = TET_SH[k]; g.next = deal();
    g.cur = { k, m, x:(10 - m.length) >> 1, y:k === 'I' ? -1 : 0 };
    if (hit(m, g.cur.x, g.cur.y)) g.over = true;
  };
  const lock = () => {
    const { k, m, x, y } = g.cur;
    m.forEach((r, j) => r.forEach((v, i) => { if (v){ if (y + j < 0) g.over = true; else b[y + j][x + i] = k; } }));
    if (g.over) return;
    let n = 0;
    for (let j = 19; j >= 0; j--) if (b[j].every(Boolean)){ b.splice(j, 1); b.unshift(Array(10).fill(0)); n++; j++; }
    g.lines += n; g.score += [0, 100, 300, 500, 800][n] * (1 + (g.lines / 10 | 0));
    spawn();
  };
  const fall = () => { const p = g.cur; if (!hit(p.m, p.x, p.y + 1)){ p.y++; return true; } lock(); return false; };
  g.input = d => {
    const p = g.cur;
    if (d === 'left' || d === 'right'){ const dx = d === 'left' ? -1 : 1; if (!hit(p.m, p.x + dx, p.y)) p.x += dx; }
    else if (d === 'up' || d === 'tap'){ const m = tetTurn(p.m); for (const k of [0, -1, 1, -2, 2]) if (!hit(m, p.x + k, p.y)){ p.m = m; p.x += k; break; } }
    else if (d === 'down'){ if (fall()) g.score += 1; t = 0; }
    else if (d === 'drop'){ while (fall()) g.score += 2; t = 0; }
  };
  g.step = dt => { t += dt; const iv = Math.max(0.1, 0.8 - 0.07 * (g.lines / 10 | 0)); while (t >= iv && !g.over){ t -= iv; fall(); } };
  g.draw = (c, w, h) => {
    const s = Math.floor(Math.min((h - 8) / 20, (w - 16) / 14.6)), bx = Math.round((w - 14.6 * s) / 2), by = Math.round((h - 20 * s) / 2), sx = bx + 10.6 * s;
    const cell = (x, y, col, q = s, ox = bx, oy = by) => { c.fillStyle = col; c.fillRect(ox + x * q + 1, oy + y * q + 1, q - 2, q - 2); c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(ox + x * q + 1, oy + y * q + 1, q - 2, Math.max(2, q * 0.14)); };
    c.fillStyle = '#161b26'; c.fillRect(bx, by, 10 * s, 20 * s);
    c.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 1; i < 10; i++) c.fillRect(bx + i * s, by, 1, 20 * s);
    b.forEach((r, j) => r.forEach((k, i) => { if (k) cell(i, j, TET_C[k]); }));
    const p = g.cur;
    if (!g.over){
      let gy = p.y; while (!hit(p.m, p.x, gy + 1)) gy++;   // where it would land, faint
      c.globalAlpha = 0.22; p.m.forEach((r, j) => r.forEach((v, i) => { if (v && gy + j >= 0) cell(p.x + i, gy + j, TET_C[p.k]); })); c.globalAlpha = 1;
      p.m.forEach((r, j) => r.forEach((v, i) => { if (v && p.y + j >= 0) cell(p.x + i, p.y + j, TET_C[p.k]); }));
    }
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = '#9aa4b2'; c.font = `600 ${Math.round(s * 0.62)}px system-ui,sans-serif`;
    c.fillText(kt('ph_next'), sx, by);
    const nm = TET_SH[g.next], q = Math.round(s * 0.8); nm.forEach((r, j) => r.forEach((v, i) => { if (v) cell(i, j, TET_C[g.next], q, sx, by + s); }));
    c.fillStyle = '#9aa4b2'; c.fillText(kt('ph_lines'), sx, by + 5.5 * s);
    c.fillStyle = '#fff'; c.font = `700 ${s}px system-ui,sans-serif`; c.fillText(String(g.lines), sx, by + 6.3 * s);
  };
  spawn(); return g;
}

/* Snake: 15 × 15, through one side and back in by the other; it starts on the first arrow, and goes a little faster with each apple */
function phSnake(){
  const N = 15, V = { up:[0, -1], down:[0, 1], left:[-1, 0], right:[1, 0] }, g = { score:0, over:false, go:false, body:[[7, 7], [6, 7], [5, 7]], dir:[1, 0], q:[], apple:null };
  let t = 0;
  const on = (x, y) => g.body.some(p => p[0] === x && p[1] === y);
  const place = () => { const f = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!on(x, y)) f.push([x, y]); g.apple = f[Math.random() * f.length | 0] || null; if (!g.apple) g.over = true; };
  g.input = d => {
    if (d === 'tap'){ g.go = true; return; }
    const v = V[d]; if (!v) return;
    const l = g.q.at(-1) || g.dir; g.go = true;
    if (g.q.length < 2 && v[0] !== -l[0] && v[1] !== -l[1] && (v[0] !== l[0] || v[1] !== l[1])) g.q.push(v);   // no turning back into itself; two turns ahead at most
  };
  const tick = () => {
    if (g.q.length) g.dir = g.q.shift();
    const [hx, hy] = g.body[0], x = (hx + g.dir[0] + N) % N, y = (hy + g.dir[1] + N) % N, eat = x === g.apple[0] && y === g.apple[1];
    if (!eat) g.body.pop();   // the tail moves on first: the head may take its place
    if (on(x, y)){ g.over = true; return; }
    g.body.unshift([x, y]);
    if (eat){ g.score++; place(); }
  };
  g.step = dt => { if (!g.go) return; t += dt; const iv = Math.max(0.08, 0.17 - 0.003 * g.score); while (t >= iv && !g.over){ t -= iv; tick(); } };
  g.draw = (c, w, h) => {
    const s = Math.floor(Math.min(w - 16, h - 8) / N), bx = Math.round((w - N * s) / 2), by = Math.round((h - N * s) / 2);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ c.fillStyle = (x + y) & 1 ? '#a2d149' : '#aad751'; c.fillRect(bx + x * s, by + y * s, s, s); }
    if (g.apple){
      const [ax, ay] = g.apple; c.fillStyle = '#e7471d'; c.beginPath(); c.arc(bx + (ax + 0.5) * s, by + (ay + 0.56) * s, s * 0.4, 0, 7); c.fill();
      c.fillStyle = '#4a8c2a'; c.fillRect(bx + (ax + 0.48) * s, by + (ay + 0.02) * s, s * 0.12, s * 0.24);
    }
    g.body.forEach(([x, y], i) => { c.fillStyle = i ? '#4675e8' : '#3a5fcb'; phRR(c, bx + x * s + 1.5, by + y * s + 1.5, s - 3, s - 3, s * 0.3); c.fill(); });
    const [hx, hy] = g.body[0], [dx, dy] = g.dir;
    for (const k of [-1, 1]){   // the eyes, looking the way it goes
      const ex = bx + (hx + 0.5 + dx * 0.12 - dy * 0.2 * k) * s, ey = by + (hy + 0.5 + dy * 0.12 + dx * 0.2 * k) * s;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, s * 0.14, 0, 7); c.fill();
      c.fillStyle = '#1b2430'; c.beginPath(); c.arc(ex + dx * s * 0.05, ey + dy * s * 0.05, s * 0.07, 0, 7); c.fill();
    }
    if (!g.go && !g.over) phMsg(c, w, h, kt('ph_go'));
  };
  place(); return g;
}

/* 2048: slide the tiles one way, two of a number meeting make one of twice it; a new 2 (or 4) comes after every slide that moved something */
const N2048_C = { 2:'#eee4da', 4:'#ede0c8', 8:'#f2b179', 16:'#f59563', 32:'#f67c5f', 64:'#f65e3b', 128:'#edcf72', 256:'#edcc61', 512:'#edc850', 1024:'#edc53f', 2048:'#edc22e' };
function ph2048(){
  const a = Array(16).fill(0), born = Array(16).fill(0), g = { score:0, over:false, won:0, wonOnce:false };
  const add = () => { const f = []; a.forEach((v, i) => { if (!v) f.push(i); }); if (!f.length) return; const i = f[Math.random() * f.length | 0]; a[i] = Math.random() < 0.9 ? 2 : 4; born[i] = 1; };
  const LINE = { left:k => [0, 1, 2, 3].map(i => k * 4 + i), right:k => [3, 2, 1, 0].map(i => k * 4 + i), up:k => [0, 1, 2, 3].map(i => i * 4 + k), down:k => [3, 2, 1, 0].map(i => i * 4 + k) };
  const stuck = () => a.every((v, i) => v && (i % 4 === 3 || a[i + 1] !== v) && (i > 11 || a[i + 4] !== v));
  g.input = d => {
    const L = LINE[d]; if (!L) return;
    let moved = false;
    for (let k = 0; k < 4; k++){
      const ix = L(k), v = ix.map(i => a[i]).filter(Boolean), out = [];
      for (let i = 0; i < v.length; i++){
        if (v[i] === v[i + 1]){ out.push(v[i] * 2); g.score += v[i] * 2; if (v[i] * 2 === 2048 && !g.wonOnce){ g.wonOnce = true; g.won = 2.5; } i++; }
        else out.push(v[i]);
      }
      ix.forEach((p, j) => { const n = out[j] || 0; if (a[p] !== n){ a[p] = n; moved = true; } });
    }
    if (moved){ add(); if (stuck()) g.over = true; }
  };
  g.step = dt => { for (let i = 0; i < 16; i++) born[i] = Math.max(0, born[i] - dt * 7); g.won = Math.max(0, g.won - dt); };
  g.draw = (c, w, h) => {
    const B = Math.min(w - 20, h - 8), gp = B * 0.03, s = (B - 5 * gp) / 4, bx = (w - B) / 2, by = (h - B) / 2;
    c.fillStyle = '#bbada0'; phRR(c, bx, by, B, B, gp * 2); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 16; i++){
      const v = a[i], x = bx + gp + (i % 4) * (s + gp), y = by + gp + (i >> 2) * (s + gp);
      c.fillStyle = 'rgba(238,228,218,.35)'; phRR(c, x, y, s, s, gp); c.fill();
      if (!v) continue;
      const q = s * (1 - 0.5 * born[i]), o = (s - q) / 2;   // a new tile grows into place
      c.fillStyle = N2048_C[v] || '#3c3a32'; phRR(c, x + o, y + o, q, q, gp); c.fill();
      c.fillStyle = v <= 4 ? '#776e65' : '#f9f6f2'; c.font = `800 ${Math.round(q * (v < 100 ? 0.46 : v < 1000 ? 0.38 : 0.3))}px system-ui,sans-serif`;
      c.fillText(String(v), x + s / 2, y + s / 2 + 1);
    }
    if (g.won > 0) phMsg(c, w, h, kt('ph_won'));
  };
  add(); add(); return g;
}

const PH_GAMES = { tetris:phTetris, snake:phSnake, 2048:ph2048 }, PH_NAMES = { tetris:'Tetris', snake:'Snake', 2048:'2048' };
function phFit(){   // the phone at most 92 % of the screen's height, the canvas drawn at the screen's pixels
  const k = Math.max(0.4, Math.min(innerHeight * 0.92 / 740, innerWidth * 0.8 / 360, 1.15));
  $('phone').style.setProperty('--k', k.toFixed(3));
  if ($('phoneGame').hidden) return;
  const cv = $('phoneCv'), px = k * (devicePixelRatio || 1);
  PHONE.cw = cv.offsetWidth; PHONE.ch = cv.offsetHeight; cv.width = Math.round(PHONE.cw * px); cv.height = Math.round(PHONE.ch * px);
}
function phApp(app){   // a game, or (none) the home screen
  PHONE.app = app; $('phoneScreen').classList.toggle('home', !app); $('phoneHome').hidden = !!app; $('phoneGame').hidden = !app;
  if (!app) return;
  PHONE.games[app] ??= PH_GAMES[app]();
  $('phoneTitle').textContent = PH_NAMES[app]; phFit();
}
function phInput(d){
  const g = PHONE.games[PHONE.app]; if (!g) return;
  if (g.over){ if (performance.now() - g.overAt > 600) PHONE.games[PHONE.app] = PH_GAMES[PHONE.app](); return; }   // a moment first, so a key still held does not start the next one
  g.input(d);
}
function phLoop(now){
  PHONE.raf = 0;
  if (!PHONE.open) return;
  const B = document.body.classList;
  if (!B.contains('walking') || B.contains('nogui')){ phoneAway(); return; }   // no longer on foot in the train, or the controls hidden: back in the pocket
  const dt = Math.min(0.1, (now - (PHONE.last || now)) / 1000); PHONE.last = now;
  const tm = hhmm(CLOCK.min); if ($('phoneTime').textContent !== tm) $('phoneTime').textContent = tm;
  const g = PHONE.games[PHONE.app];
  if (g){
    if (!g.over) g.step(dt);
    if (g.over && !g.overAt){ g.overAt = performance.now(); if (g.score > (PHONE.best[PHONE.app] || 0)){ PHONE.best[PHONE.app] = g.score; phSave(); } }
    const cv = $('phoneCv'), c = cv.getContext('2d');
    c.setTransform(cv.width / PHONE.cw, 0, 0, cv.height / PHONE.ch, 0, 0); c.clearRect(0, 0, PHONE.cw, PHONE.ch);
    g.draw(c, PHONE.cw, PHONE.ch);
    if (g.over) phMsg(c, PHONE.cw, PHONE.ch, kt('ph_over'), kt('ph_again'));
    const sc = `${kt('ph_score')} ${g.score}\n${kt('ph_best')} ${Math.max(g.score, PHONE.best[PHONE.app] || 0)}`;
    if ($('phoneScore').textContent !== sc) $('phoneScore').textContent = sc;
  }
  PHONE.raf = requestAnimationFrame(phLoop);
}
function phoneOut(){   // out of the pocket: the walker stops, the phone has the keys
  if (PHONE.open || !document.body.classList.contains('walking') || barIsOpen()) return;
  PHONE.open = true; keys.clear(); stickReset(); walkSay(null);
  const el = $('phone'); el.hidden = false; document.body.classList.add('phone-open'); phFit();
  void el.offsetWidth; el.classList.add('on');
  PHONE.last = 0; if (!PHONE.raf) PHONE.raf = requestAnimationFrame(phLoop);
}
function phoneAway(){
  if (!PHONE.open) return;
  PHONE.open = false; phPadUp(); document.body.classList.remove('phone-open');
  const el = $('phone'); el.classList.remove('on'); setTimeout(() => { if (!PHONE.open) el.hidden = true; }, 350);
}
let phRep = 0;   // a Tetris arrow held: once, then again every 60 ms after 200
function phPadUp(){ clearTimeout(phRep); clearInterval(phRep); phRep = 0; $('phonePad').querySelectorAll('.on').forEach(b => b.classList.remove('on')); }
$('phonePad').querySelectorAll('button').forEach(b => {
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); phPadUp(); b.classList.add('on');
    const d = b.dataset.d; phInput(d);
    if (PHONE.app === 'tetris' && d !== 'up') phRep = setTimeout(() => { phRep = setInterval(() => phInput(d), 60); }, 200);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, phPadUp);
});
const phSw = { id:-1, x:0, y:0, done:false };   // on the screen: a swipe is an arrow (down drops a Tetris piece), a tap turns it
$('phoneCv').addEventListener('pointerdown', e => { e.preventDefault(); Object.assign(phSw, { id:e.pointerId, x:e.clientX, y:e.clientY, done:false }); });
$('phoneCv').addEventListener('pointermove', e => {
  if (e.pointerId !== phSw.id || phSw.done) return;
  const dx = e.clientX - phSw.x, dy = e.clientY - phSw.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
  phSw.done = true;
  const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  phInput(PHONE.app === 'tetris' && d === 'down' ? 'drop' : d);
});
$('phoneCv').addEventListener('pointerup', e => { if (e.pointerId !== phSw.id) return; phSw.id = -1; if (!phSw.done) phInput('tap'); });
$('phoneCv').addEventListener('pointercancel', () => { phSw.id = -1; });
$('phoneBtn').addEventListener('click', phoneOut);
$('phoneBack').addEventListener('click', phoneAway);
$('phoneX').addEventListener('click', phoneAway);
$('phoneBar').addEventListener('click', () => phApp(null));
$('phoneBackApp').addEventListener('click', () => phApp(null));
$('phoneHome').querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => phApp(b.dataset.app)));
addEventListener('resize', () => { if (PHONE.open) phFit(); });
const PH_KEYS = { ArrowUp:'up', KeyW:'up', ArrowDown:'down', KeyS:'down', ArrowLeft:'left', KeyA:'left', ArrowRight:'right', KeyD:'right', Space:'drop' };
addEventListener('keydown', e => {   // ahead of the page's own keys (capture): open, the phone has them all
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches?.('input,textarea,select')) return;
  if (!PHONE.open){
    if (e.code === 'KeyP' && !e.repeat && document.body.classList.contains('walking') && !barIsOpen()){ e.preventDefault(); e.stopPropagation(); phoneOut(); }
    return;
  }
  e.stopPropagation();   // nobody walks, honks or leaves behind it
  if (e.key === 'Escape' || e.code === 'KeyP'){ e.preventDefault(); if (!e.repeat) phoneAway(); return; }
  if (e.key === 'Backspace'){ e.preventDefault(); phApp(null); return; }
  const d = PH_KEYS[e.code];
  if (d && PHONE.app){ e.preventDefault(); if (!e.repeat || PHONE.app === 'tetris' && (d === 'left' || d === 'right' || d === 'down')) phInput(d); }
}, true);
Object.assign(window.locoDebug, { PHONE, phoneOut, phoneAway, phApp, phInput });
