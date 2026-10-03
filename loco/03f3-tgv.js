
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
function loftGeo(rings, vs){   // rings: [{x, pts}] ordered by increasing x; vs: v of each ring point (RING_N + 1 values, default j / RING_N); returns {body, capRear, capFront}
  const R = rings.length, xMin = rings[0].x, xMax = rings[R - 1].x, pos = [], uv = [], idx = [];
  for (let i = 0; i < R; i++){
    const { x, pts } = rings[i], u = (x - xMin) / (xMax - xMin);
    for (let j = 0; j <= RING_N; j++){ const [z, y] = pts[j % RING_N]; pos.push(x, y, z); uv.push(u, vs ? vs[j] : j / RING_N); }
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
function vAt(pts, vs, y, side){   // exact v of the side wall at height y on a body lofted with the ring v values vs; side +1 = +z wall
  const h = RING_N / 2;
  for (let k = 0; k < h; k++){
    const a = side > 0 ? k : h + k, ya = pts[a][1], yb = pts[(a + 1) % RING_N][1];
    if (ya !== yb && (y - ya) * (y - yb) <= 0) return vs[a] + (y - ya) / (yb - ya) * (vs[a + 1] - vs[a]);
  }
  return y > pts[h][1] - 1e-6 ? vs[h] : side > 0 ? vs[0] : vs[RING_N];
}
function rrect(c, x, y, w, h, rx, ry){   // rounded rectangle path with elliptic corners (canvas px per metre differ along u and v)
  rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
  c.beginPath();
  c.ellipse(x + w - rx, y + ry, rx, ry, 0, -Math.PI / 2, 0); c.ellipse(x + w - rx, y + h - ry, rx, ry, 0, 0, Math.PI / 2);
  c.ellipse(x + rx, y + h - ry, rx, ry, 0, Math.PI / 2, Math.PI); c.ellipse(x + rx, y + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
  c.closePath();
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
/* plug-door leaf that follows the body section between y0 and y1 on side s (±1), w wide along x and centred on x = 0, its outer face
   `out` proud of the skin and `thick` deep, with a window through it (win: half width, bottom, top). Its faces bend at the ring
   heights, as the skin does. Groups: 0 the outer face and the edges round the leaf, 1 the inner face, 2 the window's reveals.
   pane: the window's glass, halfway through the leaf and 1 cm into the reveals all round, facing out */
function doorLeafGeo(pts, s, y0, y1, w, [wx, wy0, wy1], out = 0.012, thick = 0.06){
  const rows = (a, b, cut = []) => [a, b, ...cut, ...pts.slice(1, RING_N / 2).map(q => q[1]).filter(y => y > a && y < b)].sort((p, q) => p - q).filter((y, k, l) => !k || y - l[k - 1] > 1e-4);
  const at = (x, y, d) => [x, y, s * (zAtY(pts, y) + out - d)], ya = rows(y0, y1, [wy0, wy1]), yw = ya.filter(y => y >= wy0 && y <= wy1), xs = [-w / 2, -wx, wx, w / 2], D = [0, thick];
  const N = (x, y, z) => new THREE.Vector3(x, y, z), hole = (x, y) => Math.abs(x) < wx && y > wy0 && y < wy1, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const build = sheets => {   // [group, A, B, f(a, b) -> point, the way it faces, cells to leave out]: a grid of quads over A x B per sheet
    const pos = [], idx = [[], [], []], g = new THREE.BufferGeometry();
    for (const [k, A, B, f, n, skip] of sheets){
      const o = pos.length / 3, v = (i, j) => o + i * B.length + j;
      for (const p of A) for (const q of B) pos.push(...f(p, q));
      for (let i = 0; i + 1 < A.length; i++) for (let j = 0; j + 1 < B.length; j++){
        if (skip && skip((A[i] + A[i + 1]) / 2, (B[j] + B[j + 1]) / 2)) continue;
        const q = [v(i, j), v(i + 1, j), v(i + 1, j + 1), v(i, j + 1)];
        a.fromArray(pos, 3 * q[0]); b.fromArray(pos, 3 * q[1]).sub(a); c.fromArray(pos, 3 * q[2]).sub(a);
        if (b.cross(c).dot(n) < 0) q.reverse();
        idx[k].push(q[0], q[1], q[2], q[0], q[2], q[3]);
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx.flat());
    let start = 0; idx.forEach((l, k) => { if (l.length) g.addGroup(start, l.length, k); start += l.length; });
    g.computeVertexNormals();
    return g;
  };
  return {
    leaf:build([
      [0, xs, ya, (x, y) => at(x, y, 0), N(0, 0, s), hole], [1, xs, ya, (x, y) => at(x, y, thick), N(0, 0, -s), hole],
      [0, [-w / 2, w / 2], D, (x, d) => at(x, y1, d), N(0, 1, 0)], [0, [-w / 2, w / 2], D, (x, d) => at(x, y0, d), N(0, -1, 0)],
      [0, ya, D, (y, d) => at(-w / 2, y, d), N(-1, 0, 0)], [0, ya, D, (y, d) => at(w / 2, y, d), N(1, 0, 0)],
      [2, yw, D, (y, d) => at(-wx, y, d), N(1, 0, 0)], [2, yw, D, (y, d) => at(wx, y, d), N(-1, 0, 0)],
      [2, [-wx, wx], D, (x, d) => at(x, wy0, d), N(0, 1, 0)], [2, [-wx, wx], D, (x, d) => at(x, wy1, d), N(0, -1, 0)],
    ]),
    pane:build([[0, [-wx - 0.01, wx + 0.01], rows(wy0 - 0.01, wy1 + 0.01), (x, y) => at(x, y, thick / 2), N(0, 0, s)]]),
  };
}
const LIV = {   // TGV inOui (Duplex 2N2): off-white power cars with a black mask and a Carmillon stripe, silver and anthracite coaches
  white:'#ecebe6', black:'#18191c', band:'#3e4043', rib:'#26282a', ribLit:'#6f7276', grille:'#1d1f22', blade:'#8d8f8e', skirt:'#3a3c3d', grey:'#9a9b99', roof:'#a6a9ab', seam:'#8f9398',
  silver:'#d2d4d6', anthracite:'#4a4c50', low:'#a4a6a6', coachRoof:'#a9adb1', line:'#e0467a',
  glass:'#1c2530', door:'#20262c', gasket:'#262b31',
};
/* The "TGV inOui" logo, built from strokes in metres (x-height 0.45, stroke 0.085; only "TGV" is set in a font) at k px/m: "!n" in
   `ink` (the dot red), "Oui" in `red`, a small "TGV" over the "!n". Also returned: a copy turned half a turn, for the -z walls,
   which show their part of the canvas upside down from outside, and the extent in metres about the start of the baseline. */
function inouiLogo(k, ink, red){
  const X0 = -0.01, X1 = 1.75, Y0 = -0.08, Y1 = 0.70, sw = 0.085, xh = 0.45;
  const img = document.createElement('canvas'); img.width = Math.ceil((X1 - X0) * k); img.height = Math.ceil((Y1 - Y0) * k);
  const c = img.getContext('2d');
  c.setTransform(k, 0, 0, -k, -X0 * k, Y1 * k);   // metres, y up
  const rect = (x0, y0, x1, y1, col) => { c.fillStyle = col; c.fillRect(x0, y0, x1 - x0, y1 - y0); };
  const dot = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
  const ring = (x, y, r0, r1, a0, a1, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r1, a0, a1); c.arc(x, y, r0, a1, a0, true); c.closePath(); c.fill(); };
  rect(0, 0.11, sw, xh, ink); dot(sw / 2, 0.04, 0.04, red);                                                                  // "!", an i upside down
  rect(0.135, 0, 0.135 + sw, xh, ink); rect(0.535 - sw, 0, 0.535, 0.25, ink); ring(0.335, 0.25, 0.2 - sw, 0.2, 0, Math.PI, ink);   // "n"
  ring(0.889, 0.26, 0.324 - 0.095, 0.324, 0, Math.PI * 2, red);                                                              // "O", past the x-height both ways
  rect(1.243, 0.18, 1.243 + sw, xh, red); rect(1.603 - sw, 0, 1.603, xh, red); ring(1.423, 0.18, 0.18 - sw, 0.18, Math.PI, Math.PI * 2, red);   // "u"
  rect(1.653, 0, 1.653 + sw, 0.33, red); dot(1.653 + sw / 2, 0.41, 0.042, red);                                              // "i"
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = `${(0.17 / 0.716 * k).toFixed(1)}px Arial, Helvetica, sans-serif`; c.fillStyle = ink; c.textBaseline = 'alphabetic';   // cap height 0.17
  c.translate(-X0 * k, (Y1 - 0.524) * k); c.scale(0.42 * k / c.measureText('TGV').width, 1); c.fillText('TGV', 0, 0);   // 0.42 m wide
  const rot = document.createElement('canvas'); rot.width = img.width; rot.height = img.height;
  const r = rot.getContext('2d'); r.translate(img.width, img.height); r.rotate(Math.PI); r.drawImage(img, 0, 0);
  return { img, rot, x0:X0, x1:X1, y0:Y0, y1:Y1 };
}
/* Lays the logo on a lofted skin one canvas column at a time, so that it follows the section: cx(x) is the canvas column of the car's
   x (linear), cy(x, y, s) the canvas row of height y on wall s (+1: +z). The logo's baseline starts at (x0, y0); sc: car metres per logo metre. */
function stampLogo(c, logo, cx, cy, s, x0, y0, sc){
  const xa = x0 + logo.x0 * sc, xb = x0 + logo.x1 * sc, ya = y0 + logo.y0 * sc, yb = y0 + logo.y1 * sc;
  const a = cx(0), k = cx(1) - a, src = s > 0 ? logo.img : logo.rot, sw = src.width / ((xb - xa) * k);
  for (let col = Math.floor(cx(xa)); col < Math.ceil(cx(xb)); col++){
    const x = (col + 0.5 - a) / k, f = (x - xa) / (xb - xa); if (f < 0 || f > 1) continue;
    const t = cy(x, yb, s), b = cy(x, ya, s), sx = Math.min(src.width - sw, Math.max(0, f * src.width - sw / 2));
    c.drawImage(src, sx, 0, sw, src.height, col, Math.min(t, b), 1, Math.abs(b - t));
  }
}
const LIN = { floor:'#3a3f46', wall:'#d6d1c7', wallUp:'#dcd7ce', rack:'#8f959c', ceil:'#eeebe4', reveal:'#aaa59c', end:'#cbc5ba' };   // coach lining (inside of the shell)

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
    const lu = []; for (let i = 1; i < R; i++) for (let k = 0; k < M; k++) lu.push(0.5, pos[3 * (i * W + j0 + k) + 1] / 2);   // v: height / 2 m, for the two-tone paint
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2)); lg.setIndex(li);
    return lg;
  };
  return { hz, leaf:{ '1':leaf(1), '-1':leaf(-1) } };
}
const PC = (() => {
  const yBot = 1.0, yTop = 4.25, w = TGV.HALF_W;
  const sec = u => [yBot - 0.3 * u, Math.max(NOSE.y0 + 0.05, yTop - 2.55 * Math.pow(u, 1.5)), w * (1 - 0.5 * u * u), w * (0.9 - 0.42 * u * u), 4 - 1.8 * u];   // u 0 at PC_NOSE0, 1 at PC_TIP
  const nose = u => sectionPts(...sec(u)), uAt = x => (x - TGV.PC_NOSE0) / (TGV.PC_TIP - TGV.PC_NOSE0);
  const body = sectionPts(yBot, yTop, w, w * 0.9, 4), rings = [{ x:TGV.PC_REAR, pts:body }, { x:TGV.PC_NOSE0, pts:body }];
  for (let k = 1; k <= 12; k++){ const u = k / 12; rings.push({ x:TGV.PC_NOSE0 + (TGV.PC_TIP - TGV.PC_NOSE0) * u, pts:nose(u) }); }
  const dome = [];
  for (let k = 0; k <= 12; k++){
    const a = (k / 12) * Math.PI / 2, x = TGV.PC_TIP + NOSE.D * Math.sin(a), c = Math.cos(a);
    dome.push({ x, pts:nose(uAt(x)).map(([z, y]) => [z * c, NOSE.y0 + (y - NOSE.y0) * c]) });
  }
  const vs = [0];   // v of each ring point by arc length round the body section, as on the trailers: texels keep their shape round the flanks
  for (let j = 1; j <= RING_N; j++){ const [z0, y0] = body[j - 1], [z1, y1] = body[j % RING_N]; vs.push(vs[j - 1] + Math.hypot(z1 - z0, y1 - y0)); }
  const per = vs[RING_N]; vs.forEach((v, j) => { vs[j] = v / per; });
  const geo = loftGeo(rings, vs), hatch = noseHatchGeo(geo.body, rings[rings.length - 2], dome), L = TGV.PC_TIP - TGV.PC_REAR;
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
  const lamps = { head:flank(10.67, 10.97, 1.35, 1.55), tail:flank(10.50, 10.63, 1.37, 1.53), top:lens(9.02, 9.24, Math.PI / 2 - 0.025, Math.PI / 2 + 0.025) };   // tails beside the heads on the mask; top: above the windshield
  /* Livery drawn in metres: x along the car, y up the wall on side s (+1: +z). u runs along x and v is read off the loft itself at x,
     facet by facet (the nose law between two rings stands up to 12 mm off them), so a shape lands where it is drawn, round the nose
     too; canvas rows run from v 1 at the top (flipY). Any height over the roof maps onto its centre line, any under the floor onto the
     bottom one. */
  const ux = x => (x - TGV.PC_REAR) / L;
  const vLoft = (x, y, s) => {   // v at height y on side s at x: across each quad, from its ring point a to its diagonal (loftGeo's a, b + 1) to a + 1
    let i = 0; while (i < rings.length - 2 && rings[i + 1].x < x) i++;
    const p = rings[i].pts, q = rings[i + 1].pts, f = Math.min(1, Math.max(0, (x - rings[i].x) / (rings[i + 1].x - rings[i].x))), h = RING_N / 2;
    for (let k = 0; k < h; k++){
      const a = s > 0 ? k : h + k, b = (a + 1) % RING_N, ts = [0, f, 1], ys = [p[a][1] + (q[a][1] - p[a][1]) * f, p[a][1] + (q[b][1] - p[a][1]) * f, p[b][1] + (q[b][1] - p[b][1]) * f];
      for (let e = 0; e < 2; e++) if (ys[e] !== ys[e + 1] && (y - ys[e]) * (y - ys[e + 1]) <= 0) return vs[a] + (ts[e] + (y - ys[e]) / (ys[e + 1] - ys[e]) * (ts[e + 1] - ts[e])) * (vs[a + 1] - vs[a]);
    }
    return y > p[h][1] + (q[h][1] - p[h][1]) * f - 1e-6 ? vs[h] : s > 0 ? vs[0] : vs[RING_N];
  };
  const vj = j => { const a = Math.floor(j); return vs[a] + (vs[a + 1] - vs[a]) * (j - a); };   // v at a fractional ring point
  const painter = (c, W, H) => {
    const cx = x => ux(x) * W, cy = (x, y, s) => (1 - vLoft(x, y, s)) * H;
    const path = (s, xy, n = 8, closed = true) => {   // polygon (or polyline) with each edge cut in n, so that it bends with the section
      c.beginPath();
      for (let i = 0; i < (closed ? xy.length : xy.length - 1); i++){
        const [x0, y0] = xy[i], [x1, y1] = xy[(i + 1) % xy.length];
        for (let k = 0; k < n; k++){ const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; i || k ? c.lineTo(cx(x), cy(x, y, s)) : c.moveTo(cx(x), cy(x, y, s)); }
      }
      if (closed) c.closePath(); else { const [x, y] = xy[xy.length - 1]; c.lineTo(cx(x), cy(x, y, s)); }
    };
    const fill = (s, xy, col, n) => { path(s, xy, n); c.fillStyle = col; c.fill(); };
    const line = (s, xy, col, px, closed = false) => { path(s, xy, 8, closed); c.strokeStyle = col; c.lineWidth = px; c.stroke(); };
    return { cx, cy, path, fill, line };
  };
  const rounded = (xy, r, n = 5) => xy.flatMap((b, i) => {   // polygon with its corners rounded r back along each edge (quadratic)
    const a = xy[(i + xy.length - 1) % xy.length], d = xy[(i + 1) % xy.length], la = Math.hypot(a[0] - b[0], a[1] - b[1]), ld = Math.hypot(d[0] - b[0], d[1] - b[1]);
    const p = [b[0] + (a[0] - b[0]) * r / la, b[1] + (a[1] - b[1]) * r / la], q = [b[0] + (d[0] - b[0]) * r / ld, b[1] + (d[1] - b[1]) * r / ld];
    return Array.from({ length:n + 1 }, (_, k) => { const t = k / n, u = 1 - t; return [0, 1].map(e => u * u * p[e] + 2 * u * t * b[e] + t * t * q[e]); });
  });
  const SIDE_WIN = rounded([[8.32, 2.86], [8.32, 3.46], [8.86, 3.2], [8.98, 2.86]], 0.08);   // cab side window, under the mask
  const WS = rounded([[9.3, 16], [10.75, 18.2], [10.75, 21.8], [9.3, 24]].map(([x, j]) => [x, j / 5]), 0.2).map(([x, t]) => [x, t * 5]);   // windshield: x, ring point (20: the top centre); its corners rounded as if ring points were 0.2 m apart (0.15 to 0.4 m there), the rear ones level with the driver's eye
  const windows = (c, W, H) => {   // windshield across the nose top + cab side windows: painted on the livery, cut out of the body on cars with a cab
    c.beginPath();
    WS.forEach(([x0, j0], i) => { const [x1, j1] = WS[(i + 1) % WS.length]; for (let k = 0; k < 8; k++){ const f = k / 8, X = ux(x0 + (x1 - x0) * f) * W, Y = (1 - vj(j0 + (j1 - j0) * f)) * H; i || k ? c.lineTo(X, Y) : c.moveTo(X, Y); } });
    c.closePath(); c.fill();
    const p = painter(c, W, H); [1, -1].forEach(s => { p.path(s, SIDE_WIN, 16); c.fill(); });
  };
  const EDGE = new THREE.SplineCurve([[7.35, 4.08], [8.2, 4.06], [8.6, 3.86], [9.0, 3.5], [9.4, 3.05], [9.8, 2.45], [10.2, 1.85], [10.45, 1.42], [10.62, 1.26], [11.0, 1.25], [11.35, 1.25]]
    .map(([x, y]) => new THREE.Vector2(x, y))).getPoints(160).map(v => [v.x, v.y]);   // lower edge of the black mask: from the cab roof down past the lamps to the chin
  const STRIPE = (() => {   // Carmillon stripe under the mask edge: fine at the roof, 0.26 m across near the nose, cut square just behind the lamps
    const top = EDGE.filter(([x]) => x >= 7.5 && x <= 10.48);
    const bot = top.map(([x, y], i) => {
      const [xa, ya] = top[Math.max(0, i - 1)], [xb, yb] = top[Math.min(top.length - 1, i + 1)], d = Math.hypot(xb - xa, yb - ya), wS = 0.26 * Math.pow(Math.min(1, (x - 7.5) / 1.6), 0.7);
      return [x + wS * (yb - ya) / d, y - wS * (xb - xa) / d];
    });
    return [...top, ...bot.reverse()];
  })();
  const logo = inouiLogo(200, '#747572', '#b8304a');
  const tex = canvasTex(2048, 1024, (c, W, H) => {
    const p = painter(c, W, H), R = TGV.PC_REAR, UP = 9;
    c.fillStyle = LIV.white; c.fillRect(0, 0, W, H);
    [1, -1].forEach(s => {
      p.fill(s, [[R, 3.95], [7.35, 3.95], [7.35, UP], [R, UP]], LIV.roof);
      p.fill(s, [[R, -UP], [9.5, -UP], [9.5, 0.9], [9.1, 1.35], [R, 1.35]], LIV.skirt);                                // skirt, rising at its front end
      p.fill(s, [[R, 1.35], [-6.6, 1.35], [-7.3, 1.85], [R, 1.85]], LIV.grey);                                         // grey wedge at the rear
      p.fill(s, [[R, 1.85], [6.1, 1.85], [6.1, 2.72], [R, 2.72]], LIV.band);                                           // ribbed band along the machine room
      for (let x = R + 0.08; x < 6.1; x += 0.08){ p.line(s, [[x, 1.85], [x, 2.72]], LIV.rib, 2); p.line(s, [[x + 0.025, 1.85], [x + 0.025, 2.72]], LIV.ribLit, 1.5); }   // lit edge: the ribs still show from afar
      p.fill(s, [[R, 2.72], [6.1, 2.72], [6.1, 2.85], [R, 2.85]], LIV.black);
      p.fill(s, [[R, 2.86], [-7.1, 2.86], [-7.1, 2.94], [R, 2.94]], LIV.line);                                         // the coaches' line, run onto the car
      // cooling air intakes under the roof: one louvred strip in nine panels, pale blades on a dark recess (dark boxes apart read as windows)
      p.fill(s, [[-6.36, 3.43], [6.01, 3.43], [6.01, 3.92], [-6.36, 3.92]], LIV.grille);
      for (let y = 3.46; y < 3.91; y += 0.05) p.line(s, [[-6.36, y], [6.01, y]], LIV.blade, 2);
      for (let k = 0; k <= 9; k++){ const x = 6.01 - k * 1.375; p.line(s, [[x, 3.43], [x, 3.92]], LIV.grille, 5); }
      p.line(s, [[6.2, 1.42], [6.8, 1.42], [6.8, 3.18], [6.6, 3.38], [6.2, 3.38]], LIV.seam, 2.5, true);              // cab door
      p.fill(s, [[6.71, 2.2], [6.76, 2.2], [6.76, 2.36], [6.71, 2.36]], LIV.band);                                     // its handle
      p.line(s, rounded([[9.15, 1.4], [9.95, 1.4], [9.62, 2.3], [9.15, 2.3]], 0.06), LIV.seam, 2.5, true);            // hatch in the nose side
      p.fill(s, [...EDGE, [11.35, UP], [7.35, UP]], LIV.black, 1);                                                   // black mask
      const [x0, y0] = STRIPE[0], [x1, y1] = EDGE.filter(([x]) => x <= 10.48).pop(), gr = c.createLinearGradient(p.cx(x0), p.cy(x0, y0, s), p.cx(x1), p.cy(x1, y1, s));
      gr.addColorStop(0, '#d9577a'); gr.addColorStop(0.5, '#c8435f'); gr.addColorStop(1, '#b8304a');                // lighter up at the roof
      p.fill(s, STRIPE, gr, 1);
      stampLogo(c, logo, p.cx, p.cy, s, 7.02, 1.98, 1);
      p.line(s, SIDE_WIN, '#b4b8bc', 5, true);                                                                       // window rim (the glass covers its inner half)
    });
    c.fillStyle = LIV.glass; windows(c, W, H);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, ux(TGV.PC_REAR + 0.25) * W, H);   // rear end shading
  });
  /* The cab openings' masks span only the nose top (the texture transform stretches them over the body, the clamped edge fills the
     rest): 2.6 by 4.9 mm a texel keeps the cut edges smooth a metre from the driver's eye, where 2 cm over the whole car alpha tested
     into scallops. */
  const Z = { u0:ux(8.2), u1:ux(10.9), v0:vAt(body, vs, 2.8, 1), v1:vAt(body, vs, 2.8, -1) }, ku = 1 / (Z.u1 - Z.u0), kv = 1 / (Z.v1 - Z.v0);
  const mask = (bg, fg) => {
    const t = canvasTex(1024, 1024, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.translate(-Z.u0 * ku * W, -(1 - Z.v1) * kv * H); c.fillStyle = fg; windows(c, W * ku, H * kv); });
    t.colorSpace = THREE.NoColorSpace; t.repeat.set(ku, kv); t.offset.set(-Z.u0 * ku, -Z.v0 * kv);
    return t;
  };
  const hatchTex = canvasTex(4, 128, (c, W, H) => { c.fillStyle = LIV.white; c.fillRect(0, 0, W, H); c.fillStyle = LIV.black; c.fillRect(0, 0, W, H * (1 - 1.25 / 2)); });   // snout (v: height / 2 m): the mask down to 1.25 m, the white chin under it
  return { geo, hatch, hatchTex, lamps, tex, alpha:mask('#fff', '#000'), glassAlpha:mask('#000', '#fff'), rings, yBot, yTop };
})();
const _lg = new THREE.Vector3(), _ln = new THREE.Vector3();
function lensGlow(geo){   // where a lens's glow sits: 0.2 m out from its middle along its normal, clear of the curved skin
  geo.computeBoundingBox(); geo.boundingBox.getCenter(_lg);
  const n = geo.getAttribute('normal'); _ln.set(0, 0, 0);
  for (let k = 0; k < n.count; k++){ _ln.x += n.getX(k); _ln.y += n.getY(k); _ln.z += n.getZ(k); }
  return _lg.addScaledVector(_ln.normalize(), 0.2).toArray();
}
function buildPowerCarBody(parent, cx, dir, mk, withCoupler = true, cabin = false){   // mk: material factory (mat or pmat); dir +1 nose toward +x; cabin: windows cut out onto a fitted cab
  const g = new THREE.Group(); g.position.x = cx; if (dir < 0) g.rotation.y = Math.PI;
  const bm = mk(0xffffff, Object.assign({ map:PC.tex, roughness:0.45, metalness:0.2 }, cabin ? { alphaMap:PC.alpha, alphaTest:0.5, side:THREE.FrontSide } : {}));
  const bodyM = new THREE.Mesh(PC.geo.body, bm); bodyM.castShadow = true; bodyM.receiveShadow = true; g.add(bodyM);
  const capM = mk(0x22272c, { roughness:0.9 }), rearM = mk(0x2b3238, { roughness:0.8 });   // capM: the coupling face, dark, only seen with the hatch open
  const cf = new THREE.Mesh(PC.geo.capFront, capM), cr = new THREE.Mesh(PC.geo.capRear, rearM); cf.castShadow = cr.castShadow = true; g.add(cf, cr);
  const shell = { mats:[bm, capM, rearM], meshes:[bodyM, cf, cr] };   // what the shell opacity control drives on a plain power car
  if (cabin){   // a plain lining inside the fitted cab instead of the livery's back, then tinted glass in the openings, seen from outside only (front faces point out)
    const lm = mk(0x80868c, { alphaMap:PC.alpha, alphaTest:0.5, roughness:0.85, metalness:0, side:THREE.BackSide }), li = new THREE.Mesh(PC.geo.body, lm);
    g.add(li); shell.mats.push(lm); shell.meshes.push(li);
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
  addHalos(g, hl, [...PC.lamps.head, PC.lamps.top].map(lensGlow), 1.1, cabin, true); addHalos(g, tl, PC.lamps.tail.map(lensGlow), 0.6, cabin, false);   // cabin: one of our own power cars
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
const allCoaches = [], COACH_NEAR = 60;      // every trailer of every set (own, parked, opposing); interiors are drawn within COACH_NEAR m of the camera (further out a head is 3 px)
const winMats = [];                          // every coach's window glass seen from afar, lit from inside in the dark (updateLights, 03f4-route.js)
const SALOON = { value:new THREE.Color(0) };   // the saloon lights: sky light only the coaches' insides get, so seats and people stay lit at night and in tunnels (updateLights)
function saloonLit(m){   // add SALOON to what lights this material, on top of its own patch if any (the people's)
  const own = m.onBeforeCompile, key = 'saloon' + (own ? own.name : '');
  m.onBeforeCompile = (sh, r) => {
    own?.(sh, r); sh.uniforms.saloon = SALOON;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 saloon;')
      .replace('#include <lights_fragment_end>', '#if defined( RE_IndirectDiffuse )\nirradiance += saloon;\n#endif\n#include <lights_fragment_end>');
  };
  m.customProgramCacheKey = () => key;
  return m;
}
const DECK = { lo:0.92, up:2.46 };           // floor heights of the two decks (the windows sit at 1.6..2.2 and 3.0..3.75): 1.48 m under the upper floor, room to stand
const SEAT_VIEW = [9.4, 16.5];               // x from the coach's rear end of the window seats kept free for the viewer, on both decks of every coach: row 7 faces +x, row 14 faces -x (in coach 1 each looks onto a window)
const SEAT_ROWS = {};
function seatRows(L){   // per body length, x from the car's -x end: rows [x, facing ±1] 0.9 m apart from x 4.0 to short of L - 0.9, bay the x of the tables
  if (!SEAT_ROWS[L]){
    const n = Math.floor((L - 6.6) / 0.9) + 2, h = Math.ceil(n / 2), rows = [];
    for (let k = 0; k < n; k++) rows.push(k < h ? [4.0 + 0.9 * k, 1] : [4.8 + 0.9 * k, -1]);   // the rear half faces +x, the front half -x: they meet face to face over the tables (1.7 m seat to seat), so half the saloon rides forward either way
    SEAT_ROWS[L] = { rows, bay:3.95 + 0.9 * h };
  }
  return SEAT_ROWS[L];
}
const SEAT_GEO = (() => {                    // cushion + backrest facing +x, origin on the floor at the seat centre, 0.44 wide
  const s = new THREE.Shape(); s.moveTo(-0.22, 0.28); s.lineTo(0.22, 0.28); s.lineTo(0.22, 0.42); s.lineTo(-0.12, 0.42); s.lineTo(-0.12, 0.95); s.lineTo(-0.22, 0.95); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth:0.44, bevelEnabled:false }); g.translate(0, 0, -0.22); return g;
})();
const SEAT_COL = [new THREE.Color(0x7a2233), new THREE.Color(0x24506b)];   // first class burgundy, second class blue
/* Duplex coach interior: floors, a stair at the door end and two decks of 2+2 seats facing both ways (seatRows). Drawn when the camera is near the coach
   (seen through the windows or from inside) and while the shell control fades the skin. One group per coach, so the curve code
   carries each coach with its own car. One passenger slot per seat (instanced): seated, empty, or walking between the seat and
   the platform-side door (see the passenger block below). */
