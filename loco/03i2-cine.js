
/* ============================================================ CINEMA (kid build, after the kid layer): the 🎬 view, for long trips */
/* "movie-like movements that can switch from the outside to the inside", "the camera movement for long term travels", "a wallpaper for the
   whole line". A director cuts every 9 to 16 s (from the ground, as the train goes by or pulls in, longer) between shots riding with the train (ahead of its nose, along its side, from the air, low by
   the rails, chasing it, a crane rising off it), shots from the ground (beside the line as it goes by, on the platform it pulls into, at the
   door that opens) and shots inside (from the driver's seat, from a window seat, down an aisle). Riding shots glide into one another,
   the others cut through black. A drag, a pinch, the wheel, a key or Esc hands the camera back where it is (inside: to the driver's seat or
   the passenger's); a tap on 🎬 cuts to the next shot */
const CN_DEG = Math.PI / 180, CN_GLIDE = 2.5, CN_OUT = 0.35, CN_IN = 0.5, CINE_FOV = orbit.fov;   // s: a glide between riding shots, a cut's fade to black and back
const CINE = { sh:null, prev:null, gl:1, ph:'run', next:null, fade:0, fo:-1, last:'', chk:0, lastDist:0, lastDir:1, lastMode:'', platS:NaN, doorS:-Infinity, wT:new THREE.Vector3(), fp:null };   // sh the shot, prev the one it glides from (gl 0..1), ph run, out (to black, then next) or in
const _cnE = new THREE.Vector3(), _cnT = new THREE.Vector3(), _cnE2 = new THREE.Vector3(), _cnT2 = new THREE.Vector3(), _cnV = new THREE.Vector3(), _cnS = new THREE.Spherical(), _cnS2 = new THREE.Spherical();
const cnEnds = () => { const f = S.mode === 'tgv' ? TGV.TIP_F : 10.2, r = -tailLen(); return S.dir > 0 ? { f, r, head:f, tail:r } : { f, r, head:r, tail:f }; };   // the train's ends in its own x, and which one leads
function cnKd(s0, s1, test){ const i1 = ROUTE.idx(Math.min(ROUTE.L, Math.max(s0, s1))); for (let i = ROUTE.idx(Math.max(0, Math.min(s0, s1))); i <= i1; i++) if (test(ROUTE.KD[i])) return true; return false; }   // a kind of line between s0 and s1 (2 a tunnel, 1 and 4 a bridge)
const cnRoof = (s0, s1) => ROOF_Z.some(z => Math.max(s0, s1) > z[0] && Math.min(s0, s1) < z[1]);   // a station's slab or shed over the line
const cnStation = (s0, s1) => ROUTE.stations.some(st => s1 > st.s - 650 && s0 < st.s + 250);       // a station's platforms, canopies and posts, from its approach to its far end
const cnRail = () => CP.G.rail[CP.lo] + (CP.G.rail[CP.hi] - CP.G.rail[CP.lo]) * CP.t;            // after camPlace: the rails' height there
const cnScene = (P, out) => out.copy(P).sub(P_loco).applyQuaternion(qInv);                       // a point of the route, where it is in the scene now
function cnSide(){ const w = laneMix(S.dist); return Math.abs(w) > 0.5 ? Math.sign(w) : Math.random() < 0.5 ? -1 : 1; }   // across the line: away from the other track
function cnOut(close){   // the train and what it meets within 8 s out in the open: no tunnel, no slab or shed over it; close: nor a station, whose canopies and posts stand where a camera at its side would
  const e = cnEnds(), ah = S.dist + e.head + S.dir * Math.max(200, S.speed * 8), a = Math.min(S.dist + e.r, ah) - 40, b = Math.max(S.dist + e.f, ah) + 40;
  if (cnKd(a, b, k => k === 2) || cnRoof(a, b)) return false;
  return !close || !cnStation(a - 20, b + 20);
}
function cnLowOk(sh){   // the low shot: in the open, on no bridge for the next 2 s, the ground beside the rails at their height
  if (!cnOut(true)) return false;
  const e = cnEnds(), d = S.dir, h = S.dist + e.head;
  if (cnKd(h + d * 15, h + d * (40 + S.speed * 2), k => k === 1 || k === 4)) return false;
  return camPlace(curveLocal(e.head + d * 27, 1.0, sh.sd * 2.5, _cnV)) && Math.abs(CP.yG - cnRail()) < 2;
}
function cnPassMake(sh){   // a spot beside the line ahead that the train reaches in about 4.5 s, on ground near the rails' height, in the open all the way there
  const e = cnEnds(), d = S.dir, h = S.dist + e.head, sc = h + d * THREE.MathUtils.clamp(S.speed * 4.5, 50, 400);
  if (sc < 200 || sc > ROUTE.L - 200 || cnStation(sc - 20, sc + 20) || cnKd(h, sc + d * 60, k => k === 2) || cnRoof(h, sc + d * 60)) return false;
  if (S.autoStop && (S.stopS + e.head - sc) * d < 30) return false;   // the autopilot stops it short of the spot
  for (const k of [sh.sd, -sh.sd]){
    if (!camPlace(curveLocal(sc - S.dist, 0, k * (14 + 6 * Math.random()), _cnV)) || Math.abs(CP.yG - cnRail()) > 6) continue;
    sh.P = _fx.clone(); sh.P.y = CP.yG + 1.8; sh.sc = sc; sh.xs = NaN;   // standing there, the eye 1.8 m over the ground
    return true;
  }
  return false;
}
const cnLens = (E, T, half = 25) => THREE.MathUtils.clamp(2 * Math.atan(half / E.distanceTo(T)) / CN_DEG, 12, 45);   // a ground camera far off zooms in: 2 half m of view across what it looks at (50 m unless told)
function cnPassPose(sh, u, E, T, dt){   // from the spot: the head coming, the cars going by, the tail going away
  const e = cnEnds(), want = THREE.MathUtils.clamp(sh.sc - S.dist + S.dir * 15, e.r + 5, e.f - 5);
  sh.xs = isNaN(sh.xs) ? want : sh.xs + (want - sh.xs) * (1 - Math.exp(-4 * dt));
  cnScene(sh.P, E); curveLocal(sh.xs, 2.4, 0, T); return cnLens(E, T);
}
const cnPlatSt = () => S.autoStop && ROUTE.stations.find(st => Math.abs(st.s - TGV.PLAT_FRONT - S.stopS) < 1);   // the station the autopilot stops at (cabTarget without its fallback)
function cnPlatOk(){ const r = tgvRemaining(); return S.speed > 3 && S.stopS !== CINE.platS && r > 40 && r < 350 && !!cnPlatSt(); }   // pulling in: once a stop
function cnPlatMake(sh){   // on the platform's edge 18 m past where the head will stop (at a buffer stop, short of it), looking down the line at the train coming in over the heads of those waiting
  const st = cnPlatSt(), d = S.dir, hx = S.stopS + cnEnds().head, sc = hx + d * Math.min(18, (d > 0 ? ROUTE.L - hx : hx) - 1);
  sh.P = curveLocal(sc - S.dist, 3.6, st.side * 3.6, new THREE.Vector3()).applyQuaternion(F0.q).add(P_loco); CINE.platS = S.stopS;
  return true;
}
function cnPlatPose(sh, u, E, T, dt){   // the nose followed in; the shot ends 4 s after the train stands
  if (S.speed < 0.05 && !S.autoStop) sh.still += dt;
  cnScene(sh.P, E); curveLocal(cnEnds().head - S.dir * 8, 2.6, 0, T); return cnLens(E, T, 10);   // head on, the nose and a car fill the view
}
const cnDoorsDue = () => Math.abs(S.dist - CINE.doorS) >= 50 && CN.doors.ok();   // doors open at a stop not filmed yet
function cnCoach(){ const cs = tgvSets[0].coaches, pool = cs.map((c, i) => i).filter(i => !cs[i].bar); return pool[Math.floor(Math.random() * pool.length)]; }   // any coach but the bar
const CN = {   // the shots: att rides with the train, in is inside (first person), the others stand on the ground; w how often, d about how long (s)
  nose:{ att:true, w:1, d:12, ok:() => cnOut(true), pose(sh, u, E, T){   // ahead of the leading nose, swinging round to its side
    const e = cnEnds(), d = S.dir, R = (S.mode === 'tgv' ? 16 : 12) * (1 + 0.25 * u), a = (40 + 35 * u) * CN_DEG, x = e.head - d * 3;
    curveLocal(x, 2.2, 0, T); curveLocal(x + d * R * Math.cos(a), 2.5 + 2 * u, sh.sd * R * Math.sin(a), E); return CINE_FOV; } },
  track:{ att:true, w:1, d:14, ok:() => cnOut(true), pose(sh, u, E, T){   // along its side, from the head back
    const d = S.dir, x = cnEnds().head - d * (S.mode === 'tgv' ? 10 + 40 * u : 5 + 30 * u);
    curveLocal(x, 3.2, sh.sd * 12, E); curveLocal(x + d * 8, 2.4, 0, T); return CINE_FOV; } },
  aerial:{ att:true, w:1, d:14, ok:() => cnOut(false), pose(sh, u, E, T){   // from the air, rising as the train draws ahead under it
    const e = cnEnds(), d = S.dir, m = (e.f + e.r) / 2;
    curveLocal(m + d * (60 - 40 * u), 55 + 15 * u, sh.sd * (60 + 15 * u), E); curveLocal(m + d * 30, 0, 0, T); return CINE_FOV; } },
  low:{ att:true, w:1, d:10, ok:cnLowOk, pose(sh, u, E, T){   // low by the rails ahead of it, inside the masts (they sweep by at the frame's edge), the ballast rushing by
    const e = cnEnds(), d = S.dir;
    curveLocal(e.head + d * (34 - 14 * u), 1.0, sh.sd * 2.5, E); curveLocal(e.head - d * 10, 2.4, 0, T); return CINE_FOV; } },
  chase:{ att:true, w:1, d:12, ok:() => cnOut(false), pose(sh, u, E, T){   // behind it and over, following
    const e = cnEnds(), d = S.dir;
    curveLocal(e.tail - d * (25 + 10 * u), 9 + 7 * u, sh.sd * (2 + 4 * u), E); curveLocal(e.tail + d * 60, 2, 0, T); return CINE_FOV; } },
  reveal:{ att:true, w:1, d:12, ok:() => cnOut(true), pose(sh, u, E, T){   // a crane: from beside the first car, up and away
    const d = S.dir, x = cnEnds().head - d * 20, R = 9 * (55 / 9) ** u, el = (10 + 15 * u) * CN_DEG, az = 100 * CN_DEG, h = R * Math.cos(el);
    curveLocal(x, 2.4, 0, T); curveLocal(x + d * h * Math.cos(az), 2.4 + R * Math.sin(el), sh.sd * h * Math.sin(az), E); return CINE_FOV; } },
  pass:{ w:2, d:28, ok:sh => S.speed > (sh.P ? 3 : 8) && (sh.P || cnOut(false)), make:cnPassMake, pose:cnPassPose,
    end:sh => (sh.sc - S.dist - cnEnds().tail) * S.dir < -50 },
  platform:{ w:0, d:40, ok:sh => !!sh.P || cnPlatOk(), make:cnPlatMake, pose:cnPlatPose, end:sh => sh.still >= 4 || (!S.autoStop && S.speed > 3) },   // the child took the lever: gone by
  doors:{ w:1, d:12, ok:() => S.mode === 'tgv' && S.speed < 0.1 && S.doorsF > 0.3 && Math.abs(stationOffset()) < 30, make:() => { CINE.doorS = S.dist; return true; }, pose(sh, u, E, T){   // on the platform by coach 1's door (CAMS.door), drifting in
    const x = TGV.TRAILERS[0][0] + TR.doorX, k = nearestStation().side;
    curveLocal(x + 7 - 2.5 * u, 2.9, 6 * k, E); curveLocal(x, 1.7, 1.5 * k, T); return CINE_FOV; } },
  cab:{ in:true, w:1, d:14, ok:() => true, make:sh => !!(sh.obj = driverSeat()), look(sh, u, f){   // in the driver's place, the look drifting across the line coming
    const v = driverView(); f.eye.copy(v.eye); f.yaw = v.yaw + 0.12 - 0.24 * u; f.pitch = v.pitch; } },
  window:{ in:true, w:1, d:14, ok:() => S.mode === 'tgv', make(sh){   // a window seat upstairs facing the way the train runs, the look turning out to the landscape
    const ci = cnCoach(), c = tgvSets[0].coaches[ci], seat = c.view[2 + (S.dir < 0 ? 1 : 0)];
    if (seat === undefined) return false;
    Object.assign(sh, { ci, seat, obj:c.g }); return true; },
    look(sh, u, f){ const c = tgvSets[0].coaches[sh.ci], i = sh.seat, k = c.face[i], z = c.seat[3 * i + 2];
      f.eye.set(c.seat[3 * i] + 0.12 * k, c.seat[3 * i + 1] + 1.16, z - Math.sign(z) * 0.3); f.yaw = (k > 0 ? 0 : Math.PI) - Math.sign(z) * k * (0.6 + 0.6 * u); f.pitch = -0.1; } },   // leaning toward the aisle: the window whole, not its pillar
  aisle:{ in:true, w:0.6, d:12, ok:() => S.mode === 'tgv' && S.speed > 1, make(sh){   // down the upper aisle toward the front, at a slow walk
    const ci = cnCoach(), c = tgvSets[0].coaches[ci];
    Object.assign(sh, { ci, x0:3.6 + Math.random() * Math.max(0, c.L - 9.5), obj:c.g }); sh.ax = sh.x0; return true; },
    look(sh, u, f){ const c = tgvSets[0].coaches[sh.ci]; sh.ax = sh.x0 + 5.5 * (S.dir > 0 ? u : 1 - u); f.eye.set(c.xr + sh.ax, DECK.up + WALK_EYE, 0); f.yaw = S.dir > 0 ? 0 : Math.PI; f.pitch = -0.05; } },
};
const CN_HOLD = { att:true, pose:(sh, u, E, T) => { E.copy(sh.E0); T.copy(sh.T0); return CINE_FOV; } };   // where the camera was outside, for the first glide
function cnMake(name){   // a shot of that kind, if it can be taken now
  const def = CN[name], sh = { n:name, def, t:0, d:def.d * (0.85 + 0.3 * Math.random()), sd:cnSide(), still:0 };
  return def.ok(sh) && (!def.make || def.make(sh)) ? sh : null;
}
function cnPick(){   // the platform the train pulls into, then the door opening there, else any shot that can be taken, rarely the same twice running; near a tunnel, mostly the cab
  if (cnPlatOk()){ const sh = cnMake('platform'); if (sh) return sh; }
  if (cnDoorsDue()){ const sh = cnMake('doors'); if (sh) return sh; }
  const tun = tunnelNear(S.dist + cnEnds().head, 300), skip = new Set([CINE.last]);
  for (let pass = 0; pass < 2; pass++, skip.clear()){
    for (;;){
      let pick = null, tot = 0;
      for (const n in CN){ const w = CN[n].w * (n === 'cab' && tun ? 3 : 1); if (!w || skip.has(n)) continue; tot += w; if (Math.random() * tot < w) pick = n; }
      if (!pick) break;
      const sh = cnMake(pick); if (sh) return sh;
      skip.add(pick);
    }
  }
  return cnMake('cab');
}
function cnNext(sh){   // on to shot sh: a riding shot glides into a riding shot, anything else cuts through black
  if (!sh) return;
  const cur = CINE.sh;
  if (cur?.def.att && sh.def.att && CINE.gl >= 1 && CINE.ph === 'run'){ CINE.prev = cur; CINE.gl = 0; cnSet(sh); return; }
  CINE.next = sh; CINE.ph = 'out';
}
function cnSet(sh){   // shot sh takes the camera: inside, the eye rides its car (no glide in); outside, the orbit is free
  CINE.sh = sh; CINE.last = sh.n; CINE.chk = 1;
  if (sh.def.in){ orbit.look(sh.obj, new THREE.Vector3(), 0, 0); orbit.fp.name = 'cine'; orbit.fp.t = 1; CINE.fp = orbit.fp; }
  else { orbit.fp = null; CINE.fp = null; }
}
function cnBlend(Ea, Ta, Eb, Tb, b){   // pose a to pose b, into b: the target in a straight line, the eye round it (distance, height and bearing eased apart)
  _cnS.setFromVector3(_cnV.subVectors(Ea, Ta)); _cnS2.setFromVector3(_cnV.subVectors(Eb, Tb));
  let dth = _cnS2.theta - _cnS.theta; dth -= Math.round(dth / (2 * Math.PI)) * 2 * Math.PI;
  _cnS2.radius = _cnS.radius * (_cnS2.radius / _cnS.radius) ** b; _cnS2.phi = _cnS.phi + (_cnS2.phi - _cnS.phi) * b; _cnS2.theta = _cnS.theta + dth * b;
  Tb.lerpVectors(Ta, Tb, b); Eb.setFromSpherical(_cnS2).add(Tb);
}
function cnApply(dt, snap){   // the camera where the shot puts it (gliding from the last one); snap: just cut, the lens too at once
  const sh = CINE.sh; if (!sh) return;
  if (sh.def.in){
    sh.def.look(sh, sh.t / sh.d, orbit.fp);
    if (snap){ camera.fov = fpFov(camera.aspect) * orbit.fpZoom; camera.updateProjectionMatrix(); }
    return;
  }
  let fov = sh.def.pose(sh, sh.t / sh.d, _cnE, _cnT, dt);
  if (CINE.prev){
    const p = CINE.prev, f0 = p.def.pose(p, p.t / p.d, _cnE2, _cnT2, dt), b = CINE.gl * CINE.gl * (3 - 2 * CINE.gl);
    cnBlend(_cnE2, _cnT2, _cnE, _cnT, b); fov = f0 + (fov - f0) * b;
  }
  orbit.target.copy(_cnT); orbit.tTarget.copy(_cnT); orbit.sph.setFromVector3(_cnV.subVectors(_cnE, _cnT)); orbit.tSph.copy(orbit.sph); orbit.fov = fov; CINE.wT.copy(_cnT);
  if (snap){ OVER.lift = 0; OVER.hold = 0; camera.fov = fov; camera.updateProjectionMatrix(); }   // a building lift was the last place's
}
function cnFade(){ const o = Math.round(CINE.fade * 50) / 50; if (o !== CINE.fo){ CINE.fo = o; $('kidFade').style.opacity = o; } }
function cineTick(dt){
  if (!kidCine) return;
  if ((orbit.ptrs.size && orbit.moved >= 6) || (keys.size && !(keys.size === 1 && keys.has('shift')))){ cineOff(true); return; }   // a drag, a pinch, a key: the camera is theirs
  let snap = false;
  const jump = Math.abs(S.dist - CINE.lastDist) > 200 || S.dir !== CINE.lastDir || S.mode !== CINE.lastMode;   // a jump along the line, a turn round, another train: black at once, then a new shot
  CINE.lastDist = S.dist; CINE.lastDir = S.dir; CINE.lastMode = S.mode;
  if (jump){ Object.assign(CINE, { fade:1, ph:'in', prev:null, gl:1, next:null }); cnSet(cnPick()); snap = true; }
  else if (CINE.sh && (CINE.sh.def.in ? orbit.fp !== CINE.fp : orbit.fp || orbit.tTarget.distanceToSquared(CINE.wT) > 1e-6)){ cineOff(); return; }   // something else took the camera (a view button, the guide's arrows): let it
  const sh0 = CINE.sh;
  if (sh0 && CINE.ph !== 'out' && (CINE.chk -= dt) <= 0){   // each second: a train pulling in or doors opening come first; a shot that can no longer be taken ends
    CINE.chk = 1;
    if (sh0.n !== 'platform' && cnPlatOk()) cnNext(cnMake('platform'));
    else if (sh0.n !== 'platform' && sh0.n !== 'doors' && cnDoorsDue()) cnNext(cnMake('doors'));
    else if (!sh0.def.ok(sh0)) cnNext(cnPick());
  }
  if (CINE.ph === 'out' && (CINE.fade = Math.min(1, CINE.fade + dt / CN_OUT)) >= 1){ cnSet(CINE.next); Object.assign(CINE, { next:null, prev:null, gl:1, ph:'in' }); snap = true; }
  else if (CINE.ph === 'in' && (CINE.fade = Math.max(0, CINE.fade - dt / CN_IN)) <= 0) CINE.ph = 'run';
  const sh = CINE.sh;
  if (sh){
    sh.t += dt;
    if (CINE.prev){ CINE.prev.t += dt; if ((CINE.gl = Math.min(1, CINE.gl + dt / CN_GLIDE)) >= 1) CINE.prev = null; }
    if (CINE.ph === 'run' && CINE.gl >= 1 && (sh.t >= sh.d || sh.def.end?.(sh))) cnNext(cnPick());
    cnApply(dt, snap);
  }
  cnFade();
}
function cineOn(){   // 🎬: X-ray off (the train whole, as inside), the first shot glides in from outside or cuts in from a seat
  kidCine = true;
  if (shellLevel < 1){ setShell(1); $('kidXray').setAttribute('aria-pressed', 'false'); }
  Object.assign(CINE, { sh:null, prev:null, gl:1, ph:'run', next:null, fade:0, last:'', lastDist:S.dist, lastDir:S.dir, lastMode:S.mode, fp:null });
  const sh = cnPick();
  if (!orbit.fp && sh.def.att){ CINE.prev = { def:CN_HOLD, t:0, d:1, E0:camera.position.clone(), T0:orbit.target.clone() }; CINE.gl = 0; cnSet(sh); }
  else cnNext(sh);
}
function cineOff(hand){   // hand: they took the camera (a drag, the wheel, a key, Esc): outside it stays where it is; inside, the driver's seat or the passenger's, looking the same way
  if (!kidCine) return;
  kidCine = false;
  const sh = CINE.sh, ours = sh?.def.in && orbit.fp === CINE.fp;
  Object.assign(CINE, { sh:null, prev:null, next:null, ph:'run', fade:0, fp:null }); cnFade();
  orbit.fov = CINE_FOV;
  if (!ours) return;
  if (!hand) orbit.free();   // the caller moves the camera next
  else if (sh.n === 'cab') kidView('driver');
  else cnToWalker(sh);
}
function cnToWalker(sh){   // from a window seat or the aisle, the passenger there: seated in that seat, or standing in the aisle, the look kept
  const cs = tgvSets[0].coaches, old = cs[WK.i], { yaw, pitch } = orbit.fp;
  if (WK.seat >= 0) old.occ[WK.seat] = 0;
  if (WK.stool >= 0) old.bar.taken[WK.stool] = 0;
  Object.assign(WK, { on:true, back:true, i:sh.ci, seat:-1, stool:-1 });
  if (sh.n === 'window') walkSit(sh.seat);
  else { const c = cs[sh.ci]; Object.assign(WK, { x:sh.ax, y:DECK.up, ey:DECK.up, z:0 }); orbit.look(c.g, new THREE.Vector3(c.xr + sh.ax, DECK.up + WALK_EYE, 0), yaw, pitch); orbit.fp.name = 'walk'; }
  Object.assign(orbit.fp, { yaw, pitch, t:1 }); WK.yaw = yaw; WK.pitch = pitch;
}
function cineSkip(){ if (kidCine && CINE.ph === 'run') cnNext(cnPick()); }   // 🎬 again: the next shot
function cineShot(name){   // tests: that shot at once, no fade; false if it cannot be taken now
  if (!kidCine) cineOn();
  const sh = cnMake(name); if (!sh) return false;
  Object.assign(CINE, { prev:null, gl:1, ph:'run', next:null, fade:0, lastDist:S.dist, lastDir:S.dir, lastMode:S.mode }); cnSet(sh); cnApply(0, true); cnFade();
  return true;
}
canvas.addEventListener('wheel', () => { if (kidCine) cineOff(true); }, { passive:true });   // after the orbit's own: the zoom it made stays
window.addEventListener('keydown', e => { if (kidCine && e.key === 'Escape' && !e.target.matches('input,textarea,select')) cineOff(true); });
{ const f0 = frameHook; frameHook = dt => { f0?.(dt); cineTick(dt); }; }
Object.assign(window.locoDebug, { cineOn, cineOff, cineSkip, cineShot, CINE, CN });
