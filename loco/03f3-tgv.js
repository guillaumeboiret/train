
/* ============================================================ TGV PACK: Duplex sets, coupling, station, doors, passengers */
const TGV = {
  HALF_W:1.5, PC_LEN:19.2, PC_REAR:-9.6, PC_NOSE0:8.0, PC_TIP:11.3, TIP_F:11.3, TIP_R:-185.4,
  SET2_X:-197.1, PLAT_FRONT:13.5,
  TRAILERS:[[-30.7, 20.5], [-49.4, 18.2], [-68.1, 18.2], [-86.8, 18.2], [-105.5, 18.2], [-124.2, 18.2], [-142.9, 18.2], [-163.9, 20.5]],   // [rear x, body length]
  REAR_PC:-174.1,   // centre of the rear power car (nose toward -x)
};
TGV.setCenter = sets => (TGV.TIP_F + (sets === 2 ? TGV.SET2_X + TGV.TIP_R : TGV.TIP_R)) / 2;

/* ---- lofted bodies: rings of a rounded section along x, textured with a canvas (u along x, v around the ring) */
const RING_N = 40;
function sectionPt(yBot, yTop, wBot, wTop, n, t){   // [z, y] at angle t: -PI/2 bottom centre, 0 the +z flank, PI/2 top
  const cy = (yBot + yTop) / 2, hy = (yTop - yBot) / 2, c = Math.cos(t), s = Math.sin(t);
  const zn = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), yn = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
  const y = cy + hy * yn, k = Math.max(0, ((y - yBot) / (yTop - yBot) - 0.45) / 0.55);
  return [zn * (wBot + (wTop - wBot) * k * k), y];
}
function sectionPts(yBot, yTop, wBot, wTop, n){
  const pts = [];
  for (let i = 0; i < RING_N; i++) pts.push(sectionPt(yBot, yTop, wBot, wTop, n, -Math.PI / 2 + (i / RING_N) * Math.PI * 2));
  return pts;
}
function loftGeo(rings){   // rings: [{x, pts}] ordered by increasing x; returns {body, capRear, capFront}
  const R = rings.length, xMin = rings[0].x, xMax = rings[R - 1].x, pos = [], uv = [], idx = [];
  for (let i = 0; i < R; i++){
    const { x, pts } = rings[i], u = (x - xMin) / (xMax - xMin);
    for (let j = 0; j <= RING_N; j++){ const [z, y] = pts[j % RING_N]; pos.push(x, y, z); uv.push(u, j / RING_N); }
  }
  const W = RING_N + 1;
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < RING_N; j++){
    const a = i * W + j, b = (i + 1) * W + j;
    idx.push(a, b, b + 1, a, b + 1, a + 1);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  body.setIndex(idx); body.computeVertexNormals();
  const cap = (ring, front) => {
    const c = [0, 0, 0]; ring.pts.forEach(([z, y]) => { c[1] += y / RING_N; });
    const p = [ring.x, c[1], 0], n = [], ix = [];
    ring.pts.forEach(([z, y]) => p.push(ring.x, y, z));
    for (let j = 0; j < RING_N; j++){ const a = 1 + j, b = 1 + (j + 1) % RING_N; if (front) ix.push(0, b, a); else ix.push(0, a, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(ix); g.computeVertexNormals();
    return g;
  };
  return { body, capRear:cap(rings[0], false), capFront:cap(rings[R - 1], true) };
}
function vAtY(pts, y, side){   // ring parameter (0..1) of the side wall at height y; side +1 = +z wall
  let best = 0, bd = 1e9;
  for (let j = 0; j < RING_N; j++){ const [z, py] = pts[j]; if (Math.sign(z) !== side || Math.abs(z) < 0.3) continue; const d = Math.abs(py - y); if (d < bd){ bd = d; best = j; } }
  return best / RING_N;
}
function canvasTex(w, h, paint){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.ClampToEdgeWrapping;
  return t;
}
function zAtY(pts, y){
  const h = RING_N / 2;
  for (let i = 0; i < h; i++){ const [z0, y0] = pts[i], [z1, y1] = pts[i + 1]; if (y >= y0 && y <= y1) return z0 + (z1 - z0) * ((y - y0) / Math.max(1e-6, y1 - y0)); }
  return y < pts[0][1] ? pts[0][0] : pts[h][0];
}
/* plug-door leaf that follows the body section between y0 and y1 on side s (±1); extruded w along x, centred on x = 0 */
function doorLeafGeo(pts, s, y0, y1, w, out = 0.012, thick = 0.06){
  const N = 10, sh = new THREE.Shape(), ys = [];
  for (let k = 0; k <= N; k++) ys.push(y0 + (y1 - y0) * k / N);
  ys.forEach((y, k) => { const x = s * (zAtY(pts, y) + out); k ? sh.lineTo(x, y) : sh.moveTo(x, y); });
  for (let k = N; k >= 0; k--) sh.lineTo(s * (zAtY(pts, ys[k]) + out - thick), ys[k]);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth:w, bevelEnabled:false });
  g.rotateY(-Math.PI / 2); g.translate(w / 2, 0, 0);   // local extrusion (+z) → world x, centred
  return g;
}
const LIV = { grey:'#b9bec4', greyDark:'#8d939a', carmine:'#7a1224', glass:'#1c2530', roof:'#6f767d', door:'#20262c' };
const PAX_COL = [0x3b5bdb, 0xc23b3b, 0x2f8f5b, 0xe0a030, 0x555c66, 0xd6d0c4, 0x7b3fa0, 0x1f6f8b];   // clothes, shared by the platform crowd and the seated passengers

/* ---- power car body (shared geometry + texture) */
const NOSE = { D:0.45, y0:1.15, BACK:0.62, OUT:0.16, LIFT:0.1 };   // closed hatch: a rounded snout D ahead of the coupling face (PC_TIP), closing on
   // the coupler axis (y0). To couple, its two leaves part and slide back into the nose like pocket doors (BACK, OUT, LIFT, set so they
   // stay inside the skin), which leaves the flat face and the coupler: how the real TGV and Thalys hatches look open
/* The snout carries on the nose law past PC_TIP and shrinks it onto the coupler axis over a quarter ellipse, so it leaves the
   body with the same slope and closes round. Split along z = 0 into the two leaves (+z: ring points 0..RING_N/2), each placed
   from the outer edge of the face on its side. The normals are worked out on the whole snout plus the last body segment and
   written back onto the body, so neither the seam with the body nor the split between the leaves shows. */
