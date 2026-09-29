
/* ============================================================ SOUND: one AudioContext shared by the horn, the train, the weather and the other trains */
/* Browsers keep audio silent until the first tap or key: the context is created then, and everything below is quiet until it exists. */
/* Every train sound but our own horn has a place: motors and blowers in each power car, rolling and wind at the point of our train nearest the camera,
   another train at its own nearest point. Each place is panned and fades with its distance to the camera; places, rain and birds pass through the car
   body, which muffles them when the camera is inside. */
/* The TGV adds three recordings, fetched from ../audio (CC0, credited in site/audio/CREDITS.txt): a coach at speed, heard instead of the synthesised
   rolling once inside; a power car at a standstill (blowers, compressor, air dryer); the door beeps and lock. Synthesised: the inverters' whine, the
   transformer hum under 25 kV, the brake squeal and air, the doors opening, the two-tone air horn and the SNCF chime. Where a recording does not load,
   the synthesis stays. */
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
  const v = SND.v = { body, bodyG, pc:[0, 1, 2, 3].map(() => place(body)), near:place(body), opp:[], birdT:2, pinkB };
  // the power cars: traction motors (a soft harmonic hum, pitch with the speed; two motors a hair apart beat slowly) and the blowers (a breathy hum)
  const wave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.45, 0.2, 0.08, 0.03]));
  const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 900; mlp.Q.value = 0;
  v.motor = ctx.createGain(); v.motor.gain.value = 0; mlp.connect(v.motor);
  v.mots = [0.7, 0.3].map((a, i) => { const o = ctx.createOscillator(); o.setPeriodicWave(wave); o.detune.value = 7 * i; const g = ctx.createGain(); g.gain.value = a; o.connect(g); g.connect(mlp); o.start(); return o; });
  v.blow = ctx.createGain(); v.blow.gain.value = 0;
  chain(noise(pinkB), 'lowpass', 420, 0, v.blow).g.gain.value = 1;
  osc('sine', 142, v.blow).g.gain.value = 0.1;   // the fans' blade tone
  // TGV power cars: the inverters' whine (three tones set per frame), the transformer's hum under 25 kV (twice 50 Hz and its harmonics), the recorded blowers
  v.inv = ctx.createGain(); v.inv.gain.value = 0; v.invT = [0, 1, 2].map(() => osc('triangle', 700, v.inv));
  v.hum = ctx.createGain(); v.hum.gain.value = 0;
  for (const [f, a] of [[100, 1], [200, 0.5], [300, 0.25]]) osc('sine', f, v.hum).g.gain.value = a;
  v.idle = ctx.createGain(); v.idle.gain.value = 0;
  for (const s of v.pc){ v.motor.connect(s.g); v.blow.connect(s.g); v.inv.connect(s.g); v.hum.connect(s.g); v.idle.connect(s.g); }
  // diesel, in the loco (the first place): firing pulses and a faint turbo
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 380; dlp.Q.value = 1.2; dlp.connect(v.pc[0].g); v.dslLp = dlp;
  v.diesel = osc('sawtooth', 60, dlp); v.turbo = osc('sine', 1100, v.pc[0].g);
  // rolling and wind, under the car nearest the camera: a deep rumble, a mid roll opening with the speed, a soft rush at high speed; the TGV's disc brakes sing there too
  const ps = noise(pinkB);
  v.rumble = chain(noise(brownB), 'lowpass', 140, 0, v.near.g); v.roll = chain(ps, 'lowpass', 400, 0, v.near.g); v.aero = chain(ps, 'bandpass', 800, 0.5, v.near.g);
  v.squeal = [6800, 4150].map(f => osc('sine', f, v.near.g));
  v.rain = chain(noise(pinkB), 'bandpass', 2400, 0.35, body);
  for (const o of opp){   // the other trains: a rush each, at their nearest point; their horn plays into the same panner
    const p = place(body); p.g.gain.value = 1;
    const c = chain(noise(pinkB), 'lowpass', 600, 0, p.g);
    v.opp.push({ o, pan:p.pan, f:c.f, g:c.g, horn:null });
  }
  // TGV coach and doors: the recorded coach goes straight out (it was recorded inside), the doors' beepers and motion sit by the nearest door, both past the car body
  v.cabin = ctx.createGain(); v.cabin.gain.value = 0; v.cabin.connect(master);
  v.door = place(master);
  v.slide = chain(noise(pinkB), 'bandpass', 380, 0.9, v.door.g); v.slideHum = osc('triangle', 140, v.door.g);   // a door sliding open: its rollers, its drive
  v.airHorn = ctx.createPeriodicWave(new Float32Array(9), new Float32Array([0, 1, 0.8, 0.55, 0.4, 0.28, 0.18, 0.12, 0.08]));   // an air horn: a bright buzz
  const ir = ctx.createBuffer(2, Math.round(ctx.sampleRate * 1.2), ctx.sampleRate);   // a hall for the chime: 1.2 s of decaying noise
  for (let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / ctx.sampleRate / 0.25); }
  v.room = ctx.createConvolver(); v.room.buffer = ir; const wet = ctx.createGain(); wet.gain.value = 0.25; v.room.connect(wet); wet.connect(master);
  // the recordings, next to the pages (XMLHttpRequest: fetch refuses file: pages); each loop file is a 0.3 s lead-in, the loop, a 0.3 s tail
  const load = (name, then) => {
    const x = new XMLHttpRequest(); x.open('GET', '../audio/' + name + '.mp3'); x.responseType = 'arraybuffer';
    x.onload = () => { if ((x.status === 200 || x.status === 0) && x.response){ const p = ctx.decodeAudioData(x.response, then, () => {}); if (p && p.catch) p.catch(() => {}); } };
    x.send();
  };
  const loop = (buf, len, dest) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = 0.3; s.loopEnd = 0.3 + len; s.connect(dest); s.start(0, 0.3 + Math.random() * len); return s; };
  load('tgv_idle', b => { v.idleS = loop(b, 9.773, v.idle); });
  load('tgv_in', b => { v.cabinS = loop(b, 14.5, v.cabin); });
  load('tgv_doors', b => { v.doorB = b; });
  return ctx;
}
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { const c = audioCtx(); if (c && c.state === 'suspended') c.resume(); }, { capture:true, passive:true });

