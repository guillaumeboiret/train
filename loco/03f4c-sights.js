
/* ------------------------------------------------------------ landmarks seen from the line
   The Golfech cooling towers, the Passerelle Eiffel, the Flèche Saint-Michel, the Pont Chaban-Delmas, the Cité du Vin and the Pont d'Aquitaine
   in Bordeaux, Angoulême cathedral, the Futuroscope, the Tour Triangle and the Eiffel Tower. Each stands where OpenStreetMap maps it
   (ROUTE_DATA.sights, baked by route/build_route.py: [E, N, DEM height, s, w] per key point), its shape simplified from published dimensions.
   One group per landmark hangs in `world`, shown within its range and placed relative to the loco each frame like the wind turbines; above the
   ground its haze is lighter still than theirs, so the Eiffel Tower shows 5 km out, and it fades into the fog at the edge of its range. Trees, houses and city blocks keep off
   (sightClear, in buildChunk). Local frame of a landmark: x east, y up, z south, from the ground under its first key point. */
const sightAt = (id, k) => { const [E, N, el, s, w] = ROUTE_DATA.sights[id][k]; return { x:E, y:Math.abs(w) < 1000 ? ROUTE.terAt(s, w) : el, z:-N, s, w }; };   // on the ground as drawn near the line, further out on the DEM
const SIGHT_LIFT0 = { value:0 };
function sightHaze(sh, fade, lift){   // the wind turbines' fog with a thinner haze: the scene's at the foot, 2.5 times lighter than theirs higher up; `fade` hides the landmark at the edge of its range
  sh.uniforms.uSightFade = fade; sh.uniforms.uSightLift = lift;
  sh.vertexShader = 'uniform float uSightLift;\nvarying float vSightH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSightH = transformed.y + uSightLift;');
  sh.fragmentShader = 'uniform float uSightFade;\nvarying float vSightH;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
    float fG = smoothstep(fogNear, fogFar, vFogDepth), fH = 1.0 - exp(-max(0.0, vFogDepth - fogNear) / (6.0 * (fogFar - fogNear)));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, max(mix(fG, min(fG, fH), smoothstep(6.0, 50.0, vSightH)), uSightFade));
  #endif`);
}
function sightGeo(parts){   // like mergeGeos, for indexed and non-indexed parts alike; the parts are disposed
  let nv = 0, ni = 0;
  for (const p of parts){ const n = p.attributes.position.count; nv += n; ni += p.index ? p.index.count : n; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, i = 0;
  for (const p of parts){
    const n = p.attributes.position.count;
    pos.set(p.attributes.position.array, v * 3); nor.set(p.attributes.normal.array, v * 3);
    if (p.index) for (const k of p.index.array) idx[i++] = k + v; else for (let k = 0; k < n; k++) idx[i++] = k + v;
    v += n; p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); return g;
}
const _sgf = mkFrame();
function sightSW(x, z, s0){   // the line's (s, w) nearest a point, searched within 2 km of s0
  let bs = s0, best = Infinity;
  const look = (a, b, ds) => { for (let s = Math.max(0, a); s <= Math.min(ROUTE.L, b); s += ds){ ROUTE.frameAt(s, _sgf); const d = (_sgf.p.x - x) ** 2 + (_sgf.p.z - z) ** 2; if (d < best){ best = d; bs = s; } } };
  look(s0 - 2000, s0 + 2000, 10); look(bs - 10, bs + 10, 0.5);
  ROUTE.frameAt(bs, _sgf); return [bs, (x - _sgf.p.x) * _sgf.r.x + (z - _sgf.p.z) * _sgf.r.z];
}
const SIGHTS = [], SIGHT_CLEAR = [];
function sight(id, range, build){
  const pts = ROUTE_DATA.sights[id]; if (!pts) return;
  const o = sightAt(id, Object.keys(pts)[0]), g = new THREE.Group(), fade = { value:1 }, parts = new Map();
  g.name = 'sight-' + id; g.visible = false; world.add(g);
  const mat = (color, opt = {}, lift = SIGHT_LIFT0) => { const m = new THREE.MeshStandardMaterial({ color, roughness:0.85, metalness:0, ...opt }); m.onBeforeCompile = sh => sightHaze(sh, fade, lift); return m; };
  const put = (m, ...geos) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(...geos); };
  const L = k => { const p = sightAt(id, k); return new THREE.Vector3(p.x - o.x, p.y - o.y, p.z - o.z); };
  const clear = (v, r) => SIGHT_CLEAR.push([o.x + v.x, o.z + v.z, r]);
  const gnd = v => { const [s, w] = sightSW(o.x + v.x, o.z + v.z, o.s); return ROUTE.terAt(s, Math.max(-1000, Math.min(1000, w))) - o.y; };   // the drawn ground under a local point
  const tick = build({ put, L, mat, clear, gnd, g, at:k => sightAt(id, k) });
  for (const [m, geos] of parts){ const mesh = new THREE.Mesh(sightGeo(geos), m); mesh.matrixAutoUpdate = false; g.add(mesh); }
  SIGHTS.push({ id, g, o, r:range, fade, tick });
}
function sightClear(x, z){ for (const c of SIGHT_CLEAR) if ((c[0] - x) ** 2 + (c[1] - z) ** 2 < c[2] * c[2]) return false; return true; }
let sightClock = 0;
function updateSights(dt){
  sightClock += dt;
  for (const S of SIGHTS){
    const dx = S.o.x - P_loco.x, dz = S.o.z - P_loco.z, d = Math.hypot(dx, dz), on = d < S.r;
    S.g.visible = on; if (!on) continue;
    S.g.position.set(dx, S.o.y - P_loco.y, dz);
    const f = Math.min(1, Math.max(0, (d - 0.8 * S.r) / (0.2 * S.r))); S.fade.value = f * f * (3 - 2 * f);
    if (S.tick) S.tick(sightClock);
  }
}

