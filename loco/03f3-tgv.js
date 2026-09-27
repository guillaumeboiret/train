
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
function sectionPts(yBot, yTop, wBot, wTop, n){
  const pts = [], cy = (yBot + yTop) / 2, hy = (yTop - yBot) / 2;
  for (let i = 0; i < RING_N; i++){
    const t = -Math.PI / 2 + (i / RING_N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    const zn = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), yn = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    const y = cy + hy * yn, k = Math.max(0, ((y - yBot) / (yTop - yBot) - 0.45) / 0.55);
    pts.push([zn * (wBot + (wTop - wBot) * k * k), y]);
  }
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

/* ---- power car body (shared geometry + texture) */
const PC = (() => {
  const yBot = 1.0, yTop = 4.25, w = TGV.HALF_W;
  const rings = [{ x:TGV.PC_REAR, pts:sectionPts(yBot, yTop, w, w * 0.9, 4) }, { x:TGV.PC_NOSE0, pts:sectionPts(yBot, yTop, w, w * 0.9, 4) }];
  for (let k = 1; k <= 12; k++){
    const u = k / 12, x = TGV.PC_NOSE0 + (TGV.PC_TIP - TGV.PC_NOSE0) * u;
    rings.push({ x, pts:sectionPts(yBot - 0.3 * u, yTop - 2.55 * Math.pow(u, 1.5), w * (1 - 0.5 * u * u), w * (0.9 - 0.42 * u * u), 4 - 1.8 * u) });
  }
  const geo = loftGeo(rings), body = rings[0].pts, L = TGV.PC_TIP - TGV.PC_REAR;
  const ux = x => (x - TGV.PC_REAR) / L;
  const tex = canvasTex(2048, 512, (c, W, H) => {
    c.fillStyle = LIV.grey; c.fillRect(0, 0, W, H);
    const band = (y0, y1, col) => [1, -1].forEach(s => { const a = vAtY(body, y0, s) * H, b = vAtY(body, y1, s) * H; c.fillStyle = col; c.fillRect(0, Math.min(a, b), ux(TGV.PC_NOSE0 + 1.6) * W, Math.abs(b - a)); });
    band(yBot, 1.55, LIV.carmine);                                                       // carmine skirt
    band(4.05, yTop, LIV.roof);                                                          // roof
    c.fillStyle = LIV.roof; c.fillRect(0, H * 0.44, ux(TGV.PC_NOSE0 + 0.8) * W, H * 0.12);
    c.fillStyle = LIV.carmine; c.fillRect(ux(TGV.PC_NOSE0 + 1.2) * W, 0, W, H);          // carmine nose
    c.fillStyle = LIV.glass;                                                             // windshield across the nose top
    c.beginPath(); c.moveTo(ux(9.3) * W, H * 0.40); c.lineTo(ux(10.75) * W, H * 0.455); c.lineTo(ux(10.75) * W, H * 0.545); c.lineTo(ux(9.3) * W, H * 0.60); c.closePath(); c.fill();
    [1, -1].forEach(s => {                                                               // cab side windows + louvres
      const a = vAtY(body, 3.55, s) * H, b = vAtY(body, 2.75, s) * H; c.fillStyle = LIV.glass; c.fillRect(ux(7.6) * W, Math.min(a, b), (ux(9.4) - ux(7.6)) * W, Math.abs(b - a));
      c.fillStyle = LIV.greyDark; for (let i = 0; i < 6; i++) c.fillRect(ux(-8.4 + i * 2.7) * W, Math.min(a, b), (ux(1.6) - ux(0)) * W, Math.abs(b - a) * 0.8);
    });
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, ux(TGV.PC_REAR + 0.25) * W, H);   // rear end shading
  });
  return { geo, tex, rings, yBot, yTop };
})();
function buildPowerCarBody(parent, cx, dir, mk, withCoupler = true){   // mk: material factory (mat or pmat); dir +1 nose toward +x
  const g = new THREE.Group(); g.position.x = cx; if (dir < 0) g.rotation.y = Math.PI;
  const bm = mk(0xffffff, { map:PC.tex, roughness:0.45, metalness:0.2 });
  const bodyM = new THREE.Mesh(PC.geo.body, bm); bodyM.castShadow = true; bodyM.receiveShadow = true; g.add(bodyM);
  const capM = mk(0x6d1020, { roughness:0.5 }), rearM = mk(0x2b3238, { roughness:0.8 });
  const cf = new THREE.Mesh(PC.geo.capFront, capM), cr = new THREE.Mesh(PC.geo.capRear, rearM); cf.castShadow = cr.castShadow = true; g.add(cf, cr);
  const shell = { mats:[bm, capM, rearM], meshes:[bodyM, cf, cr] };   // what the shell opacity control drives on a plain power car
  const lamp = (w, h, d, m, x, y, z) => { const b = box(w, h, d, m, x, y, z); g.add(b); shell.meshes.push(b); };
  // lamps: white heads and red tails, driven per power car by updateTgv (only the true train ends light up)
  const hl = mk(0xfff1c0, { emissive:0xfff1c0, emissiveIntensity:0, roughness:0.3 });
  [-0.86, 0.86].forEach(z => lamp(0.3, 0.2, 0.08, hl, 10.82, 1.45, z));
  lamp(0.28, 0.16, 0.3, hl, 10.42, 2.62, 0);
  const tl = mk(0xff3b30, { emissive:0xff2a20, emissiveIntensity:0, roughness:0.3 });
  [-0.86, 0.86].forEach(z => lamp(0.14, 0.14, 0.08, tl, 10.84, 1.16, z));
  shell.mats.push(hl, tl);
  const hatch = withCoupler ? buildNoseCoupler(g, mk) : null;
  parent.add(g);
  return { group:g, hatch, body:bodyM, hl, tl, shell };
}
/* The three plain power cars (set 1 rear, set 2 front and rear) carry a copy of the lead car's internals, with the same
   materials, so the electric chain reads the same on every motrice. The copy sits in the car group and inherits its pose. */