function noseHatchGeo(bodyGeo, prev, dome){
  const R = dome.length + 1, W = RING_N + 1, pos = [], idx = [];
  for (const { x, pts } of [prev, ...dome]) for (let j = 0; j <= RING_N; j++){ const [z, y] = pts[j % RING_N]; pos.push(x, y, z); }
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < RING_N; j++){ const a = i * W + j, b = a + W; idx.push(a, b, b + 1, a, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const n = g.getAttribute('normal'), v = new THREE.Vector3();
  for (let i = 0; i < R; i++){   // the ring's first and last points are one point: one normal
    v.set(n.getX(i * W) + n.getX(i * W + RING_N), n.getY(i * W) + n.getY(i * W + RING_N), n.getZ(i * W) + n.getZ(i * W + RING_N)).normalize();
    n.setXYZ(i * W, v.x, v.y, v.z); n.setXYZ(i * W + RING_N, v.x, v.y, v.z);
  }
  for (let j = 0; j <= RING_N; j++) n.setXYZ((R - 1) * W + j, 1, 0, 0);   // the apex looks straight ahead
  const bn = bodyGeo.getAttribute('normal'), last = bn.count - W;
  for (let j = 0; j <= RING_N; j++) bn.setXYZ(last + j, n.getX(W + j), n.getY(W + j), n.getZ(W + j));
  const hz = Math.max(...dome[0].pts.map(([z]) => Math.abs(z)));
  const leaf = s => {
    const j0 = s > 0 ? 0 : RING_N / 2, M = RING_N / 2 + 1, lp = [], ln = [], li = [];
    for (let i = 1; i < R; i++) for (let k = 0; k < M; k++){ const q = i * W + j0 + k; lp.push(pos[3 * q] - TGV.PC_TIP, pos[3 * q + 1] - NOSE.y0, pos[3 * q + 2] - s * hz); ln.push(n.getX(q), n.getY(q), n.getZ(q)); }
    for (let i = 0; i < R - 2; i++) for (let k = 0; k < M - 1; k++){ const a = i * M + k, b = a + M; li.push(a, b, b + 1, a, b + 1, a + 1); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3)); lg.setIndex(li);
    return lg;
  };
  return { hz, leaf:{ '1':leaf(1), '-1':leaf(-1) } };
}
const PC = (() => {
  const yBot = 1.0, yTop = 4.25, w = TGV.HALF_W;
  const sec = u => [yBot - 0.3 * u, Math.max(NOSE.y0 + 0.05, yTop - 2.55 * Math.pow(u, 1.5)), w * (1 - 0.5 * u * u), w * (0.9 - 0.42 * u * u), 4 - 1.8 * u];   // u 0 at PC_NOSE0, 1 at PC_TIP
  const nose = u => sectionPts(...sec(u)), uAt = x => (x - TGV.PC_NOSE0) / (TGV.PC_TIP - TGV.PC_NOSE0);
  const rings = [{ x:TGV.PC_REAR, pts:sectionPts(yBot, yTop, w, w * 0.9, 4) }, { x:TGV.PC_NOSE0, pts:sectionPts(yBot, yTop, w, w * 0.9, 4) }];
  for (let k = 1; k <= 12; k++){ const u = k / 12; rings.push({ x:TGV.PC_NOSE0 + (TGV.PC_TIP - TGV.PC_NOSE0) * u, pts:nose(u) }); }
  const dome = [];
  for (let k = 0; k <= 12; k++){
    const a = (k / 12) * Math.PI / 2, x = TGV.PC_TIP + NOSE.D * Math.sin(a), c = Math.cos(a);
    dome.push({ x, pts:nose(uAt(x)).map(([z, y]) => [z * c, NOSE.y0 + (y - NOSE.y0) * c]) });
  }
  const geo = loftGeo(rings), hatch = noseHatchGeo(geo.body, rings[rings.length - 2], dome), body = rings[0].pts, L = TGV.PC_TIP - TGV.PC_REAR;
  /* lamp lenses: patches of the nose skin (x0..x1 along the car, t0..t1 around the section as in sectionPt) lifted 3 mm along
     its normal, so they sit flush on the curved nose. Flank lamps are given by their height range, taken at their middle. */
  const lens = (x0, x1, t0, t1) => {
    const N = 6, pos = [], idx = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++){ const x = x0 + (x1 - x0) * i / N, [z, y] = sectionPt(...sec(uAt(x)), t0 + (t1 - t0) * j / N); pos.push(x, y, z); }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++){ const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, b, b + 1, a, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) + 0.003 * n.getX(k), p.getY(k) + 0.003 * n.getY(k), p.getZ(k) + 0.003 * n.getZ(k));
    return g;
  };
  const tAt = (x, y) => { const [b, t, , , n] = sec(uAt(x)), yn = (2 * y - b - t) / (t - b); return Math.asin(Math.sign(yn) * Math.pow(Math.abs(yn), n / 2)); };   // on the +z flank
  const flank = (x0, x1, y0, y1) => { const t0 = tAt((x0 + x1) / 2, y0), t1 = tAt((x0 + x1) / 2, y1); return [lens(x0, x1, t0, t1), lens(x0, x1, Math.PI - t1, Math.PI - t0)]; };
  const lamps = { head:flank(10.67, 10.97, 1.35, 1.55), tail:flank(10.77, 10.91, 1.09, 1.23), top:lens(9.02, 9.24, Math.PI / 2 - 0.025, Math.PI / 2 + 0.025) };   // top: above the windshield
  const ux = x => (x - TGV.PC_REAR) / L;
  const windows = (c, W, H) => {   // windshield across the nose top + cab side windows: painted on the livery, cut out of the body on cars with a cab
    c.beginPath(); c.moveTo(ux(9.3) * W, H * 0.40); c.lineTo(ux(10.75) * W, H * 0.455); c.lineTo(ux(10.75) * W, H * 0.545); c.lineTo(ux(9.3) * W, H * 0.60); c.closePath(); c.fill();
    [1, -1].forEach(s => { const a = vAtY(body, 3.55, s) * H, b = vAtY(body, 2.75, s) * H; c.fillRect(ux(7.6) * W, Math.min(a, b), (ux(9.4) - ux(7.6)) * W, Math.abs(b - a)); });
  };
  const tex = canvasTex(2048, 512, (c, W, H) => {
    c.fillStyle = LIV.grey; c.fillRect(0, 0, W, H);
    const band = (y0, y1, col) => [1, -1].forEach(s => { const a = vAtY(body, y0, s) * H, b = vAtY(body, y1, s) * H; c.fillStyle = col; c.fillRect(0, Math.min(a, b), ux(TGV.PC_NOSE0 + 1.6) * W, Math.abs(b - a)); });
    band(yBot, 1.55, LIV.carmine);                                                       // carmine skirt
    band(4.05, yTop, LIV.roof);                                                          // roof
    c.fillStyle = LIV.roof; c.fillRect(0, H * 0.44, ux(TGV.PC_NOSE0 + 0.8) * W, H * 0.12);
    c.fillStyle = LIV.carmine; c.fillRect(ux(TGV.PC_NOSE0 + 1.2) * W, 0, W, H);          // carmine nose
    c.fillStyle = LIV.glass; windows(c, W, H);
    [1, -1].forEach(s => {                                                               // louvres
      const a = vAtY(body, 3.55, s) * H, b = vAtY(body, 2.75, s) * H;
      c.fillStyle = LIV.greyDark; for (let i = 0; i < 6; i++) c.fillRect(ux(-8.4 + i * 2.7) * W, Math.min(a, b), (ux(1.6) - ux(0)) * W, Math.abs(b - a) * 0.8);
    });
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, ux(TGV.PC_REAR + 0.25) * W, H);   // rear end shading
  });
  const mask = (bg, fg) => { const t = canvasTex(1024, 256, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; windows(c, W, H); }); t.colorSpace = THREE.NoColorSpace; return t; };
  return { geo, hatch, lamps, tex, alpha:mask('#fff', '#000'), glassAlpha:mask('#000', '#fff'), rings, yBot, yTop };
})();
function buildPowerCarBody(parent, cx, dir, mk, withCoupler = true, cabin = false){   // mk: material factory (mat or pmat); dir +1 nose toward +x; cabin: windows cut out onto a fitted cab
  const g = new THREE.Group(); g.position.x = cx; if (dir < 0) g.rotation.y = Math.PI;
  const bm = mk(0xffffff, Object.assign({ map:PC.tex, roughness:0.45, metalness:0.2 }, cabin ? { alphaMap:PC.alpha, alphaTest:0.5, side:THREE.DoubleSide } : {}));
  const bodyM = new THREE.Mesh(PC.geo.body, bm); bodyM.castShadow = true; bodyM.receiveShadow = true; g.add(bodyM);
  const capM = mk(0x22272c, { roughness:0.9 }), rearM = mk(0x2b3238, { roughness:0.8 });   // capM: the coupling face, dark, only seen with the hatch open
  const cf = new THREE.Mesh(PC.geo.capFront, capM), cr = new THREE.Mesh(PC.geo.capRear, rearM); cf.castShadow = cr.castShadow = true; g.add(cf, cr);
  const shell = { mats:[bm, capM, rearM], meshes:[bodyM, cf, cr] };   // what the shell opacity control drives on a plain power car
  if (cabin){   // tinted glass in the openings, seen from outside only (front faces point out)
    const gm = mk(0x1c2530, { alphaMap:PC.glassAlpha, transparent:true, opacity:0.45, roughness:0.1, metalness:0.3, depthWrite:false, alphaTest:0.01, side:THREE.FrontSide });
    const gl = new THREE.Mesh(PC.geo.body, gm); g.add(gl); shell.mats.push(gm); shell.meshes.push(gl);
  }
  const lamp = (geo, m) => { const b = new THREE.Mesh(geo, m); g.add(b); shell.meshes.push(b); };
  // lamps: white heads and red tails, driven per power car by updateTgv (only the true train ends light up)
  const lens = { roughness:0.3, side:THREE.FrontSide, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 };   // on the skin: win the depth test against it from afar, and from outside only (not through it from the cab)
  const hl = mk(0xfff1c0, Object.assign({ emissive:0xfff1c0, emissiveIntensity:0 }, lens));
  [...PC.lamps.head, PC.lamps.top].forEach(geo => lamp(geo, hl));
  const tl = mk(0xff3b30, Object.assign({ emissive:0xff2a20, emissiveIntensity:0 }, lens));
  PC.lamps.tail.forEach(geo => lamp(geo, tl));
  shell.mats.push(hl, tl);
  const hatch = withCoupler ? buildNoseCoupler(g, mk) : null;
  if (hatch){ shell.mats.push(hatch.mat); shell.meshes.push(...hatch.leaves.map(l => l.mesh)); }   // the leaves are skin: they fade with the body
  parent.add(g);
  return { group:g, hatch, body:bodyM, hl, tl, shell };
}
/* The three plain power cars (set 1 rear, set 2 front and rear) carry a copy of the lead car's internals, with the same
   materials, so the electric chain reads the same on every motrice. The copy sits in the car group and inherits its pose. */