function mergeGeos(geos, skip = []){   // one indexed geometry (position + normal) from several; skip[k]: index ranges [start, end) of geos[k] to leave out
  const pos = [], nrm = [], idx = [];
  geos.forEach((b, k) => {
    const o = pos.length / 3, ix = b.index.array; pos.push(...b.getAttribute('position').array); nrm.push(...b.getAttribute('normal').array);
    for (let i = 0; i < ix.length; i++) if (!(skip[k] && i >= skip[k][0] && i < skip[k][1])) idx.push(ix[i] + o);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}
/* People. One figure (about 850 triangles), built standing, facing +x, feet at y 0, 1.45 m tall (the Duplex here is a little
   lower than the real one, so are its people), posed per instance in the vertex shader: sitting (hips down onto the cushion,
   thighs forward, shins to the floor), walking (legs and arms swing with the stride phase, the body bobs), the head turned, or
   bowed over a phone. Each vertex carries its part (paxPart); each instance its colours (paxCol: shirt, trousers, skin, hair as
   0xRRGGBB), its look (paxLook: height, build, style bits) and its pose (paxPose: sit 0..1, stride phase, stride 0..1, head turn).
   Parts: 0 torso, 1 neck, 2 backpack, 3 head, 4 hair, 5 long hair, 6 upper arm, 7 forearm, 8 hand, 9 phone, 10 pelvis,
   11 thigh, 12 shin, 13 shoe. Style bits: 1 long hair, 2 short sleeves, 4 phone, 8 bare shins, 16 backpack, 32 x shoe colour,
   128 x bag colour. */
const PAX_SEAT = 0.47;   // the hips' height seated: on the cushion (SEAT_GEO's top is 0.42) through the thighs
const PAX_SHIRT = [0x3b5bdb, 0xc23b3b, 0x2f8f5b, 0xe0a030, 0x555c66, 0xd6d0c4, 0x7b3fa0, 0x1f6f8b, 0xf2f0ea, 0x22252b, 0x8a2f3c, 0x6b8fb8, 0xb5651d, 0x56733a, 0xe58fa0, 0x2a3a5c];
const PAX_SKIN = [0xf1c9a5, 0xe0ac7e, 0xc68a5a, 0x9c6a43, 0x6e4a2f, 0xf6d7bd];
const PAX_HAIR = [0x1c1714, 0x3a2618, 0x5e3b22, 0x8a5a2b, 0xc9a464, 0x9e9a94, 0xdcd8d0, 0x7a2e16];   // 5, 6: grey and white
const PAX_LEGS = [0x2b3140, 0x3b4a6b, 0x1f2328, 0x6b5a45, 0x4a4f57, 0x2f4a3a, 0xb8a888, 0x5a6d8c];
const PAX_GEO = (() => {
  const parts = [], lathe = (pts, seg, sx = 1) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).scale(sx, 1, 1);   // profiles run up from the bottom: normals out
  const add = (k, g) => parts.push([k, g]);
  add(0, lathe([[0, 0.8], [0.125, 0.8], [0.135, 0.92], [0.152, 1.06], [0.15, 1.15], [0.12, 1.21], [0.05, 1.235], [0, 1.24]], 8, 0.66));
  add(1, new THREE.CylinderGeometry(0.036, 0.042, 0.1, 6, 1, true).translate(0, 1.25, 0));
  add(2, new THREE.BoxGeometry(0.12, 0.3, 0.24).translate(-0.15, 1.02, 0));
  add(3, new THREE.SphereGeometry(1, 8, 6).scale(0.088, 0.105, 0.078).translate(0.005, 1.345, 0));
  add(4, new THREE.SphereGeometry(1, 8, 4, 0, 2 * Math.PI, 0, 0.6 * Math.PI).rotateZ(0.65).scale(0.095, 0.113, 0.086).translate(0.005, 1.345, 0));   // a cap tipped back: the forehead clear, the nape covered
  add(5, new THREE.SphereGeometry(1, 8, 6).scale(0.065, 0.14, 0.09).translate(-0.045, 1.28, 0));   // long hair: down the nape onto the shoulders
  add(10, lathe([[0, 0.68], [0.11, 0.69], [0.13, 0.76], [0.125, 0.86], [0, 0.86]], 8, 0.7));
  for (const z of [0.19, -0.19]){
    add(6, lathe([[0, 0.88], [0.04, 0.89], [0.045, 1.0], [0.05, 1.12], [0.045, 1.18], [0, 1.2]], 6).translate(0, 0, z));
    add(7, lathe([[0, 0.68], [0.032, 0.69], [0.038, 0.8], [0.042, 0.9], [0, 0.93]], 6).translate(0, 0, z));
    add(8, new THREE.SphereGeometry(1, 6, 4).scale(0.038, 0.07, 0.028).translate(0, 0.615, z));
  }
  add(9, new THREE.BoxGeometry(0.01, 0.14, 0.07).translate(0.03, 0.6, -0.17));   // in the -z hand
  for (const z of [0.08, -0.08]){
    add(11, lathe([[0, 0.385], [0.05, 0.395], [0.058, 0.43], [0.072, 0.62], [0.07, 0.72], [0, 0.76]], 6).translate(0, 0, z));
    add(12, lathe([[0, 0.06], [0.04, 0.065], [0.045, 0.2], [0.055, 0.34], [0.05, 0.41], [0, 0.43]], 6).translate(0, 0, z));
    add(13, new THREE.BoxGeometry(0.21, 0.065, 0.085).translate(0.055, 0.0325, z));
  }
  const pos = [], nrm = [], prt = [], idx = [];
  for (const [k, g] of parts){
    const o = pos.length / 3, P = g.getAttribute('position'), N = g.getAttribute('normal');
    for (let i = 0; i < P.count; i++){ pos.push(P.getX(i), P.getY(i), P.getZ(i)); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); prt.push(k); }
    const I = g.index.array, same = (a, b) => P.getX(a) === P.getX(b) && P.getY(a) === P.getY(b) && P.getZ(a) === P.getZ(b);
    for (let t = 0; t < I.length; t += 3){   // a lathe closes on its axis with a ring of zero-area triangles: left out
      if (same(I[t], I[t + 1]) || same(I[t + 1], I[t + 2]) || same(I[t], I[t + 2])) continue;
      idx.push(I[t] + o, I[t + 1] + o, I[t + 2] + o);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('paxPart', new THREE.Float32BufferAttribute(prt, 1)); g.setIndex(idx);
  return g;
})();
const glf = v => v.toFixed(1);   // an integer colour as a GLSL float (exact below 2^24)
const PAX_VERT = `
attribute float paxPart; attribute vec4 paxCol; attribute vec4 paxLook; attribute vec4 paxPose;
#ifdef PAX_COLOR
varying vec3 vPaxCol; varying vec4 vPaxFace;
vec3 paxRGB(float v){ vec3 c = vec3(floor(v / 65536.0), mod(floor(v / 256.0), 256.0), mod(v, 256.0)) / 255.0;
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
float paxPick(float i, vec4 v){ return i < 0.5 ? v.x : i < 1.5 ? v.y : i < 2.5 ? v.z : v.w; }
#endif
vec2 paxRot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
float paxBit(float s, float b){ return mod(floor(s / b), 2.0); }
vec3 paxBend(vec3 p, inout vec3 n){
  int ip = int(paxPart + 0.5);
  float hs = paxLook.x, bw = paxLook.y, st = paxLook.z, sit = paxPose.x, ph = paxPose.y, amp = paxPose.z;
  float side = p.z < 0.0 ? -1.0 : 1.0, phone = paxBit(st, 4.0), held = side < 0.0 ? phone : 0.0;
#ifdef PAX_COLOR
  float k = ip == 0 || ip == 6 ? paxCol.x : ip == 10 || ip == 11 ? paxCol.y : ip == 1 || ip == 3 || ip == 8 ? paxCol.z : ip == 4 || ip == 5 ? paxCol.w
    : ip == 7 ? (paxBit(st, 2.0) > 0.5 ? paxCol.z : paxCol.x) : ip == 12 ? (paxBit(st, 8.0) > 0.5 ? paxCol.z : paxCol.y)
    : ip == 13 ? paxPick(mod(floor(st / 32.0), 4.0), vec4(${[0x1d1d1f, 0x4a3426, 0xe8e6e1, 0x6b6e73].map(glf)}))
    : ip == 2 ? paxPick(mod(floor(st / 128.0), 4.0), vec4(${[0x2a2d33, 0x7a3b2e, 0x3d5a80, 0x5c5f3a].map(glf)})) : ${glf(0x151719)};
  vPaxCol = paxRGB(k);
  vPaxFace = vec4(p - vec3(0.005, 1.345, 0.0), ip == 3 ? 1.0 : 0.0);
#endif
  float hide = ip == 5 ? 1.0 - paxBit(st, 1.0) : ip == 9 ? 1.0 - phone : ip == 2 ? max(1.0 - paxBit(st, 16.0), step(0.5, sit)) : 0.0;
  p *= vec3(bw, hs, bw); n /= vec3(bw, hs, bw);
  float hipY = 0.74 * hs, kneeY = 0.41 * hs, shY = 1.15 * hs, elbY = 0.91 * hs, neckY = 1.25 * hs;
  float sw = sin(ph), fwd = side * sw, through = max(0.0, side * cos(ph));
  float th = acos(clamp((${PAX_SEAT.toFixed(3)} - 0.985 * kneeY) / (hipY - kneeY), -0.2, 0.7));   // seated: thigh down to a knee that leaves the shin (tipped 0.17) on the floor
  float thigh = mix(amp * 0.42 * fwd, th, sit), knee = mix(-amp * (0.8 * through + 0.1), 0.17 - th, sit);
  float shoulder = mix(-amp * 0.35 * fwd * (1.0 - held), 0.12, sit), elbow = mix(amp * (0.2 + 0.25 * max(0.0, -fwd)) * (1.0 - held), 0.95, sit) + held * (1.3 - 0.35 * sit);
  float inward = -side * mix(0.38 * sit, 0.3, held);   // the forearm swung in about the upper arm: the hands onto the thighs, the phone before the chest
  float lean = 0.06 * sit - 0.05 * amp, drop = (${PAX_SEAT.toFixed(3)} - hipY) * sit - 0.05 * amp * sw * sw;
  vec2 q = p.xy, m = n.xy;
  if (ip >= 11){
    if (ip >= 12){ q = paxRot(q - vec2(0.0, kneeY), knee) + vec2(0.0, kneeY); m = paxRot(m, knee); }
    q = paxRot(q - vec2(0.0, hipY), thigh) + vec2(0.0, hipY); m = paxRot(m, thigh);
  } else if (ip <= 9){
    if (ip >= 6){
      if (ip >= 7){
        q = paxRot(q - vec2(0.0, elbY), elbow) + vec2(0.0, elbY); m = paxRot(m, elbow);
        float az = side * 0.19 * bw; vec2 t = paxRot(vec2(q.x, p.z - az), inward), u = paxRot(vec2(m.x, n.z), inward);
        q.x = t.x; p.z = t.y + az; m.x = u.x; n.z = u.y;
      }
      q = paxRot(q - vec2(0.0, shY), shoulder) + vec2(0.0, shY); m = paxRot(m, shoulder);
    } else if (ip >= 3){
      float nod = -0.4 * phone, turn = paxPose.w * (1.0 - phone);
      q = paxRot(q - vec2(0.0, neckY), nod) + vec2(0.0, neckY); m = paxRot(m, nod);
      vec2 t = paxRot(vec2(q.x, p.z), turn), u = paxRot(vec2(m.x, n.z), turn);
      q.x = t.x; p.z = t.y; m.x = u.x; n.z = u.y;
    }
    q = paxRot(q - vec2(0.0, hipY), lean) + vec2(0.0, hipY); m = paxRot(m, lean);
  }
  p.xy = q; n.xy = m; p.y += drop;
  return mix(p, vec3(0.0, hipY + drop, 0.0), hide);   // a part this person has not got folds to a point
}
`;
function paxCompile(sh){   // one function for every people material: one shader program
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + PAX_VERT)
    .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal);\nvec3 paxP = paxBend(position, objectNormal);')
    .replace('#include <begin_vertex>', 'vec3 transformed = paxP;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaxCol; varying vec4 vPaxFace;')
    .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb *= vPaxCol;
if (vPaxFace.w > 0.5 && vPaxFace.x > 0.04){ vec2 e = vec2(vPaxFace.y - 0.012, abs(vPaxFace.z) - 0.03); if (dot(e, e) < 0.00012) diffuseColor.rgb *= 0.12; }   // the eyes`);
}
function paxDepthCompile(sh){
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + PAX_VERT)
    .replace('#include <begin_vertex>', 'vec3 paxN = vec3(0.0, 1.0, 0.0);\nvec3 transformed = paxBend(position, paxN);');
}
function paxMat(mk){ const m = mk(0xffffff, { roughness:0.8, metalness:0 }); m.defines = { PAX_COLOR:'' }; m.onBeforeCompile = paxCompile; return m; }
function paxDepthMat(){ const m = new THREE.MeshDepthMaterial({ depthPacking:THREE.RGBADepthPacking }); m.onBeforeCompile = paxDepthCompile; return m; }   // the shadow of the posed figure
function paxMesh(n, mat){   // room for n people sharing the figure's buffers, none drawn yet
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'paxPart']) g.setAttribute(k, PAX_GEO.getAttribute(k));
  g.setIndex(PAX_GEO.index);
  for (const k of ['paxCol', 'paxLook', 'paxPose']) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(4 * n), 4));
  const m = new THREE.InstancedMesh(g, mat, n); m.count = 0;
  return m;
}
function paxLookAt(m, k, h){   // instance k of m dressed as person h (a 32-bit hash): the same person every time
  const C = m.geometry.attributes.paxCol.array, Lk = m.geometry.attributes.paxLook.array, u = hash32(h ^ 0x9e3779b9), v = hash32(u);
  const skin = h % 6, grey = (h >>> 3) % 100 < 10;
  C[4 * k] = PAX_SHIRT[(h >>> 10) % 16]; C[4 * k + 1] = PAX_LEGS[(h >>> 14) % 8]; C[4 * k + 2] = PAX_SKIN[skin];
  C[4 * k + 3] = PAX_HAIR[grey ? 5 + ((h >>> 5) & 1) : skin === 3 || skin === 4 ? (h >>> 7) & 1 : [0, 1, 1, 2, 2, 3, 4, 7][(h >>> 7) % 8]];
  Lk[4 * k] = 0.94 + ((v >>> 20) % 8) * 0.01; Lk[4 * k + 1] = 0.92 + ((v >>> 24) % 8) * 0.02;
  Lk[4 * k + 2] = (u % 100 < 42 ? 1 : 0) | ((u >>> 8) % 100 < 25 ? 2 : 0) | ((u >>> 16) % 100 < 22 ? 4 : 0) | (v % 100 < 12 ? 8 : 0) | ((v >>> 8) % 100 < 22 ? 16 : 0) | ((v >>> 16) & 3) << 5 | ((v >>> 18) & 3) << 7;
}
function paxPut(m, k, x, y, z, yaw, sit, ph, amp, turn){   // instance k of m at (x, y, z) facing yaw (0: +x), its pose
  _m4.compose(_p.set(x, y, z), _q.setFromAxisAngle(Y_UP, yaw), _s.setScalar(1)); m.setMatrixAt(k, _m4);
  const P = m.geometry.attributes.paxPose.array; P[4 * k] = sit; P[4 * k + 1] = ph % (2 * Math.PI); P[4 * k + 2] = amp; P[4 * k + 3] = turn;
}
const DECK_GEO = {};
function deckGeo(L, bar = false){   // per body length, x from the car's -x end: lower floor + upper floor + stair + tables (not in the bar car) in one mesh; in another, lit like a ceiling, what the lower deck sees overhead (the undersides of the upper floor, the bridge and the stair) and the bridge's parapets (in the floor's grey they showed black from the vestibule)
  const key = L + (bar ? 'b' : '');
  if (!DECK_GEO[key]){
    const x0 = 3.4, w = L - 3.43, xb = seatRows(L).bay;   // the upper floor runs to the front gangway and is open over the vestibule and the stair, but for a bridge from it to the rear gangway
    const br = new THREE.BoxGeometry(x0 - 0.03, 0.06, 0.9).translate(x0 / 2 + 0.015, DECK.up - 0.03, 0);   // the bridge, between parapets
    const par = [1, -1].map(s => new THREE.BoxGeometry(x0 - 0.03, 0.9, 0.03).translate(x0 / 2 + 0.015, DECK.up + 0.45, s * 0.46));
    par.push(new THREE.BoxGeometry(0.03, 0.9, 0.95).translate(x0 + 0.015, DECK.up + 0.45, 0.935));   // and a rail along the upper floor's edge over the well beside the stair, from the parapet to the wall (z 1.42 at its top)
    const sl = Math.hypot(1.7, DECK.up - DECK.lo), stair = g => g.rotateZ(Math.atan2(DECK.up - DECK.lo, 1.7)).translate(2.7, (DECK.lo + DECK.up) / 2 - 0.03, -0.9);   // stair: vestibule (x 1.85) up to the upper deck (x 3.55)
    const tb = [];   // the bay's tables on both decks and sides, on a pedestal: top 0.7 over the floor, clear of the aisle, the feet and the wall
    if (!bar) for (const y of [DECK.lo, DECK.up]) for (const s of [1, -1]) tb.push(new THREE.BoxGeometry(0.4, 0.04, 1.08).translate(xb, y + 0.68, s * 0.84), new THREE.BoxGeometry(0.06, 0.66, 0.06).translate(xb, y + 0.33, s * 0.72));
    DECK_GEO[key] = {
      floor:mergeGeos([new THREE.BoxGeometry(L - 0.2, 0.06, 2.28).translate(L / 2, DECK.lo - 0.03, 0), new THREE.BoxGeometry(w, 0.06, 2.98).translate(x0 + w / 2, DECK.up - 0.03, 0), br, stair(new THREE.BoxGeometry(sl, 0.06, 0.9)), ...tb], [null, [18, 24], [18, 24], [18, 24]]),   // the upper floor, the bridge and the stair without their -y faces
      ceil:mergeGeos([new THREE.PlaneGeometry(w, 2.98).rotateX(Math.PI / 2).translate(x0 + w / 2, DECK.up - 0.06, 0), new THREE.PlaneGeometry(x0 - 0.03, 0.9).rotateX(Math.PI / 2).translate(x0 / 2 + 0.015, DECK.up - 0.06, 0),
                      stair(new THREE.PlaneGeometry(sl, 0.9).rotateX(Math.PI / 2).translate(0, -0.03, 0)), ...par]),
    };
  }
  return DECK_GEO[key];
}
const Q0 = new THREE.Quaternion(), QB = new THREE.Quaternion(0, 1, 0, 0);   // QB: half a turn about y, for what faces -x
const hash32 = i => { i = Math.imul(i ^ (i >>> 16), 0x45d9f3b); i = Math.imul(i ^ (i >>> 16), 0x45d9f3b); return (i ^ (i >>> 16)) >>> 0; };
function buildCoach(parent, cm, xr, L, carNo){
  const g = new THREE.Group(); g.visible = false; parent.add(g);
  const bar = carNo % 10 === 4;   // car 4 (14, 24...) is the bar car: no seats, the bar upstairs (buildBar)
  const fl = new THREE.Mesh(deckGeo(L, bar).floor, cm.floor), ce = new THREE.Mesh(deckGeo(L, bar).ceil, cm.ceil); fl.position.x = ce.position.x = xr;
  const seat = [], deck = [], face = [], view = [];   // view[2 * deck + (facing -x ? 1 : 0)]: the viewer's seats
  if (!bar) for (const [d, y] of [[0, DECK.lo], [1, DECK.up]]) for (const [x, f] of seatRows(L).rows) for (const z of [-0.95, -0.48, 0.48, 0.95]){
    const v = f > 0 ? 0 : 1;
    if (z === 0.95 && Math.abs(x - SEAT_VIEW[v]) < 0.1) view[2 * d + v] = deck.length;
    seat.push(xr + x, y, z); deck.push(d); face.push(f);
  }
  const n = deck.length, cls = carNo % 10 <= 3 ? 0 : 1;                                 // cars 1..3 (11..13) are first class
  const seats = new THREE.InstancedMesh(SEAT_GEO, cm.seat, n), people = paxMesh(n, cm.people);
  // people: one instance per person in the coach, packed at the front (inst[seat] -> instance, slot[instance] -> seat) so only they are drawn; look[seat]: who sits there
  const c = { g, id:carNo, xr, L, n, seats, solid:[fl, ce], seat:new Float32Array(seat), deck:new Uint8Array(deck), face:new Int8Array(face), occ:new Uint8Array(n), view,
              look:new Uint32Array(n), inst:new Int16Array(n).fill(-1), slot:new Int16Array(n), people, paths:[], walk:[], crowd:[[], []], dirty:false, colDirty:false };
  for (let i = 0; i < n; i++){
    _m4.compose(_p.set(seat[3 * i], seat[3 * i + 1], seat[3 * i + 2]), face[i] > 0 ? Q0 : QB, _s.setScalar(1)); seats.setMatrixAt(i, _m4); seats.setColorAt(i, SEAT_COL[cls]);
  }
  const sphere = new THREE.Sphere(new THREE.Vector3(xr + L / 2, 2.5, 0), L / 2 + 1.5);   // people only move inside the coach and its doorway: one fixed bound for both instanced meshes
  for (const m of [seats, people]) m.boundingSphere = sphere;
  for (const m of bar ? [fl, ce] : [fl, ce, seats, people]) g.add(m);   // no shadows inside: the saloon is lit by its own lights (emissive lining and ceiling)
  paxSeed(c);
  if (bar) buildBar(c, cm);
  return c;
}
/* ---- the bar car (car 4 of every set, as on the Duplex): no seats. Its upper deck is the bar: a counter along the -z side from x 4.8 to
   9.4 with the barista's aisle behind it (coffee machine, grinder and drinks fridge on the back counter; till and pastry case on the
   front one), window ledges down both sides with two stools to a window, a speed screen on the wall over the fridge. Its lower deck past the stair's foot is the
   crew's store, shut by a partition with a staff door. Everything fixed is one mesh coloured per vertex, what glows another; the
   barista and four customers are a small people mesh of the car's own (c.bar.people), posed by poseBar while the car is drawn. The
   walker orders at the counter (the menu, 03h) or takes a free stool (walkSitStool) */