const PC_INTERNALS = ['frame', 'cab', 'bogies', 'motors', 'transformer', 'converter4q', 'inverters', 'control', 'roofResistors', 'cooling', 'compressor', 'auxConverter', 'battery', 'vcb'];
const pcHosts = [];                          // {ig, clones:{id:group}} per equipped power car
const pcShells = { mats:[], meshes:[] };     // their body shells, so the shell opacity control covers every power car
function equipPowerCar(pc, pantoX){
  for (const ax of axles) ax.userData.axle = 1;          // tags survive clone(): the copies' wheels and rotors turn with the train
  for (const r of motorRotors) r.userData.rotor = 1;
  const ig = new THREE.Group(); ig.name = 'pcInternals'; pc.group.add(ig);
  const clones = {};
  for (const id of PC_INTERNALS){
    const c = parts[id].group.clone(); c.position.set(0, 0, 0); ig.add(c); clones[id] = c;
    c.traverse(o => { if (o.userData.axle) axles.push(o); else if (o.userData.rotor) motorRotors.push(o); });
  }
  // HV lead from the pantograph base to the circuit breaker (on the lead car it belongs to the pantograph part)
  ig.add(cable(pantoX < 0 ? [[-1.6, 4.6, 0.25], [1.5, 4.55, 0.35], [4.35, 4.55, 0.3]] : [[2.0, 4.58, 0.5], [3.4, 4.5, 0.6], [4.35, 4.55, 0.3]], 0.03, pmat(pal.copper)));
  pcHosts.push({ ig, clones });
  pcShells.mats.push(...pc.shell.mats); pcShells.meshes.push(...pc.shell.meshes);
}
function buildNoseCoupler(g, mk){   // nose hatch (two leaves hinged on their outer edges) + Scharfenberg coupler behind it
  const hatchM = mk(0x6d1020, { roughness:0.5 }), cpM = mk(pal.dark, { metalness:0.6, roughness:0.4 });
  const hatch = { leaves:[], head:null };
  [-1, 1].forEach(s => { const piv = new THREE.Group(); piv.position.set(TGV.PC_TIP + 0.03, 1.12, s * 0.5); piv.add(box(0.05, 0.6, 0.48, hatchM, 0, 0, -s * 0.24)); g.add(piv); hatch.leaves.push({ piv, s }); });
  const head = new THREE.Group(); head.position.set(TGV.PC_TIP - 0.95, 1.12, 0);
  head.add(cyl(0.09, 1.1, cpM, 'x', -0.1, 0, 0, 12)); head.add(box(0.34, 0.36, 0.36, cpM, 0.55, 0, 0)); head.add(cyl(0.06, 0.4, cpM, 'x', 0.85, 0.06, 0.1, 10));
  g.add(head); hatch.head = head;
  return hatch;
}
function poseHatch(h, f){   // f 0 closed .. 1 open (leaves swing out, coupler head slides forward)
  h.leaves.forEach(l => { l.piv.rotation.y = -l.s * f * 1.9; });
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
  const bodyM = mk(0xffffff, { map:TR.tex, roughness:0.45, metalness:0.2 }), endM = mk(0x2b3238, { roughness:0.85 });
  const bellowsM = mk(0x23272c, { roughness:0.95 }), doorM = mk(0xaeb4ba, { roughness:0.5, metalness:0.25, side:THREE.DoubleSide }), glassM = mk(0x1c2530, { roughness:0.25, metalness:0.1 });
  const trailerRear = [];
  TGV.TRAILERS.forEach(([xr, L], i) => {
    const g = new THREE.Group(); g.position.x = xr;
    const b = new THREE.Mesh(TR.geo[L].body, bodyM); b.castShadow = true; b.receiveShadow = true; g.add(b);
    const cr = new THREE.Mesh(TR.geo[L].capRear, endM), cf = new THREE.Mesh(TR.geo[L].capFront, endM); cf.position.x = 0; g.add(cr, cf);
    g.add(box(L - 1.0, 0.16, 2.6, endM, L / 2, 0.83, 0));                                 // underframe
    g.add(box(L - 3.0, 0.5, 2.9, endM, L / 2, 0.55, 0));                                  // low floor tanks/equipment
    if (i < TGV.TRAILERS.length - 1) g.add(box(0.5, 3.3, 2.5, bellowsM, -0.25, 2.5, 0));   // gangway bellows over the Jacobs bogie
    G.trailers.add(g); trailerRear.push(xr);
    // plug-sliding door at the -x end of each trailer, both sides; only +z (platform) leaves animate
    [1, -1].forEach(s => {
      const d = new THREE.Group(); d.position.set(xr + 1.65, 0, 0);
      const leaf = new THREE.Mesh(TR.leaf[s > 0 ? 'p' : 'n'], doorM); leaf.castShadow = true; d.add(leaf);
      d.add(box(0.8, 0.6, 0.02, glassM, 0, 2.0, s * (zAtY(TR.pts, 2.0) + 0.022)));        // door window, level with the lower deck
      G.doors.add(d); set.doors.push({ g:d, s, x0:xr + 1.65, z0:0 });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map:carNumber(firstCar + i), side:THREE.DoubleSide }));
      num.position.set(xr + 2.75, 3.3, s * (zAtY(TR.pts, 3.3) + 0.012)); if (s < 0) num.rotation.y = Math.PI; G.trailers.add(num);
    });
  });
  // bogies: end bogies + 7 Jacobs at the articulations
  tgvBogie(G.jacobs, -13.0, mk, 3.0, false);
  for (let i = 0; i < TGV.TRAILERS.length - 1; i++) tgvBogie(G.jacobs, TGV.TRAILERS[i][0] - 0.25, mk, 3.0, true);
  tgvBogie(G.jacobs, -161.0, mk, 3.0, false);
  // rear power car (nose toward -x) + its pantograph; the front car is the loco shell (set 1) or built here (set 2)
  G.trailers.add(box(0.6, 3.3, 2.5, bellowsM, -9.9, 2.5, 0)); G.trailers.add(box(0.6, 3.3, 2.5, bellowsM, -164.2, 2.5, 0));   // gangways to both power cars
  const rear = buildPowerCarBody(G.power, TGV.REAR_PC, -1, mk);
  set.hatches.push(rear.hatch); set.lamps.rear = { hl:rear.hl, tl:rear.tl };
  if (internals) equipPowerCar(rear, -2); else [TGV.REAR_PC - 6, TGV.REAR_PC + 6].forEach(x => tgvBogie(G.power, x, mk, 3.0, false));
  const pm = mk(pal.panto, { metalness:0.6, roughness:0.35 }), im = mk(pal.insulator, { roughness:0.5 }), cm = mk(0x2a2a2a, { roughness:0.9 });
  const pg = new THREE.Group(); pg.position.x = TGV.REAR_PC + 2.0; pg.rotation.y = Math.PI;   // panto knee points backward like the loco's
  G.power.add(pg); const rp = buildPanto(pg, 0, pm, im, cm); set.pantos.push(rp);
  if (withFront){
    const front = buildPowerCarBody(G.power, 0, 1, mk);
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
definePart('tgvShell', g => { const b = buildPowerCarBody(g, 0, 1, mat, false); tgvFrontLamps = { hl:b.hl, tl:b.tl }; });
definePart('coupler', g => { tgvFrontHatch = buildNoseCoupler(g, mat); });
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
pantoHook = f => { if (S.mode !== 'tgv') return false; posePanto(tgvSets[0].pantos[0], f); return true; };

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

/* ---- passengers: instanced capsules that wait, alight and board through the platform-side doors */
const PAX_N = 96, PAX_COL = [0x3b5bdb, 0xc23b3b, 0x2f8f5b, 0xe0a030, 0x555c66, 0xd6d0c4, 0x7b3fa0, 0x1f6f8b];
const paxBody = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.19, 0.55, 3, 8), pmat(0xffffff, { roughness:0.8 }), PAX_N);
const paxHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), pmat(0xd9b48f, { roughness:0.7 }), PAX_N);
paxBody.castShadow = true; paxBody.frustumCulled = false; paxHead.frustumCulled = false;
station.add(paxBody, paxHead);
const pax = [];                       // {st: wait|in|alight|board|gone, x, z, tx, tz, door, delay, ph, sp}
let paxPhase = 'idle', paxT = 0;
function makeCrowd(){
  pax.length = 0;
  const doors = [];
  for (let s = 0; s < S.sets; s++) TGV.TRAILERS.forEach(([xr]) => doors.push(xr + 1.65 + (s ? TGV.SET2_X : 0) - TGV.PLAT_FRONT));
  const per = doors.length > 8 ? 2 : 3, col = new THREE.Color();
  doors.forEach(dx => {
    for (let i = 0; i < per; i++) pax.push({ st:'wait', x:dx + (Math.random() - 0.5) * 7, z:3.0 + Math.random() * 2.8, tx:0, tz:0, door:dx, delay:3.5 + i * 0.9 + Math.random() * 0.5, ph:0, sp:1.0 + Math.random() * 0.3 });
    for (let i = 0; i < per; i++) pax.push({ st:'in', x:dx, z:1.95, tx:dx + (Math.random() - 0.5) * 9, tz:7.7, door:dx, delay:0.4 + i * 0.7, ph:0, sp:1.0 + Math.random() * 0.3 });
  });
  pax.forEach((p, i) => { col.setHex(PAX_COL[(i * 7 + (i >> 3)) % PAX_COL.length]); paxBody.setColorAt(i, col); });
  paxBody.instanceColor.needsUpdate = true;
  paxPhase = 'idle';
}
function updatePax(dt){
  const active = S.atStation && S.doorsF > 0.9;
  if (active){ if (paxPhase === 'idle'){ paxPhase = 'exchange'; paxT = 0; } paxT += dt; }
  else if (paxPhase === 'exchange') paxPhase = 'done';
  if (paxPhase === 'done' && !S.atStation && Math.abs(stationOffset()) > 30) makeCrowd();
  let i = 0;
  for (const p of pax){
    if (paxPhase === 'exchange' && paxT > p.delay){
      if (p.st === 'in') p.st = 'alight';
      else if (p.st === 'wait' && active){ p.st = 'board'; p.tx = p.door; p.tz = 1.95; }
    }
    if (p.st === 'board' && !active) p.st = 'wait';                       // doors closed: missed it, keeps waiting
    if (p.st === 'alight' || p.st === 'board'){
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz), step = p.sp * dt;
      if (d <= step){ p.x = p.tx; p.z = p.tz; p.st = 'gone'; }
      else { p.x += dx / d * step; p.z += dz / d * step; p.ph += dt * 9; }
    }
    const vis = p.st === 'wait' || p.st === 'alight' || p.st === 'board', k = vis ? 1 : 0;
    const bob = vis && p.st !== 'wait' ? Math.abs(Math.sin(p.ph)) * 0.05 : 0;
    _m4.compose(_p.set(p.x, 1.02 + bob, p.z), _q, _s.setScalar(k)); paxBody.setMatrixAt(i, _m4);
    _m4.compose(_p.set(p.x, 1.6 + bob, p.z), _q, _s.setScalar(k)); paxHead.setMatrixAt(i, _m4);
    i++;
  }
  for (; i < PAX_N; i++){ _m4.makeScale(0, 0, 0); paxBody.setMatrixAt(i, _m4); paxHead.setMatrixAt(i, _m4); }
  paxBody.instanceMatrix.needsUpdate = true; paxHead.instanceMatrix.needsUpdate = true;
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
function setTgvVisible(on){
  tgvTrain.visible = on; paxBody.visible = paxHead.visible = on;
  if (!on){ platVariant[1].visible = true; platVariant[2].visible = false; setShadowBox(-82, 14, 2048); tgvShadow = ''; return; }
  if (!pax.length) makeCrowd();
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
  updatePax(dt);
}