const PC_INTERNALS = ['frame', 'cab', 'bogies', 'motors', 'transformer', 'converter4q', 'inverters', 'control', 'roofResistors', 'cooling', 'compressor', 'auxConverter', 'battery', 'vcb'];
const pcHosts = [];                          // {ig, clones:{id:group}} per equipped power car
const pcShells = { mats:[], meshes:[] };     // their body shells, so the shell opacity control covers every power car
const trShells = { mats:[], meshes:[] };     // trailer skins (body, ends, gangways, doors): the shell control fades them too and reveals the interiors
const DECK = { lo:0.92, up:2.3 };            // floor heights of the two decks (the painted windows sit at 1.65..2.35 and 3.0..3.75)
const SEAT_GEO = (() => {                    // cushion + backrest facing +x, origin on the floor at the seat centre, 0.44 wide
  const s = new THREE.Shape(); s.moveTo(-0.22, 0.28); s.lineTo(0.22, 0.28); s.lineTo(0.22, 0.42); s.lineTo(-0.12, 0.42); s.lineTo(-0.12, 0.95); s.lineTo(-0.22, 0.95); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth:0.44, bevelEnabled:false }); g.translate(0, 0, -0.22); return g;
})();
const SEAT_COL = [new THREE.Color(0x7a2233), new THREE.Color(0x24506b)];   // first class burgundy, second class blue
/* Duplex coach interior, drawn only while the shell control fades the skin: two decks of 2+2 seats and a stair at the door
   end. One group per coach, so the curve code carries each coach with its own car. One passenger slot per seat (instanced):
   seated, empty, or walking between the seat and the platform-side door (see the passenger block below). */
const SKIN = [0xf1c9a5, 0xe0ac7e, 0xc68a5a, 0x9c6a43, 0x6e4a2f, 0xf6d7bd];
const PAX_BODY_GEO = new THREE.CapsuleGeometry(0.17, 0.35, 2, 6), PAX_HEAD_GEO = new THREE.SphereGeometry(0.12, 7, 5);
const Q0 = new THREE.Quaternion(), _pc = new THREE.Color();
const hash32 = i => { i = Math.imul(i ^ (i >>> 16), 0x45d9f3b); i = Math.imul(i ^ (i >>> 16), 0x45d9f3b); return (i ^ (i >>> 16)) >>> 0; };
function buildCoach(parent, cm, xr, L, carNo){
  const g = new THREE.Group(); g.visible = false; parent.add(g);
  g.add(box(L - 3.6, 0.08, 2.85, cm.floor, xr + 3.4 + (L - 3.6) / 2, DECK.up, 0));    // upper floor, open over the vestibule and the stair
  const st = box(2.19, 0.06, 0.9, cm.floor, xr + 2.7, (DECK.lo + DECK.up) / 2 - 0.03, -0.9); st.rotation.z = Math.atan2(DECK.up - DECK.lo, 1.7); g.add(st);   // stair: vestibule (xr+1.85) up to the upper deck (xr+3.55)
  const seat = [], deck = [];
  for (const [d, y] of [[0, DECK.lo], [1, DECK.up]]) for (let x = xr + 4.0; x < xr + L - 0.9; x += 0.9) for (const z of [-0.95, -0.48, 0.48, 0.95]){ seat.push(x, y, z); deck.push(d); }
  const n = deck.length, cls = carNo % 10 <= 3 ? 0 : 1;                                 // cars 1..3 (11..13) are first class
  const seats = new THREE.InstancedMesh(SEAT_GEO, cm.seat, n), bodies = new THREE.InstancedMesh(PAX_BODY_GEO, cm.body, n), heads = new THREE.InstancedMesh(PAX_HEAD_GEO, cm.head, n);
  const c = { g, id:carNo, xr, L, n, seat:new Float32Array(seat), deck:new Uint8Array(deck), occ:new Uint8Array(n), colB:new Uint32Array(n), colH:new Uint32Array(n),
              bodies, heads, paths:[], walk:[], crowd:[[], []], dirty:false, colDirty:false };
  for (let i = 0; i < n; i++){
    _m4.compose(_p.set(seat[3 * i], seat[3 * i + 1], seat[3 * i + 2]), Q0, _s.setScalar(1)); seats.setMatrixAt(i, _m4); seats.setColorAt(i, SEAT_COL[cls]);
  }
  for (const m of [seats, bodies, heads]){ m.frustumCulled = false; m.castShadow = m.receiveShadow = false; g.add(m); }
  paxSeed(c);
  return c;
}
function equipPowerCar(pc, pantoX){
  for (const ax of axles) ax.userData.axle = 1;          // tags survive clone(): the copies' wheels and rotors turn with the train
  for (const r of motorRotors) r.userData.rotor = 1;
  const ig = new THREE.Group(); ig.name = 'pcInternals'; pc.group.add(ig);
  const clones = {};
  for (const id of PC_INTERNALS){
    const c = parts[id].group.clone(); c.position.set(0, 0, 0); ig.add(c); clones[id] = c;
    c.traverse(o => { if (o.userData.axle) axles.push(o); else if (o.userData.rotor) motorRotors.push(o); else if (o.userData.lever) cabLevers.push(o); });
  }
  clones.cab.getObjectByName('cabLoco').visible = false; clones.cab.getObjectByName('cabTgv').visible = true;
  const driver = clones.cab.getObjectByName('driver'); driver.visible = false;   // shown only in the leading cab
  // HV lead from the pantograph base to the circuit breaker (on the lead car it belongs to the pantograph part)
  ig.add(cable(pantoX < 0 ? [[-1.6, 4.6, 0.25], [1.5, 4.55, 0.35], [4.35, 4.55, 0.3]] : [[2.0, 4.58, 0.5], [3.4, 4.5, 0.6], [4.35, 4.55, 0.3]], 0.03, pmat(pal.copper)));
  pcHosts.push({ ig, clones, driver });
  pcShells.mats.push(...pc.shell.mats); pcShells.meshes.push(...pc.shell.meshes);
}
function buildNoseCoupler(g, mk){   // nose hatch (the rounded snout in two leaves) + Scharfenberg coupler behind it
  const hatchM = mk(new THREE.Color(LIV.carmine), { roughness:0.45, metalness:0.2, side:THREE.DoubleSide }), cpM = mk(pal.dark, { metalness:0.6, roughness:0.4 });
  const hatch = { leaves:[], head:null, mat:hatchM };
  [-1, 1].forEach(s => {
    const piv = new THREE.Group(); piv.position.set(TGV.PC_TIP, NOSE.y0, s * PC.hatch.hz);
    const mesh = new THREE.Mesh(PC.hatch.leaf[s], hatchM); mesh.castShadow = true; mesh.receiveShadow = true;
    piv.add(mesh); g.add(piv); hatch.leaves.push({ piv, s, mesh });
  });
  const head = new THREE.Group(); head.position.set(TGV.PC_TIP - 0.95, 1.12, 0);
  head.add(cyl(0.09, 1.1, cpM, 'x', -0.1, 0, 0, 12)); head.add(box(0.34, 0.36, 0.36, cpM, 0.55, 0, 0)); head.add(cyl(0.06, 0.4, cpM, 'x', 0.85, 0.06, 0.1, 10));
  g.add(head); hatch.head = head;
  return hatch;
}
function poseHatch(h, f){   // f 0 closed .. 1 open (leaves part and slide back into the nose, coupler head slides forward)
  const e = f * f * (3 - 2 * f);
  h.leaves.forEach(l => l.piv.position.set(TGV.PC_TIP - NOSE.BACK * e, NOSE.y0 + NOSE.LIFT * e, l.s * (PC.hatch.hz + NOSE.OUT * e)));
  h.head.position.x = TGV.PC_TIP - 0.95 + 0.45 * f;
}
function tgvBogie(parent, cx, mk, wheelbase = 3.0, jacobs = false){
  const fm = mk(pal.dark, { roughness:0.7 }), wm = mk(pal.wheel, { roughness:0.45, metalness:0.6 }), sm = mk(pal.steel, { metalness:0.6 });
  [1.1, -1.1].forEach(z => parent.add(box(wheelbase + 0.9, 0.3, 0.2, fm, cx, 0.95, z)));
  parent.add(box(0.6, 0.3, 2.3, fm, cx, 0.98, 0));
  if (jacobs) parent.add(box(1.2, 0.35, 2.2, fm, cx, 1.22, 0));                         // articulation bolster carrying both car ends
  [cx - wheelbase / 2, cx + wheelbase / 2].forEach(x => {
    const ax = new THREE.Group(); ax.position.set(x, WHEEL_R, 0);
    ax.add(cyl(0.08, 2.0, sm, 'z', 0, 0, 0, 12));
    [-0.75, 0.75].forEach(z => ax.add(cyl(WHEEL_R, 0.13, wm, 'z', 0, 0, z, 28)));
    [-0.62, 0.62].forEach(z => ax.add(cyl(0.36, 0.05, fm, 'z', 0, 0, z, 20)));         // brake discs
    parent.add(ax); axles.push(ax);
    [1.1, -1.1].forEach(z => parent.add(box(0.34, 0.34, 0.18, fm, x, WHEEL_R, z)));
  });
}