/* shapes */
const sgV2 = (x, y) => new THREE.Vector2(x, y);
const sgYawAz = az => Math.PI / 2 - az * Math.PI / 180;   // the yaw that turns local +x toward azimuth az (degrees clockwise from north)
const sgDir = az => new THREE.Vector3(Math.sin(az * Math.PI / 180), 0, -Math.cos(az * Math.PI / 180));
const _sgv = new THREE.Vector3(), _sgq = new THREE.Quaternion(), _sgm = new THREE.Matrix4(), _sgx = new THREE.Vector3(), _sgy = new THREE.Vector3(), _sgz = new THREE.Vector3();
function sgBox(w, h, d, x, y, z, yaw = 0){ return new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).rotateY(yaw).translate(x, y, z); }   // standing on (x, y, z), w along the yawed x
function sgFrustum(bw, bd, tw, td, h){   // a box tapering from bw × bd at its foot to tw × td at h
  const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){ const top = p.getY(i) > 0; p.setXYZ(i, p.getX(i) * (top ? tw : bw), top ? h : 0, p.getZ(i) * (top ? td : bd)); }
  g.computeVertexNormals(); return g;
}
function sgBeam(a, b, t){ const d = _sgv.subVectors(b, a), len = d.length(); return new THREE.BoxGeometry(t, len, t).translate(0, len / 2, 0).applyQuaternion(_sgq.setFromUnitVectors(Y_UP, d.divideScalar(len))).translate(a.x, a.y, a.z); }
function sgSlab(a, b, width, depth){   // a deck whose top middle runs from a to b
  const len = _sgx.subVectors(b, a).length(); _sgx.divideScalar(len); _sgz.crossVectors(_sgx, Y_UP).normalize(); _sgy.crossVectors(_sgz, _sgx);
  return new THREE.BoxGeometry(len, depth, width).translate(len / 2, -depth / 2, 0).applyMatrix4(_sgm.makeBasis(_sgx, _sgy, _sgz).setPosition(a));
}
function sgLoft(rings){   // a prism through rings of 4 corners (+x+z, +x−z, −x−z, −x+z: counter-clockwise seen from above), each side its own strip so the edges stay sharp
  const pos = [], idx = [];
  for (let k = 0; k < 4; k++){
    const o = pos.length / 3;
    for (const r of rings) pos.push(...r[k], ...r[(k + 1) % 4]);
    for (let j = 0; j < rings.length - 1; j++){ const a = o + 2 * j; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function sgFlat(g){ const f = g.toNonIndexed(); f.computeVertexNormals(); g.dispose(); return f; }   // faceted
function sgPuff(r, seed){   // a lumpy ball of steam, flatter underneath
  const g = new THREE.SphereGeometry(r, 20, 14), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){
    const x = p.getX(i) / r, y = p.getY(i) / r, z = p.getZ(i) / r;
    const k = r * (1 + 0.09 * Math.sin(4.1 * x + seed) * Math.sin(3.7 * y + 1.3 * seed) + 0.07 * Math.sin(5.3 * z + 2.1 * seed) - 0.12 * Math.max(0, -y));
    p.setXYZ(i, x * k, y * k, z * k);
  }
  return g;
}
const sgLathe = (prof, n) => new THREE.LatheGeometry(prof.map(([r, y]) => sgV2(r, y)), n);   // profile [radius, height] from the bottom up, so the faces look out

/* Golfech nuclear power station, 1 to 1.5 km south of the line: two 178.5 m natural-draught cooling towers under their plumes, blown
   downwind like the turbines' wind, and the two 1300 MW units, each a reactor building with its turbine hall and fuel building */
sight('golfech', 9000, ({ put, L, mat, clear }) => {
  const shellM = mat(0xb3b3ad, { side:THREE.DoubleSide }), inletM = mat(0x4a4a46), steamM = mat(0xe8ebee, { roughness:1, emissive:0x34383c }), domeM = mat(0xd6d2c8), hallM = mat(0xbfc3c6);
  const shell = []; for (let i = 0; i <= 16; i++){ const y = 11 + (178.5 - 11) * i / 16; shell.push([41.4 * Math.hypot(1, (y - 143) / 107.2), y]); }   // a hyperboloid, its 82.8 m throat at 143 m
  const drift = sgDir(70);
  ['towerN', 'towerS'].forEach((k, j) => {
    const c = L(k); c.y = 0;
    put(shellM, sgLathe(shell, 48).translate(c.x, 0, c.z));
    put(inletM, new THREE.CylinderGeometry(64, 66, 11, 48, 1, true).translate(c.x, 5.5, c.z));   // the air inlet, dark between the legs under the shell
    for (let i = 0; i < 7; i++){ const dr = 14 * i + 4 * i * i; put(steamM, sgPuff(42 + 9 * i, 1.3 + 2.8 * j + 1.7 * i).translate(c.x + drift.x * dr, 196 + 30 * i, c.z + drift.z * dr)); }
    clear(c, 80);
  });
  ['unit1', 'unit2'].forEach((k, j) => {
    const az = [44.6, 37.2][j], u = sgDir(az), n = new THREE.Vector3(-u.z, 0, u.x), c = L(k); c.y = 0;
    const at = (a, b) => c.clone().addScaledVector(u, a).addScaledVector(n, b);
    const r = at(-30, 0), h = at(22, 0), f = at(-30, 40);
    put(domeM, sgLathe([[23, -6], [23, 55], [20.5, 59.5], [14, 63], [7, 64.6], [0, 65]], 32).translate(r.x, 0, r.z));
    put(hallM, sgBox(26, 34, 80, h.x, -2, h.z, sgYawAz(az)), sgBox(24, 22, 30, f.x, -2, f.z, sgYawAz(az)));
    clear(c, 70);
  });
});

/* Passerelle Eiffel, 1860, the old railway bridge 25 to 40 m downstream of today's: two lattice girders 6.4 m deep with the track between them,
   on six pairs of river columns. Its deck follows the line's, which crosses the Garonne alongside */
sight('passerelle', 1500, ({ put, L, mat, clear, at }) => {
  const ironM = mat(0x3d4145, { roughness:0.7 }), pierM = mat(0x55595c);
  const a = at('sw'), b = at('ne'), e = L('ne'); e.y = 0;
  const len = e.length(), u = e.divideScalar(len), n = new THREE.Vector3(-u.z, 0, u.x), yaw = Math.atan2(-u.z, u.x);
  const sAt = t => a.s + (b.s - a.s) * t / len, yB = t => ROUTE.elAt(sAt(t)) - 1.2 - a.y;
  const P = (t, c, y) => new THREE.Vector3(u.x * t + n.x * c, y, u.z * t + n.z * c);
  const NP = Math.round(len / 3.2), dt = len / NP, H = 6.4;
  for (const c of [-4.3, 4.3]){
    const bot = [], top = [];
    for (let i = 0; i <= NP; i++){ const t = i * dt; bot.push(P(t, c, yB(t))); top.push(P(t, c, yB(t) + H)); }
    for (let i = 0; i < NP; i++) put(ironM, sgBeam(bot[i], bot[i + 1], 0.7), sgBeam(top[i], top[i + 1], 0.7));
    for (let i = 0; i + 2 <= NP; i++) put(ironM, sgBeam(bot[i], top[i + 2], 0.22), sgBeam(top[i], bot[i + 2], 0.22));   // the double lattice
    for (let i = 0; i <= NP; i += 4) put(ironM, sgBeam(bot[i], top[i], 0.35));
    if (NP % 4) put(ironM, sgBeam(bot[NP], top[NP], 0.35));
  }
  for (let i = 0; i <= NP; i += 4){ const y = yB(i * dt) + H; put(ironM, sgBeam(P(i * dt, -4.3, y), P(i * dt, 4.3, y), 0.3)); }   // top bracing
  for (let i = 0; i < NP; i++){ const t = (i + 0.5) * dt, p = P(t, 0, yB(t) - 0.5); put(ironM, sgBox(dt + 0.05, 0.5, 8.6, p.x, p.y, p.z, yaw)); }
  for (let k = 0; k < 6; k++){
    const t = 50 + 77.8 * k, y0 = ROUTE.terAt(sAt(t), a.w + (b.w - a.w) * t / len) - a.y - 6, y1 = yB(t);
    for (const c of [-3.4, 3.4]){ const p = P(t, c, 0); put(pierM, new THREE.CylinderGeometry(1.5, 1.5, y1 - y0, 16).translate(p.x, (y0 + y1) / 2, p.z)); }
    const p = P(t, 0, y0); put(pierM, sgBox(2, y1 - 1.5 - y0, 6.8, p.x, y0, p.z, yaw));   // the web between the columns
  }
  for (let t = 0; t <= len; t += 40) clear(P(t, 0, 0), 16);
});

/* Pont d'Aquitaine, 1967: a 394 m main span hung between two red pylons 103 m high, 143 m side spans, the deck 53 m over the river, and the
   long approach viaducts. Its east side span passes over the line at the mouth of the Lormont tunnel, its anchorage beside the portal */
sight('aquitaine', 5000, ({ put, L, mat, clear, gnd }) => {
  const redM = mat(0xb0402f, { roughness:0.6 }), cableM = mat(0x4a4e52, { roughness:0.5 }), concM = mat(0xa8a49c), viaM = mat(0x9d9a94);
  const e = L('pylonE'), yR = e.y; e.y = 0;
  const span = e.length(), u = e.divideScalar(span), n = new THREE.Vector3(-u.z, 0, u.x), yaw = Math.atan2(-u.z, u.x);
  const T = k => { const p = L(k); return p.x * u.x + p.z * u.z; };
  const P = (t, c = 0, y = 0) => new THREE.Vector3(u.x * t + n.x * c, y, u.z * t + n.z * c);
  const dT = yR + 53, top = yR + 103, tAW = T('anchW'), tAE = T('anchE'), tEE = T('endE'), tVW = T('viaW');
  for (const [t, g0] of [[0, 0], [span, yR]]){   // each pylon two legs, tied under the deck and at the top
    for (const c of [-12.5, 12.5]){ const p = P(t, c, g0 - 5); put(redM, sgFrustum(5.3, 4, 3.3, 4, top - g0 + 5).rotateY(yaw).translate(p.x, p.y, p.z)); }
    const p = P(t); put(redM, sgBox(3.2, 3.5, 29, p.x, dT - 8, p.z, yaw), sgBox(3.2, 4, 29, p.x, top - 6, p.z, yaw));
    clear(p, 40);
  }
  put(redM, sgSlab(P(tAW - 15, 0, dT), P(tEE, 0, dT), 20.9, 4.5));
  const par = (t, t0, t1, y0, y1, sag) => { const q = (t - t0) / (t1 - t0); return y0 + (y1 - y0) * q - 4 * sag * q * (1 - q); };
  const yC = t => t < 0 ? par(t, 0, tAW, top - 1, dT + 1, 6) : t > span ? par(t, span, tAE, top - 1, dT + 1, 6) : par(t, 0, span, top - 1, top - 1, top - 3 - dT);   // the cables, 6 m sag in the side spans
  const ts = [...Array.from({ length:8 }, (_, i) => tAW * (1 - i / 8)), ...Array.from({ length:32 }, (_, i) => span * i / 32), ...Array.from({ length:9 }, (_, i) => span + (tAE - span) * i / 8)];
  for (const c of [-10.4, 10.4]){
    for (let i = 1; i < ts.length; i++) put(cableM, sgBeam(P(ts[i - 1], c, yC(ts[i - 1])), P(ts[i], c, yC(ts[i])), 1.2));
    for (let t = Math.ceil(tAW / 12) * 12; t < tAE; t += 12) if (yC(t) - dT > 1.5 && Math.abs(t) > 4 && Math.abs(t - span) > 4) put(cableM, sgBeam(P(t, c, dT), P(t, c, yC(t)), 0.4));
  }
  for (const t of [tAW, tAE]){ const p = P(t), g0 = gnd(p) - 5; put(concM, sgBox(30, dT + 3 - g0, 26, p.x, g0, p.z, yaw)); clear(p, 38); }
  { const p = P(tEE), g0 = gnd(p) - 3; put(concM, sgBox(4, dT - 4.5 - g0, 18, p.x, g0, p.z, yaw)); clear(p, 30); }
  const via = (t0, y0, t1, y1) => {   // an approach viaduct from (t0, y0) to (t1, y1), on twin piers every 45 m
    put(viaM, sgSlab(P(t0, 0, y0), P(t1, 0, y1), 20.9, 2.5));
    for (let k = 1; k * 45 < Math.abs(t1 - t0) - 10; k++){
      const t = t0 + Math.sign(t1 - t0) * 45 * k, y = y0 + (y1 - y0) * (t - t0) / (t1 - t0) - 2.5;
      for (const c of [-6, 6]){ const p = P(t, c), g0 = gnd(p) - 3; if (y - g0 > 7) put(concM, sgBox(2.6, y - g0, 2.6, p.x, g0, p.z, yaw)); }
    }
    for (let t = Math.min(t0, t1); t <= Math.max(t0, t1); t += 22) clear(P(t), 14);
  };
  via(tEE, dT, 780, gnd(P(780)) + 1.5);   // east, onto the Lormont heights
  via(tAW - 15, dT, tVW, yR + 8);         // west, down over Bacalan
});

/* Futuroscope, beside its TGV station: the Kinémax's two crystals, the Omnimax sphere in its glass cube, the Pavillon's tilted roof and ball,
   the Gyrotour, whose cabin climbs its mast, and the dark hall of the robots */
sight('futuroscope', 2500, ({ put, L, mat, clear, g }) => {
  const u = sgDir(147.5), yaw = sgYawAz(147.5), whiteM = mat(0xeef0f0, { roughness:0.4 });
  const kin = L('kinemax'), kinM = mat(0xa9c3dc, { roughness:0.12, emissive:0x1a2530 });
  for (const [r, h, a, lean] of [[18, 35, -12, 0.2], [14, 26, 12, -0.2]]) put(kinM, sgFlat(sgLathe([[0, -6], [r, -6], [0.92 * r, 0.62 * h], [0, h]], 6)).rotateZ(lean).rotateY(yaw).translate(kin.x + u.x * a, kin.y, kin.z + u.z * a));
  const om = L('omnimax');
  put(mat(0x9a9ea3, { roughness:0.5 }), new THREE.SphereGeometry(15, 32, 16).translate(om.x, om.y + 17, om.z));
  put(mat(0x9cc3d9, { roughness:0.1, transparent:true, opacity:0.35, depthWrite:false }), new THREE.BoxGeometry(26, 26, 26).rotateZ(25 * Math.PI / 180).rotateY(yaw).translate(om.x, om.y + 14, om.z));
  const pv = L('pavillon'), pd = sgDir(21.5), roof = new THREE.BoxGeometry(50, 1, 40), rp = roof.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setY(i, rp.getY(i) > 0 ? 14 + 13 * (rp.getX(i) + 25) / 50 : -3);
  roof.computeVertexNormals();
  put(mat(0x6d8ca3, { roughness:0.2 }), roof.rotateY(sgYawAz(21.5)).translate(pv.x, pv.y, pv.z));
  put(whiteM, new THREE.SphereGeometry(8.6, 24, 12).translate(pv.x + pd.x * 25, pv.y + 32, pv.z + pd.z * 25));
  const gy = L('gyrotour');
  put(whiteM, new THREE.CylinderGeometry(1.75, 1.75, 51, 16).translate(gy.x, gy.y + 19.5, gy.z));
  const rb = L('robots');
  put(mat(0x1e2328, { roughness:0.2 }), sgBox(61.5, 15, 46.2, rb.x, rb.y - 3, rb.z, yaw));
  [['kinemax', 30], ['omnimax', 32], ['pavillon', 35], ['gyrotour', 10], ['robots', 40]].forEach(([k, r]) => clear(L(k), r));
  const lift = { value:0 }, cab = new THREE.Group(); cab.position.copy(gy); g.add(cab);   // the cabin rides the mast in a 3 minute cycle
  cab.add(new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 3.2, 32).translate(0, 3.6, 0), mat(0x9cc3d9, { roughness:0.1, transparent:true, opacity:0.6 }, lift)),
          new THREE.Mesh(new THREE.CylinderGeometry(6.9, 6.9, 0.8, 32).translate(0, 1.6, 0), mat(0xeef0f0, { roughness:0.4 }, lift)));
  const sm = x => x * x * (3 - 2 * x);
  return clock => { const c = clock % 180, h = c < 30 ? 0 : c < 90 ? 40 * sm((c - 30) / 60) : c < 120 ? 40 : 40 * (1 - sm((c - 120) / 60)); cab.position.y = gy.y + h; lift.value = gy.y + h; };
});