const BAR_FONT = '"Barlow Condensed","Arial Narrow",Arial,sans-serif', barScr = { key:'' };   // barScr.key: what the live screen shows
function colGeo(parts){   // one indexed geometry (position + normal + colour) from [geometry, 0xRRGGBB] pairs, indexed or not
  const pos = [], nrm = [], col = [], idx = [], c = new THREE.Color();
  for (const [g, hex] of parts){
    const o = pos.length / 3, P = g.getAttribute('position'), N = g.getAttribute('normal'); c.set(hex);
    for (let i = 0; i < P.count; i++){ pos.push(P.getX(i), P.getY(i), P.getZ(i)); nrm.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b); }
    if (g.index) for (const i of g.index.array) idx.push(o + i); else for (let i = 0; i < P.count; i++) idx.push(o + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
function barScreenPaint(tex, cap, big, unit){   // the screen over the counter: a caption over a big number and its unit, or just a word
  const c = tex.image.getContext('2d'), W = 256, H = 128, g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a1438'); g.addColorStop(1, '#14081c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.textBaseline = 'alphabetic'; c.textAlign = 'center';
  if (cap){ c.fillStyle = '#d9cfe3'; c.font = `600 20px ${BAR_FONT}`; c.fillText(cap.toUpperCase(), W / 2, 30, W - 20); }
  c.textAlign = 'left'; c.font = `700 64px ${BAR_FONT}`; const wb = c.measureText(big).width;
  c.font = `700 24px ${BAR_FONT}`; const wu = unit ? c.measureText(unit).width + 6 : 0, x = (W - wb - wu) / 2, y = cap ? 100 : 88;   // number and unit centred together
  c.fillStyle = '#fff'; c.font = `700 64px ${BAR_FONT}`; c.fillText(big, x, y);
  if (unit){ c.fillStyle = '#e0447f'; c.font = `700 24px ${BAR_FONT}`; c.fillText(unit, x + wb + 6, y); }
  tex.needsUpdate = true;
}
const BAR_TEX = {
  fridge:canvasTex(352, 144, (c, W, H) => {   // the drinks fridge's glass door: three lit shelves of cans and bottles
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#dff2fc'); g.addColorStop(1, '#a9cfe6'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const cols = ['#e0447f', '#f2c53d', '#43c977', '#3c8dea', '#ff7f3f', '#c084ff', '#f4f4f4', '#d23a3a'];
    for (let r = 0; r < 3; r++){
      const y = 46 + r * 42;   // the shelf
      for (let k = 0, x = 16; x < W - 30; k++){
        const h = hash32(r * 97 + k + 5), bottle = h % 3 === 0, w = bottle ? 12 : 16, hh = bottle ? 32 : 24;
        c.fillStyle = cols[(h >>> 4) % cols.length];
        if (bottle){ c.fillRect(x, y - hh + 10, w, hh - 10); c.fillRect(x + 4, y - hh, 4, 10); } else c.fillRect(x, y - hh, w, hh);
        c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(x + 2, y - hh + (bottle ? 12 : 3), 3, hh - (bottle ? 15 : 6));
        x += w + 6;
      }
      c.fillStyle = '#7f98a8'; c.fillRect(10, y, W - 20, 4);
    }
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.moveTo(W * 0.62, 0); c.lineTo(W * 0.72, 0); c.lineTo(W * 0.5, H); c.lineTo(W * 0.4, H); c.fill();   // glare
    c.strokeStyle = '#5d636b'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10);   // the door's frame
  }),
  idle:canvasTex(256, 128, () => {}), live:canvasTex(256, 128, () => {}),   // other trains' screens say BAR; ours show the train's speed (updateBar)
};
barScreenPaint(BAR_TEX.idle, '', 'BAR', ''); barScreenPaint(BAR_TEX.live, '', '0', 'km/h');
document.fonts && Promise.all([600, 700].map(w => document.fonts.load(`${w} 40px "Barlow Condensed"`))).then(() => { barScreenPaint(BAR_TEX.idle, '', 'BAR', ''); barScr.key = ''; }, () => {});   // a canvas does not fetch a web font by itself: paint again once it is here
const BAR_GEO = {}, BAR_STAND = 13.33;   // BAR_STAND: the two standing at the -z ledge, either side of that window's middle (buildBar)
const barBox = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
const barCyl = (r, y0, y1, x, z, seg = 12, r1 = r) => new THREE.CylinderGeometry(r, r1, y1 - y0, seg).translate(x, (y0 + y1) / 2, z);   // upright: r at the top, r1 at the foot
const barBall = (r, sx, sy, sz, x, y, z) => new THREE.SphereGeometry(r, 10, 6).scale(sx, sy, sz).translate(x, y, z);
const barDome = (r, sy, x, y, z) => new THREE.SphereGeometry(r, 10, 5, 0, 2 * Math.PI, 0, Math.PI / 2).scale(1, sy, 1).translate(x, y, z);   // a half ball standing on y
const CUP = 0xf4f2ee, BUN = 0xd9a24e, CHOC = 0x3b2416;
function paperCup(add, x, y, z, sleeve, lid){   // a takeaway cup with a coloured sleeve: lidded, or open on the drink
  add(barCyl(0.038, y, y + 0.1, x, z, 14, 0.029), CUP); add(barCyl(0.0358, y + 0.035, y + 0.07, x, z, 14, 0.0327), sleeve);
  if (lid) add(barCyl(0.04, y + 0.1, y + 0.112, x, z, 14, 0.039), 0x6b3f2a); else add(barCyl(0.0365, y + 0.1, y + 0.102, x, z, 14), 0x8a4f22);
}
/* things to eat and drink, standing on y at (x, z), handed to add as [geometry, colour]: the pastry case's cakes, and all the menu sells (BAR_MENU's ids) */
const BAR_FOOD = {
  croissant:(add, x, y, z) => add(barBall(0.05, 1.3, 0.55, 0.7, x, y + 0.026, z), 0xd9a24e),
  painchoc:(add, x, y, z) => add(barBox(x - 0.045, x + 0.045, y, y + 0.04, z - 0.03, z + 0.03), 0xc98a3a),
  cookie:(add, x, y, z) => add(barCyl(0.035, y, y + 0.012, x, z, 12), 0xc08a4f),
  madeleine:(add, x, y, z) => add(barBall(0.03, 1.2, 0.5, 0.8, x, y + 0.014, z), 0xe8b75a),
  muffin:(add, x, y, z) => { add(barCyl(0.032, y, y + 0.04, x, z, 10, 0.026), 0x6b3f2a); add(barDome(0.036, 1, x, y + 0.04, z), 0x7a4a30); },
  sandwich:(add, x, y, z) => { add(barBox(x - 0.05, x + 0.05, y, y + 0.045, z - 0.035, z + 0.035), 0xe7d2a5); add(barBox(x - 0.052, x + 0.052, y + 0.02, y + 0.026, z - 0.037, z + 0.037), 0x6aa84f); },
  espresso:(add, x, y, z) => {   // on its saucer, the handle to the right
    add(barCyl(0.045, y, y + 0.006, x, z, 14), CUP); add(barCyl(0.03, y + 0.006, y + 0.05, x, z, 12, 0.024), CUP);
    add(barCyl(0.027, y + 0.05, y + 0.052, x, z, 12), CHOC); add(barBox(x + 0.026, x + 0.038, y + 0.02, y + 0.04, z - 0.004, z + 0.004), CUP);
  },
  choco:(add, x, y, z) => paperCup(add, x, y, z, 0x8a5a3a, true),
  tea:(add, x, y, z) => { paperCup(add, x, y, z, 0x43a86a, false); add(barBox(x + 0.036, x + 0.039, y + 0.055, y + 0.08, z - 0.011, z + 0.011), 0xf2c53d); },   // the bag's tag over the rim
  soda:(add, x, y, z) => { add(barCyl(0.033, y, y + 0.115, x, z, 14), 0xd23a3a); add(barCyl(0.0335, y + 0.05, y + 0.07, x, z, 14), 0xffffff); add(barCyl(0.029, y + 0.115, y + 0.12, x, z, 14, 0.033), 0xc9cdd2); },
  juice:(add, x, y, z) => {   // a carton with its straw
    add(barBox(x - 0.032, x + 0.032, y, y + 0.1, z - 0.022, z + 0.022), 0x43c977); add(barBox(x - 0.033, x + 0.033, y + 0.075, y + 0.1, z - 0.023, z + 0.023), 0xffffff);
    add(barCyl(0.003, y + 0.1, y + 0.145, x + 0.014, z, 6), 0xe0447f);
  },
  water:(add, x, y, z) => { add(barCyl(0.035, y, y + 0.09, x, z, 14, 0.027), 0xcfe9f7); add(barCyl(0.033, y + 0.09, y + 0.092, x, z, 14), 0x7cc3ea); },
  club:(add, x, y, z) => {   // three slices, lettuce and ham between
    for (let k = 0; k < 3; k++) add(barBox(x - 0.05, x + 0.05, y + 0.024 * k, y + 0.024 * k + 0.016, z - 0.04, z + 0.04), 0xe7d2a5);
    for (const [k, c] of [[0, 0x6aa84f], [1, 0xe8a0a0]]) add(barBox(x - 0.052, x + 0.052, y + 0.016 + 0.024 * k, y + 0.024 + 0.024 * k, z - 0.042, z + 0.042), c);
  },
  croque:(add, x, y, z) => { add(barBox(x - 0.045, x + 0.045, y, y + 0.03, z - 0.045, z + 0.045), 0xe2b56a); add(barBox(x - 0.042, x + 0.042, y + 0.03, y + 0.037, z - 0.042, z + 0.042), 0xf0c24a); },
  burger:(add, x, y, z) => {
    add(barCyl(0.042, y, y + 0.018, x, z, 14), BUN); add(barCyl(0.044, y + 0.018, y + 0.034, x, z, 14), 0x5a3a24);
    add(barBox(x - 0.035, x + 0.035, y + 0.034, y + 0.038, z - 0.035, z + 0.035), 0xf2c53d); add(barCyl(0.045, y + 0.038, y + 0.043, x, z, 14), 0x6aa84f);
    add(barDome(0.043, 0.65, x, y + 0.043, z), BUN);
  },
  chips:(add, x, y, z) => {   // a bag standing up, its top crimped
    add(barBox(x - 0.045, x + 0.045, y, y + 0.12, z - 0.016, z + 0.016), 0xf2c53d); add(barBox(x - 0.046, x + 0.046, y + 0.075, y + 0.1, z - 0.017, z + 0.017), 0xd23a3a);
    add(barBox(x - 0.046, x + 0.046, y + 0.12, y + 0.128, z - 0.004, z + 0.004), 0xf2c53d);
  },
  sweets:(add, x, y, z) => {   // a striped paper bag, three spilt in front of it
    add(barBox(x - 0.03, x + 0.03, y, y + 0.07, z - 0.02, z + 0.02), CUP);
    for (const h of [0.02, 0.045]) add(barBox(x - 0.031, x + 0.031, y + h, y + h + 0.01, z - 0.021, z + 0.021), 0xe0447f);
    for (const [c, a, b] of [[0xf2c53d, 0.03, 0.03], [0x43c977, -0.035, 0.032], [0x3c8dea, 0, 0.038]]) add(barBall(0.011, 1, 1, 1, x + a, y + 0.011, z + b), c);
  },
};
/* the walker's tray on the counter: what was bought (BAR.tray, 03h) stands on it in three rows of four, the back row first. It is put down
   by the walker, clear of the till, the card reader and the pastry case, and each thing lands once the barista is back with it (BAR.wait) */
const barTrayX = x => x < 6.5 ? THREE.MathUtils.clamp(x, 5.05, 6.0) : THREE.MathUtils.clamp(x, 7.01, 8.05);
function barTrayGeo(ids){   // standing on (0, 0, 0)
  const p = [], add = (g, c) => p.push([g, c]), T = 0x34383f;
  add(barBox(-0.23, 0.23, 0, 0.01, -0.15, 0.15), T);
  for (const s of [-1, 1]){ add(barBox(-0.23, 0.23, 0.01, 0.025, 0.145 * s - 0.005, 0.145 * s + 0.005), T); add(barBox(0.225 * s - 0.005, 0.225 * s + 0.005, 0.01, 0.025, -0.14, 0.14), T); }   // the rims
  add(barBox(-0.215, 0.215, 0.01, 0.0125, -0.135, 0.135), 0xf1ead8);   // a paper liner
  ids.forEach((id, k) => BAR_FOOD[id](add, -0.165 + 0.11 * (k % 4), 0.0125, -0.09 + 0.09 * Math.floor(k / 4)));
  return colGeo(p);
}
function barGeo(L){   // per body length, x from the car's -x end: the fixed fittings (solid), what glows, the fridge's door, the screen, the stools [x, z, ...], the two customers' stools
  if (BAR_GEO[L]) return BAR_GEO[L];
  const F = DECK.up, sol = [], glo = [], st = [], add = (g, c) => sol.push([g, c]), glow = (g, c) => glo.push([g, c]);
  const WALNUT = 0x5a4636, STONE = 0xd9d4cc, STEEL = 0xb9bec4, DARK = 0x2a2724, CHROME = 0xc9cdd2, OAK = 0x8a6a4c;
  const bx = barBox, cy = barCyl, cx = (r, x0, x1, y, z) => new THREE.CylinderGeometry(r, r, x1 - x0, 8).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, y, z);   // cx: along x
  // the counter: walnut front on a dark plinth, a stone top with a warm light under its lip, a foot rail, end panels back to the wall
  add(bx(4.8, 9.4, F + 0.1, F + 0.9, -0.62, -0.30), WALNUT); add(bx(4.85, 9.35, F, F + 0.1, -0.60, -0.36), DARK);
  add(bx(4.75, 9.45, F + 0.90, F + 0.94, -0.66, -0.22), STONE); glow(bx(4.8, 9.4, F + 0.88, F + 0.895, -0.30, -0.28), 0xffcf8a);
  add(cx(0.02, 4.9, 9.3, F + 0.16, -0.20), CHROME);
  for (const x of [5.2, 7.1, 9.0]){ add(cy(0.012, F, F + 0.16, x, -0.20, 6), CHROME); add(bx(x - 0.012, x + 0.012, F + 0.148, F + 0.172, -0.30, -0.20), CHROME); }
  for (const x of [4.70, 9.45]) add(bx(x, x + 0.05, F, F + 0.94, -1.40, -0.30), WALNUT);
  // the back counter: steel doors under a stone top
  add(bx(4.8, 9.4, F, F + 0.80, -1.40, -1.10), STEEL); add(bx(4.8, 9.4, F + 0.80, F + 0.83, -1.42, -1.08), STONE);
  for (let k = 0; k < 7; k++){ const x = 5.4 + 0.6 * k; add(bx(x - 0.004, x + 0.004, F + 0.05, F + 0.78, -1.10, -1.096), DARK); add(bx(x - 0.12, x - 0.04, F + 0.70, F + 0.715, -1.096, -1.08), CHROME); }
  // the coffee corner: the espresso machine (cups warming on top, two group heads), its drip tray and steam wand, the grinder
  add(bx(5.2, 5.9, F + 0.83, F + 1.22, -1.30, -1.12), 0x1d1f22); add(bx(5.2, 5.9, F + 1.22, F + 1.26, -1.30, -1.12), CHROME);
  for (const x of [5.4, 5.7]){ add(cy(0.03, F + 0.98, F + 1.04, x, -1.08, 10), CHROME); add(bx(x - 0.01, x + 0.01, F + 0.965, F + 0.98, -1.06, -0.97), DARK); }
  add(bx(5.25, 5.85, F + 0.83, F + 0.85, -1.12, -1.02), DARK); add(cy(0.006, F + 0.92, F + 1.12, 5.84, -1.07, 6), CHROME);
  for (const x of [5.3, 5.45, 5.6, 5.75]) add(cy(0.032, F + 1.26, F + 1.32, x, -1.21, 10, 0.026), 0xf4f2ee);
  add(cy(0.07, F + 0.83, F + 1.13, 6.15, -1.2, 14), 0x2a2d33); add(cy(0.07, F + 1.13, F + 1.27, 6.15, -1.2, 14, 0.045), 0x4a2c1a);
  add(bx(7.1, 8.2, F + 0.83, F + 1.30, -1.28, -1.10), 0xe9eaec);   // the drinks fridge (its glass door: BAR_TEX.fridge)
  // the pastry case on the front counter: a lit base, chrome posts, a lid; croissants, pains au chocolat, cookies, madeleines, muffins, sandwiches
  glow(bx(8.3, 9.3, F + 0.94, F + 0.97, -0.62, -0.32), 0xfff1d6);
  for (const x of [8.31, 9.29]) for (const z of [-0.61, -0.33]) add(bx(x - 0.01, x + 0.01, F + 0.97, F + 1.22, z - 0.01, z + 0.01), CHROME);
  add(bx(8.3, 9.3, F + 1.22, F + 1.24, -0.62, -0.32), 0xdfe6ea);
  [['croissant', 'painchoc', 'cookie', 'madeleine'], ['muffin', 'sandwich', 'croissant', 'muffin']].forEach((row, r) => row.forEach((k, j) => { for (const d of [-0.05, 0.05]) BAR_FOOD[k](add, 8.42 + 0.24 * j + d, F + 0.97, r ? -0.54 : -0.41); }));
  // the till, its screen turned to the customer, and the card reader
  add(bx(6.25, 6.55, F + 0.94, F + 0.99, -0.58, -0.40), 0x30343b); add(bx(6.38, 6.42, F + 0.99, F + 1.04, -0.49, -0.45), DARK);
  add(new THREE.BoxGeometry(0.26, 0.17, 0.02).rotateX(-0.35).translate(6.4, F + 1.08, -0.46), DARK);
  glow(new THREE.PlaneGeometry(0.235, 0.145).rotateX(-0.35).translate(6.4, F + 1.08 + 0.343 * 0.012, -0.46 + 0.939 * 0.012), 0x6fa8ff);
  add(bx(6.68, 6.76, F + 0.94, F + 0.965, -0.40, -0.28), 0x30343b); glow(bx(6.70, 6.74, F + 0.965, F + 0.968, -0.32, -0.30), 0x43c977);
  // overhead: two pendant lamps over the counter
  for (const x of [5.4, 8.9]){ add(cy(0.004, 3.97, 4.24, x, -0.48, 4), DARK); add(cy(0.05, 3.87, 3.97, x, -0.48, 14, 0.11), 0x22262b); glow(new THREE.SphereGeometry(0.045, 10, 6).translate(x, 3.86, -0.48), 0xffe3a8); }
  // the speed screen in its housing on the wall over the fridge, along the upper wall's slope from 3.95 to 4.17 (over the barista's head from
  // the counter, out of the walker's eye line), turned down to the counter. at(d): d in from that chord, the wall curving out behind it
  const ya = 3.95, yb = 4.17, za = -zAtY(TR.pts, ya), zb = -zAtY(TR.pts, yb), tilt = Math.atan2(zb - za, yb - ya);
  const at = d => [7.65, (ya + yb) / 2 - Math.sin(tilt) * d, (za + zb) / 2 + Math.cos(tilt) * d];
  add(new THREE.BoxGeometry(0.66, 0.36, 0.025).rotateX(tilt).translate(...at(0.0315)), DARK);
  // window ledges on steel brackets and a foot rail along the wall: the +z side all the way, the -z side past the counter
  for (const [s, x0] of [[1, 4.8], [-1, 10.0]]){
    const z = (a, b) => s > 0 ? [a, b] : [-b, -a];
    add(bx(x0, L - 0.6, F + 0.86, F + 0.90, ...z(1.08, 1.40)), OAK);
    for (const x of [5.4, 7.0, 8.6, 10.8, 13.2, 15.6, 17.5]) if (x > x0 && x < L - 0.6) add(bx(x - 0.01, x + 0.01, F + 0.62, F + 0.86, ...z(1.25, 1.40)), STEEL);
    add(cx(0.015, x0 + 0.1, L - 0.7, F + 0.13, s * 1.30), CHROME);
    for (let x = x0 + 0.3; x < L - 0.7; x += 1.6) add(bx(x - 0.01, x + 0.01, F + 0.12, F + 0.14, ...z(1.30, 1.46)), CHROME);
  }
  // stools: two to each upper window facing it, 0.85 m out from the middle; on the -z side only past the counter, and none where two stand at the ledge
  const stool = (x, z) => {
    add(cy(0.17, F + 0.49, F + 0.55, x, z, 16), 0xe0447f); add(cy(0.025, F + 0.03, F + 0.49, x, z, 8), CHROME); add(cy(0.17, F, F + 0.03, x, z, 16, 0.19), 0x5d636b);
    add(new THREE.TorusGeometry(0.12, 0.012, 4, 14).rotateX(Math.PI / 2).translate(x, F + 0.22, z), CHROME); add(bx(x - 0.12, x + 0.12, F + 0.215, F + 0.225, z - 0.006, z + 0.006), CHROME);
    st.push(x, z);
  };
  for (const [x0, x1, y0] of TR.holes(L)) if (y0 > 2.9 && x0 > 5) for (const s of [1, -1]) if (s > 0 || (x0 > 10 && (x1 < BAR_STAND || x0 > BAR_STAND))) for (const d of [-0.305, 0.305]) stool((x0 + x1) / 2 + d, s * 0.85);
  // a bin at the counter's end; cups left on the ledges, before the two customers' stools (sat) and between the two standing
  add(bx(9.55, 9.9, F, F + 0.75, -1.30, -0.92), 0x3d4248); add(bx(9.53, 9.92, F + 0.75, F + 0.78, -1.32, -0.90), 0x6b7078); add(bx(9.62, 9.83, F + 0.78, F + 0.785, -1.0, -0.94), DARK);
  const near = (x, z) => { let b = 0; for (let k = 1; k < st.length / 2; k++) if (Math.hypot(st[2 * k] - x, st[2 * k + 1] - z) < Math.hypot(st[2 * b] - x, st[2 * b + 1] - z)) b = k; return b; };
  const sat = [near(7.4, 0.85), near(15.2, -0.85)];
  for (const [x, z] of [[BAR_STAND, -1.2], ...sat.map(k => [st[2 * k], Math.sign(st[2 * k + 1]) * 1.2])]) add(cy(0.035, F + 0.90, F + 1.0, x, z, 10, 0.028), 0xffffff);
  // the lower deck: a partition just past the stair's foot (under the upper floor, and lower under the stair), a staff door in it, cabinets down both sides
  const wz = y => zAtY(TR.pts, y) - 0.01, ys = [];
  for (let k = 0; k <= 12; k++) ys.push(DECK.lo + (2.40 - DECK.lo) * k / 12);
  const sh = new THREE.Shape(); sh.moveTo(wz(DECK.lo), DECK.lo);
  for (const y of ys.slice(1)) sh.lineTo(wz(y), y);
  sh.lineTo(-0.45, 2.40); sh.lineTo(-0.45, 2.28); sh.lineTo(-wz(2.28), 2.28);
  for (const y of ys.filter(y => y < 2.27).reverse()) sh.lineTo(-wz(y), y);
  add(new THREE.ExtrudeGeometry(sh, { depth:0.05, bevelEnabled:false }).rotateY(-Math.PI / 2).translate(3.50, 0, 0), 0xcbc5ba);   // the shape is (z, y): x runs 3.45..3.50
  add(bx(3.425, 3.45, DECK.lo, 2.30, 0.05, 0.85), 0x8a9099); add(bx(3.40, 3.425, 1.80, 1.84, 0.12, 0.24), CHROME); add(bx(3.42, 3.425, 1.85, 2.15, 0.3, 0.6), 0x1c2530);
  const n = Math.round((L - 3.9) / 1.2), w = (L - 0.3 - 3.6) / n;
  for (let k = 0; k < n; k++) for (const s of [1, -1]) add(bx(3.6 + k * w + 0.01, 3.6 + (k + 1) * w - 0.01, DECK.lo, 2.30, s > 0 ? 0.35 : -1.10, s > 0 ? 1.10 : -0.35), k % 2 ? 0x7d838c : 0x8a9099);
  return BAR_GEO[L] = {
    solid:colGeo(sol), glow:colGeo(glo), stools:new Float32Array(st), sat,
    fridge:new THREE.PlaneGeometry(0.98, 0.40).translate(7.65, F + 1.065, -1.095),
    screen:new THREE.PlaneGeometry(0.60, 0.30).rotateX(tilt).translate(...at(0.045)),
  };
}
function buildBar(c, cm){   // the bar car's fittings and its people: the barista by the till, two at a ledge over a coffee, two on stools facing the windows (one on the phone)
  const G = barGeo(c.L), F = DECK.up, put = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.position.x = c.xr; c.g.add(m); return m; };
  c.solid.push(put(G.solid, cm.bar)); put(G.glow, cm.glow); put(G.fridge, cm.fridge); put(G.screen, cm.screen);
  const people = paxMesh(5, cm.people), st = G.stools, taken = new Uint8Array(st.length / 2);   // taken: 1 a customer, 4 the walker (walkSitStool)
  people.count = 5; people.boundingSphere = c.people.boundingSphere; c.g.add(people);
  const [s3, s4] = G.sat; taken[s3] = taken[s4] = 1;
  const npc = [
    { x:6.1, z:-0.86, y:F, yaw:-Math.PI / 2, sit:0 },
    { x:BAR_STAND - 0.335, z:-0.95, y:F, yaw:0.4, sit:0 }, { x:BAR_STAND + 0.335, z:-0.95, y:F, yaw:Math.PI - 0.4, sit:0 },
    { x:st[2 * s3], z:st[2 * s3 + 1], y:F + 0.13, yaw:-Math.PI / 2, sit:1 }, { x:st[2 * s4], z:st[2 * s4 + 1], y:F + 0.13, yaw:Math.PI / 2, sit:1 },   // 0.42 under the cushion, as on a seat
  ];
  const A = people.geometry.attributes, C = A.paxCol.array, Lk = A.paxLook.array;
  npc.forEach((p, k) => {
    paxLookAt(people, k, hash32(c.id * 1000 + 900 + k));
    if (!k){ C[0] = 0x2a2d33; C[1] = 0x1f2328; Lk[2] = Lk[2] & ~(2 | 4 | 16); }   // the barista: dark uniform, long sleeves, no phone, no backpack
    else Lk[4 * k + 2] = k === 3 ? Lk[4 * k + 2] | 4 : Lk[4 * k + 2] & ~4;
    Object.assign(p, { ph:0, amp:0, turn:0, goal:p.x });
    paxPut(people, k, c.xr + p.x, p.y, p.z, p.yaw, p.sit, 0, 0, 0);
  });
  const tray = new THREE.Mesh(new THREE.BufferGeometry(), cm.bar); tray.visible = false; c.g.add(tray);
  c.bar = { people, st, taken, npc, stand:npc.slice(1, 3).map(p => [p.x, p.z]), t:0, serve:null, tray, trayKey:'' };   // stand: the two at the ledge, whom the walker does not walk through
}
function updateBar(dt){   // our sets' bar cars while drawn: their people, and the screen over the counter (the train's speed)
  let on = false;
  for (const set of tgvSets) for (const c of set.coaches) if (c.bar && c.lod > 0){ poseBar(c, dt); on = true; }
  const kmh = Math.round(Math.abs(S.speed) * 3.6), key = `${kmh} ${S.lang}`;
  if (on && key !== barScr.key){ barScr.key = key; barScreenPaint(BAR_TEX.live, t('bar_speed'), String(kmh), 'km/h'); }
}
function poseBar(c, dt){   // the barista keeps level with the walker along the counter and fetches what was bought (facing the machine, the fridge or the case a moment); the others glance at the walker close by
  const b = c.bar, p = b.npc[0], me = WK.on && tgvSets[0].coaches[WK.i] === c && WK.y > 1.7;
  b.t += dt;
  if (!me) p.goal = 6.1;   // back by the till
  else if (WK.x > 4.4 && WK.x < 9.9){ const g = THREE.MathUtils.clamp(WK.x, 5.0, 9.0); if (Math.abs(g - p.goal) > 0.5) p.goal = g; }
  const to = b.serve ? b.serve.x : p.goal, d = to - p.x, moving = Math.abs(d) > 0.01, step = Math.min(Math.abs(d), dt * 1.0);
  if (moving){ p.x += Math.sign(d) * step; p.ph = (p.ph + step * STRIDE) % (2 * Math.PI); }
  else if (b.serve && (b.serve.t -= dt) <= 0) b.serve = null;   // the serving time runs once there
  p.amp = approach(p.amp, moving ? 1 : 0, dt * 5);
  p.yaw = turnTo(p.yaw, moving ? (d > 0 ? 0 : Math.PI) : b.serve ? b.serve.face : -Math.PI / 2, dt * 7);
  const look = (q, lim) => {   // the head's turn toward the walker (0: out of sight behind)
    const dx = WK.x - q.x, dz = WK.z - q.z, a = Math.atan2(dx * Math.sin(q.yaw) + dz * Math.cos(q.yaw), dx * Math.cos(q.yaw) - dz * Math.sin(q.yaw));
    return Math.abs(a) > lim + 0.4 ? null : THREE.MathUtils.clamp(a, -lim, lim);
  };
  const ease = (q, a, r) => { q.turn += (a - q.turn) * Math.min(1, dt * r); };
  ease(p, me && !moving && !b.serve ? (look(p, 1) ?? 0) : 0, 4);
  paxPut(b.people, 0, c.xr + p.x, p.y, p.z, p.yaw, 0, p.ph, p.amp, p.turn);
  for (let k = 1; k < b.npc.length; k++){
    const q = b.npc[k], a = me && Math.hypot(WK.x - q.x, WK.z - q.z) < 2 ? look(q, 1.1) : null;
    ease(q, a ?? 0.35 * Math.sin(b.t * 0.3 + k * 1.7), 3);
    paxPut(b.people, k, c.xr + q.x, q.y, q.z, q.yaw, q.sit, 0, 0, q.turn);
  }
  b.people.instanceMatrix.needsUpdate = b.people.geometry.attributes.paxPose.needsUpdate = true;
  if (b.trayOn){   // the walker's tray: what the barista has brought, once back from fetching it
    if (BAR.wait && !b.serve && !moving) BAR.wait = 0;
    const ids = BAR.tray.slice(0, BAR.tray.length - BAR.wait), key = ids.join();
    if (key !== b.trayKey){ b.trayKey = key; b.tray.geometry.dispose(); b.tray.geometry = barTrayGeo(ids); }
    b.tray.visible = BAR.tray.length > 0;
  }
}
const BAR_AT = { hot:[5.55, Math.PI / 2], cold:[7.65, Math.PI / 2], food:[8.8, -Math.PI / 2] };   // where the barista fetches each kind of thing, and the way they face there
function barServe(st){   // the barista fetches what was just bought; the first thing on an empty tray puts the tray down by the walker
  const c = tgvSets[0].coaches[WK.i], b = c?.bar;
  if (!b){ BAR.wait = 0; return; }
  b.serve = { x:BAR_AT[st][0], face:BAR_AT[st][1], t:1.1 };
  if (BAR.tray.length === 1){ b.trayOn = true; b.tray.position.set(c.xr + barTrayX(WK.x), DECK.up + 0.94, -0.47); }
}
function barFace(){   // the menu open at the counter: the eye turns to it and a little down, onto the tray, the barista still in sight
  const c = tgvSets[0].coaches[WK.i];
  if (WK.seat >= 0 || WK.stool >= 0 || !c.bar) return;
  orbit.look(c.g, new THREE.Vector3(c.xr + WK.x, WK.ey + WALK_EYE, WK.z), Math.PI / 2, -0.3); orbit.fp.name = 'walk';
}
function barNear(){   // standing at the counter, not turned away from it: E, Enter or the button orders
  if (!WK.on || WK.seat >= 0 || WK.stool >= 0 || WK.y < 1.7 || !tgvSets[0].coaches[WK.i].bar) return false;
  return WK.x > 4.4 && WK.x < 9.8 && -Math.sin(orbit.fp?.yaw ?? 0) < 0.5;
}
function barTap(){ if (WK.y > 1.7 && WK.x > 4.4 && WK.x < 9.8) barOpen(); else walkSay('walk_far'); }   // the counter or the barista tapped: near enough, the menu
function barPick(c, ray){   // walking in the bar car: a tap on the counter or the barista orders, on a free stool within reach sits there
  const b = c.bar, F = DECK.up, h = ray.intersectObjects([...c.solid, b.people], false)[0];
  if (!h) return;
  if (h.object === b.people){ if (h.instanceId === 0) barTap(); else if (h.instanceId >= 3) walkSay('walk_taken'); return; }
  c.g.updateWorldMatrix(true, false); const p = c.g.worldToLocal(_wk.copy(h.point)); p.x -= c.xr;
  if (p.y > F + 0.1 && p.y < F + 1.6 && p.z < -0.2 && p.x > 4.65 && p.x < 9.55){ barTap(); return; }
  for (let k = 0; k < b.taken.length; k++){
    const sx = b.st[2 * k], sz = b.st[2 * k + 1];
    if (Math.hypot(p.x - sx, p.z - sz) > 0.22 || p.y < F - 0.05 || p.y > F + 0.65) continue;
    if (k === WK.stool) return;
    if (b.taken[k]) walkSay('walk_taken');
    else if (WK.y < 1.7 || Math.hypot(WK.x - sx, WK.z - sz) > WALK_REACH) walkSay('walk_far');
    else walkSitStool(k);
    return;
  }
}
function walkSitStool(k){   // onto stool k of the walker's (bar) car: the eye over it, looking out of its window; standing up puts the walker in the aisle beside it
  const c = tgvSets[0].coaches[WK.i], b = c.bar, F = DECK.up, x = b.st[2 * k], z = b.st[2 * k + 1], s = Math.sign(z);
  if (WK.stool >= 0) b.taken[WK.stool] = 0;
  b.taken[k] = 4; Object.assign(WK, { stool:k, hold:true, x, y:F, ey:F, z:0.45 * s });
  orbit.look(c.g, new THREE.Vector3(c.xr + x, F + 1.29, z), s > 0 ? -Math.PI / 2 : Math.PI / 2, -0.3); orbit.fp.name = 'walk';
}
function equipPowerCar(pc, pantoX){
  for (const ax of axles) ax.userData.axle = 1;          // tags survive clone(): the copies' wheels and rotors turn with the train
  for (const r of motorRotors) r.userData.rotor = 1;
  const ig = new THREE.Group(); ig.name = 'pcInternals'; pc.group.add(ig);
  const clones = {};
  for (const id of PC_INTERNALS){
    const c = parts[id].group.clone(); c.position.set(0, 0, 0); ig.add(c); clones[id] = c;
    c.traverse(o => { if (o.userData.axle) axles.push(o); else if (o.userData.rotor) motorRotors.push(o); else if (o.userData.lever) cabLevers.push(o); else if (o.userData.cabBtn) CAB.btns.push(o); else if (o.userData.cabScr) CAB.scrs.push(o); });
  }
  clones.cab.getObjectByName('cabLoco').visible = false; clones.cab.getObjectByName('cabTgv').visible = true;
  const driver = clones.cab.getObjectByName('driver'); driver.visible = false;   // shown only in the leading cab
  // HV lead from the pantograph base to the circuit breaker (on the lead car it belongs to the pantograph part)
  ig.add(cable(pantoX < 0 ? [[-1.6, 4.6, 0.25], [1.5, 4.55, 0.35], [4.35, 4.55, 0.3]] : [[2.0, 4.58, 0.5], [3.4, 4.5, 0.6], [4.35, 4.55, 0.3]], 0.03, pmat(pal.copper)));
  pcHosts.push({ ig, clones, driver, pantoX });
  pcShells.mats.push(...pc.shell.mats); pcShells.meshes.push(...pc.shell.meshes);
}
function buildNoseCoupler(g, mk){   // nose hatch (the rounded snout in two leaves) + Scharfenberg coupler behind it
  const hatchM = mk(0xffffff, { map:PC.hatchTex, roughness:0.45, metalness:0.2, side:THREE.DoubleSide }), cpM = mk(pal.dark, { metalness:0.6, roughness:0.4 });
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
function tgvBogie(parent, cx, mk, wheelbase = 3.0, low = false){   // low: under a trailer, kept below the top of the lower deck's floor (0.92): wheels 0.9 m across (0.92 new on a TGV), the frame dropped to match
  const fm = mk(pal.dark, { roughness:0.7 }), wm = mk(pal.wheel, { roughness:0.45, metalness:0.6 }), sm = mk(pal.steel, { metalness:0.6 });
  const r = low ? 0.45 : WHEEL_R, y = low ? 0.67 : 0.95;
  [1.1, -1.1].forEach(z => parent.add(box(wheelbase + 0.9, 0.3, 0.2, fm, cx, y, z)));
  parent.add(box(0.6, 0.3, 2.3, fm, cx, y + 0.03, 0));
  [cx - wheelbase / 2, cx + wheelbase / 2].forEach(x => {
    const ax = new THREE.Group(); ax.position.set(x, r, 0); ax.userData.r = r;   // the radius the wheels roll on (see the sims)
    ax.add(cyl(0.08, 2.0, sm, 'z', 0, 0, 0, 12));
    [-0.75, 0.75].forEach(z => ax.add(cyl(r, 0.13, wm, 'z', 0, 0, z, 28)));
    [-0.62, 0.62].forEach(z => ax.add(cyl(0.36, 0.05, fm, 'z', 0, 0, z, 20)));         // brake discs
    parent.add(ax); axles.push(ax);
    [1.1, -1.1].forEach(z => parent.add(box(0.34, 0.34, 0.18, fm, x, r, z)));
  });
}

/* ---- Duplex trailer body (shared geometry + textures per body length). The windows and the doorway are real openings: cut out of
   the livery (alpha test) and of the lining that shows the inside of the shell, glazed from just outside the skin so that from
   inside the pane's edge stays hidden behind the lining (a pane in front of it showed a pale unglazed strip along one side of
   every window, wider the more obliquely it was seen). Far from the camera the glass is opaque and the doorway plugged, and the
   coach draws nothing inside (see coachLod). */
const TR = (() => {
  const yBot = 0.75, yTop = 4.3, w = TGV.HALF_W;
  const pts = sectionPts(yBot, yTop, w, w * 0.87, 4);
  const vs = [0];   // v of each ring point by arc length: one texel is the same size all round, and vAt lands exactly on the geometry
  for (let j = 1; j <= RING_N; j++){ const [z0, y0] = pts[j - 1], [z1, y1] = pts[j % RING_N]; vs.push(vs[j - 1] + Math.hypot(z1 - z0, y1 - y0)); }
  const per = vs[RING_N]; vs.forEach((v, j) => { vs[j] = v / per; });
  const Ls = [18.2, 20.5], DOOR = [1.0, 2.3, 0.95, 3.15];   // door leaf x0, x1 (from the car's -x end), y0, y1
  const holes = L => {   // [x0, x1, y0, y1, doorway]: two decks of windows over the saloon, the window over the door, the doorway 2 cm inside the leaf
    const o = [], n = Math.round((L - 3.6) / 1.9), pitch = (L - 0.6 - 3.6 - 1.25) / (n - 1);
    for (let i = 0; i < n; i++){ const x = 3.6 + i * pitch; o.push([x, x + 1.25, 1.6, 2.2, false], [x, x + 1.25, 3.0, 3.75, false]); }
    o.push([1.05, 2.25, 3.4, 3.65, false], [DOOR[0] + 0.02, DOOR[1] - 0.02, DOOR[2] + 0.02, DOOR[3] - 0.02, true]);
    return o;
  };
  const painter = (c, W, H, L) => {   // canvas helpers in metres: x along the car, y up the wall on side s; rows run from v 1 at the top (flipY)
    const px = W / L, pv = H / per, cx = x => x * px, cy = (x, y, s) => (1 - vAt(pts, vs, y, s)) * H;
    const rect = (s, x0, x1, y0, y1, grow = 0) => { const a = cy(0, y0 - grow, s), b = cy(0, y1 + grow, s); return [(x0 - grow) * px, Math.min(a, b), (x1 - x0 + 2 * grow) * px, Math.abs(b - a)]; };
    const band = (s, y0, y1, col) => { const [x, y, ww, hh] = rect(s, 0, L, y0, y1); c.fillStyle = col; c.fillRect(x, y, ww, hh); };
    const round = (s, [x0, x1, y0, y1], grow, r, col) => { const [x, y, ww, hh] = rect(s, x0, x1, y0, y1, grow); rrect(c, x, y, ww, hh, r * px, r * pv); c.fillStyle = col; c.fill(); };
    const cut = (shrink, rWin) => {   // punch every opening through (alpha 0), shrunk by `shrink` all round
      c.globalCompositeOperation = 'destination-out';
      [1, -1].forEach(s => { for (const h of holes(L)) round(s, h, -shrink, h[4] ? 0 : rWin, '#000'); });
      c.globalCompositeOperation = 'source-over';
    };
    return { band, round, cut, cx, cy };
  };
  const geo = {}, tex = {}, lin = {}, pane = {}, lining = {}, surround = {}, cap = {}, logo = inouiLogo(128, '#f2f1ee', '#e5415d');
  const fan = (hw, top) => {   // an end wall round the upper deck's gangway opening (GANGWAY), hw either side and up to top: points [z, y], triangles wound to face -x (rear) or +x
    const hole = [[hw, DECK.up], [-hw, DECK.up], [-hw, top], [hw, top]], all = [...pts, ...hole], v2 = q => q.map(([z, y]) => new THREE.Vector2(z, y));
    const tri = THREE.ShapeUtils.triangulateShape(v2(pts), [v2(hole)]).map(([a, b, c]) => {   // earcut picks its own winding: each triangle made anticlockwise in (z, y), facing -x
      const [za, ya] = all[a], [zb, yb] = all[b], [zc, yc] = all[c];
      return (zb - za) * (yc - ya) - (yb - ya) * (zc - za) > 0 ? [a, b, c] : [a, c, b];
    });
    return { pts:all, tri:rear => tri.flatMap(([a, b, c]) => rear ? [a, b, c] : [a, c, b]) };
  };
  const endFan = fan(0.45, 4.05), capFan = fan(0.47, 4.07);   // the caps' opening wider than the gangway's walls and ceiling (1 cm past the end walls' edges): no rim of them inside it
  for (const L of Ls){
    geo[L] = loftGeo([{ x:0, pts }, { x:L, pts }], vs);
    tex[L] = canvasTex(2048, 1024, (c, W, H) => {   // inOui livery: silver over a Carmillon line, anthracite band (to the floor by the door), pale sill, dark gaskets and door frame, logo past the door
      const p = painter(c, W, H, L);
      c.fillStyle = LIV.silver; c.fillRect(0, 0, W, H);
      [1, -1].forEach(s => {
        p.band(s, yBot, 1.3, LIV.low); p.band(s, 1.3, 2.86, LIV.anthracite); p.band(s, 2.86, 2.94, LIV.line); p.band(s, 4.1, yTop, LIV.coachRoof);
        p.round(s, [0, DOOR[1] + 0.05, yBot, 1.3], 0, 0, LIV.anthracite);
        for (const h of holes(L)) h[4] ? p.round(s, h, 0.04, 0, LIV.door) : p.round(s, h, 0.04, 0.14, LIV.gasket);
        stampLogo(c, logo, p.cx, p.cy, s, 2.45, 1.72, 0.575);
      });
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 0, 0.2 * W / L, H); c.fillRect((L - 0.2) * W / L, 0, 0.2 * W / L, H);   // end shading
      p.cut(0, 0.1);
    });
    lin[L] = canvasTex(1024, 512, (c, W, H) => {   // lining: floor edge, pale walls, luggage rack line, light ceiling, window reveals, end walls
      const p = painter(c, W, H, L);
      c.fillStyle = LIN.ceil; c.fillRect(0, 0, W, H);
      [1, -1].forEach(s => {
        p.band(s, yBot, DECK.lo + 0.05, LIN.floor); p.band(s, DECK.lo + 0.05, DECK.up + 0.05, LIN.wall); p.band(s, DECK.up + 0.05, 3.92, LIN.wallUp); p.band(s, 3.84, 3.92, LIN.rack);
        for (const h of holes(L)) if (!h[4]) p.round(s, h, 0.03, 0.12, LIN.reveal);
      });
      c.fillStyle = LIN.end; c.fillRect(0, 0, 0.1 * W / L, H);   // sampled by the end walls
      p.cut(0.02, 0.08);   // 2 cm inside the skin's openings: from inside, never a gap onto the skin's back
    });
    const body = geo[L].body, lp = [...body.getAttribute('position').array], lu = [...body.getAttribute('uv').array], li = [...body.index.array];
    for (const [x, rear] of [[0.015, true], [L - 0.015, false]]){   // end walls, 1.5 cm in from the gangway faces, wound like the caps (seen from inside)
      const o = lp.length / 3;
      for (const [z, y] of endFan.pts){ lp.push(x, y, z); lu.push(0.004, 0.25); }
      for (const t of endFan.tri(rear)) li.push(o + t);
    }
    const capGeo = (x, rear) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(capFan.pts.flatMap(([z, y]) => [x, y, z]), 3));
      g.setIndex(capFan.tri(rear)); g.computeVertexNormals(); return g;
    };
    cap[L] = { rear:capGeo(0, true), front:capGeo(L, false) };
    const lg = lining[L] = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2)); lg.setIndex(li); lg.computeVertexNormals();
    const strips = (doorway, inset, r) => {   // quads following the section over each opening (2 cm larger all round, corners rounded to r), `inset` in from the skin (< 0: out), facing out
      const pos = [], idx = [];
      for (const s of [1, -1]) for (const [x0, x1, y0, y1, d] of holes(L)){
        if (d !== doorway) continue;
        const X0 = x0 - 0.02, X1 = x1 + 0.02, Y0 = y0 - 0.02, Y1 = y1 + 0.02, o = pos.length / 3;
        const arc = [1, 2, 3, 4, 5, 6].map(k => r - r * Math.cos(k * Math.PI / 12));   // rise of the corner arcs, sampled every 15 degrees
        const ys = [Y0, Y1, ...pts.slice(1, RING_N / 2).map(q => q[1]).filter(y => y > Y0 && y < Y1), ...arc.map(t => Y0 + t), ...arc.map(t => Y1 - t)]
          .sort((a, b) => a - b).filter((y, k, a) => k === 0 || y - a[k - 1] > 1e-4);
        for (const y of ys){
          const e = Math.max(0, Y0 + r - y, y - Y1 + r), dx = r - Math.sqrt(Math.max(0, r * r - e * e)), z = s * (zAtY(pts, y) - inset);
          pos.push(X0 + dx, y, z, X1 - dx, y, z);
        }
        for (let k = 0; k + 1 < ys.length; k++){ const a = o + 2 * k; s > 0 ? idx.push(a, a + 1, a + 3, a, a + 3, a + 2) : idx.push(a, a + 3, a + 1, a, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    pane[L] = { glass:strips(false, -0.004, 0.12), plug:mergeGeos([strips(true, 0.07, 0),   // glass 4 mm proud of the skin, over the gasket (its corners on the gasket's arcs, 2 cm in from its edge); the plug sits behind the closed leaf (its back is 4.8 cm in)
      new THREE.PlaneGeometry(0.94, 1.61).rotateY(-Math.PI / 2).translate(0.005, 3.265, 0), new THREE.PlaneGeometry(0.94, 1.61).rotateY(Math.PI / 2).translate(L - 0.005, 3.265, 0)]) };   // and over both gangway openings: from afar the coach is empty, so they would show through it
    const rr = (x0, x1, y0, y1, r, ys) => {   // rounded rectangle, anticlockwise from the top right corner: 7 points per corner, and the heights ys (rising) up each jamb
      const out = [];
      for (const [cx, cy, q] of [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 1], [x0 + r, y0 + r, 2], [x1 - r, y0 + r, 3]]){
        for (let k = 0; k <= 6; k++){ const a = (q + k / 6) * Math.PI / 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        if (q === 1) for (let k = ys.length - 1; k >= 0; k--) out.push([x0, ys[k]]); else if (q === 3) for (const y of ys) out.push([x1, y]);
      }
      return out;
    };
    /* window surrounds 3 mm inside the lining, from 3 cm inside each opening to 3.5 cm out: a crisp edge over the alpha cuts, which a
       seat sees at arm's length. Their jambs bend at the ring heights as the wall does (straight, they stood up to 2 cm off it), and a
       reveal runs from their inner edge out to the glass: no sightline slips between surround and pane onto the lining's cut edge. */
    const fp = [], fi = [];
    for (const s of [1, -1]) for (const [x0, x1, y0, y1, d] of holes(L)){
      if (d) continue;
      const ys = pts.slice(1, RING_N / 2).map(q => q[1]).filter(y => y > y0 + 0.1 && y < y1 - 0.1);   // both rings' jambs run from y0 + 0.1 to y1 - 0.1
      const a = rr(x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, 0.07, ys), b = rr(x0 - 0.035, x1 + 0.035, y0 - 0.035, y1 + 0.035, 0.135, ys), o = fp.length / 3, n = a.length;
      for (const [ring, dz] of [[a, -0.003], [b, -0.003], [a, -0.003], [a, 0.004]]) for (const [x, y] of ring) fp.push(x, y, s * (zAtY(pts, y) + dz));   // surround, then the reveal on its own vertices (its own normals)
      for (const [p, q] of [[o, o + n], [o + 2 * n, o + 3 * n]]) for (let k = 0; k < n; k++){ const k1 = (k + 1) % n; fi.push(p + k, q + k, q + k1, p + k, q + k1, p + k1); }
    }
    const fg = surround[L] = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals();
  }
  const paint = d => {   // inOui door: magenta at the top and bottom, coral a little over mid height (vertex colours by height, worn by its outer face and edges); the edges fade to the lining's end-wall grey at the inner face
    const p = d.leaf.getAttribute('position'), st = [[0, '#dd4c8e'], [0.55, '#fa6951'], [1, '#e034a2']].map(([t, h]) => [t, new THREE.Color(h)]), q = new THREE.Color(), inner = new THREE.Color(LIN.end), col = [];
    for (let i = 0; i < p.count; i++){
      if (Math.abs(p.getZ(i)) < zAtY(pts, p.getY(i)) - 0.018){ col.push(inner.r, inner.g, inner.b); continue; }   // the inner face, 6 cm behind the outer one (doorLeafGeo)
      const t = Math.min(1, Math.max(0, (p.getY(i) - DOOR[2]) / (DOOR[3] - DOOR[2]))), k = t < st[1][0] ? 0 : 1;
      q.copy(st[k][1]).lerp(st[k + 1][1], (t - st[k][0]) / (st[k + 1][0] - st[k][0])); col.push(q.r, q.g, q.b);
    }
    d.leaf.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return d;
  };
  const win = [0.4, 1.7, 2.3];   // the leaf's window: half width, bottom, top (level with the lower deck's windows)
  const leaf = { p:paint(doorLeafGeo(pts, 1, ...DOOR.slice(2), DOOR[1] - DOOR[0], win)), n:paint(doorLeafGeo(pts, -1, ...DOOR.slice(2), DOOR[1] - DOOR[0], win)) };
  return { geo, tex, lin, pane, lining, surround, cap, pts, yBot, yTop, leaf, holes, doorX:(DOOR[0] + DOOR[1]) / 2 };
})();
/* rubber fairings over the car gaps, as on the real sets: each car's own section 2 cm in all round, lofted across the gap and 1 cm
   into both cars. They read as a dark seam that follows the roof (a box across the gap stood out of the rounded roof shoulders). */
const GANG = (() => {
  const inset = (pts, d) => pts.map(([z, y], j) => {   // d in along the normal (the ring runs anticlockwise in z, y)
    const [z0, y0] = pts[(j + RING_N - 1) % RING_N], [z1, y1] = pts[(j + 1) % RING_N], l = Math.hypot(z1 - z0, y1 - y0);
    return [z - d * (y1 - y0) / l, y + d * (z1 - z0) / l];
  });
  const tr = inset(TR.pts, 0.02), pc = inset(PC.rings[0].pts, 0.02), o = 0.01;
  return {
    tr:loftGeo([{ x:-0.5 - o, pts:tr }, { x:o, pts:tr }]).body,                                               // behind a trailer (x 0) to the next one
    pcFront:loftGeo([{ x:-o, pts:tr }, { x:0, pts:tr }, { x:0.6, pts:pc }, { x:0.6 + o, pts:pc }]).body,     // ahead of the first trailer (x 0) to its power car
    pcRear:loftGeo([{ x:-0.6 - o, pts:pc }, { x:-0.6, pts:pc }, { x:0, pts:tr }, { x:o, pts:tr }]).body,     // behind the last trailer (x 0) to its power car
  };
})();
/* the walk-through between two cars on the upper deck, inside the fairing: floor, walls and ceiling from 3 cm into a car (x 0, its
   rear end) to 3 cm into the next one, over the edges of both end walls' openings (TR endFan). Faces inward. Groups: floor, walls, ceiling.
   Walls and ceiling 1 cm out past the openings' edges (z ±0.45, y 4.05), behind the end walls: on them, the edges flickered along the walls */
const GANGWAY = (() => {
  const P = (w, h) => new THREE.PlaneGeometry(w, h), top = 4.06, y = (DECK.up + top) / 2, h = top - DECK.up;
  const g = mergeGeos([P(0.56, 0.92).rotateX(-Math.PI / 2).translate(-0.25, DECK.up, 0), P(0.56, h).rotateY(Math.PI).translate(-0.25, y, 0.46), P(0.56, h).translate(-0.25, y, -0.46), P(0.56, 0.92).rotateX(Math.PI / 2).translate(-0.25, top, 0)]);
  g.addGroup(0, 6, 0); g.addGroup(6, 12, 1); g.addGroup(18, 6, 2);
  return g;
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
  const bodyM = {}, linM = {};
  for (const L of Object.keys(TR.tex)){
    bodyM[L] = mk(0xffffff, { map:TR.tex[L], alphaTest:0.5, roughness:0.45, metalness:0.2 });   // the openings are cut out (the shadow pass keeps the cut)
    linM[L] = mk(0xffffff, { map:TR.lin[L], alphaTest:0.5, side:THREE.BackSide, roughness:0.9, metalness:0, emissive:0xffffff, emissiveMap:TR.lin[L], emissiveIntensity:0.25 });   // inside of the shell, lit by the saloon lights
  }
  const endM = mk(0x2b3238, { roughness:0.85 }), capM = mk(0x2b3238, { roughness:0.85 });
  const frameM = mk(LIN.reveal, { side:THREE.DoubleSide, roughness:0.9, metalness:0, emissive:LIN.reveal, emissiveIntensity:0.25 });   // lit like the lining
  const bellowsM = mk(0x23272c, { roughness:0.95 }), doorM = mk(0xffffff, { vertexColors:true, roughness:0.45, metalness:0.15, side:THREE.DoubleSide });
  const leafM = [doorM, mk(LIN.end, { roughness:0.9, metalness:0, emissive:LIN.end, emissiveIntensity:0.25 }), mk(LIV.gasket, { roughness:0.8 })];   // a door leaf's groups: livery, inner face lit like the lining, window gasket
  const paneM = {   // glass in the openings: opaque from afar (the doors' own copy: highlighting the doors leaves the windows be), tinted and clear near the camera; the doorway plug only from afar
    far:mk(0x27303a, { roughness:0.25, metalness:0.1 }), door:mk(0x27303a, { roughness:0.25, metalness:0.1 }), plug:mk(LIV.door, { roughness:0.8 }),
    near:mk(0x1c2530, { transparent:true, opacity:0.45, depthWrite:false, side:THREE.DoubleSide, forceSinglePass:true, roughness:0.05, metalness:0 }),   // one pass: every pane has the same tint, so the blend order does not matter
  };
  for (const m of [paneM.far, paneM.door]){ m.emissive.setHex(0xffc98a); winMats.push(m); }   // the saloon's light in them from afar, in the dark (updateLights)
  const skin = m => { if (internals) trShells.meshes.push(m); return m; };   // what the shell control fades: body, ends, gangways, doors (the underframe stays); the other trains stay opaque
  if (internals) trShells.mats.push(...Object.values(bodyM), capM, bellowsM, ...leafM);
  set.coaches = [];
  const coachM = { floor:mk(0x3a3f46, { roughness:0.9 }), ceil:mk(0xe6e2da, { roughness:0.9, emissive:0xe6e2da, emissiveIntensity:0.45 }), seat:mk(0xffffff, { roughness:0.85 }), people:paxMat(mk),
                  bar:mk(0xffffff, { vertexColors:true, roughness:0.7, metalness:0.05 }), glow:new THREE.MeshBasicMaterial({ vertexColors:true, toneMapped:false }),   // the bar car's fittings, and what glows in it
                  fridge:new THREE.MeshBasicMaterial({ map:BAR_TEX.fridge, toneMapped:false }), screen:new THREE.MeshBasicMaterial({ map:internals ? BAR_TEX.live : BAR_TEX.idle, toneMapped:false }) };
  const gangM = [coachM.floor, frameM, coachM.ceil], staffM = mk(LIN.rack, { roughness:0.6, metalness:0.2, emissive:LIN.rack, emissiveIntensity:0.25 }), staffGeo = new THREE.PlaneGeometry(0.9, 4.05 - DECK.up);
  for (const m of [...Object.values(linM), frameM, leafM[1], staffM, coachM.floor, coachM.ceil, coachM.seat, coachM.people, coachM.bar]) saloonLit(m);
  const trailerRear = [];
  TGV.TRAILERS.forEach(([xr, L], i) => {
    const g = new THREE.Group(); g.position.x = xr;
    const b = new THREE.Mesh(TR.geo[L].body, bodyM[L]); b.castShadow = true; b.receiveShadow = true; g.add(skin(b));
    const cr = new THREE.Mesh(TR.cap[L].rear, capM), cf = new THREE.Mesh(TR.cap[L].front, capM); g.add(skin(cr), skin(cf));
    const lining = new THREE.Mesh(TR.lining[L], linM[L]), glass = new THREE.Mesh(TR.pane[L].glass, paneM.far), plug = new THREE.Mesh(TR.pane[L].plug, paneM.plug);
    lining.visible = false; glass.receiveShadow = plug.receiveShadow = true; g.add(lining, glass, plug);
    lining.add(new THREE.Mesh(TR.surround[L], frameM));   // shown with the lining
    g.add(box(L - 1.0, 0.16, 2.6, endM, L / 2, 0.83, 0));                                 // underframe
    g.add(box(L - 3.0, 0.5, 2.9, endM, L / 2, 0.55, 0));                                  // low floor tanks/equipment
    g.add(skin(new THREE.Mesh(i < TGV.TRAILERS.length - 1 ? GANG.tr : GANG.pcRear, bellowsM)));   // gangway fairing behind: over the Jacobs bogie, or to the rear power car
    if (i === 0){ const f = new THREE.Mesh(GANG.pcFront, bellowsM); f.position.x = L; g.add(skin(f)); }   // and to the front power car
    G.trailers.add(g); trailerRear.push(xr);
    // plug-sliding door at the -x end of each trailer, both sides; only +z (platform) leaves animate
    const doorPanes = [];
    [1, -1].forEach(s => {
      const d = new THREE.Group(); d.position.set(xr + TR.doorX, 0, 0);
      const t = TR.leaf[s > 0 ? 'p' : 'n'], leaf = new THREE.Mesh(t.leaf, leafM), pane = new THREE.Mesh(t.pane, paneM.door);   // the pane follows the coach's glass (coachLod)
      leaf.castShadow = true; pane.receiveShadow = true; d.add(skin(leaf), pane); doorPanes.push(pane);
      G.doors.add(d); set.doors.push({ g:d, s, x0:xr + TR.doorX, z0:0 });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map:carNumber(firstCar + i), side:THREE.DoubleSide }));
      const tilt = Math.atan((zAtY(TR.pts, 3.425) - zAtY(TR.pts, 3.175)) / 0.25);   // leant with the tumblehome, 1 to 1.5 cm off it (upright, its lower edge was inside the wall and showed from inside)
      num.position.set(xr + 2.75, 3.3, s * (zAtY(TR.pts, 3.3) + 0.012)); num.rotation.set(s * tilt, s < 0 ? Math.PI : 0, 0); G.trailers.add(num);
    });
    const c = buildCoach(G.trailers, coachM, xr, L, firstCar + i);
    Object.assign(c, { lining, glass, doorPanes, plug, paneM, own:internals, lod:0 });
    if (i < TGV.TRAILERS.length - 1){ const t = new THREE.Mesh(GANGWAY, gangM); t.position.x = xr; c.g.add(t); }   // through to the next car
    for (const [end, x, ry] of [[i === 0, xr + L - 0.02, -Math.PI / 2], [i === TGV.TRAILERS.length - 1, xr + 0.02, Math.PI / 2]]) if (end){   // the end against a power car: a staff door shuts the opening
      const d = new THREE.Mesh(staffGeo, staffM); d.position.set(x, (DECK.up + 4.05) / 2, 0); d.rotation.y = ry; c.g.add(d);
    }
    set.coaches.push(c); allCoaches.push(c);
  });
  // bogies: end bogies + 7 Jacobs at the articulations
  tgvBogie(G.jacobs, -13.0, mk, 3.0, true);
  for (let i = 0; i < TGV.TRAILERS.length - 1; i++) tgvBogie(G.jacobs, TGV.TRAILERS[i][0] - 0.25, mk, 3.0, true);
  tgvBogie(G.jacobs, -161.0, mk, 3.0, true);
  // rear power car (nose toward -x) + its pantograph; the front car is the loco shell (set 1) or built here (set 2)
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
  for (let x = -12; x > TGV.REAR_PC + 3; x -= 9.6) G.roof.add(cyl(0.06, 0.3, insM, 'y', x, (x < TGV.REAR_PC + 9.6 ? 4.25 : 4.3) + 0.15, 0.25, 8));   // standing on the roof, not through it (seen from inside)
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
pantoHook = f => { if (S.mode !== 'tgv') return false; posePanto(tgvSets[0].pantos[0], f); posePanto(panto, f * S.pantoDcF); return true; };   // under 25 kV the rear pantograph feeds the roof line and the leading one stays folded; under 1.5 kV DC both rise