/* ---- our horn: two-tone chord, synthesised; the TGV's own two air horns (UIC 644, 660 and 370 Hz) play one after the other; H or Space, or the horn button */
const horn = (() => {
  let gain = null, hi = null, lo = null, holding = false, minUntil = 0, timer = 0;
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
    const tlp = ctx.createBiquadFilter(); tlp.type = 'lowpass'; tlp.frequency.value = 3200; tlp.Q.value = 0.7; tlp.connect(SND.master);
    [hi, lo] = [660, 370].map(f => {
      const o = ctx.createOscillator(); o.setPeriodicWave(SND.v.airHorn); o.frequency.value = f; lfoG.connect(o.detune);
      const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(tlp); o.start(); return g;
    });
    return true;
  };
  const ramp = (g, v, t) => { const now = SND.ctx.currentTime; g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value, now); g.gain.linearRampToValueAtTime(v, now + t); };
  const on = () => {
    if (!gain && !build()) return; if (SND.ctx.state === 'suspended') SND.ctx.resume();
    if (S.mode === 'tgv'){ const t = SND.ctx.currentTime;   // the high note, then the low one, held
      ramp(hi, 0.25, 0.04); hi.gain.setValueAtTime(0.25, t + 0.4); hi.gain.linearRampToValueAtTime(0, t + 0.45);
      ramp(lo, 0, 0.04); lo.gain.setValueAtTime(0, t + 0.4); lo.gain.linearRampToValueAtTime(0.25, t + 0.45);
    } else ramp(gain, 0.35, 0.06);
    document.getElementById('btnHorn')?.classList.add('on');
  };
  const off = () => { if (gain) for (const g of [gain, hi, lo]) ramp(g, 0, 0.25); document.getElementById('btnHorn')?.classList.remove('on'); };
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
function oppHorn(vo, lvl, dop){   // "tuu-tuuu": the other trains are TGVs, so their high then low air horn, pitched by the Doppler factor, placed in that train's panner
  const ctx = SND.ctx, t0 = ctx.currentTime, g = ctx.createGain(); g.gain.value = lvl;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.7; g.connect(lp); lp.connect(vo.pan);
  for (const [f, st, len] of [[660, 0, 0.45], [370, 0.5, 0.75]]){
    const o = ctx.createOscillator(); o.setPeriodicWave(SND.v.airHorn); o.frequency.value = f * dop; const og = ctx.createGain();
    og.gain.setValueAtTime(0, t0 + st); og.gain.linearRampToValueAtTime(0.5, t0 + st + 0.04); og.gain.setValueAtTime(0.5, t0 + st + len - 0.1); og.gain.linearRampToValueAtTime(0, t0 + st + len);
    o.connect(og); og.connect(g); o.start(t0 + st); o.stop(t0 + st + len + 0.05);
  }
  vo.horn = { g, until:t0 + 1.4 };
}
function chime(ctx, lvl){   // SNCF's sound logo before an announcement (Michaël Boumendil, 2005): C, G, A flat, E flat, struck like a vibraphone, through the train's speakers
  const t0 = ctx.currentTime + 0.05, out = ctx.createGain(), hp = ctx.createBiquadFilter();
  out.gain.value = 0.16 * lvl; hp.type = 'highpass'; hp.frequency.value = 170; out.connect(hp); hp.connect(SND.master); hp.connect(SND.v.room);
  for (const [f, st, last] of [[261.63, 0, 0], [392, 0.48, 0], [415.3, 0.98, 0], [311.13, 1.34, 1]]) for (const [h, a] of [[1, 1], [2, 0.5], [3, 0.2], [4, 0.1]]){
    const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + st, tau = (last ? 0.6 : 0.35) / Math.sqrt(h);   // the upper partials die first
    o.frequency.value = f * h; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.015); g.gain.setTargetAtTime(0, t + 0.015, tau);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.015 + 7 * tau);
  }
}
function doorsClose(ctx){   // the doors' warning beeps, then the lock: recorded, else square beeps; cut short if the doors reopen
  const v = SND.v, t0 = ctx.currentTime, g = ctx.createGain(), out = v.closing = ctx.createGain();
  g.connect(out); out.connect(v.door.g);
  if (v.doorB){ const s = ctx.createBufferSource(); s.buffer = v.doorB; g.gain.value = 0.7; s.connect(g); s.start(t0); return; }
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1450; g.gain.value = 0;
  for (let i = 0; i < 21; i++){ const t = t0 + i * 0.143; g.gain.setValueAtTime(0.05, t); g.gain.setValueAtTime(0, t + 0.07); }
  o.connect(g); o.start(t0); o.stop(t0 + 3.1);
}
function puff(ctx, dest, type, freq, q, lvl, rise, hold, tau){   // a burst of filtered noise: up in rise s, held, then dying away with time constant tau
  const t0 = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = SND.v.pinkB; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(lvl, t0 + rise); g.gain.setTargetAtTime(0, t0 + rise + hold, tau);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t0, Math.random() * 3); s.stop(t0 + rise + hold + 7 * tau);
}
function airSigh(ctx){ puff(ctx, SND.v.near.g, 'highpass', 1800, 1, 0.12, 0.05, 0.25, 0.35); }   // the brakes' air as the train comes to rest
function knock(ctx, freq, lvl){   // a damped thud by the nearest door, its pitch sagging
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(0.6 * freq, t + 0.12);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, 0.04);
  o.connect(g); g.connect(SND.v.door.g); o.start(t); o.stop(t + 0.3);
}
function doorsUnlock(ctx){   // the doors starting to open: the lock lets go (a click, a knock), then air as each leaf swings out; the slide follows, per frame
  puff(ctx, SND.v.door.g, 'bandpass', 2600, 1.5, 0.6, 0.002, 0, 0.012); knock(ctx, 120, 0.18);
  puff(ctx, SND.v.door.g, 'highpass', 2000, 0.7, 0.16, 0.05, 0.15, 0.25);
}
function doorsHome(ctx){ knock(ctx, 85, 0.2); puff(ctx, SND.v.door.g, 'lowpass', 700, 0.7, 0.15, 0.004, 0, 0.03); }   // the leaves open, on their end stops

