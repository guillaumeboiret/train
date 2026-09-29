
/* ============================================================ SOUND: one AudioContext shared by the horn, the train, the weather and the other trains */
/* Browsers keep audio silent until the first tap or key: the context is created then, and everything below is quiet until it exists. */
/* Every train sound but our own horn has a place: motors and blowers in each power car, rolling and wind at the point of our train nearest the camera,
   another train at its own nearest point. Each place is panned and fades with its distance to the camera; places, rain and birds pass through the car
   body, which muffles them when the camera is inside. */
const SND = { ctx:null, master:null, muted:false, v:null,
  setMuted(m){ SND.muted = m; if (SND.master) SND.master.gain.setTargetAtTime(m ? 0 : 0.9, SND.ctx.currentTime, 0.05); } };
const _sc = (v, a, b) => Math.max(a, Math.min(b, v));
const _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3();
function audioCtx(){
  if (SND.ctx) return SND.ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const ctx = new AC(); SND.ctx = ctx;
  const master = ctx.createGain(); master.gain.value = SND.muted ? 0 : 0.9; master.connect(ctx.destination); SND.master = master;
  // seamless loops of soft noise, pink (equal energy per octave) and brown (mostly below 150 Hz): every hiss and rumble is cut from them
  const loopNoise = (sec, brown) => {
    const sr = ctx.sampleRate, n = Math.round(sr * sec), x = 2400, raw = new Float32Array(n + x);
    let b0 = 0, b1 = 0, b2 = 0, s = 0;
    for (let i = -8000; i < n + x; i++){
      const w = Math.random() * 2 - 1;
      if (brown) s = (s + 0.02 * w) / 1.02;
      else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; s = b0 + b1 + b2 + w * 0.1848; }
      if (i >= 0) raw[i] = s;
    }
    for (let i = 0; i < x; i++){ const k = i / x; raw[i] = raw[i] * Math.sqrt(k) + raw[n + i] * Math.sqrt(1 - k); }   // the end runs on into the start
    let m = 0, q = 0; for (let i = 0; i < n; i++) m += raw[i]; m /= n;
    for (let i = 0; i < n; i++) q += (raw[i] - m) ** 2;
    const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0), k = 0.2 / Math.sqrt(q / n);   // RMS 0.2
    for (let i = 0; i < n; i++) d[i] = (raw[i] - m) * k;
    return buf;
  };
  const pinkB = loopNoise(4.1, false), brownB = loopNoise(3.3, true);
  const noise = buf => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration); return s; };   // each place its own stretch of the loop
  const chain = (src, type, freq, q, dest) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(dest); return { f, g }; };
  const osc = (type, freq, dest) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(dest); o.start(); return { o, g }; };
  const place = dest => { const g = ctx.createGain(); g.gain.value = 0; const pan = ctx.createStereoPanner(); g.connect(pan); pan.connect(dest); return { g, pan }; };
  const body = ctx.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 16000; body.Q.value = 0;   // the car body: open outside, 700 Hz inside
  const bodyG = ctx.createGain(); body.connect(bodyG); bodyG.connect(master);
  const v = SND.v = { body, bodyG, pc:[0, 1, 2, 3].map(() => place(body)), near:place(body), opp:[], birdT:2 };
  // the power cars: traction motors (a soft harmonic hum, pitch with the speed; two motors a hair apart beat slowly) and the blowers (a breathy hum)
  const wave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.45, 0.2, 0.08, 0.03]));
  const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 900; mlp.Q.value = 0;
  v.motor = ctx.createGain(); v.motor.gain.value = 0; mlp.connect(v.motor);
  v.mots = [0.7, 0.3].map((a, i) => { const o = ctx.createOscillator(); o.setPeriodicWave(wave); o.detune.value = 7 * i; const g = ctx.createGain(); g.gain.value = a; o.connect(g); g.connect(mlp); o.start(); return o; });
  v.blow = ctx.createGain(); v.blow.gain.value = 0;
  chain(noise(pinkB), 'lowpass', 420, 0, v.blow).g.gain.value = 1;
  osc('sine', 142, v.blow).g.gain.value = 0.1;   // the fans' blade tone
  for (const s of v.pc){ v.motor.connect(s.g); v.blow.connect(s.g); }
  // diesel, in the loco (the first place): firing pulses and a faint turbo
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 380; dlp.Q.value = 1.2; dlp.connect(v.pc[0].g); v.dslLp = dlp;
  v.diesel = osc('sawtooth', 60, dlp); v.turbo = osc('sine', 1100, v.pc[0].g);
  // rolling and wind, under the car nearest the camera: a deep rumble, a mid roll opening with the speed, a soft rush at high speed
  const ps = noise(pinkB);
  v.rumble = chain(noise(brownB), 'lowpass', 140, 0, v.near.g); v.roll = chain(ps, 'lowpass', 400, 0, v.near.g); v.aero = chain(ps, 'bandpass', 800, 0.5, v.near.g);
  v.rain = chain(noise(pinkB), 'bandpass', 2400, 0.35, body);
  for (const o of opp){   // the other trains: a rush each, at their nearest point; their horn plays into the same panner
    const p = place(body); p.g.gain.value = 1;
    const c = chain(noise(pinkB), 'lowpass', 600, 0, p.g);
    v.opp.push({ o, pan:p.pan, f:c.f, g:c.g, horn:null });
  }
  return ctx;
}
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { const c = audioCtx(); if (c && c.state === 'suspended') c.resume(); }, { capture:true, passive:true });