/* ---- station: a platform on the camera side sized to the formation (200 m single set, 400 m double), letters A..P.
   platG holds our platform and its crowd: an island to the right of our track, mirrored (scale.z -1) into a side platform on the
   left at the LGV stations, where platOpp is the other direction's side platform. The letter signs undo the mirror so they read right */
const station = new THREE.Group(); world.add(station);   // posed on the line at the nearest station by updateRoute
const platG = new THREE.Group(); station.add(platG);
const platVariant = {}, letterSigns = [], platRoofs = [], platPosts = [];
let platOpp = null, platSide = 1, platRoof = true;
function setPlatformSide(side){
  if (side === platSide) return;
  platSide = side; platG.scale.z = side; platOpp.visible = side < 0; platOpp.position.z = 2 * (2.25 + ROUTE.SD);   // on the far loop, lane 'C'
  for (const sg of letterSigns) sg.scale.z = side;
}
function setPlatformRoof(on){   // under a station's slab (Massy) the platforms have no canopy: the coach letters stand on posts instead of hanging from it
  if (on === platRoof) return;
  platRoof = on;
  for (const g of platRoofs) g.visible = on;
  for (const g of platPosts) g.visible = !on;
}
/* the stop's name on every sign that carries one: the platform boards and, in capitals, the generic building's board. One texture each,
   repainted per stop (poseStation); a sign shows the painted part and takes its width from it */
