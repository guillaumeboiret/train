
/* ============================================================ SOUND: one AudioContext shared by the horn, the train, the weather and the other trains */
/* Browsers keep audio silent until the first tap or key: the context is created then, and everything below is quiet until it exists. */
const SND = { ctx:null, master:null, muted:false, v:null,
  setMuted(m){ SND.muted = m; if (SND.master) SND.master.gain.setTargetAtTime(m ? 0 : 0.9, SND.ctx.currentTime, 0.05); } };
const _sc = (v, a, b) => Math.max(a, Math.min(b, v));
const _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3();
function audioCtx(){
  if (SND.ctx) return SND.ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const ctx = new AC(); SND.ctx = ctx;
  const master = ctx.createGain(); master.gain.value = SND.muted ? 0 : 0.9; master.connect(ctx.destination); SND.master = master;
  // a 2 s loop of white noise feeds every hiss: rolling, rumble, wind, rain and the other trains
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true; noise.start();
  const chain = (type, freq, q, dest = master) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; noise.connect(f); f.connect(g); g.connect(dest); return { f, g }; };
  const osc = (type, freq, dest = master) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(dest); o.start(); return { o, g }; };
  const v = SND.v = { roll:chain('bandpass', 320, 0.6), rumble:chain('lowpass', 110, 0.7), wind:chain('highpass', 1600, 0.5), rain:chain('highpass', 3200, 0.5), opp:[], birdT:2 };
  const wlp = ctx.createBiquadFilter(); wlp.type = 'lowpass'; wlp.frequency.value = 2600; wlp.connect(master);   // electric: inverter whine, pitch follows the speed
  v.whine = osc('sawtooth', 200, wlp); v.whine2 = osc('sawtooth', 300, wlp);
  const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 380; dlp.Q.value = 1.2; dlp.connect(master); v.dslLp = dlp;   // diesel: firing pulses + turbo whistle
  v.diesel = osc('sawtooth', 60, dlp); v.turbo = osc('sine', 2000);
  for (const o of opp){   // the other trains: a hiss each, panned where the train is seen; their horn plays into the same panner
    const pan = ctx.createStereoPanner(); pan.connect(master);
    const c = chain('bandpass', 420, 0.5, pan);
    v.opp.push({ o, pan, f:c.f, g:c.g, horn:null });
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
  pan.pan.value = Math.random() * 1.6 - 0.8; o.type = 'sine'; o.connect(g); g.connect(pan); pan.connect(SND.master);
  const n = 2 + Math.floor(Math.random() * 4), base = 2400 + Math.random() * 1400, d = 0.09 + Math.random() * 0.06;
  g.gain.setValueAtTime(0, t0);
  for (let i = 0; i < n; i++){
    const t = t0 + i * d * 1.6;
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.45, t + d * 0.5); o.frequency.linearRampToValueAtTime(base * 1.1, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.01); g.gain.setValueAtTime(0.045, t + d - 0.02); g.gain.linearRampToValueAtTime(0, t + d);
  }
  o.start(t0); o.stop(t0 + n * d * 1.6 + 0.1);
}
function oppHorn(vo, att, dop){   // "tuu-tuuu": a high then a low note, our chord recipe, pitched by the Doppler factor, placed in that train's panner
  const ctx = SND.ctx, t0 = ctx.currentTime, g = ctx.createGain(); g.gain.value = 0.5 * att;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; g.connect(lp); lp.connect(vo.pan);
  for (const [f, st, len] of [[392, 0, 0.45], [311, 0.5, 0.75]]) for (const [r, type, gg] of [[1, 'sawtooth', 0.42], [1.19, 'sawtooth', 0.42], [2, 'square', 0.06], [2.38, 'square', 0.06]]){
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * r * dop; const og = ctx.createGain();
    og.gain.setValueAtTime(0, t0 + st); og.gain.linearRampToValueAtTime(gg, t0 + st + 0.05); og.gain.setValueAtTime(gg, t0 + st + len - 0.1); og.gain.linearRampToValueAtTime(0, t0 + st + len);
    o.connect(og); og.connect(g); o.start(t0 + st); o.stop(t0 + st + len + 0.05);
  }
  vo.horn = { g, until:t0 + 1.4 };
}

/* ---- per frame: levels follow the sim */
function updateSound(dt){
  const ctx = SND.ctx; if (!ctx || SND.muted) return;
  const v = SND.v, now = ctx.currentTime, sp = S.speed, set = (p, val) => p.setTargetAtTime(val, now, 0.12);
  const tun = ROUTE.kindAt(S.dist) === 2, tunMul = tun ? 1.6 : 1;   // a tunnel throws the noise back
  set(v.roll.g.gain, 0.32 * Math.min(1, sp / 55) * tunMul); set(v.roll.f.frequency, 250 + 3 * sp);
  set(v.rumble.g.gain, 0.3 * Math.min(1, sp / 30) * tunMul);
  set(v.wind.g.gain, 0.3 * Math.min(1, (sp / 90) ** 2));
  const elec = S.mode !== 'diesel', tr = _sc(S.tractionN, 0, 1), fw = 180 + 6 * sp;
  set(v.whine.g.gain, elec ? 0.09 * tr : 0); set(v.whine2.g.gain, elec ? 0.04 * tr : 0);
  set(v.whine.o.frequency, fw); set(v.whine2.o.frequency, fw * 1.5);
  const rpm = S.mode === 'diesel' ? S.rpm : 0, rn = S.mode === 'diesel' ? S.rpmN : 0;
  set(v.diesel.g.gain, rpm > 50 ? 0.2 : 0); set(v.diesel.o.frequency, Math.max(20, rpm / 60 * 8)); set(v.dslLp.frequency, 250 + 300 * rn);
  set(v.turbo.g.gain, 0.02 * rn * rn); set(v.turbo.o.frequency, 1800 + 3200 * rn);
  const rain = !!WEATHER[weatherId].rain;
  set(v.rain.g.gain, rain ? 0.14 : 0);
  v.birdT -= dt;
  if (v.birdT <= 0){ v.birdT = 1.2 + Math.random() * 3; if (sp < 8 && !tun && !rain) bird(ctx); }   // birds when slow, outdoors and dry
  const camR = _sv1.set(1, 0, 0).applyQuaternion(camera.quaternion);
  for (const vo of v.opp){
    const o = vo.o;
    if (!o.active){ set(vo.g.gain, 0); vo.horn = null; continue; }
    const lo = o.dir < 0 ? o.s : o.s - 200, hi = lo + 200, ourS = S.dist + camera.position.x;   // the train is a 200 m segment: the nearest point speaks
    const sN = _sc(ourS, lo, hi), along = sN - ourS;
    curveLocal(sN - S.dist, 2.5, ROUTE.laneW(o.lane, sN) - laneMix(sN), _sv2); _sv2.sub(camera.position);
    const r = Math.max(8, _sv2.length()), att = 1 / (1 + (r / 140) ** 2);
    const vRad = Math.sign(along || 1) * (o.v * o.dir - sp * S.dir), dop = 340 / Math.max(120, 340 + vRad);   // radial speed: negative when closing
    set(vo.g.gain, 0.8 * Math.min(1, o.v / 60) * att); set(vo.f.frequency, 420 * dop);
    set(vo.pan.pan, _sc(_sv2.normalize().dot(camR), -1, 1));
    if (!o.horned && vRad < -20 && r < 650){ o.horned = true; oppHorn(vo, att, dop); }
    if (vo.horn){ if (now > vo.horn.until) vo.horn = null; else vo.horn.g.gain.setTargetAtTime(0.5 * att, now, 0.05); }
  }
}