/* ---- Duplex trailer body (shared geometry + texture) */
const TR = (() => {
  const yBot = 0.75, yTop = 4.3, w = TGV.HALF_W;
  const pts = sectionPts(yBot, yTop, w, w * 0.87, 4);
  const mk = L => loftGeo([{ x:0, pts }, { x:L, pts }]);
  const geo = { 18.2:mk(18.2), 20.5:mk(20.5) };
  const tex = canvasTex(2048, 512, (c, W, H) => {
    const L = 20.5, ux = x => x / L * W;
    c.fillStyle = LIV.grey; c.fillRect(0, 0, W, H);
    [1, -1].forEach(s => {
      const band = (y0, y1, x0, x1, col) => { const a = vAtY(pts, y0, s) * H, b = vAtY(pts, y1, s) * H; c.fillStyle = col; c.fillRect(ux(x0), Math.min(a, b), ux(x1) - ux(x0), Math.abs(b - a)); };
      band(yBot, 1.55, 0, L, LIV.carmine);                                              // skirt
      band(4.1, yTop, 0, L, LIV.roof);                                                  // roof edge
      for (let x = 3.6; x < L - 1.2; x += 1.9){ band(1.65, 2.35, x, x + 1.25, LIV.glass); band(3.0, 3.75, x, x + 1.25, LIV.glass); }   // two decks of windows
      band(0.95, 3.15, 1.0, 2.3, LIV.door);                                             // doorway (door leaf sits in it)
      band(3.4, 3.65, 1.05, 2.25, LIV.glass);
    });
    c.fillStyle = LIV.roof; c.fillRect(0, H * 0.44, W, H * 0.12);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 0, ux(0.2), H); c.fillRect(ux(L - 0.2), 0, ux(0.2), H);
  });
  const leaf = { p:doorLeafGeo(pts, 1, 0.95, 3.15, 1.3), n:doorLeafGeo(pts, -1, 0.95, 3.15, 1.3) };
  return { geo, tex, pts, yBot, yTop, leaf };
})();
const carNumTex = {};
function carNumber(n){
  if (!carNumTex[n]) carNumTex[n] = canvasTex(128, 64, (c, W, H) => {
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, W, H); c.fillStyle = '#1b1f24'; c.font = 'bold 44px Inter, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), W / 2, H / 2 + 2);
  });
  return carNumTex[n];
}

/* ---- one Duplex set, set-local x (front nose tip at +11.3, rear tip at -185.4) */
function buildSet(opts){
  // opts: {mk, groups:{power, trailers, jacobs, doors, roof}, withFront, firstCar}
  const { mk, groups:G, withFront, firstCar, internals = false } = opts;   // internals: full copy of the lead car's equipment
  const set = { doors:[], hatches:[], lamps:{}, pantos:[] };
  const bodyM = mk(0xffffff, { map:TR.tex, roughness:0.45, metalness:0.2 }), endM = mk(0x2b3238, { roughness:0.85 }), capM = mk(0x2b3238, { roughness:0.85 });
  const bellowsM = mk(0x23272c, { roughness:0.95 }), doorM = mk(0xaeb4ba, { roughness:0.5, metalness:0.25, side:THREE.DoubleSide }), glassM = mk(0x1c2530, { roughness:0.25, metalness:0.1 });
  const skin = m => { if (internals) trShells.meshes.push(m); return m; };   // what the shell control fades: body, ends, gangways, doors (the underframe stays); the other trains stay opaque
  if (internals) trShells.mats.push(bodyM, capM, bellowsM, doorM, glassM);
  set.coaches = [];
  const coachM = internals ? { floor:mk(0x3a3f46, { roughness:0.9 }), seat:mk(0xffffff, { roughness:0.85 }), body:mk(0xffffff, { roughness:0.8 }), head:mk(0xffffff, { roughness:0.7 }) } : null;
  const trailerRear = [];
  TGV.TRAILERS.forEach(([xr, L], i) => {
    const g = new THREE.Group(); g.position.x = xr;
    const b = new THREE.Mesh(TR.geo[L].body, bodyM); b.castShadow = true; b.receiveShadow = true; g.add(skin(b));
    const cr = new THREE.Mesh(TR.geo[L].capRear, capM), cf = new THREE.Mesh(TR.geo[L].capFront, capM); cf.position.x = 0; g.add(skin(cr), skin(cf));
    g.add(box(L - 1.0, 0.16, 2.6, endM, L / 2, 0.83, 0));                                 // underframe
    g.add(box(L - 3.0, 0.5, 2.9, endM, L / 2, 0.55, 0));                                  // low floor tanks/equipment
    if (i < TGV.TRAILERS.length - 1) g.add(skin(box(0.5, 3.3, 2.5, bellowsM, -0.25, 2.5, 0)));   // gangway bellows over the Jacobs bogie
    G.trailers.add(g); trailerRear.push(xr);
    // plug-sliding door at the -x end of each trailer, both sides; only +z (platform) leaves animate
    [1, -1].forEach(s => {
      const d = new THREE.Group(); d.position.set(xr + 1.65, 0, 0);
      const leaf = new THREE.Mesh(TR.leaf[s > 0 ? 'p' : 'n'], doorM); leaf.castShadow = true; d.add(skin(leaf));
      d.add(skin(box(0.8, 0.6, 0.02, glassM, 0, 2.0, s * (zAtY(TR.pts, 2.0) + 0.022))));  // door window, level with the lower deck
      G.doors.add(d); set.doors.push({ g:d, s, x0:xr + 1.65, z0:0 });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map:carNumber(firstCar + i), side:THREE.DoubleSide }));
      num.position.set(xr + 2.75, 3.3, s * (zAtY(TR.pts, 3.3) + 0.012)); if (s < 0) num.rotation.y = Math.PI; G.trailers.add(num);
    });
    if (internals) set.coaches.push(buildCoach(G.trailers, coachM, xr, L, firstCar + i));
  });
  // bogies: end bogies + 7 Jacobs at the articulations
  tgvBogie(G.jacobs, -13.0, mk, 3.0, false);
  for (let i = 0; i < TGV.TRAILERS.length - 1; i++) tgvBogie(G.jacobs, TGV.TRAILERS[i][0] - 0.25, mk, 3.0, true);
  tgvBogie(G.jacobs, -161.0, mk, 3.0, false);
  // rear power car (nose toward -x) + its pantograph; the front car is the loco shell (set 1) or built here (set 2)
  G.trailers.add(skin(box(0.6, 3.3, 2.5, bellowsM, -9.9, 2.5, 0))); G.trailers.add(skin(box(0.6, 3.3, 2.5, bellowsM, -164.2, 2.5, 0)));   // gangways to both power cars
  const rear = buildPowerCarBody(G.power, TGV.REAR_PC, -1, mk, true, internals);
  set.hatches.push(rear.hatch); set.lamps.rear = { hl:rear.hl, tl:rear.tl };
  if (internals) equipPowerCar(rear, -2); else [TGV.REAR_PC - 6, TGV.REAR_PC + 6].forEach(x => tgvBogie(G.power, x, mk, 3.0, false));
  const pm = mk(pal.panto, { metalness:0.6, roughness:0.35 }), im = mk(pal.insulator, { roughness:0.5 }), cm = mk(0x2a2a2a, { roughness:0.9 });
  const pg = new THREE.Group(); pg.position.x = TGV.REAR_PC + 2.0; pg.rotation.y = Math.PI;   // panto knee points backward like the loco's
  G.power.add(pg); const rp = buildPanto(pg, 0, pm, im, cm); set.pantos.push(rp);
  if (withFront){
    const front = buildPowerCarBody(G.power, 0, 1, mk, true, internals);
    set.hatches.push(front.hatch); set.lamps.front = { hl:front.hl, tl:front.tl };
    if (internals) equipPowerCar(front, 2); else [-6, 6].forEach(x => tgvBogie(G.power, x, mk, 3.0, false));
    const fg = new THREE.Group(); fg.position.x = 2.0; G.power.add(fg); set.pantos.push(buildPanto(fg, 0, pm, im, cm));
  }
  // 25 kV roof line: rear panto -> along every trailer roof -> front power car's circuit breaker
  const lineM = mk(0xffb347, { roughness:0.35, metalness:0.6, emissive:0x3a2000, emissiveIntensity:0.25 }), insM = mk(pal.insulator, { roughness:0.5 });
  const xA = TGV.REAR_PC + 2.0, xB = -9.8;
  { // one segment per car so the line can follow the curves
    const cuts = [xA, -164.15, ...TGV.TRAILERS.map(([xr]) => xr - 0.25), xB].filter(x => x >= xA && x <= xB).sort((a, b) => a - b).filter((x, i, arr) => !i || x - arr[i - 1] > 0.5);
    for (let i = 0; i + 1 < cuts.length; i++) G.roof.add(cyl(0.035, cuts[i + 1] - cuts[i], lineM, 'x', (cuts[i] + cuts[i + 1]) / 2, 4.62, 0.25, 8));
  }
  for (let x = -12; x > TGV.REAR_PC + 3; x -= 9.6) G.roof.add(cyl(0.06, 0.3, insM, 'y', x, 4.42, 0.25, 8));
  G.roof.add(cable([[xA, 4.62, 0.25], [xA - 0.25, 4.6, 0.25], [xA - 0.4, 4.5, 0.15]], 0.03, lineM));   // to the rear panto base
  G.roof.add(cable([[-9.8, 4.62, 0.25], [-8.6, 4.58, 0.3], [-7.4, 4.5, 0.3]], 0.03, lineM));                                                  // down to the front car roof
  G.roof.add(cable([[-7.4, 4.5, 0.3], [-1.0, 4.55, 0.32], [3.6, 4.55, 0.32], [4.4, 4.5, 0.3]], 0.03, lineM));                                 // to the VCB
  return set;
}