const NAME_PX = 128, nameTexs = [0, 1].map(() => canvasTex(2048, NAME_PX, () => {})), nameSigns = [];
let nameShown = '';
function setStationName(name){
  if (name === nameShown) return;
  nameShown = name;
  nameTexs.forEach((t, caps) => {
    const c = t.image.getContext('2d'), txt = caps ? name.toUpperCase() : name;
    c.font = 'bold 80px Inter, Arial, sans-serif';
    const fit = caps ? 1 : Math.min(1, 900 / c.measureText(txt).width);   // a platform board stays under 5.3 m, so it never fills the door view: a long name takes smaller letters
    c.font = `bold ${Math.floor(80 * fit)}px Inter, Arial, sans-serif`;
    const w = Math.min(2048, Math.ceil(c.measureText(txt).width) + 72);
    c.fillStyle = '#1f4fa0'; c.fillRect(0, 0, 2048, NAME_PX); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(txt, w / 2, NAME_PX / 2 + 4);
    t.repeat.set(w / 2048, 1); t.userData.aspect = w / NAME_PX; t.needsUpdate = true;
  });
  for (const sg of nameSigns) sg.fit();
}
if (document.fonts) document.fonts.ready.then(() => { const n = nameShown; nameShown = ''; if (n) setStationName(n); });   // repaint in the web font once it is in
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
  const letterGeo = new THREE.PlaneGeometry(0.8, 0.8), nameGeo = new THREE.PlaneGeometry(1, 0.7), nameM = new THREE.MeshBasicMaterial({ map:nameTexs[0] });
  const nameBoard = (x, mirrored) => {   // on two posts along the middle of the platform, one face per side, 2.6 to 3.3 m above the rail
    const g = new THREE.Group(), frame = box(1, 0.78, 0.05, sm, 0, 0, 0), faces = [1, -1].map(k => { const m = new THREE.Mesh(nameGeo, nameM); m.position.z = 0.03 * k; if (k < 0) m.rotation.y = Math.PI; return m; });
    const posts = [-1, 1].map(() => box(0.08, 2.05, 0.08, sm, 0, -1.375, 0));
    g.add(frame, ...faces, ...posts); g.position.set(x, 2.95, 6.5);
    if (mirrored) letterSigns.push(g);
    nameSigns.push({ fit(){ const w = 0.7 * nameTexs[0].userData.aspect; for (const f of faces) f.scale.x = w; frame.scale.x = w + 0.08; posts[0].position.x = 0.3 - w / 2; posts[1].position.x = w / 2 - 0.3; } });
    return g;
  };
  const mkPlat = (L, sets, mirrored = true) => {
    const g = new THREE.Group(), roof = new THREE.Group(), posts = new THREE.Group();
    posts.visible = false; g.add(roof, posts); platRoofs.push(roof); platPosts.push(posts);
    g.add(box(L, 0.97, 6.25, pm, -L / 2, 0.065, 4.875));                       // slab z 1.75..8.0, top at y 0.55
    g.add(box(L, 0.02, 0.3, em, -L / 2, 0.56, 1.95)); g.add(box(L, 0.02, 0.3, em, -L / 2, 0.56, 7.8));   // safety lines on both faces of the island platform
    for (let x = -6; x > -L + 4; x -= 12) roof.add(box(0.25, 3.7, 0.25, sm, x, 2.4, 6.5));
    roof.add(box(L - 6, 0.12, 4.0, cm, -L / 2, 4.25, 5.75));                      // canopy, z 3.75..7.75, clear of the train on the far face; light so its underside reads in the door view
    for (let x = -30; x > -L + 20; x -= 60){ g.add(box(4, 1.1, 2.2, sm, x, 1.1, 4.9)); g.add(box(3.6, 0.1, 1.9, glassM, x, 1.7, 4.9)); }   // stair heads down to the underpass, in the middle of the island
    for (let x = -12; x > -L + 10; x -= 48) g.add(nameBoard(x, mirrored));   // between two lamp posts
    const letters = 'ABCDEFGHIJKLMNOP';
    for (let s = 0; s < sets; s++) TGV.TRAILERS.forEach(([xr, Lc], i) => {
      const cx = xr + Lc / 2 + (s ? TGV.SET2_X : 0) - TGV.PLAT_FRONT, mat = new THREE.MeshBasicMaterial({ map:letterTex(letters[s * 8 + i]) });
      const sg = new THREE.Group(), back = new THREE.Mesh(letterGeo, mat); back.rotation.y = Math.PI;   // two faces back to back, each reading right
      sg.add(new THREE.Mesh(letterGeo, mat), back); sg.position.set(cx, 3.4, 2.6); g.add(sg); letterSigns.push(sg);
      roof.add(box(0.06, 0.9, 0.06, sm, cx, 3.8, 2.6)); posts.add(box(0.06, 2.45, 0.06, sm, cx, 1.775, 2.6));   // hung from the canopy, or on a post
    });
    return g;
  };
  platVariant[1] = mkPlat(200, 1); platVariant[2] = mkPlat(400, 2); platVariant[2].visible = false;
  platG.add(platVariant[1], platVariant[2]);
  platOpp = mkPlat(400, 0, false); platOpp.visible = false; station.add(platOpp);
  const b = new THREE.Group(); b.name = 'stationBuilding'; b.position.set(-40, -0.42, -12);   // station building across the tracks (z set per station)
  b.add(box(30, 6, 9, wallM, 0, 3, 0)); b.add(box(32, 0.5, 10, roofM, 0, 6.25, 0));
  { const back = box(1, 1.3, 0.3, signM, 0, 7.2, 4.8), face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshBasicMaterial({ map:nameTexs[1] }));   // the name board on the roof edge
    face.position.set(0, 7.2, 4.96); b.add(back, face);
    nameSigns.push({ fit(){ const w = Math.min(28, 1.3 * nameTexs[1].userData.aspect); face.scale.x = w; back.scale.x = w + 0.4; } }); }
  for (let x = -12; x <= 12; x += 4) b.add(box(1.6, 2.4, 0.1, glassM, x, 3.2, 4.55));
  station.add(b);
}

