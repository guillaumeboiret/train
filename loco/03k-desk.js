/* ---- the iPad's 3D cab ("I would like to have the 3D version of the cockpit … when he's in the cockpit, he's able to control the train from
   the iPad"): the remote (site/remote.html) shows this page in a frame, /playground/?desk, as the driver's desk alone. The TV runs the train
   and this page follows it: where it is and how fast (between two of the remote's states it runs on by itself), the lever, the pantograph,
   the doors, the train, the weather and the time. The desk's buttons, lever and screens send their commands through the remote, the lever
   moving here at once. Silent: the TV plays the sound */
const DESK = new URLSearchParams(location.search).has('desk') && window.parent !== window;
if (DESK){
  SND.off = true; document.body.classList.add('desk');
  document.head.insertAdjacentHTML('beforeend', '<style>body.desk .stage>:not(#c3d,#cabSay){display:none!important}</style>');
  const DK = { st:null, t:0, leverT:-1e9, horn:false, hornSt:false, run:true, stopped:false, lookT:0 };
  const post = m => window.parent.postMessage(m, location.origin), cmd = (c, v) => post({ desk:'cmd', c, v });

  /* the view: a step back and up from the driver's eyes, looking down on the screens, the buttons and the lever; a finger turns the head,
     which comes back by itself a second after */
  const POSE = { tgv:[0.4, 0.1, 0.1, -0.3], loco:[0.4, 0.2, -0.1, -0.3] }, pose = () => POSE[S.mode === 'tgv' ? 'tgv' : 'loco'];   // back, up, yaw, pitch
  const seated = CAMS.driver;
  CAMS.driver = () => {
    const v = seated(); if (S.mode !== 'tgv' && S.dir < 0) return v;   // a loco backing its wagons has no cab at the head: the remote shows its own buttons then
    const [b, u, yaw, pitch] = pose(); v.eye.x -= b; v.eye.y += u; return { ...v, yaw, pitch };
  };
  function lookBack(dt, now){
    const f = orbit.fp;
    if (orbit.ptrs.size){ DK.lookT = now; return; }
    if (f?.name !== 'driver' || f.t < 1 || now - DK.lookT < 1000 || S.mode !== 'tgv' && S.dir < 0) return;
    const [, , yaw, pitch] = pose(), k = Math.min(1, dt * 3);
    f.yaw += Math.atan2(Math.sin(yaw - f.yaw), Math.cos(yaw - f.yaw)) * k; f.pitch += (pitch - f.pitch) * k; orbit.fpZoom += (1 - orbit.fpZoom) * k;
  }

  /* ---- the desk: each press a command to the TV */
  const hornOn = on => {   // held: the button lit here, the TV sounding it as long as the remote says so
    if (on === DK.horn) return;
    DK.horn = on; if (on) horn.press(); else if (!DK.hornSt) horn.release();
    post({ desk:'horn', on });
  };
  for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, () => hornOn(false));
  Object.assign(cabActions, {
    lever(v){ S.notch = v; S.brake = v === 0 ? 4 : 0; DK.leverT = performance.now(); cmd('lever', v); },   // the TV's state catches up after
    horn(){ hornOn(true); }, panto(){ cmd('panto'); }, doors(){ cmd('doors'); }, next(){ cmd('next'); }, service(){ cmd('service'); },
    dir(d){ if (d !== S.dir) cmd('turn'); }, leave(){}, leverTip(){ cabSay(kt('lever_drag')); },
  });
  orbit.onClick = e => { if (!inCab) return; const st = cabRowAt(e); if (st){ cmd('station', st.id); cabSay(st.name); } };   // a stop on the line screen; no skip on the edges

  /* ---- following the TV */
  function deskState(st){   // a state from the TV: its train, its weather and its time at once; where it is, every frame (followHook)
    DK.st = st; DK.t = performance.now();
    if (st.mode !== S.mode && RM_MODES.includes(st.mode)) kidTrain(st.mode);
    if (Array.isArray(st.plan) && st.plan.length === 8 && st.plan.every(k => Object.hasOwn(WEATHER, k))) WX_PLAN.slots = st.plan.slice();
    WX_PLAN.auto = st.wx === 'auto'; if (Object.hasOwn(WEATHER, st.wx)) weatherId = st.wx;   // never setWeather: it would keep the TV's plan in this browser
    const m = /^(\d\d):(\d\d)$/.exec(st.clock || '');
    if (st.tod === 'now'){ if (!CLOCK.live) setClock(null); }
    else if (m){   // the TV's time picked by hand runs with its train: set again when this one is more than a minute and a half off
      const min = +m[1] * 60 + +m[2] + 0.5;
      if (CLOCK.live || Math.abs(((CLOCK.min - min) % 1440 + 2160) % 1440 - 720) > 1.5) setClock(min);
      CLOCK.pick = TOD.includes(st.tod) ? st.tod : null;
    }
    if (!!st.horn !== DK.hornSt){ DK.hornSt = !!st.horn; if (DK.hornSt) horn.press(); else if (!DK.horn) horn.release(); }
  }
  followHook = dt => {
    const st = DK.st, now = performance.now();
    if (!st){ simulate(dt); return; }
    S.battery = true; S.dir = st.dir < 0 ? -1 : 1; S.panto = !!st.panto; S.doors = !!st.doors && S.mode === 'tgv';
    if (now - DK.leverT > 1000){ S.notch = clamp(st.notch | 0, 0, 8); S.brake = clamp(st.brake | 0, 0, 8); }
    const d0 = S.dist; S.autoStop = S.service = false; simulate(dt);   // the needles, the pantographs, the engine: this train's own, its autopilot never at the lever
    const v = Math.max(0, +st.v || 0), age = Math.min(1, (now - DK.t) / 1000), run = age < 1 ? v : 0, want = (+st.s || 0) + v * S.dir * age;   // nothing heard for a second: it waits there
    S.speed = run; S.dist = d0 + run * S.dir * dt;
    const e = want - S.dist;
    if (Math.abs(e) > 30) jumpTo(want);   // a jump on the TV (a station, the line), or this page shown again
    else S.dist = clamp(S.dist + e * Math.min(1, dt * 1.5), 8 + tailLen(), ROUTE.L - 15.5);
    S.speed = run; S.autoStop = !!st.auto; S.service = !!st.svc;   // the desk's Next stop lit as on the TV
    lookBack(dt, now);
  };
  const frames = loop;
  loop = now => { if (DK.run) frames(now); else DK.stopped = true; };   // hidden on the iPad: no frame drawn
  function pause(on){ DK.run = !on; if (!on && DK.stopped){ DK.stopped = false; requestAnimationFrame(loop); } }
  addEventListener('message', e => {
    if (e.source !== window.parent || e.origin !== location.origin) return;
    const m = e.data; if (!m || typeof m !== 'object') return;
    if (m.desk === 'state' && m.st && typeof m.st === 'object') deskState(m.st);
    else if (m.desk === 'pause') pause(!!m.on);
    else if (m.desk === 'lang' && (m.l === 'fr' || m.l === 'en') && m.l !== S.lang){ setLang(m.l); kidLang(); }
  });
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, e => e.preventDefault());   // no page zoom under two fingers: they zoom the view
  flyPreset('driver'); orbit.fp.t = 1;
  Object.assign(window.locoDebug, { DK, cabRowAt });
  post({ desk:'ready' });
}