/* ---- per frame: levels follow the sim, places follow the camera */
function updateSound(dt){
  const ctx = SND.ctx; if (!ctx) return;
  const v = SND.v, now = ctx.currentTime, sp = S.speed, tgv = S.mode === 'tgv';
  // TGV events, followed while muted too so that unmuting does not replay them: doors starting to open from shut and reaching their stops, doors starting
  // to close, the train coming to rest, the planned stop near
  const reopen = tgv && v.doorsWas === false && S.doors, unlock = reopen && S.doorsF < 0.1, home = tgv && S.doors && v.doorsFWas < 1 && S.doorsF >= 1;
  const shut = tgv && v.doorsWas && !S.doors && S.doorsF > 0.3;
  if (reopen){ v.chimeAt = 0; if (v.closing) v.closing.gain.setTargetAtTime(0, now, 0.03); v.closing = null; }   // not leaving after all: no beeps, lock or welcome
  if (shut && v.atWas) v.chimeAt = now + 3.4;   // leaving a platform (as of the last frame: the kid's station button jumps ahead): the welcome announcement once the doors are locked
  v.doorsWas = S.doors; v.doorsFWas = S.doorsF; v.atWas = S.atStation;
  const depart = tgv && v.chimeAt > 0 && now >= v.chimeAt; if (v.chimeAt && now >= v.chimeAt) v.chimeAt = 0;
  const halt = tgv && v.run && sp < 0.02; if (sp > 1) v.run = true; else if (sp < 0.02) v.run = false;
  const arrive = tgv && S.autoStop && !v.arrived && tgvRemaining() < Math.max(400, 25 * sp); if (arrive) v.arrived = true; if (!S.autoStop) v.arrived = false;   // about half a minute out
  if (SND.muted) return;
  const set = (p, val) => p.setTargetAtTime(val, now, 0.12);
  const cam = camera.position, camR = _sv1.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const aim = (s, p, gain) => { p.sub(cam); const r = Math.max(0.5, p.length()); set(s.g.gain, gain(r)); set(s.pan.pan, 0.75 * _sc(p.dot(camR) / r, -1, 1)); return r; };   // p: where it is (scene), used up
  const two = tgv && tgvSets[1].group.visible, base2 = TGV.SET2_X + S.set2Off;
  const head = TGV.TIP_F, tail = tgv ? (two ? base2 : 0) + TGV.TIP_R : TGV.TIP_F - trainLen();
  const cx = _sc(cam.x, tail, head);   // our train's nearest point to the camera, in train coordinates
  curveLocal(cx, 0, 0, _sv2);
  const inside = cam.x > tail && cam.x < head && Math.hypot(cam.x - _sv2.x, cam.z - _sv2.z) < TGV.HALF_W - 0.05 && cam.y - _sv2.y > 0.7 && cam.y - _sv2.y < 4.4;
  set(v.body.frequency, inside ? 700 : 16000); set(v.bodyG.gain, inside ? 0.7 : 1);
  // power cars: the motors hum with the effort, the blowers run while the line breaker is closed; beyond 12 m a long car fades a little slower than a point
  const live = S.mode === 'diesel' ? S.engine === 'running' : S.vcb && S.dcN > 0.7, tr = _sc(S.tractionN, 0, 1);
  set(v.motor.gain, live ? (tgv ? 0.08 : 0.13) * (0.2 + 0.8 * tr) * Math.min(1, sp / 3) : 0);
  for (const o of v.mots) set(o.frequency, 20 + 2.6 * sp);
  const idle = tgv && S.vcb && v.idleS;   // the TGV's recorded blowers replace the synthesised ones
  set(v.blow.gain, S.mode !== 'diesel' && S.vcb && !idle ? 0.16 * S.dcN : 0);
  set(v.idle.gain, idle ? 0.15 * S.dcN : 0);
  // TGV inverters, from the motors' stator frequency f1 (speed, plus the slip under effort): at first a fixed switching tone with sidebands at +-2 f1, then
  // synchronous steps (switching at N f1, the pitch dropping at each lower N), then full wave from about 190 km/h, where the 6 f1 ripple is left
  const f1 = 1.51 * sp + (tr > 0.02 ? 1.2 : 0), N = f1 < 21 ? 0 : f1 < 30 ? 33 : f1 < 45 ? 21 : f1 < 60 ? 15 : f1 < 80 ? 9 : 1, fc = N ? N * f1 : 700;
  for (const [k, f, a] of [[0, fc - 2 * f1, N === 1 ? 0 : 0.5], [1, fc + 2 * f1, N === 1 ? 0 : 0.5], [2, Math.max(30, 6 * f1), N === 1 ? 0.8 : 0.25 * Math.min(1, f1 / 40)]]){
    v.invT[k].o.frequency.setTargetAtTime(f, now, 0.02); set(v.invT[k].g.gain, a);
  }
  set(v.inv.gain, tgv && live && tr > 0.02 ? 0.09 * (0.3 + 0.7 * tr) : 0);
  set(v.hum.gain, tgv && live && !S.dc ? 0.012 * (0.4 + 0.6 * tr) : 0);
  const pcs = tgv ? (two ? [0, TGV.REAR_PC, base2, base2 + TGV.REAR_PC] : [0, TGV.REAR_PC]) : [0];
  v.pc.forEach((s, i) => { if (i < pcs.length) aim(s, curveLocal(pcs[i], 1.6, 0, _sv2), r => (12 / Math.max(12, r)) ** 0.8); else set(s.g.gain, 0); });
  const rpm = S.mode === 'diesel' ? S.rpm : 0, rn = S.mode === 'diesel' ? S.rpmN : 0;
  set(v.diesel.g.gain, rpm > 50 ? 0.16 : 0); set(v.diesel.o.frequency, Math.max(20, rpm / 60 * 8)); set(v.dslLp.frequency, 180 + 260 * rn);
  set(v.turbo.g.gain, 0.006 * rn * rn); set(v.turbo.o.frequency, 1100 + 1300 * rn);
  // rolling and wind: a line of bogies, so it fades slower than a point
  const tun = ROUTE.kindAt(S.dist) === 2, tunMul = tun ? 1.6 : 1;   // a tunnel throws the noise back
  const kIn = tgv && inside && v.cabinS ? 1 : 0, cut = 1 - 0.8 * kIn * Math.min(1, sp / 30), vr = sp / 83;   // in a TGV coach the recording takes over as the speed builds
  if (tgv){   // welded rails, no joints: the rolling grows as v^1.5 and the wind as v^3, level with each other near 300 km/h
    set(v.rumble.g.gain, 0.3 * Math.min(1, sp / 30) * tunMul * cut);
    set(v.roll.g.gain, 0.42 * Math.min(1.2, vr ** 1.5) * tunMul * cut); set(v.roll.f.frequency, 350 + 12 * sp);
    set(v.aero.g.gain, 0.42 * Math.min(1.35, vr ** 3) * tunMul * cut); set(v.aero.f.frequency, 700 + 6 * sp);
  } else {
    set(v.rumble.g.gain, 0.36 * Math.min(1, sp / 30) * tunMul);
    set(v.roll.g.gain, 0.4 * Math.min(1, sp / 50) * tunMul); set(v.roll.f.frequency, 280 + 7 * sp);
    set(v.aero.g.gain, 0.3 * (sp / 89) ** 2 * tunMul);
  }
  set(v.cabin.gain, kIn * 0.75 * Math.min(1.15, vr) * tunMul);
  if (v.cabinS) set(v.cabinS.playbackRate, 0.72 + 0.33 * Math.min(1.1, vr));
  const sq = tgv && S.brakeN > 0.05 && sp > 0.15 && sp < 5 ? Math.min(1, (5 - sp) / 2) * Math.min(1, sp / 0.6) : 0;   // the disc brakes sing in the last metres
  v.squeal.forEach((s, i) => { set(s.g.gain, (i ? 0.006 : 0.012) * sq); s.o.frequency.setTargetAtTime((i ? 4150 : 6800) * (1 + 0.008 * Math.sin(now * (i ? 5.3 : 7))), now, 0.05); });
  aim(v.near, curveLocal(cx, 0.8, 0, _sv2), r => (6 / Math.max(6, r)) ** 0.55);
  aim(v.door, curveLocal(cx, 1.2, 0, _sv2), r => (8 / Math.max(8, r)) ** 0.7);
  const slide = tgv && S.doors && S.doorsF > 0.3 && S.doorsF < 1;   // the doors' last 2.1 s: the leaf slides along the body, its drive rising and falling
  set(v.slide.g.gain, slide ? 0.2 : 0); set(v.slideHum.g.gain, slide ? 0.02 : 0); set(v.slideHum.o.frequency, 140 + 60 * Math.sin(Math.PI * _sc((S.doorsF - 0.3) / 0.7, 0, 1)));
  if (halt) airSigh(ctx);
  if (unlock) doorsUnlock(ctx);
  if (home) doorsHome(ctx);
  if (shut) doorsClose(ctx);
  if (arrive || depart) chime(ctx, inside ? 1 : 0.6);
  const rain = !!WEATHER[weatherId].rain;
  set(v.rain.g.gain, rain ? 0.12 : 0);
  v.birdT -= dt;
  if (v.birdT <= 0){ v.birdT = 8 + Math.random() * 14; if (sp < 8 && !tun && !rain) bird(ctx); }   // now and then (one every 15 s on average) when slow, outdoors and dry
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