/* ---- passengers. Seated ones live in the coaches (one slot per seat, buildCoach); the platform crowd is one instanced pool
   under the station. Doors open at a stop: alighters leave their seats, queue at the door and step down onto the platform,
   then walk to the nearest stair; then the crowd boards and walks to free seats. Lane 0 of a doorway serves the upper deck
   (its -x half), lane 1 the lower deck. At the terminus everyone gets off and the train fills again; the doors wait for the
   last passenger (a close request is deferred until then, not refused). */
const POOL_N = 3072;
const pool = { mesh:paxMesh(POOL_N, paxMat(pmat)), a:new Array(POOL_N).fill(null), lo:0, hi:-1, dirty:false, colDirty:false };   // slot j: agent a[j], or a hole (folded to nothing) below hi
{
  _m4.makeScale(0, 0, 0);
  for (let j = 0; j < POOL_N; j++) pool.mesh.setMatrixAt(j, _m4);
  pool.mesh.customDepthMaterial = paxDepthMat(); pool.mesh.castShadow = true; pool.mesh.frustumCulled = false;
  platG.add(pool.mesh);
}
const _pw = new THREE.Vector3(), _pw2 = new THREE.Vector3();
const PX = { phase:'idle', t:0, plan:'mid', h:0.55, visited:null, hold:false, closeWhenDone:false, crowdSt:null, rebuild:true, list:[] };
const STRIDE = 5.6;   // stride phase per metre walked: a step of 0.56 m, so the feet do not slide