/* Tour Eiffel, 2.6 km north-west of the Montparnasse buffer stops: four legs curving into one shaft above the second floor, the arches between
   the legs, the three platforms, the top and its antenna at 330 m */
sight('eiffel', 8000, ({ put, mat }) => {
  const ironM = mat(0x6f6450, { roughness:0.75 }), parts = [];
  const HW = [[0, 62.5], [20, 50], [57.6, 35.3], [90, 26], [115.7, 20.5], [160, 14.5], [200, 11], [240, 8.8], [276, 7.5], [300, 5.5]];   // half the width of the tower at each height
  const hw = y => { let i = 1; while (i < HW.length - 1 && y > HW[i][0]) i++; const [y0, h0] = HW[i - 1], [y1, h1] = HW[i]; return h0 + (h1 - h0) * (y - y0) / (y1 - y0); };
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) parts.push(sgLoft([-6, 0, 10, 20, 35, 57.6, 75, 90, 105, 115.7].map(y => {
    const a = hw(y), b = a - a * (0.4 + 0.6 * Math.max(0, y) / 115.7);   // each leg a square from b to a, 25 m wide at the foot, meeting the others at the second floor
    const X1 = sx > 0 ? a : -b, X0 = sx > 0 ? b : -a, Z1 = sz > 0 ? a : -b, Z0 = sz > 0 ? b : -a;
    return [[X1, y, Z1], [X1, y, Z0], [X0, y, Z0], [X0, y, Z1]];
  })));
  parts.push(sgLoft([[115.7], [160], [200], [240], [276], [300], [301, 3.5], [312, 2.5]].map(([y, h = hw(y)]) => [[h, y, h], [h, y, -h], [-h, y, -h], [-h, y, h]])));
  parts.push(new THREE.CylinderGeometry(0.8, 0.8, 18, 8).translate(0, 321, 0));
  for (const s of [1, -1]) parts.push(sgBox(75.6, 5, 15.8, 0, 55, s * 29.9), sgBox(15.8, 5, 44, s * 29.9, 55, 0));   // the first floor, a square ring standing out of the legs
  parts.push(sgBox(45, 4, 45, 0, 113.7, 0), sgBox(18.6, 4, 18.6, 0, 274, 0));
  const arch = new THREE.CatmullRomCurve3(Array.from({ length:17 }, (_, i) => { const th = Math.PI * i / 16, y = 12 + 40 * Math.sin(th); return new THREE.Vector3(29.6 * Math.cos(th), y, hw(y) - 1); }));
  for (let k = 0; k < 4; k++) parts.push(new THREE.TubeGeometry(arch, 48, 1.1, 6, false).rotateY(k * Math.PI / 2));
  for (const p of parts) put(ironM, p.rotateY(sgYawAz(43.5)));
});