/* ---- the train: set 1 = loco (front power car shell + the electric chain) + registered set parts; set 2 = plain visuals */
const tgvTrain = new THREE.Group(); tgvTrain.name = 'tgvTrain'; scene.add(tgvTrain);
const tgvSets = [];
let tgvFrontHatch = null, tgvFrontLamps = null;
definePart('tgvShell', g => { const b = buildPowerCarBody(g, 0, 1, mat, false, true); tgvFrontLamps = { hl:b.hl, tl:b.tl }; });
definePart('coupler', g => { tgvFrontHatch = buildNoseCoupler(g, mat); pcShells.mats.push(tgvFrontHatch.mat); pcShells.meshes.push(...tgvFrontHatch.leaves.map(l => l.mesh)); });   // the leaves fade with the lead car's skin
{
  const ids = ['powerCars', 'roofLine', 'trailers', 'jacobs', 'doors'], G = {};
  for (const id of ids) definePart(id, g => { G[id] = g; });
  const set1 = buildSet({ mk:pmat, groups:{ power:G.powerCars, roof:G.roofLine, trailers:G.trailers, jacobs:G.jacobs, doors:G.doors }, withFront:false, firstCar:1, internals:true });
  for (const id of ids){
    const p = parts[id];
    loco.remove(p.group); tgvTrain.add(p.group);            // outside `loco`: never clipped, never exploded
    p.mats.length = 0;                                       // meshes were added after registration: collect them now
    p.group.traverse(o => { if (o.isMesh){ o.userData.partId = id; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (!p.mats.includes(m)) p.mats.push(m); }); } });
  }
  set1.group = tgvTrain; tgvSets.push(set1);
  const s2 = new THREE.Group(); s2.name = 'tgvSet2'; s2.visible = false; tgvTrain.add(s2);
  const G2 = { power:new THREE.Group(), roof:new THREE.Group(), trailers:new THREE.Group(), jacobs:new THREE.Group(), doors:new THREE.Group() };
  Object.values(G2).forEach(g => s2.add(g));
  const set2 = buildSet({ mk:pmat, groups:G2, withFront:true, firstCar:11, internals:true });
  set2.group = s2; tgvSets.push(set2);
}
pantoHook = f => { if (S.mode !== 'tgv') return false; posePanto(tgvSets[0].pantos[0], f); posePanto(panto, 0); return true; };   // single set under 25 kV: the rear pantograph feeds the roof line, the leading one stays folded

/* ---- station: a platform on the camera side sized to the formation (200 m single set, 400 m double), letters A..P */
const station = new THREE.Group(); world.add(station);   // posed on the line at the nearest station by updateRoute
const platVariant = {};
const letterTexCache = {};
function letterTex(ch){
  if (!letterTexCache[ch]) letterTexCache[ch] = canvasTex(128, 128, (c, W, H) => {
    c.fillStyle = '#1f4fa0'; c.fillRect(0, 0, W, H); c.fillStyle = '#ffffff'; c.font = 'bold 92px Inter, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, W / 2, H / 2 + 4);
  });
  return letterTexCache[ch];
}
{
  const pm = pmat(0x9a968e, { roughness:0.95 }), em = pmat(0xe8e2d0, { roughness:0.9 }), sm = pmat(0x545b63, { roughness:0.6 }), rm = pmat(0x3b4148, { roughness:0.8 }), cm = pmat(0xb7bdc4, { roughness:0.85 });
  const wallM = pmat(0xd9d2c3, { roughness:0.9 }), roofM = pmat(0x6e4a3c, { roughness:0.8 }), signM = pmat(0x1f4fa0, { roughness:0.6 }), glassM = pmat(0x9fd0ff, { roughness:0.2, metalness:0.2 });
  const mkPlat = (L, sets) => {
    const g = new THREE.Group();
    g.add(box(L, 0.97, 6.25, pm, -L / 2, 0.065, 4.875));                       // slab z 1.75..8.0, top at y 0.55
    g.add(box(L, 0.02, 0.3, em, -L / 2, 0.56, 1.95)); g.add(box(L, 0.02, 0.3, em, -L / 2, 0.56, 7.8));   // safety lines on both faces of the island platform
    for (let x = -6; x > -L + 4; x -= 12) g.add(box(0.25, 3.7, 0.25, sm, x, 2.4, 6.5));
    g.add(box(L - 6, 0.12, 4.0, cm, -L / 2, 4.25, 5.75));                      // canopy, z 3.75..7.75, clear of the train on the far face; light so its underside reads in the door view
    for (let x = -30; x > -L + 20; x -= 60){ g.add(box(4, 1.1, 2.2, sm, x, 1.1, 4.9)); g.add(box(3.6, 0.1, 1.9, glassM, x, 1.7, 4.9)); }   // stair heads down to the underpass, in the middle of the island
    const letters = 'ABCDEFGHIJKLMNOP';
    for (let s = 0; s < sets; s++) TGV.TRAILERS.forEach(([xr, Lc], i) => {
      const cx = xr + Lc / 2 + (s ? TGV.SET2_X : 0) - TGV.PLAT_FRONT;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map:letterTex(letters[s * 8 + i]), side:THREE.DoubleSide }));
      sign.position.set(cx, 3.4, 2.6); g.add(sign);
      g.add(box(0.06, 0.9, 0.06, sm, cx, 3.8, 2.6));
    });
    return g;
  };
  platVariant[1] = mkPlat(200, 1); platVariant[2] = mkPlat(400, 2); platVariant[2].visible = false;
  station.add(platVariant[1], platVariant[2]);
  const b = new THREE.Group(); b.name = 'stationBuilding'; b.position.set(-40, -0.42, -12);   // station building across the tracks (z set per station)
  b.add(box(30, 6, 9, wallM, 0, 3, 0)); b.add(box(32, 0.5, 10, roofM, 0, 6.25, 0)); b.add(box(12, 1.3, 0.3, signM, 0, 7.2, 4.8));
  for (let x = -12; x <= 12; x += 4) b.add(box(1.6, 2.4, 0.1, glassM, x, 3.2, 4.55));
  station.add(b);
}