/* ---- our horn: two-tone chord, synthesised; H or Space, or the horn button */
const horn = (() => {
  let gain = null, holding = false, minUntil = 0, timer = 0;
  const build = () => {
    const ctx = audioCtx(); if (!ctx) return false;
    gain = ctx.createGain(); gain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.8;
    gain.connect(lp); lp.connect(SND.master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lfoG = ctx.createGain(); lfoG.gain.value = 5; lfo.connect(lfoG); lfo.start();
    for (const [f, type, g] of [[311, 'sawtooth', 0.42], [370, 'sawtooth', 0.42], [622, 'square', 0.06], [740, 'square', 0.06]]){
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; lfoG.connect(o.detune);
      const og = ctx.createGain(); og.gain.value = g; o.connect(og); og.connect(gain); o.start();
    }
    return true;
  };
  const ramp = (v, t) => { const now = SND.ctx.currentTime; gain.gain.cancelScheduledValues(now); gain.gain.setValueAtTime(gain.gain.value, now); gain.gain.linearRampToValueAtTime(v, now + t); };
  const on = () => { if (!gain && !build()) return; if (SND.ctx.state === 'suspended') SND.ctx.resume(); ramp(0.35, 0.06); document.getElementById('btnHorn')?.classList.add('on'); };
  const off = () => { if (gain) ramp(0, 0.25); document.getElementById('btnHorn')?.classList.remove('on'); };
  const settle = () => { clearTimeout(timer); const rem = minUntil - performance.now(); if (holding) return; if (rem > 0) timer = setTimeout(off, rem); else off(); };
  return {
    get active(){ return holding || performance.now() < minUntil; },
    press(){ holding = true; minUntil = Math.max(minUntil, performance.now() + 1200); on(); },
    release(){ holding = false; settle(); },
    blast(ms = 1200){ minUntil = Math.max(minUntil, performance.now() + ms); on(); settle(); },
  };
})();

/* ---- one-shot voices */
function bird(ctx){   // a short trill, somewhere left or right
  const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.6 - 0.8; o.type = 'sine'; o.connect(g); g.connect(pan); pan.connect(SND.v.body);
  const n = 2 + Math.floor(Math.random() * 4), base = 2400 + Math.random() * 1400, d = 0.09 + Math.random() * 0.06;
  g.gain.setValueAtTime(0, t0);
  for (let i = 0; i < n; i++){
    const t = t0 + i * d * 1.6;
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.45, t + d * 0.5); o.frequency.linearRampToValueAtTime(base * 1.1, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.01); g.gain.setValueAtTime(0.045, t + d - 0.02); g.gain.linearRampToValueAtTime(0, t + d);
  }
  o.start(t0); o.stop(t0 + n * d * 1.6 + 0.1);
}
function oppHorn(vo, lvl, dop){   // "tuu-tuuu": a high then a low note, our chord recipe, pitched by the Doppler factor, placed in that train's panner
  const ctx = SND.ctx, t0 = ctx.currentTime, g = ctx.createGain(); g.gain.value = lvl;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; g.connect(lp); lp.connect(vo.pan);
  for (const [f, st, len] of [[392, 0, 0.45], [311, 0.5, 0.75]]) for (const [r, type, gg] of [[1, 'sawtooth', 0.42], [1.19, 'sawtooth', 0.42], [2, 'square', 0.06], [2.38, 'square', 0.06]]){
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * r * dop; const og = ctx.createGain();
    og.gain.setValueAtTime(0, t0 + st); og.gain.linearRampToValueAtTime(gg, t0 + st + 0.05); og.gain.setValueAtTime(gg, t0 + st + len - 0.1); og.gain.linearRampToValueAtTime(0, t0 + st + len);
    o.connect(og); og.connect(g); o.start(t0 + st); o.stop(t0 + st + len + 0.05);
  }
  vo.horn = { g, until:t0 + 1.4 };
}