/* Cathédrale Saint-Pierre d'Angoulême on the ramparts, over the tunnel west of the station: the nave under three domes, the crossing dome on its
   drum and lantern, the apse, the transepts, the west front between its turrets and the 59 m bell tower on the north transept.
   Built along its axis (x toward 106°, z toward 196°), then turned */
sight('angouleme', 4500, ({ put, L, mat, clear }) => {
  const wallM = mat(0xe4d9c3), roofM = mat(0xcfc2a6), coreM = mat(0x7d7466), u = sgDir(106), v = sgDir(16), yaw = sgYawAz(106), parts = [];
  const add = (m, ...geos) => geos.forEach(geo => parts.push([m, geo]));
  const dome = (r, ys, x, y) => new THREE.SphereGeometry(r, 24, 8, 0, 2 * Math.PI, 0, Math.PI / 2).scale(1, ys, 1).translate(x, y, 0);
  add(wallM, sgBox(45, 35, 20, -32.5, -15, 0), sgBox(20, 37, 20, 0, -15, 0), sgBox(4, 33, 20, 12, -15, 0));   // nave, crossing, choir
  add(roofM, ...[-47.5, -32.5, -17.5].map(x => dome(8, 0.6, x, 20)), dome(8.45, 0.75, 0, 28), new THREE.ConeGeometry(2.4, 2, 12).translate(0, 39, 0));
  add(wallM, new THREE.CylinderGeometry(8.45, 8.45, 6, 24).translate(0, 25, 0), new THREE.CylinderGeometry(2, 2, 4, 12).translate(0, 36, 0));   // drum, lantern
  add(wallM, new THREE.CylinderGeometry(10, 10, 31, 24, 1, false, 0, Math.PI).translate(14, 0.5, 0));   // apse
  add(roofM, new THREE.SphereGeometry(10, 24, 12, Math.PI / 2, Math.PI, 0, Math.PI / 2).scale(1, 0.6, 1).translate(14, 16, 0));
  add(wallM, sgBox(16, 33, 18, 0, -15, -19), sgBox(16, 33, 16, 0, -15, 18), sgBox(2, 39, 26, -56, -15, 0));   // transepts, west front
  for (const z of [-13, 13]) add(wallM, new THREE.CylinderGeometry(2.3, 2.3, 37, 12).translate(-56, 3.5, z)), add(roofM, new THREE.ConeGeometry(2.6, 5, 12).translate(-56, 24.5, z));
  const tw = L('tower'), tx = tw.x * u.x + tw.z * u.z, tz = -(tw.x * v.x + tw.z * v.z), ty = tw.y;   // the bell tower: a 14 m ground storey, five of 8.4 m, a low pyramid
  add(coreM, sgBox(9, 71, 9, tx, ty - 15, tz));
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) add(wallM, sgBox(2.5, 71, 2.5, tx + 4.25 * sx, ty - 15, tz + 4.25 * sz));
  for (const y of [14, 22.4, 30.8, 39.2, 47.6]) add(wallM, sgBox(11.6, 0.8, 11.6, tx, ty + y, tz));
  add(wallM, sgBox(11.6, 1.2, 11.6, tx, ty + 55, tz));
  add(roofM, new THREE.ConeGeometry(8.2, 3, 4).rotateY(Math.PI / 4).translate(tx, ty + 57.7, tz));
  for (const [m, geo] of parts) put(m, geo.rotateY(yaw));
  for (const [a, b] of [[-45, 0], [-20, 0], [5, 0], [20, 0], [0, 30], [0, -20]]) clear(u.clone().multiplyScalar(a).addScaledVector(v, b), 30);
});