/* ---- passengers. Seated ones live in the coaches (one slot per seat, buildCoach); the platform crowd is one instanced pool
   under the station. Doors open at a stop: alighters leave their seats, queue at the door and step down onto the platform,
   then walk to the nearest stair; then the crowd boards and walks to free seats. Lane 0 of a doorway serves the upper deck
   (its -x half), lane 1 the lower deck. At the terminus everyone gets off and the train fills again; the doors wait for the
   last passenger (a close request is deferred until then, not refused). */
const POOL_N = 3072;
const pool = {
  body:new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.19, 0.55, 2, 6), pmat(0xffffff, { roughness:0.8 }), POOL_N),
  head:new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 7, 5), pmat(0xffffff, { roughness:0.7 }), POOL_N),
  a:new Array(POOL_N).fill(null), lo:0, hi:-1, dirty:false, colDirty:false,
};
{
  _m4.makeScale(0, 0, 0); _pc.setRGB(1, 1, 1);
  for (let j = 0; j < POOL_N; j++){ pool.body.setMatrixAt(j, _m4); pool.head.setMatrixAt(j, _m4); pool.body.setColorAt(j, _pc); pool.head.setColorAt(j, _pc); }
  pool.body.castShadow = true; pool.body.frustumCulled = pool.head.frustumCulled = false; pool.body.count = pool.head.count = 0;
  station.add(pool.body, pool.head);
}
const _pw = new THREE.Vector3(), _pw2 = new THREE.Vector3();
const PX = { phase:'idle', t:0, plan:'mid', h:0.55, visited:null, hold:false, closeWhenDone:false, crowdSt:null, rebuild:true, list:[] };

function mkPath(P){ const C = [0]; for (let k = 3; k < P.length; k += 3) C.push(C[C.length - 1] + Math.hypot(P[k] - P[k - 3], P[k + 1] - P[k - 2], P[k + 2] - P[k - 1])); return { P, C, len:C[C.length - 1] }; }
function pathAt(p, s, out){   // point at arc length s along a polyline path
  const C = p.C, P = p.P; let k = 1; while (k < C.length - 1 && C[k] < s) k++;
  const u = C[k] > C[k - 1] ? Math.min(1, Math.max(0, (s - C[k - 1]) / (C[k] - C[k - 1]))) : 1, i = 3 * (k - 1);
  return out.set(P[i] + (P[i + 3] - P[i]) * u, P[i + 1] + (P[i + 4] - P[i + 1]) * u, P[i + 2] + (P[i + 5] - P[i + 2]) * u);
}
function seatPath(c, i){   // seat -> step out -> aisle -> (upper deck: stair down) -> doorway, set-local
  if (c.paths[i]) return c.paths[i];
  const x = c.seat[3 * i], y = c.seat[3 * i + 1], z = c.seat[3 * i + 2], xr = c.xr, lo = DECK.lo, up = DECK.up;
  return c.paths[i] = mkPath(c.deck[i]
    ? [x, y, z, x + 0.42, y, z, x + 0.42, y, 0, xr + 3.75, up, 0, xr + 3.55, up, -0.9, xr + 1.85, lo, -0.9, xr + 1.35, lo, -0.4, xr + 1.35, lo, 1.25]
    : [x, y, z, x + 0.42, y, z, x + 0.42, y, 0, xr + 2.2, lo, 0, xr + 1.95, lo, 0.35, xr + 1.95, lo, 1.25]);
}
function poseSeat(c, i, on){
  const x = c.seat[3 * i] + 0.04, y = c.seat[3 * i + 1], z = c.seat[3 * i + 2], k = on ? 1 : 0;
  _m4.compose(_p.set(x, y + 0.72, z), Q0, _s.setScalar(k)); c.bodies.setMatrixAt(i, _m4);
  _m4.compose(_p.set(x, y + 1.12, z), Q0, _s.setScalar(k)); c.heads.setMatrixAt(i, _m4);
  c.dirty = true;
}
function poseWalker(c, w){   // walking in the coach: stands up over the first step out of the seat, then walks upright
  const p = w.p, u = Math.min(1, w.s / p.C[1]), x0 = c.seat[3 * w.i] + 0.04, y0 = c.seat[3 * w.i + 1], z0 = c.seat[3 * w.i + 2];
  pathAt(p, w.s, _pw); const bob = u >= 1 ? Math.abs(Math.sin(w.ph)) * 0.04 : 0;
  _m4.compose(_p.set(x0 + (_pw.x - x0) * u, y0 + 0.72 + (_pw.y + 0.465 + bob - y0 - 0.72) * u, z0 + (_pw.z - z0) * u), Q0, _s.set(1 + 0.12 * u, 1 + 0.35 * u, 1 + 0.12 * u)); c.bodies.setMatrixAt(w.i, _m4);
  _m4.compose(_p.set(x0 + (_pw.x - x0) * u, y0 + 1.12 + (_pw.y + 1.05 + bob - y0 - 1.12) * u, z0 + (_pw.z - z0) * u), Q0, _s.setScalar(1 + 0.08 * u)); c.heads.setMatrixAt(w.i, _m4);
  c.dirty = true;
}
function paxSeed(c){   // the passengers a coach starts with: 60% of the seats, the same people every time
  for (let i = 0; i < c.n; i++){
    const h = hash32(c.id * 1000 + i); c.colB[i] = PAX_COL[h % PAX_COL.length]; c.colH[i] = SKIN[(h >>> 8) % SKIN.length];
    c.bodies.setColorAt(i, _pc.setHex(c.colB[i])); c.heads.setColorAt(i, _pc.setHex(c.colH[i]));
    c.occ[i] = hash32(c.id * 7919 + i) % 100 < 60 ? 1 : 0; poseSeat(c, i, c.occ[i] === 1);   // occ: 0 free, 1 seated, 2 getting off, 3 taken by someone getting on
  }
  c.colDirty = true;
}
function freeSeat(c, deck){   // a random free seat on that deck, or -1
  let n = 0, pick = -1;
  for (let i = 0; i < c.n; i++) if (c.occ[i] === 0 && c.deck[i] === deck && Math.random() * ++n < 1) pick = i;
  return pick;
}

// platform pool: agents {j, st: wait|board|back|alight, x,y,z, home hx,hz, path, s, v, ph, colours, c, lane, e, seat}
function poseAgent(a, bob){
  _m4.compose(_p.set(a.x, a.y + 0.465 + bob, a.z), Q0, _s.setScalar(1)); pool.body.setMatrixAt(a.j, _m4);
  _m4.compose(_p.set(a.x, a.y + 1.05 + bob, a.z), Q0, _s.setScalar(1)); pool.head.setMatrixAt(a.j, _m4);
  pool.dirty = true;
}
function poolSpawn(x, y, z, st, colB, colH){
  let j = pool.lo; while (j < POOL_N && pool.a[j]) j++;
  if (j >= POOL_N) return null;
  const a = { j, st, x, y, z, hx:x, hz:z, path:null, s:0, v:1.15 + Math.random() * 0.3, ph:Math.random() * 6, colB, colH, c:null, lane:0, e:null, seat:-1 };
  pool.a[j] = a; pool.lo = j + 1; pool.hi = Math.max(pool.hi, j);
  pool.body.setColorAt(j, _pc.setHex(colB)); pool.head.setColorAt(j, _pc.setHex(colH)); pool.colDirty = true;
  poseAgent(a, 0);
  return a;
}
function poolFree(a){
  pool.a[a.j] = null; pool.lo = Math.min(pool.lo, a.j); a.st = 'gone'; a.path = null;
  _m4.makeScale(0, 0, 0); pool.body.setMatrixAt(a.j, _m4); pool.head.setMatrixAt(a.j, _m4); pool.dirty = true;
  while (pool.hi >= 0 && !pool.a[pool.hi]) pool.hi--;
}
function poolClear(){ for (let j = 0; j <= pool.hi; j++) if (pool.a[j]) poolFree(pool.a[j]); pool.lo = 0; }
function agentGo(a, st, P){ a.st = st; a.path = mkPath(P); a.s = 0; }