function mkPath(P){ const C = [0]; for (let k = 3; k < P.length; k += 3) C.push(C[C.length - 1] + Math.hypot(P[k] - P[k - 3], P[k + 1] - P[k - 2], P[k + 2] - P[k - 1])); return { P, C, len:C[C.length - 1] }; }
let _seg = 0;   // the segment the last pathAt landed on
function pathAt(p, s, out){   // point at arc length s along a polyline path
  const C = p.C, P = p.P; let k = 1; while (k < C.length - 1 && C[k] < s) k++;
  const u = C[k] > C[k - 1] ? Math.min(1, Math.max(0, (s - C[k - 1]) / (C[k] - C[k - 1]))) : 1, i = 3 * (k - 1);
  _seg = k - 1;
  return out.set(P[i] + (P[i + 3] - P[i]) * u, P[i + 1] + (P[i + 4] - P[i + 1]) * u, P[i + 2] + (P[i + 5] - P[i + 2]) * u);
}
function segYaw(p, dir, yaw){   // the way someone on that segment faces (dir -1: walking the path backwards); a vertical step keeps yaw
  const P = p.P, i = 3 * _seg, dx = (P[i + 3] - P[i]) * dir, dz = (P[i + 5] - P[i + 2]) * dir;
  return dx * dx + dz * dz > 1e-8 ? Math.atan2(-dz, dx) : yaw;
}
function turnTo(a, b, step){ let d = b - a; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; return Math.abs(d) <= step ? b : a + Math.sign(d) * step; }   // the short way round
function seatPath(c, i){   // seat -> step out (the way the seat faces) -> aisle -> (upper deck: stair down) -> doorway on the platform side, set-local
  const sd = platSide, key = sd < 0 ? i + c.n : i;
  if (c.paths[key]) return c.paths[key];
  const x = c.seat[3 * i], y = c.seat[3 * i + 1], z = c.seat[3 * i + 2], o = x + 0.42 * c.face[i], xr = c.xr, lo = DECK.lo, up = DECK.up;
  return c.paths[key] = mkPath(c.deck[i]
    ? [x, y, z, o, y, z, o, y, 0, xr + 3.55, up, 0, xr + 3.55, up, -0.9, xr + 1.85, lo, -0.9, xr + 1.35, lo, sd > 0 ? -0.4 : -0.9, xr + 1.35, lo, 1.25 * sd]   // along the aisle to the stair head before turning into it, clear of the first row
    : [x, y, z, o, y, z, o, y, 0, xr + 2.2, lo, 0, xr + 1.95, lo, 0.35 * sd, xr + 1.95, lo, 1.25 * sd]);
}
function paxIn(c, i){   // the instance of seat i's person, taken at the end of the drawn range the first time
  let k = c.inst[i];
  if (k < 0){ k = c.inst[i] = c.people.count++; c.slot[k] = i; paxLookAt(c.people, k, c.look[i]); c.colDirty = true; }
  return k;
}
function paxOut(c, i){   // seat i's person leaves the coach: the last drawn instance moves into the gap
  const k = c.inst[i]; if (k < 0) return;
  const m = c.people, last = --m.count;
  if (k !== last){
    m.instanceMatrix.array.copyWithin(16 * k, 16 * last, 16 * last + 16);
    for (const a of ['paxCol', 'paxLook', 'paxPose']) m.geometry.attributes[a].array.copyWithin(4 * k, 4 * last, 4 * last + 4);
    const j = c.slot[last]; c.slot[k] = j; c.inst[j] = k;
  }
  c.inst[i] = -1; c.dirty = c.colDirty = true;
}
function paxSetLook(c, i, h){ c.look[i] = h; if (c.inst[i] >= 0){ paxLookAt(c.people, c.inst[i], h); c.colDirty = true; } }
function poseSeat(c, i, on){   // seated (facing the way the seat does, the head turned a little), or gone
  if (!on){ paxOut(c, i); return; }
  const f = c.face[i];
  paxPut(c.people, paxIn(c, i), c.seat[3 * i] + 0.01 * f, c.seat[3 * i + 1], c.seat[3 * i + 2], f > 0 ? 0 : Math.PI, 1, 0, 0, ((c.look[i] >>> 27) % 9 - 4) * 0.12);
  c.dirty = true;
}
function poseWalker(c, w, dt){   // walking in the coach: stands up over the first step out of the seat (still facing its way), then turns down the aisle
  const p = w.p, u = Math.min(1, w.s / p.C[1]), f = c.face[w.i];
  pathAt(p, w.s, _pw);
  w.yaw = turnTo(w.yaw, u < 1 ? (f > 0 ? 0 : Math.PI) : segYaw(p, w.dir, w.yaw), dt * 7);
  w.amp = approach(w.amp, w.moving ? u : 0, dt * 5);
  paxPut(c.people, paxIn(c, w.i), _pw.x + 0.01 * f * (1 - u), _pw.y, _pw.z, w.yaw, 1 - THREE.MathUtils.smoothstep(u, 0, 1), w.ph, w.amp, 0);
  c.dirty = true;
}
function paxSeed(c){   // the passengers a coach starts with: 30% of the seats, the same people every time
  c.people.count = 0; c.inst.fill(-1);
  for (let i = 0; i < c.n; i++){
    c.look[i] = hash32(c.id * 1000 + i);
    if (c.occ[i] !== 4) c.occ[i] = !c.view.includes(i) && hash32(c.id * 7919 + i) % 100 < 30 ? 1 : 0;   // occ: 0 free, 1 seated, 2 getting off, 3 taken by someone getting on, 4 the walker's (walkSit)
    poseSeat(c, i, c.occ[i] === 1);
  }
  c.dirty = c.colDirty = true;
}
function freeSeat(c, deck){   // a random free seat on that deck, or -1 (never the viewer's)
  let n = 0, pick = -1;
  for (let i = 0; i < c.n; i++) if (c.occ[i] === 0 && c.deck[i] === deck && !c.view.includes(i) && Math.random() * ++n < 1) pick = i;
  return pick;
}