/* Flèche Saint-Michel, 1 km west of the Garonne bridge: the free-standing octagonal bell tower in four stages under its stone spire, 114.6 m,
   the tallest in the south of France */
sight('stmichel', 3500, ({ put, mat }) => {
  const stoneM = mat(0xd9bc9a);
  put(stoneM, sgFlat(sgLathe([[11.3, -10], [11.3, 46], [9.5, 46], [9.5, 56], [8.3, 56], [8.3, 66], [7.2, 66], [7.2, 76], [6.2, 76], [6.2, 80], [0.3, 114.6], [0, 114.6]], 8)));
  for (let k = 0; k < 8; k++){ const a = k * Math.PI / 4; put(stoneM, new THREE.ConeGeometry(1, 18, 6).translate(7.8 * Math.sin(a), 84, 7.8 * Math.cos(a))); }   // pinnacles round the foot of the spire
});

/* Pont Jacques-Chaban-Delmas, 2013: four 77 m pylons lift a 117 m span from 13 to 53 m over the river for ships; its approach viaducts */
sight('chaban', 3500, ({ put, L, mat }) => {
  const pylM = mat(0xc9c9c3), deckM = mat(0x8f959a);
  const q1 = L('p1').add(L('p2')).multiplyScalar(0.5), q2 = L('p3').add(L('p4')).multiplyScalar(0.5); q1.y = q2.y = 0;
  const e = q2.clone().sub(q1), len = e.length(), u = e.divideScalar(len), yaw = Math.atan2(-u.z, u.x), mid = q1.clone().add(q2).multiplyScalar(0.5);
  for (const k of ['p1', 'p2', 'p3', 'p4']){ const p = L(k); put(pylM, sgFrustum(10.6, 5.9, 6, 3.5, 83).rotateY(yaw).translate(p.x, -6, p.z)); }
  put(deckM, sgBox(117, 3.5, 20, mid.x, 13, mid.z, yaw));   // the lift span, down
  for (const sg of [-1, 1]){
    const at = t => mid.clone().addScaledVector(u, sg * t), t0 = 58.6, t1 = len / 2 + 229;
    put(deckM, sgSlab(at(t0).setY(16.5), at(t1).setY(6), 20, 2.5));
    for (let t = len / 2 + 38; t < t1 - 10; t += 38){ const p = at(t), y = 16.5 + (6 - 16.5) * (t - t0) / (t1 - t0) - 2.5; put(pylM, sgBox(3, y + 6, 14, p.x, -6, p.z, yaw)); }
  }
});

/* La Cité du Vin, 2016, 55 m: a golden swirl, like wine turning in a glass, its neck leaning toward the Garonne */
sight('citevin', 3500, ({ put, mat }) => {
  put(mat(0xc8a75e, { roughness:0.35, metalness:0.15 }), sgLathe([[0, -4], [33, -4], [34, 6], [32, 14], [26, 22], [18, 28], [12, 34], [9, 42], [7, 50], [4, 54], [0, 55]], 48)
    .applyMatrix4(new THREE.Matrix4().set(1, 0.3, 0, 0, 0, 1, 0, 0, 0, 0, 0.7, 0, 0, 0, 0, 1)).rotateY(sgYawAz(150)));
});

/* Tour Triangle at the Porte de Versailles, 180 m: a glass trapezoid seen broadside, a slim wedge end on */
sight('triangle', 6000, ({ put, mat }) => {
  put(mat(0x8fa3b5, { roughness:0.25 }), sgFrustum(173, 41.7, 12, 18, 186).translate(0, -6, 0).rotateY(sgYawAz(42.5)));
});