function stationPlan(st){
  const A = ROUTE.stations, first = st === A[0], last = st === A[A.length - 1];
  return (first && S.dir < 0) || (last && S.dir > 0) ? 'terminus' : (first && S.dir > 0) || (last && S.dir < 0) ? 'origin' : 'mid';
}
function buildCrowd(st){   // people waiting on the platform, in two files beside each doorway (one per lane)
  poolClear(); PX.crowdSt = st.id; PX.rebuild = false;
  const plan = stationPlan(st);
  tgvSets.forEach((set, k) => { for (const c of set.coaches){
    c.crowd[0].length = c.crowd[1].length = 0;
    if (k >= S.sets) continue;
    let seated = 0; for (let i = 0; i < c.n; i++) if (c.occ[i] === 1) seated++;
    const want = plan === 'terminus' ? 0.7 * c.n : plan === 'origin' ? Math.max(6, 0.85 * c.n - seated) : Math.max(0, 0.8 * c.n - 0.75 * seated);
    const per = Math.min(42, Math.round(want / 2)), nd = c.xr + 1.65 + (k ? TGV.SET2_X : 0) - TGV.PLAT_FRONT;
    for (let l = 0; l < 2; l++) for (let j = 0; j < per; j++){
      const h = hash32((Math.random() * 1e9) | 0), col = Math.floor(j / 3);
      const a = poolSpawn(nd + (l ? 1 : -1) * (1.0 + 0.55 * col) + (Math.random() - 0.5) * 0.2, 0.55, [2.45, 2.95, 3.45][j % 3] + (Math.random() - 0.5) * 0.1, 'wait', PAX_COL[h % PAX_COL.length], SKIN[(h >>> 8) % SKIN.length]);
      if (a){ a.c = c; a.lane = l; c.crowd[l].push(a); }
    }
  } });
}
function paxActivate(){   // doors open at a standstill: who gets off, who is waiting, per doorway at the platform
  const st = nearestStation(), plan = stationPlan(st);
  const share = PX.visited === st.id ? 0 : plan === 'terminus' ? 1 : plan === 'origin' ? 0 : 0.25;
  Object.assign(PX, { phase:'exchange', t:0, plan, h:plan === 'terminus' ? 0.42 : 0.55, hold:false, closeWhenDone:false });
  PX.list.length = 0;
  const Lp = S.sets === 2 ? 400 : 200, t0 = 3.2 * (1 - S.doorsF) + 0.6;
  station.updateWorldMatrix(true, false);
  for (let k = 0; k < S.sets; k++) for (const c of tgvSets[k].coaches){
    c.g.updateWorldMatrix(true, false);
    const T = [1.35, 1.95].map(dx => station.worldToLocal(c.g.localToWorld(new THREE.Vector3(c.xr + dx, DECK.lo, 1.25))));
    if (Math.abs(T[0].z - 1.25) > 0.4 || T[0].x > -1 || T[0].x < -Lp + 1) continue;   // this doorway is not along the platform
    const e = { c, T, L:[0, 1].map(() => ({ outs:[], wait:[], last:-9 , full:false })), boardT:-1, boarding:0, done:false };
    for (let i = 0; i < c.n; i++) if (c.occ[i] === 1 && Math.random() < share){
      c.occ[i] = 2; e.L[c.deck[i] ? 0 : 1].outs.push({ i, p:seatPath(c, i), s:0, v:1.25 * (0.9 + 0.2 * Math.random()), ph:Math.random() * 6, rel:0 });
    }
    e.L.forEach((ln, l) => {
      ln.outs.sort((a, b) => a.p.len - b.p.len);
      ln.outs.forEach((w, j) => { w.rel = Math.max(0, t0 + j * PX.h - w.p.len / w.v); });   // reach the door one after the other as it opens
      const d = a => Math.hypot(a.x - T[l].x, a.z - T[l].z);
      ln.wait = c.crowd[l].filter(a => a.st === 'wait').sort((a, b) => d(a) - d(b));
    });
    PX.list.push(e);
  }
  if (PX.list.length) PX.visited = st.id;   // a second stop at the same platform lets nobody off
}
function alightPath(e, l){   // doorway -> step down -> out of the door area -> nearest stair head -> down into it
  const T = e.T[l], dx = (e.T[0].x + e.T[1].x) / 2, Lp = S.sets === 2 ? 400 : 200;
  let sx = -30; for (let x = -30; x > -Lp + 20; x -= 60) if (Math.abs(x - dx) < Math.abs(sx - dx)) sx = x;
  const k = Math.sign(dx - sx) || 1, side = l ? 0.35 : -0.35, zj = 4.9 + 0.4 * (l ? k : -k);
  return [T.x, T.y, T.z, T.x, T.y, T.z + 0.37, T.x, 0.55, T.z + 0.7, dx + side, 0.55, 2.7, dx + side, 0.55, 4.0, sx + k * 2.25, 0.55, zj, sx + k * 0.6, -0.75, 4.9];
}
function paxExchange(dt){
  PX.t += dt;
  if (S.speed > 0.3 || S.coupling < 0 || !S.doors){ paxAbort(); return; }
  const t = PX.t, h = PX.h, open = S.doorsF > 0.9;
  PX.hold = PX.plan === 'terminus' && t < 90;   // at the terminus the doors wait for everyone (90 s at most)
  if (!PX.hold && PX.closeWhenDone && PX.plan === 'terminus'){ PX.closeWhenDone = false; S.doors = false; syncControls(); return; }
  let all = true;
  for (const e of PX.list){
    if (e.done) continue;
    const c = e.c;
    let outs = 0;
    e.L.forEach((ln, l) => {
      ln.outs.sort((a, b) => (a.p.len - a.s) - (b.p.len - b.s));   // queue order: nearest the door first
      let ahead = -0.45;
      for (const w of ln.outs){
        if (t < w.rel) continue;                                     // still seated
        const s = Math.min(w.p.len, w.s + w.v * dt, Math.max(w.s, w.p.len - (ahead + 0.45)));
        if (s !== w.s){ w.s = s; w.ph += dt * 9; poseWalker(c, w); }
        ahead = w.p.len - w.s;
      }
      const w0 = ln.outs[0];
      if (w0 && w0.s >= w0.p.len && open && t - ln.last >= h){   // step out onto the platform
        const a = poolSpawn(e.T[l].x, e.T[l].y, e.T[l].z, 'alight', c.colB[w0.i], c.colH[w0.i]);
        if (a) agentGo(a, 'alight', alightPath(e, l));
        c.occ[w0.i] = 0; poseSeat(c, w0.i, false); ln.outs.shift(); ln.last = t;
      }
      outs += ln.outs.length;
    });
    if (!outs && e.boardT < 0 && open) e.boardT = t + 1.6;
    if (e.boardT >= 0 && t >= e.boardT && open) e.L.forEach((ln, l) => {
      if (ln.full || !ln.wait.length || t - ln.last < h) return;
      const i = freeSeat(c, l ? 0 : 1);
      if (i < 0){ ln.full = true; return; }
      const a = ln.wait.shift(), T = e.T[l];
      c.occ[i] = 3; a.seat = i; a.e = e; e.boarding++; ln.last = t;
      agentGo(a, 'board', [a.x, a.y, a.z, T.x, 0.55, T.z + 0.75, T.x, T.y, T.z + 0.37, T.x, T.y, T.z]);
    });
    e.done = !outs && e.boardT >= 0 && e.boarding === 0 && e.L.every(ln => ln.full || !ln.wait.length);
    if (!e.done) all = false;
  }
  if (all){
    PX.phase = 'done'; PX.hold = false;
    if (PX.closeWhenDone){ PX.closeWhenDone = false; S.doors = false; syncControls(); }
  }
}
function paxAbort(){   // doors closing or the train moving: whoever is inside goes back to a seat, the platform steps back
  for (const e of PX.list) for (const ln of e.L){
    for (const w of ln.outs){ if (w.s <= 0){ e.c.occ[w.i] = 1; poseSeat(e.c, w.i, true); } else { e.c.occ[w.i] = 3; e.c.walk.push(w); } }
    ln.outs.length = 0;
  }
  for (let j = 0; j <= pool.hi; j++){
    const a = pool.a[j];
    if (a && a.st === 'board'){ a.e.c.occ[a.seat] = 0; a.e.boarding--; a.seat = -1; agentGo(a, 'back', [a.x, a.y, a.z, a.hx, 0.55, a.hz]); }
  }
  PX.list.length = 0; PX.phase = 'idle'; PX.hold = false; PX.closeWhenDone = false;
}
function enterCoach(a){   // a boarding agent reaches the doorway: the coach slot takes over and walks to the seat
  const e = a.e, c = e.c, i = a.seat;
  c.colB[i] = a.colB; c.colH[i] = a.colH; c.bodies.setColorAt(i, _pc.setHex(a.colB)); c.heads.setColorAt(i, _pc.setHex(a.colH)); c.colDirty = true;
  const p = seatPath(c, i), w = { i, p, s:p.len, v:a.v, ph:a.ph };
  c.walk.push(w); poseWalker(c, w);
  e.boarding--;
  const q = c.crowd[a.lane], k = q.indexOf(a); if (k >= 0) q.splice(k, 1);
  poolFree(a);
}
function walkCoaches(dt){   // people walking in to their seat (or back to it)
  for (const set of tgvSets) for (const c of set.coaches) for (let k = c.walk.length - 1; k >= 0; k--){
    const w = c.walk[k]; w.s -= w.v * dt; w.ph += dt * 9;
    if (w.s <= 0){ c.occ[w.i] = 1; poseSeat(c, w.i, true); c.walk.splice(k, 1); } else poseWalker(c, w);
  }
}
function walkPool(dt){
  for (let j = 0; j <= pool.hi; j++){
    const a = pool.a[j]; if (!a || !a.path) continue;
    a.s = Math.min(a.path.len, a.s + a.v * dt); a.ph += dt * 9;
    pathAt(a.path, a.s, _pw2); a.x = _pw2.x; a.y = _pw2.y; a.z = _pw2.z;
    if (a.s >= a.path.len){
      a.path = null;
      if (a.st === 'alight'){ poolFree(a); continue; }
      if (a.st === 'board'){ enterCoach(a); continue; }
      a.st = 'wait';
    }
    poseAgent(a, a.path ? Math.abs(Math.sin(a.ph)) * 0.05 : 0);
  }
}
function updatePax(dt){
  const st = nearestStation();
  if (PX.phase !== 'exchange' && (PX.rebuild || st.id !== PX.crowdSt)) buildCrowd(st);
  if (PX.phase === 'done' && S.speed > 0.3) PX.phase = 'idle';
  if (PX.phase === 'idle' && S.doors && S.speed < 0.05 && S.coupling >= 0) paxActivate();
  if (PX.phase === 'exchange') paxExchange(dt);
  walkPool(dt); walkCoaches(dt);
  pool.body.count = pool.head.count = pool.hi + 1;
  if (pool.dirty && pool.hi >= 0) for (const m of [pool.body, pool.head]){ const a = m.instanceMatrix; a.clearUpdateRanges(); a.addUpdateRange(0, (pool.hi + 1) * 16); a.needsUpdate = true; }   // upload the live part only
  pool.dirty = false;
  if (pool.colDirty){ pool.body.instanceColor.needsUpdate = pool.head.instanceColor.needsUpdate = true; pool.colDirty = false; }
  for (const set of tgvSets) for (const c of set.coaches){
    if (c.dirty){ c.bodies.instanceMatrix.needsUpdate = c.heads.instanceMatrix.needsUpdate = true; c.dirty = false; }
    if (c.colDirty){ c.bodies.instanceColor.needsUpdate = c.heads.instanceColor.needsUpdate = true; c.colDirty = false; }
  }
}
function paxHolding(){ return PX.phase === 'exchange' && PX.hold; }
function paxResolve(reset = false){   // settle everyone at once (teleport, reset, mode switch): walkers sit down or are gone, the crowd is rebuilt
  for (const set of tgvSets) for (const c of set.coaches){
    c.walk.length = 0; c.crowd[0].length = c.crowd[1].length = 0;
    if (reset){ paxSeed(c); continue; }
    for (let i = 0; i < c.n; i++){ const o = c.occ[i]; if (o >= 2){ c.occ[i] = o === 2 ? 0 : 1; } poseSeat(c, i, c.occ[i] === 1); }
  }
  poolClear(); PX.list.length = 0;
  Object.assign(PX, { phase:'idle', hold:false, closeWhenDone:false, rebuild:true, visited:null });
}