// platform pool: agents {j, st: wait|board|back|alight, x,y,z, home hx,hz, path, s, v, ph, look, yaw, face (waiting), amp, turn, c, lane, e, seat}
function poseAgent(a, dt){   // facing down the path (or, standing, the way it waits), the stride easing in and out
  a.yaw = turnTo(a.yaw, a.path ? segYaw(a.path, 1, a.yaw) : a.face, dt * 7); a.amp = approach(a.amp, a.path ? 1 : 0, dt * 4);
  paxPut(pool.mesh, a.j, a.x, a.y, a.z, a.yaw, 0, a.ph, a.amp, a.turn * (1 - a.amp));
  pool.dirty = true;
}
function poolSpawn(x, y, z, st, look){   // waiting ones face the train (-z, platform-local), give or take 20°, and look about
  let j = pool.lo; while (j < POOL_N && pool.a[j]) j++;
  if (j >= POOL_N) return null;
  const face = Math.PI / 2 + (Math.random() - 0.5) * 0.7;
  const a = { j, st, x, y, z, hx:x, hz:z, path:null, s:0, v:1.15 + Math.random() * 0.3, ph:Math.random() * 6, look, yaw:face, face, amp:0, turn:(Math.random() - 0.5) * 0.8, c:null, lane:0, e:null, seat:-1 };
  pool.a[j] = a; pool.lo = j + 1; pool.hi = Math.max(pool.hi, j);
  paxLookAt(pool.mesh, j, look); pool.colDirty = true;
  poseAgent(a, 0);
  return a;
}
function poolFree(a){
  pool.a[a.j] = null; pool.lo = Math.min(pool.lo, a.j); a.st = 'gone'; a.path = null;
  _m4.makeScale(0, 0, 0); pool.mesh.setMatrixAt(a.j, _m4); pool.dirty = true;
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
    if (k >= S.sets || !c.n) continue;   // the bar car has no seats: nobody waits at its door
    let seated = 0; for (let i = 0; i < c.n; i++) if (c.occ[i] === 1) seated++;
    const want = plan === 'terminus' ? 0.35 * c.n : plan === 'origin' ? Math.max(3, 0.43 * c.n - seated) : Math.max(0, 0.4 * c.n - 0.75 * seated);   // the coach leaves a third to two fifths full
    const per = Math.min(21, Math.round(want / 2)), nd = c.xr + 1.65 + (k ? TGV.SET2_X : 0) - TGV.PLAT_FRONT;
    for (let l = 0; l < 2; l++) for (let j = 0; j < per; j++){
      const col = Math.floor(j / 3);
      const a = poolSpawn(nd + (l ? 1 : -1) * (1.0 + 0.55 * col) + (Math.random() - 0.5) * 0.2, 0.55, [2.45, 2.95, 3.45][j % 3] + (Math.random() - 0.5) * 0.1, 'wait', hash32((Math.random() * 1e9) | 0));
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
  platG.updateWorldMatrix(true, false);
  for (let k = 0; k < S.sets; k++) for (const c of tgvSets[k].coaches){
    c.g.updateWorldMatrix(true, false);
    const T = [1.35, 1.95].map(dx => platG.worldToLocal(c.g.localToWorld(new THREE.Vector3(c.xr + dx, DECK.lo, 1.25 * platSide))));
    if (Math.abs(T[0].z - 1.25) > 0.4 || T[0].x > -1 || T[0].x < -Lp + 1) continue;   // this doorway is not along the platform
    const e = { c, T, L:[0, 1].map(() => ({ outs:[], wait:[], last:-9 , full:false })), boardT:-1, boarding:0, done:false };
    for (let i = 0; i < c.n; i++) if (c.occ[i] === 1 && Math.random() < share){
      c.occ[i] = 2; e.L[c.deck[i] ? 0 : 1].outs.push({ i, p:seatPath(c, i), s:0, v:1.25 * (0.9 + 0.2 * Math.random()), ph:Math.random() * 6, rel:0, yaw:c.face[i] > 0 ? 0 : Math.PI, amp:0, dir:1, moving:false });
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
        w.moving = s > w.s + 1e-6; w.ph += (s - w.s) * STRIDE; w.s = s; poseWalker(c, w, dt);   // queued ones stand still and settle
        ahead = w.p.len - w.s;
      }
      const w0 = ln.outs[0];
      if (w0 && w0.s >= w0.p.len && open && t - ln.last >= h){   // step out onto the platform (+z, platform-local), still in stride
        const a = poolSpawn(e.T[l].x, e.T[l].y, e.T[l].z, 'alight', c.look[w0.i]);
        if (a){ Object.assign(a, { yaw:-Math.PI / 2, amp:1, ph:w0.ph }); agentGo(a, 'alight', alightPath(e, l)); }
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
    for (const w of ln.outs){ if (w.s <= 0){ e.c.occ[w.i] = 1; poseSeat(e.c, w.i, true); } else { e.c.occ[w.i] = 3; w.dir = -1; e.c.walk.push(w); } }
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
  paxSetLook(c, i, a.look);
  const p = seatPath(c, i), w = { i, p, s:p.len, v:a.v, ph:a.ph, yaw:platSide > 0 ? Math.PI / 2 : -Math.PI / 2, amp:a.amp, dir:-1, moving:true };   // in through the doorway: -z on the +z side
  c.walk.push(w); poseWalker(c, w, 0);
  e.boarding--;
  const q = c.crowd[a.lane], k = q.indexOf(a); if (k >= 0) q.splice(k, 1);
  poolFree(a);
}
function walkCoaches(dt){   // people walking in to their seat (or back to it)
  for (const set of tgvSets) for (const c of set.coaches) for (let k = c.walk.length - 1; k >= 0; k--){
    const w = c.walk[k], s = Math.max(0, w.s - w.v * dt); w.ph += (w.s - s) * STRIDE; w.s = s; w.moving = true;
    if (s <= 0){ c.occ[w.i] = 1; poseSeat(c, w.i, true); c.walk.splice(k, 1); } else poseWalker(c, w, dt);
  }
}
function walkPool(dt){
  for (let j = 0; j <= pool.hi; j++){
    const a = pool.a[j]; if (!a) continue;
    if (a.path){
      const s = Math.min(a.path.len, a.s + a.v * dt); a.ph += (s - a.s) * STRIDE; a.s = s;
      pathAt(a.path, s, _pw2); a.x = _pw2.x; a.y = _pw2.y; a.z = _pw2.z;
      if (s >= a.path.len){
        a.path = null;
        if (a.st === 'alight'){ poolFree(a); continue; }
        if (a.st === 'board'){ enterCoach(a); continue; }
        a.st = 'wait';
      }
    } else if (a.amp === 0 && a.yaw === a.face) continue;   // standing, settled: nothing to redraw
    poseAgent(a, dt);
  }
}
function updatePax(dt){
  const st = nearestStation();
  if (PX.phase !== 'exchange' && (PX.rebuild || st.id !== PX.crowdSt)) buildCrowd(st);
  if (PX.phase === 'done' && S.speed > 0.3) PX.phase = 'idle';
  if (PX.phase === 'idle' && S.doors && S.speed < 0.05 && S.coupling >= 0) paxActivate();
  if (PX.phase === 'exchange') paxExchange(dt);
  walkPool(dt); walkCoaches(dt);
  const m = pool.mesh, n = pool.hi + 1, A = m.geometry.attributes; m.count = n;
  const upload = (a, w) => { a.clearUpdateRanges(); a.addUpdateRange(0, n * w); a.needsUpdate = true; };   // the live part only
  if (pool.dirty && n){ upload(m.instanceMatrix, 16); upload(A.paxPose, 4); }
  if (pool.colDirty && n){ upload(A.paxCol, 4); upload(A.paxLook, 4); }
  pool.dirty = pool.colDirty = false;
  for (const set of tgvSets) for (const c of set.coaches){
    const B = c.people.geometry.attributes;
    if (c.dirty){ c.people.instanceMatrix.needsUpdate = B.paxPose.needsUpdate = true; c.dirty = false; }
    if (c.colDirty){ B.paxCol.needsUpdate = B.paxLook.needsUpdate = true; c.colDirty = false; }
  }
}
function paxHolding(){ return PX.phase === 'exchange' && PX.hold; }
function paxResolve(reset = false){   // settle everyone at once (teleport, reset, mode switch): walkers sit down or are gone, the crowd is rebuilt
  for (const set of tgvSets) for (const c of set.coaches){
    c.walk.length = 0; c.crowd[0].length = c.crowd[1].length = 0;
    if (reset){ paxSeed(c); continue; }
    for (let i = 0; i < c.n; i++){ const o = c.occ[i]; if (o === 2 || o === 3) c.occ[i] = o === 2 ? 0 : 1; poseSeat(c, i, c.occ[i] === 1); }
  }
  poolClear(); PX.list.length = 0;
  Object.assign(PX, { phase:'idle', hold:false, closeWhenDone:false, rebuild:true, visited:null });
}

function coachLod(){   // lod 0 far: opaque glass, plugged doorway, no interior; 1 near: interior, lining, clear glass; 2 own sets in x-ray: interior only
  for (const c of allCoaches){
    let lod;
    if (c.own && shellLevel < 1) lod = 2;
    else { _p.set(c.xr + c.L / 2, 2.5, 0).applyMatrix4(c.g.matrixWorld); lod = _p.distanceTo(camera.position) < COACH_NEAR + (c.lod === 1 ? 10 : 0) ? 1 : 0; }
    if (lod === c.lod) continue;
    c.lod = lod; c.g.visible = lod > 0; c.lining.visible = lod === 1; c.glass.visible = lod < 2; c.glass.material = lod ? c.paneM.near : c.paneM.far; c.plug.visible = lod === 0;
    for (const p of c.doorPanes){ p.visible = lod < 2; p.material = lod ? c.paneM.near : c.paneM.door; }
  }
}

/* ---- cameras for the long train (functions: they depend on the formation, and the platform views on the platform's side) */
const mirrorCam = c => nearestStation().side > 0 ? c : c.map(p => [p[0], p[1], -p[2]]);
Object.assign(CAMS, {
  train:    () => S.sets === 2 || S.coupling !== 0 ? [[40, 22, 80], [-120, 3, 0]] : [[45, 22, 75], [-60, 3, 0]],
  rearroof: [[-160, 9.5, 12], [-172, 4.8, 0]],
  coupler:  () => mirrorCam(S.sets === 2 || S.coupling !== 0 ? [[-186, 3.4, 6.0], [-186, 1.4, 0]] : [[-183, 3.4, 5.5], [-191, 1.4, 0]]),   // from the island platform, inside the row of lamp posts and clear of the train on the far face
  station:  () => mirrorCam([[-30, 10, 34], [-45, 1.5, 4]]),
  door:     () => mirrorCam([[-48, 2.3, 5.9], [-35, 1.7, 1.4]]),   // eye height on the island platform, under the canopy, between the two trains
  driver:   () => driverView(),
  walk:     () => walkView(),
});
function driverSeat(){   // the cab at the head of the train, whichever way it runs; a loco backing its wagons has none there: the last wagon stands in
  if (S.mode !== 'tgv') return S.dir > 0 ? parts.cab.group.getObjectByName('cabLoco') : wagons.children[wagons.children.length - 1];
  return S.dir > 0 ? tgvDriver.parent : (S.sets === 2 || S.coupling !== 0 ? pcHosts[1] : pcHosts[0]).driver.parent;
}
function driverView(){   // first person in the driver's place, the page's controls out of the way (keepDriver in 03h keeps it seated)
  const obj = driverSeat(), V = THREE.Vector3;
  if (S.mode !== 'tgv' && S.dir < 0) return { obj, eye:new V(-8.9, 4.0, 0), yaw:Math.PI, pitch:-0.05 };   // just past the end of the last wagon, looking back down the line
  const pitch = -0.09;   // the dashboard's lower edge (about -32°) on the bottom edge of the widest view (55° tall); a taller one shows more roof and desk alike
  return S.mode === 'tgv' ? { obj, eye:new V(8.3, 3.45, 0), yaw:0, pitch } : { obj, eye:new V(8.25, 3.2, 0.55), yaw:0, pitch };
}
/* ---- walking through set 1 in first person (CAMS.walk): up the stair at a car's rear end, over the bridge and through the upper-deck
   gangway into the next car, either way, and into any free seat (occ 4 while taken). The walker stands at x from the rear end of car
   WK.i, on floor y, at z across, inside the boxes of that car's floor plan (walkZones). keepWalker (03h) drives it every frame */
const WK = { on:false, back:false, i:0, x:0, y:0, z:0, ey:0, yaw:0, pitch:0, seat:-1, stool:-1, hold:false };   // back: walked before, Passenger again resumes there; ey: the eye's floor, eased up and down the stair; yaw, pitch: the look, kept each frame (03h) for coming back; stool: the bar car's stool sat on; hold: forward still held from before sitting
const WALK_EYE = 1.33, WALK_R = 0.35, WALK_REACH = 2.2;   // eye over the floor; room kept from anyone walking in the car; how far a seat can be taken from
const _wk = new THREE.Vector3(), _wk2 = new THREE.Vector3(), _wkQ = new THREE.Quaternion(), _wkQ2 = new THREE.Quaternion();
const WALK_Z = {};
function walkZones(i){   // [x0, x1, z0, z1, floor at x0, floor at x1]: where the walker's centre may be, 0.18 m clear of walls, rails and seats (and the eye 0.2 m clear of the curved upper wall)
  if (WALK_Z[i]) return WALK_Z[i];
  const L = TGV.TRAILERS[i][1], rows = seatRows(L).rows, e = rows[rows.length - 1][0] + 0.4, lo = DECK.lo, up = DECK.up;
  const Z = tgvSets[0].coaches[i].bar ? [   // the bar car: up the stair to the bar (the lower deck past the stair's foot is the crew's)
    [0.2, 1.85, -0.95, 0.95, lo, lo], [1.85, 3.27, -0.27, 0.95, lo, lo], [1.85, 3.55, -1.05, -0.63, lo, up],
    [i < TGV.TRAILERS.length - 1 ? -0.6 : 0.21, 3.4, -0.27, 0.27, up, up], [3.4, 3.6, -1.05, 0.27, up, up],
    [3.6, 4.52, -1.05, 1.05, up, up],                                          // in at the counter's end
    [4.52, 9.68, -0.04, 0.47, up, up],                                         // along the counter, clear of its foot rail and of the stools
    [9.68, L - 0.2, -0.47, 0.47, up, up],                                      // the lounge between the stools
  ] : [
    [0.2, 1.85, -0.95, 0.95, lo, lo],                                          // the vestibule, between the doors
    [1.85, 3.6, -0.27, 0.95, lo, lo],                                          // beside the stair's foot, into the lower saloon
    [3.4, L - 0.2, -0.08, 0.08, lo, lo], [e, L - 0.2, -0.95, 0.95, lo, lo],    // the lower aisle; the room past the last row
    [1.85, 3.55, -1.05, -0.63, lo, up],                                        // the stair
    [i < TGV.TRAILERS.length - 1 ? -0.6 : 0.21, 3.4, -0.27, 0.27, up, up],     // the bridge over the vestibule, on into the rear gangway (car 8: its staff door)
    [3.4, 3.6, -1.05, 0.27, up, up],                                           // the stair head, clear of the rail over the well
    [3.4, L - 0.2, -0.08, 0.08, up, up], [e, L - 0.2, -1.05, 1.05, up, up],    // the upper aisle; the room past the last row (car 1: its staff door)
  ];
  if (i > 0) Z.push([L - 0.2, L + 0.6, -0.27, 0.27, up, up]);                 // the front gangway, into the car ahead
  return WALK_Z[i] = Z;
}
function walkFloor(Z, x, z, y){   // the floor under (x, z) nearest y within a step (0.25 m), or NaN: nowhere to stand
  let f = NaN;
  for (const [x0, x1, z0, z1, y0, y1] of Z){
    if (x < x0 || x > x1 || z < z0 || z > z1) continue;
    const h = y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    if (Math.abs(h - y) <= 0.25 && (isNaN(f) || Math.abs(h - y) < Math.abs(f - y))) f = h;
  }
  return f;
}
function walkCrowded(c, x, z){   // someone walking in car c (to or from a seat) stands within WALK_R of (x, z), and that step does not take the walker away from them
  const near = p => {
    if (Math.abs(p.y - WK.y) > 0.6) return false;
    const px = p.x - c.xr, d = Math.hypot(x - px, z - p.z);
    return d < WALK_R && d < Math.hypot(WK.x - px, WK.z - p.z);
  };
  for (const w of c.walk) if (near(pathAt(w.p, w.s, _wk))) return true;
  for (const e of PX.list) if (e.c === c) for (const ln of e.L) for (const w of ln.outs) if (PX.t >= w.rel && near(pathAt(w.p, w.s, _wk))) return true;
  if (c.bar && WK.y > 1.7) for (const [px, pz] of c.bar.stand){ const d = Math.hypot(x - px, z - pz); if (d < WALK_R && d < Math.hypot(WK.x - px, WK.z - pz)) return true; }   // the two at the ledge
  return false;
}
function walkMove(dt, f, s, v){   // f, s: forward and to the right, -1..1 (the keys, or the left stick); v: full speed, m/s. Both go by the way the eye looks; the look is the mouse's or the right stick's (03h)
  const fp = orbit.fp;
  if (WK.seat >= 0 || WK.stool >= 0){   // seated: forward stands up (pushed anew: the push that walked here may still be held); sideways turns the head
    if (f < 0.5) WK.hold = false; else if (!WK.hold){ walkStand(); return; }
    orbit.turn(-s * 1.3 * dt, 0); return;
  }
  const n = Math.hypot(f, s);
  if (n > 1){ f /= n; s /= n; }   // a diagonal is no faster
  if (n){
    const c = tgvSets[0].coaches[WK.i], Z = walkZones(WK.i), cy = Math.cos(fp.yaw), sy = Math.sin(fp.yaw), d = v * dt,
      dx = (cy * f + sy * s) * d, dz = (cy * s - sy * f) * d,
      zc = WK.z - Math.sign(WK.z) * Math.min(Math.abs(WK.z), Math.hypot(dx, dz));   // drawn toward the middle, where the aisles, the bridge and the gangways are
    const tries = [[WK.x + dx, WK.z + dz], [WK.x + dx, WK.z], [WK.x, WK.z + dz]];   // straight on, or sliding along what is in the way
    if (Math.abs(dx) >= Math.abs(dz)) tries.push([WK.x + dx, zc], [WK.x, zc]);   // or eased into the opening pushed against; not when stepping mostly across, where it would fight the step and shake
    for (const [x, z] of tries){
      if (Math.abs(x - WK.x) + Math.abs(z - WK.z) < 1e-6) continue;
      const y = walkFloor(Z, x, z, WK.y);
      if (isNaN(y) || walkCrowded(c, x, z)) continue;
      WK.x = x; WK.z = z; WK.y = y; break;
    }
    walkCar();
  }
  WK.ey += (WK.y - WK.ey) * Math.min(1, dt * 12);
  fp.eye.set(tgvSets[0].coaches[WK.i].xr + WK.x, WK.ey + WALK_EYE, WK.z);
}
function walkCar(){   // half way through a gangway the next car takes over, in its own frame (on a curve the two turn apart)
  const n = TGV.TRAILERS.length, L = TGV.TRAILERS[WK.i][1], j = WK.x > L + 0.3 && WK.i > 0 ? WK.i - 1 : WK.x < -0.3 && WK.i < n - 1 ? WK.i + 1 : -1;
  if (j < 0) return;
  const cs = tgvSets[0].coaches, a = cs[WK.i], b = cs[j], f = orbit.fp;
  a.g.updateWorldMatrix(true, false); b.g.updateWorldMatrix(true, false);
  b.g.worldToLocal(a.g.localToWorld(_wk.set(a.xr + WK.x, WK.y, WK.z)));
  _wk2.set(Math.cos(f.yaw), 0, -Math.sin(f.yaw)).applyQuaternion(a.g.getWorldQuaternion(_wkQ)).applyQuaternion(b.g.getWorldQuaternion(_wkQ2).invert());
  WK.i = j; WK.x = _wk.x - b.xr; WK.z = THREE.MathUtils.clamp(_wk.z, -0.27, 0.27);   // the floor stays the upper deck's
  f.obj = b.g; f.yaw = Math.atan2(-_wk2.z, _wk2.x);
  walkSay('walk_car', b.id);
}
function walkSit(i){   // into seat i of the walker's car: the eye over the cushion, looking ahead and a little toward the window
  const c = tgvSets[0].coaches[WK.i], f = c.face[i], x = c.seat[3 * i], y = c.seat[3 * i + 1], z = c.seat[3 * i + 2];
  if (WK.seat >= 0) c.occ[WK.seat] = 0;
  c.occ[i] = 4; Object.assign(WK, { seat:i, hold:true, x:x - c.xr + 0.42 * f, y, ey:y, z:0 });   // x, z: where standing up puts the walker, the aisle beside it
  orbit.look(c.g, new THREE.Vector3(x + 0.12 * f, y + 1.16, z), (f > 0 ? 0 : Math.PI) - Math.sign(z) * f * 0.35, -0.1); orbit.fp.name = 'walk';
}
function walkStand(){   // up into the aisle beside the seat, facing along it the way the seat did; off a stool at the counter facing the counter, in the lounge facing back to it
  const c = tgvSets[0].coaches[WK.i], i = WK.seat;
  if (WK.stool >= 0){
    c.bar.taken[WK.stool] = 0; WK.stool = -1;
    orbit.look(c.g, new THREE.Vector3(c.xr + WK.x, WK.y + WALK_EYE, WK.z), WK.x < 9.65 ? Math.PI / 2 : Math.PI, -0.05); orbit.fp.name = 'walk'; return;
  }
  if (i < 0) return;
  c.occ[i] = 0; WK.seat = -1;
  orbit.look(c.g, new THREE.Vector3(c.xr + WK.x, WK.y + WALK_EYE, WK.z), c.face[i] > 0 ? 0 : Math.PI, -0.05); orbit.fp.name = 'walk';
}
function walkSitNear(){   // Sit (or E, or Enter): the nearest free seat within reach on this deck, one ahead rather than one behind; seated: stand up. The bar car: at the counter, order; else the nearest free stool
  if (WK.seat >= 0 || WK.stool >= 0){ walkStand(); return; }
  const c = tgvSets[0].coaches[WK.i], d = WK.y > 1.7 ? 1 : 0, fx = Math.cos(orbit.fp.yaw), fz = -Math.sin(orbit.fp.yaw);
  if (c.bar){
    if (barNear()){ barOpen(); return; }
    const b = c.bar; let best = -1, bs = Infinity;
    if (d) for (let k = 0; k < b.taken.length; k++){
      const dx = b.st[2 * k] - WK.x, dz = b.st[2 * k + 1] - WK.z, s = Math.hypot(dx, dz);
      if (b.taken[k] || s > WALK_REACH) continue;
      const sc = s + (dx * fx + dz * fz < 0 ? 1 : 0);
      if (sc < bs){ bs = sc; best = k; }
    }
    if (best >= 0) walkSitStool(best); else walkSay('walk_noseat');
    return;
  }
  let best = -1, bs = Infinity;
  for (let i = 0; i < c.n; i++){
    if (c.deck[i] !== d || c.occ[i] !== 0) continue;
    const dx = c.seat[3 * i] - c.xr - WK.x, dz = c.seat[3 * i + 2] - WK.z, s = Math.hypot(dx, dz);
    if (s > WALK_REACH) continue;
    const sc = s + (dx * fx + dz * fz < 0 ? 1 : 0);
    if (sc < bs){ bs = sc; best = i; }
  }
  if (best >= 0) walkSit(best); else walkSay('walk_noseat');
}
function walkPick(ray){   // a tap on a seat of the walker's car (not through the floor): taken if it is free and within reach, else a word why not
  const c = tgvSets[0].coaches[WK.i];
  if (c.bar){ barPick(c, ray); return; }
  const h = ray.intersectObjects([c.seats, ...c.solid], false)[0];
  if (!h || h.object !== c.seats || h.instanceId === WK.seat) return;
  const i = h.instanceId;
  if (c.deck[i] !== (WK.y > 1.7 ? 1 : 0) || Math.hypot(c.seat[3 * i] - c.xr - WK.x, c.seat[3 * i + 2] - WK.z) > WALK_REACH) walkSay('walk_far');
  else if (c.occ[i] !== 0) walkSay('walk_taken');
  else walkSit(i);
}
function walkAway(){ WK.on = false; WK.back = true; }   // off to another view: the spot, the look and the seat or stool (still occ 4, taken 4: nobody sits there) wait for the passenger
function walkView(){   // the passenger: first seated by the window on coach 1's upper deck, facing the way the train runs (a seat no traveller takes); back from another view, where they were, looking the same way; already walking: stay put
  if (S.mode !== 'tgv' || WK.on) return null;
  if (!WK.back){
    Object.assign(WK, { on:true, i:0, seat:-1, stool:-1 });
    walkSit(tgvSets[0].coaches[0].view[2 + (S.dir < 0 ? 1 : 0)]);   // walkSit takes the view there itself: nothing left for flyPreset to do
    return null;
  }
  const c = tgvSets[0].coaches[WK.i], { yaw, pitch } = WK;
  WK.on = true;
  if (WK.seat >= 0) walkSit(WK.seat);
  else if (WK.stool >= 0) walkSitStool(WK.stool);
  else { WK.ey = WK.y; orbit.look(c.g, new THREE.Vector3(c.xr + WK.x, WK.y + WALK_EYE, WK.z), yaw, pitch); orbit.fp.name = 'walk'; }
  Object.assign(orbit.fp, { yaw, pitch });
  return null;
}

/* ---- the sun's shadow box: over the train (a long one takes a bigger map), stretched over a station's slab near it so the slab shades the
   tracks under it, and away from a low sun as far as the train's shadow falls (60 m at most). Rounded to 20 m so it moves in steps, not every
   frame; it turns with the light (03b-scene.js), a tenth of a degree at a time */
let shadowKey = '';
function fitShadow(){
  const tgv = S.mode === 'tgv', d = stationDeck(), near = d && d[1] > -600 && d[0] < 600;
  let x0 = tgv ? (S.sets === 2 || S.coupling !== 0 ? -392 : -195) : -82, x1 = 14, z0 = -14, z1 = 14;
  if (near){
    x0 = Math.min(x0, Math.floor(Math.max(d[0], -600) / 20) * 20); x1 = Math.max(x1, Math.ceil(Math.min(d[1], 600) / 20) * 20);
    z0 = Math.min(z0, Math.floor(Math.max(d[2], -64) / 2) * 2); z1 = Math.max(z1, Math.ceil(Math.min(d[3], 64) / 2) * 2);
  }
  const L = LIGHT_DIR, k = Math.min(60, 5 / Math.max(0.05, L.y)), sx = Math.round(-L.x * k / 20) * 20, sz = Math.round(-L.z * k / 2) * 2;   // where a 5 m high shadow ends
  if (sx < 0) x0 += sx; else x1 += sx;
  if (sz < 0) z0 += sz; else z1 += sz;
  const size = Math.min(tgv || near ? 4096 : 2048, renderer.capabilities.maxTextureSize);
  const key = [x0, x1, z0, z1, size, Math.round(L.x * 600), Math.round(L.y * 600), Math.round(L.z * 600)].join();
  if (key !== shadowKey){ setShadowBox(x0, x1, size, z0, z1); shadowKey = key; }
}

/* ---- per-frame update (tgv mode only) + mode switch hook */
const tgvDriver = parts.cab.group.getObjectByName('driver');
function setTgvVisible(on){
  tgvTrain.visible = on; pool.mesh.visible = on;
  parts.cab.group.getObjectByName('cabLoco').visible = !on; parts.cab.group.getObjectByName('cabTgv').visible = on;   // the lead car's cab: loco desk or TGV desk with its driver
  if (!on){ platVariant[1].visible = true; platVariant[2].visible = false; return; }
  paxResolve();
}
function updateTgv(dt){
  const s1 = tgvSets[0], s2 = tgvSets[1], bat = S.battery ? 1 : 0;
  const wide = S.sets === 2 || S.coupling !== 0;
  s2.group.visible = wide;
  platVariant[1].visible = S.sets === 1; platVariant[2].visible = S.sets === 2;
  // pantographs: the rear power car of each set feeds its roof line and the leading one stays folded, except under 1.5 kV DC where every power car collects its own current
  posePanto(s2.pantos[0], S.sets === 2 && S.coupling === 0 ? S.pantoF : (S.coupling !== 0 ? 1 : 0));
  posePanto(s2.pantos[1], S.coupling !== 0 ? S.pantoDcF : S.sets === 2 ? S.pantoF * S.pantoDcF : 0);
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
  for (const set of tgvSets) for (const d of set.doors){ const k = d.s === platSide ? 1 : 0; d.g.position.z = d.z0 + 0.13 * k1 * k * d.s; d.g.position.x = d.x0 + 1.35 * k2 * k; }
  for (const h of pcHosts) for (const id in h.clones) h.clones[id].visible = parts[id].group.visible;   // copies follow the part toggles
  const fpCab = orbit.fp?.name === 'driver' ? orbit.fp.obj : null;   // in the driver's place the driver is the viewer: not drawn
  tgvDriver.visible = S.dir > 0 && tgvDriver.parent !== fpCab;   // the driver sits in the leading cab
  for (const h of pcHosts) h.driver.visible = S.dir < 0 && h === (wide ? pcHosts[1] : pcHosts[0]) && h.driver.parent !== fpCab;
  updatePax(dt); updateBar(dt);
}