/* ---- per frame: levels follow the sim, places follow the camera */
function updateSound(dt){
  const ctx = SND.ctx; if (!ctx || SND.muted) return;
  const v = SND.v, now = ctx.currentTime, sp = S.speed, set = (p, val) => p.setTargetAtTime(val, now, 0.12);
  const cam = camera.position, camR = _sv1.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const aim = (s, p, gain) => { p.sub(cam); const r = Math.max(0.5, p.length()); set(s.g.gain, gain(r)); set(s.pan.pan, 0.75 * _sc(p.dot(camR) / r, -1, 1)); return r; };   // p: where it is (scene), used up
  const tgv = S.mode === 'tgv', two = tgv && tgvSets[1].group.visible, base2 = TGV.SET2_X + S.set2Off;
  const head = TGV.TIP_F, tail = tgv ? (two ? base2 : 0) + TGV.TIP_R : TGV.TIP_F - trainLen();
  const cx = _sc(cam.x, tail, head);   // our train's nearest point to the camera, in train coordinates
  curveLocal(cx, 0, 0, _sv2);
  const inside = cam.x > tail && cam.x < head && Math.hypot(cam.x - _sv2.x, cam.z - _sv2.z) < TGV.HALF_W - 0.05 && cam.y - _sv2.y > 0.7 && cam.y - _sv2.y < 4.4;
  set(v.body.frequency, inside ? 700 : 16000); set(v.bodyG.gain, inside ? 0.7 : 1);
  // power cars: the motors hum with the effort, the blowers run while the line breaker is closed; beyond 12 m a long car fades a little slower than a point
  const live = S.mode === 'diesel' ? S.engine === 'running' : S.vcb && S.dcV > 2000, tr = _sc(S.tractionN, 0, 1);
  set(v.motor.gain, live ? 0.13 * (0.2 + 0.8 * tr) * Math.min(1, sp / 3) : 0);
  for (const o of v.mots) set(o.frequency, 20 + 2.6 * sp);
  set(v.blow.gain, S.mode !== 'diesel' && S.vcb ? 0.16 * S.dcN : 0);
  const pcs = tgv ? (two ? [0, TGV.REAR_PC, base2, base2 + TGV.REAR_PC] : [0, TGV.REAR_PC]) : [0];
  v.pc.forEach((s, i) => { if (i < pcs.length) aim(s, curveLocal(pcs[i], 1.6, 0, _sv2), r => (12 / Math.max(12, r)) ** 0.8); else set(s.g.gain, 0); });
  const rpm = S.mode === 'diesel' ? S.rpm : 0, rn = S.mode === 'diesel' ? S.rpmN : 0;
  set(v.diesel.g.gain, rpm > 50 ? 0.16 : 0); set(v.diesel.o.frequency, Math.max(20, rpm / 60 * 8)); set(v.dslLp.frequency, 180 + 260 * rn);
  set(v.turbo.g.gain, 0.006 * rn * rn); set(v.turbo.o.frequency, 1100 + 1300 * rn);
  // rolling and wind: a line of bogies, so it fades slower than a point
  const tun = ROUTE.kindAt(S.dist) === 2, tunMul = tun ? 1.6 : 1;   // a tunnel throws the noise back
  set(v.rumble.g.gain, 0.36 * Math.min(1, sp / 30) * tunMul);
  set(v.roll.g.gain, 0.4 * Math.min(1, sp / 50) * tunMul); set(v.roll.f.frequency, 280 + 7 * sp);
  set(v.aero.g.gain, 0.3 * (sp / 89) ** 2 * tunMul);
  aim(v.near, curveLocal(cx, 0.8, 0, _sv2), r => (6 / Math.max(6, r)) ** 0.55);
  const rain = !!WEATHER[weatherId].rain;
  set(v.rain.g.gain, rain ? 0.12 : 0);
  v.birdT -= dt;
  if (v.birdT <= 0){ v.birdT = 1.2 + Math.random() * 3; if (sp < 8 && !tun && !rain) bird(ctx); }   // birds when slow, outdoors and dry
  for (const vo of v.opp){
    const o = vo.o;
    if (!o.active){ set(vo.g.gain, 0); vo.horn = null; continue; }
    const a = o.s + TGV.TIP_F * o.dir, b = o.s + TGV.TIP_R * o.dir, ourS = S.dist + cam.x;   // the train is a 197 m segment: the nearest point speaks
    const sN = _sc(ourS, Math.min(a, b), Math.max(a, b));
    curveLocal(sN - S.dist, 1.6, ROUTE.laneW(o.lane, sN) - laneMix(sN), _sv2);
    const r = aim(vo, _sv2, r => 0.5 * Math.min(1, o.v / 60) / (1 + r / 15));
    const u = (sN - ourS) / r, dop = (340 + sp * S.dir * u) / Math.max(60, 340 + o.v * o.dir * u);   // Doppler: both trains move, only along the line of sight counts
    set(vo.f.frequency, 600 * dop);
    const gap = (o.s - S.dist) * S.dir - 2 * TGV.TIP_F, hornLvl = 0.45 * Math.min(1, 500 / r);   // nose to nose; full level for any train close enough to meet, about our horn once panned
    if (!o.horned && o.dir === -S.dir && gap > 0 && gap < 3 * (o.v + sp)){ o.horned = true; oppHorn(vo, hornLvl, dop ** 0.35); }   // hello, 3 s before we meet; the pitch rise kept mild
    if (vo.horn){ if (now > vo.horn.until) vo.horn = null; else vo.horn.g.gain.setTargetAtTime(hornLvl, now, 0.05); }
  }
}