/* ---- cameras for the long train (functions: they depend on the formation) */
Object.assign(CAMS, {
  train:    () => S.sets === 2 || S.coupling !== 0 ? [[40, 22, 80], [-120, 3, 0]] : [[45, 22, 75], [-60, 3, 0]],
  rearroof: [[-160, 9.5, 12], [-172, 4.8, 0]],
  coupler:  () => S.sets === 2 || S.coupling !== 0 ? [[-186, 3.4, 6.0], [-186, 1.4, 0]] : [[-183, 3.4, 5.5], [-191, 1.4, 0]],   // from the island platform, inside the row of lamp posts and clear of the train on the far face
  station:  [[-30, 10, 34], [-45, 1.5, 4]],
  door:     [[-48, 2.3, 5.9], [-35, 1.7, 1.4]],   // eye height on the island platform, under the canopy, between the two trains
});

/* ---- per-frame update (tgv mode only) + mode switch hook */
let tgvShadow = '';
const tgvDriver = parts.cab.group.getObjectByName('driver');
function setTgvVisible(on){
  tgvTrain.visible = on; pool.body.visible = pool.head.visible = on;
  parts.cab.group.getObjectByName('cabLoco').visible = !on; parts.cab.group.getObjectByName('cabTgv').visible = on;   // the lead car's cab: loco desk or TGV desk with its driver
  if (!on){ platVariant[1].visible = true; platVariant[2].visible = false; setShadowBox(-82, 14, 2048); tgvShadow = ''; return; }
  paxResolve();
}
function updateTgv(dt){
  const s1 = tgvSets[0], s2 = tgvSets[1], bat = S.battery ? 1 : 0;
  const wide = S.sets === 2 || S.coupling !== 0;
  s2.group.visible = wide;
  platVariant[1].visible = S.sets === 1; platVariant[2].visible = S.sets === 2;
  const sh = wide ? 'um' : 'us';
  if (sh !== tgvShadow){ setShadowBox(wide ? -392 : -195, 14, Math.min(4096, renderer.capabilities.maxTextureSize)); tgvShadow = sh; }
  // pantographs: the rear power car of each set feeds its roof line; the leading one stays folded
  posePanto(s2.pantos[0], S.sets === 2 && S.coupling === 0 ? S.pantoF : (S.coupling !== 0 ? 1 : 0));
  posePanto(s2.pantos[1], 0);
  // nose hatches open at the coupling face only
  poseHatch(s1.hatches[0], S.hatchF); poseHatch(s2.hatches[1], S.hatchF); poseHatch(s2.hatches[0], 0); poseHatch(tgvFrontHatch, 0);
  // lamps: white at the head of the train, red at its true tail; a set on the move shows its own
  const lampTo = (m, t) => { m.emissiveIntensity = approach(m.emissiveIntensity, t, dt * 4); };
  lampTo(tgvFrontLamps.hl, bat * (S.dir > 0 ? 2.2 : 0)); lampTo(tgvFrontLamps.tl, bat * (S.dir < 0 ? 1.4 : 0));
  lampTo(s1.lamps.rear.hl, bat * (S.dir < 0 && !wide ? 2.2 : 0)); lampTo(s1.lamps.rear.tl, bat * (S.dir > 0 && !wide ? 1.4 : 0));
  lampTo(s2.lamps.rear.hl, bat * (S.dir < 0 && S.sets === 2 ? 2.2 : 0)); lampTo(s2.lamps.rear.tl, S.coupling !== 0 || (bat && S.dir > 0) ? 1.4 : 0);
  lampTo(s2.lamps.front.hl, S.coupling !== 0 ? 2.2 : 0); lampTo(s2.lamps.front.tl, 0);
  // doors: plug out, then slide along the body (platform side only)
  const f = S.doorsF, k1 = Math.min(1, f / 0.3), k2 = Math.max(0, (f - 0.3) / 0.7);
  for (const set of tgvSets) for (const d of set.doors){ if (d.s < 0) continue; d.g.position.z = d.z0 + 0.13 * k1; d.g.position.x = d.x0 + 1.35 * k2; }
  for (const h of pcHosts) for (const id in h.clones) h.clones[id].visible = parts[id].group.visible;   // copies follow the part toggles
  tgvDriver.visible = S.dir > 0;   // the driver sits in the leading cab
  for (const h of pcHosts) h.driver.visible = S.dir < 0 && h === (wide ? pcHosts[1] : pcHosts[0]);
  updatePax(dt);
}
