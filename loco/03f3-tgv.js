
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
  /* Livery drawn in metres: x along the car, y up the wall on side s (+1: +z). u runs along x and v is read off the section at x (the
     rings' own), so a shape lands where it is drawn, round the nose too; canvas rows run from v 1 at the top (flipY). Any height over
     the roof maps onto its centre line, any under the floor onto the bottom one. */
  const ux = x => (x - TGV.PC_REAR) / L;
  const secAt = x => x <= TGV.PC_NOSE0 ? body : nose(Math.min(1, uAt(x)));
  const vj = j => { const a = Math.floor(j); return vs[a] + (vs[a + 1] - vs[a]) * (j - a); };   // v at a fractional ring point
  const painter = (c, W, H) => {
    const cx = x => ux(x) * W, cy = (x, y, s) => (1 - vAt(secAt(x), vs, y, s)) * H;
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
  const windows = (c, W, H) => {   // windshield across the nose top + cab side windows: painted on the livery, cut out of the body on cars with a cab
    const WS = [[9.3, 16], [10.75, 18.2], [10.75, 21.8], [9.3, 24]];   // windshield corners: x, ring point (20: the top centre)
    c.beginPath();
    WS.forEach(([x0, j0], i) => { const [x1, j1] = WS[(i + 1) % 4]; for (let k = 0; k < 8; k++){ const f = k / 8, X = ux(x0 + (x1 - x0) * f) * W, Y = (1 - vj(j0 + (j1 - j0) * f)) * H; i || k ? c.lineTo(X, Y) : c.moveTo(X, Y); } });
    c.closePath(); c.fill();
    const p = painter(c, W, H); [1, -1].forEach(s => { p.path(s, SIDE_WIN, 3); c.fill(); });
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
  const mask = (bg, fg) => { const t = canvasTex(1024, 512, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; windows(c, W, H); }); t.colorSpace = THREE.NoColorSpace; return t; };
  const hatchTex = canvasTex(4, 128, (c, W, H) => { c.fillStyle = LIV.white; c.fillRect(0, 0, W, H); c.fillStyle = LIV.black; c.fillRect(0, 0, W, H * (1 - 1.25 / 2)); });   // snout (v: height / 2 m): the mask down to 1.25 m, the white chin under it
  return { geo, hatch, hatchTex, lamps, tex, alpha:mask('#fff', '#000'), glassAlpha:mask('#000', '#fff'), rings, yBot, yTop };
})();
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
const DECK = { lo:0.92, up:2.3 };            // floor heights of the two decks (the windows sit at 1.6..2.2 and 3.0..3.75)
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
const SKIN = [0xf1c9a5, 0xe0ac7e, 0xc68a5a, 0x9c6a43, 0x6e4a2f, 0xf6d7bd];
const TROUSERS = [0x2b3140, 0x3b4a6b, 0x1f2328, 0x6b5a45, 0x4a4f57, 0x2f4a3a];
const trousers = (colB, colH) => TROUSERS[(colB ^ colH) % TROUSERS.length];   // follows the person: derived from the shirt and the skin
const PAX_BODY_GEO = new THREE.CapsuleGeometry(0.17, 0.35, 2, 6), PAX_HEAD_GEO = new THREE.SphereGeometry(0.12, 7, 5);
function mergeGeos(geos, skip = []){   // one indexed geometry (position + normal) from several; skip[k]: index ranges [start, end) of geos[k] to leave out
  const pos = [], nrm = [], idx = [];
  geos.forEach((b, k) => {
    const o = pos.length / 3, ix = b.index.array; pos.push(...b.getAttribute('position').array); nrm.push(...b.getAttribute('normal').array);
    for (let i = 0; i < ix.length; i++) if (!(skip[k] && i >= skip[k][0] && i < skip[k][1])) idx.push(ix[i] + o);
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
  return g;
}
const PAX_LEG_GEO = mergeGeos([[0.42, 0.13, 0.28, 0.17, 0.485], [0.12, 0.46, 0.26, 0.33, 0.23], [0.22, 0.07, 0.28, 0.4, 0.035]].map(([w, h, d, x, y]) => new THREE.BoxGeometry(w, h, d).translate(x, y, 0)));   // seated legs facing +x, both in one block: thighs on the cushion, shins, feet. Origin on the floor under the body
const DECK_GEO = {};
function deckGeo(L){   // per body length, x from the car's -x end: lower floor + upper floor + stair + tables in one mesh, the lower deck's ceiling (the upper floor's underside) in another
  if (!DECK_GEO[L]){
    const x0 = 3.4, w = L - 3.6, xb = seatRows(L).bay;   // the upper floor is open over the vestibule and the stair
    const st = new THREE.BoxGeometry(2.19, 0.06, 0.9).rotateZ(Math.atan2(DECK.up - DECK.lo, 1.7)).translate(2.7, (DECK.lo + DECK.up) / 2 - 0.03, -0.9);   // stair: vestibule (x 1.85) up to the upper deck (x 3.55)
    const tb = [];   // the bay's tables on both decks and sides, on a pedestal: top 0.7 over the floor, clear of the aisle, the feet and the wall
    for (const y of [DECK.lo, DECK.up]) for (const s of [1, -1]) tb.push(new THREE.BoxGeometry(0.4, 0.04, 1.08).translate(xb, y + 0.68, s * 0.84), new THREE.BoxGeometry(0.06, 0.66, 0.06).translate(xb, y + 0.33, s * 0.72));
    DECK_GEO[L] = {
      floor:mergeGeos([new THREE.BoxGeometry(L - 0.2, 0.06, 2.28).translate(L / 2, DECK.lo - 0.03, 0), new THREE.BoxGeometry(w, 0.08, 2.98).translate(x0 + w / 2, DECK.up, 0), st, ...tb], [null, [18, 24]]),   // the upper floor without its -y face
      ceil:new THREE.PlaneGeometry(w, 2.98).rotateX(Math.PI / 2).translate(x0 + w / 2, DECK.up - 0.04, 0),
    };
  }
  return DECK_GEO[L];
}
const Q0 = new THREE.Quaternion(), QB = new THREE.Quaternion(0, 1, 0, 0), _pc = new THREE.Color();   // QB: half a turn about y, for what faces -x
const hash32 = i => { i = Math.imul(i ^ (i >>> 16), 0x45d9f3b); i = Math.imul(i ^ (i >>> 16), 0x45d9f3b); return (i ^ (i >>> 16)) >>> 0; };
function buildCoach(parent, cm, xr, L, carNo){
  const g = new THREE.Group(); g.visible = false; parent.add(g);
  const fl = new THREE.Mesh(deckGeo(L).floor, cm.floor), ce = new THREE.Mesh(deckGeo(L).ceil, cm.ceil); fl.position.x = ce.position.x = xr;
  const seat = [], deck = [], face = [], view = [];   // view[2 * deck + (facing -x ? 1 : 0)]: the viewer's seats
  for (const [d, y] of [[0, DECK.lo], [1, DECK.up]]) for (const [x, f] of seatRows(L).rows) for (const z of [-0.95, -0.48, 0.48, 0.95]){
    const v = f > 0 ? 0 : 1;
    if (z === 0.95 && Math.abs(x - SEAT_VIEW[v]) < 0.1) view[2 * d + v] = deck.length;
    seat.push(xr + x, y, z); deck.push(d); face.push(f);
  }
  const n = deck.length, cls = carNo % 10 <= 3 ? 0 : 1;                                 // cars 1..3 (11..13) are first class
  const seats = new THREE.InstancedMesh(SEAT_GEO, cm.seat, n), bodies = new THREE.InstancedMesh(PAX_BODY_GEO, cm.body, n), heads = new THREE.InstancedMesh(PAX_HEAD_GEO, cm.head, n), legs = new THREE.InstancedMesh(PAX_LEG_GEO, cm.legs, n);
  const c = { g, id:carNo, xr, L, n, seat:new Float32Array(seat), deck:new Uint8Array(deck), face:new Int8Array(face), occ:new Uint8Array(n), view, colB:new Uint32Array(n), colH:new Uint32Array(n),
              bodies, heads, legs, paths:[], walk:[], crowd:[[], []], dirty:false, colDirty:false };
  for (let i = 0; i < n; i++){
    _m4.compose(_p.set(seat[3 * i], seat[3 * i + 1], seat[3 * i + 2]), face[i] > 0 ? Q0 : QB, _s.setScalar(1)); seats.setMatrixAt(i, _m4); seats.setColorAt(i, SEAT_COL[cls]);
  }
  const sphere = new THREE.Sphere(new THREE.Vector3(xr + L / 2, 2.5, 0), L / 2 + 1.5);   // people only move inside the coach and its doorway: one fixed bound for every instanced mesh
  for (const m of [seats, bodies, heads, legs]) m.boundingSphere = sphere;
  for (const m of [fl, ce, seats, bodies, heads, legs]) g.add(m);   // no shadows inside: the saloon is lit by its own lights (emissive lining and ceiling)
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
    c.traverse(o => { if (o.userData.axle) axles.push(o); else if (o.userData.rotor) motorRotors.push(o); else if (o.userData.lever) cabLevers.push(o); else if (o.userData.cabBtn) CAB.btns.push(o); });
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
  const geo = {}, tex = {}, lin = {}, pane = {}, lining = {}, surround = {}, logo = inouiLogo(128, '#f2f1ee', '#e5415d');
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
      const o = lp.length / 3; lp.push(x, (yBot + yTop) / 2, 0); lu.push(0.004, 0.25);
      for (let j = 0; j < RING_N; j++){ lp.push(x, pts[j][1], pts[j][0]); lu.push(0.004, 0.25); }
      for (let j = 0; j < RING_N; j++){ const a = o + 1 + j, b = o + 1 + (j + 1) % RING_N; rear ? li.push(o, a, b) : li.push(o, b, a); }
    }
    const lg = lining[L] = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(lu, 2)); lg.setIndex(li); lg.computeVertexNormals();
    const strips = (doorway, inset) => {   // quads following the section over each opening (2 cm larger all round), `inset` in from the skin (< 0: out), facing out
      const pos = [], idx = [];
      for (const s of [1, -1]) for (const [x0, x1, y0, y1, d] of holes(L)){
        if (d !== doorway) continue;
        const ys = [y0 - 0.02, ...pts.slice(1, RING_N / 2).map(q => q[1]).filter(y => y > y0 - 0.02 && y < y1 + 0.02), y1 + 0.02], o = pos.length / 3;
        for (const y of ys){ const z = s * (zAtY(pts, y) - inset); pos.push(x0 - 0.02, y, z, x1 + 0.02, y, z); }
        for (let k = 0; k + 1 < ys.length; k++){ const a = o + 2 * k; s > 0 ? idx.push(a, a + 1, a + 3, a, a + 3, a + 2) : idx.push(a, a + 3, a + 1, a, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    pane[L] = { glass:strips(false, -0.004), plug:strips(true, 0.07) };   // glass 4 mm proud of the skin, over the gasket; the plug sits behind the closed leaf (its back is 4.8 cm in)
    const rr = (x0, x1, y0, y1, r, out) => {   // rounded rectangle, 7 points per corner, anticlockwise from the top right corner
      for (const [cx, cy, q] of [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 1], [x0 + r, y0 + r, 2], [x1 - r, y0 + r, 3]])
        for (let k = 0; k <= 6; k++){ const a = (q + k / 6) * Math.PI / 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return out;
    };
    const fp = [], fi = [];   // window surrounds 3 mm inside the lining, from 3 cm inside each opening to 3.5 cm out: a crisp edge over the alpha cuts, which a seat sees at arm's length
    for (const s of [1, -1]) for (const [x0, x1, y0, y1, d] of holes(L)){
      if (d) continue;
      const a = rr(x0 + 0.03, x1 - 0.03, y0 + 0.03, y1 - 0.03, 0.07, []), b = rr(x0 - 0.035, x1 + 0.035, y0 - 0.035, y1 + 0.035, 0.135, []), o = fp.length / 3, n = a.length;
      for (const [x, y] of [...a, ...b]) fp.push(x, y, s * (zAtY(pts, y) - 0.003));
      for (let k = 0; k < n; k++){ const k1 = (k + 1) % n; fi.push(o + k, o + n + k, o + n + k1, o + k, o + n + k1, o + k1); }
    }
    const fg = surround[L] = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals();
  }
  const paint = g => {   // inOui door: magenta at the top and bottom, coral a little over mid height (vertex colours by height)
    const p = g.getAttribute('position'), st = [[0, '#dd4c8e'], [0.55, '#fa6951'], [1, '#e034a2']].map(([t, h]) => [t, new THREE.Color(h)]), q = new THREE.Color(), col = [];
    for (let i = 0; i < p.count; i++){
      const t = Math.min(1, Math.max(0, (p.getY(i) - DOOR[2]) / (DOOR[3] - DOOR[2]))), k = t < st[1][0] ? 0 : 1;
      q.copy(st[k][1]).lerp(st[k + 1][1], (t - st[k][0]) / (st[k + 1][0] - st[k][0])); col.push(q.r, q.g, q.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  };
  const leaf = { p:paint(doorLeafGeo(pts, 1, ...DOOR.slice(2), DOOR[1] - DOOR[0])), n:paint(doorLeafGeo(pts, -1, ...DOOR.slice(2), DOOR[1] - DOOR[0])) };
  return { geo, tex, lin, pane, lining, surround, pts, yBot, yTop, leaf, doorX:(DOOR[0] + DOOR[1]) / 2 };
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
  const bellowsM = mk(0x23272c, { roughness:0.95 }), doorM = mk(0xffffff, { vertexColors:true, roughness:0.45, metalness:0.15, side:THREE.DoubleSide }), glassM = mk(0x1c2530, { roughness:0.25, metalness:0.1 });
  const paneM = {   // glass in the openings: opaque from afar, tinted and clear near the camera; the doorway plug only from afar
    far:mk(0x27303a, { roughness:0.25, metalness:0.1 }), plug:mk(LIV.door, { roughness:0.8 }),
    near:mk(0x1c2530, { transparent:true, opacity:0.45, depthWrite:false, side:THREE.DoubleSide, forceSinglePass:true, roughness:0.05, metalness:0 }),   // one pass: every pane has the same tint, so the blend order does not matter
  };
  const skin = m => { if (internals) trShells.meshes.push(m); return m; };   // what the shell control fades: body, ends, gangways, doors (the underframe stays); the other trains stay opaque
  if (internals) trShells.mats.push(...Object.values(bodyM), capM, bellowsM, doorM, glassM);
  set.coaches = [];
  const coachM = { floor:mk(0x3a3f46, { roughness:0.9 }), ceil:mk(0xe6e2da, { roughness:0.9, emissive:0xe6e2da, emissiveIntensity:0.45 }), seat:mk(0xffffff, { roughness:0.85 }), body:mk(0xffffff, { roughness:0.8 }), head:mk(0xffffff, { roughness:0.7 }), legs:mk(0xffffff, { roughness:0.85 }) };
  const trailerRear = [];
  TGV.TRAILERS.forEach(([xr, L], i) => {
    const g = new THREE.Group(); g.position.x = xr;
    const b = new THREE.Mesh(TR.geo[L].body, bodyM[L]); b.castShadow = true; b.receiveShadow = true; g.add(skin(b));
    const cr = new THREE.Mesh(TR.geo[L].capRear, capM), cf = new THREE.Mesh(TR.geo[L].capFront, capM); cf.position.x = 0; g.add(skin(cr), skin(cf));
    const lining = new THREE.Mesh(TR.lining[L], linM[L]), glass = new THREE.Mesh(TR.pane[L].glass, paneM.far), plug = new THREE.Mesh(TR.pane[L].plug, paneM.plug);
    lining.visible = false; glass.receiveShadow = plug.receiveShadow = true; g.add(lining, glass, plug);
    lining.add(new THREE.Mesh(TR.surround[L], frameM));   // shown with the lining
    g.add(box(L - 1.0, 0.16, 2.6, endM, L / 2, 0.83, 0));                                 // underframe
    g.add(box(L - 3.0, 0.5, 2.9, endM, L / 2, 0.55, 0));                                  // low floor tanks/equipment
    if (i < TGV.TRAILERS.length - 1) g.add(skin(box(0.5, 3.3, 2.5, bellowsM, -0.25, 2.5, 0)));   // gangway bellows over the Jacobs bogie
    G.trailers.add(g); trailerRear.push(xr);
    // plug-sliding door at the -x end of each trailer, both sides; only +z (platform) leaves animate
    [1, -1].forEach(s => {
      const d = new THREE.Group(); d.position.set(xr + TR.doorX, 0, 0);
      const leaf = new THREE.Mesh(TR.leaf[s > 0 ? 'p' : 'n'], doorM); leaf.castShadow = true; d.add(skin(leaf));
      d.add(skin(box(0.8, 0.6, 0.02, glassM, 0, 2.0, s * (zAtY(TR.pts, 2.0) + 0.022))));  // door window, level with the lower deck
      G.doors.add(d); set.doors.push({ g:d, s, x0:xr + TR.doorX, z0:0 });
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map:carNumber(firstCar + i), side:THREE.DoubleSide }));
      num.position.set(xr + 2.75, 3.3, s * (zAtY(TR.pts, 3.3) + 0.012)); if (s < 0) num.rotation.y = Math.PI; G.trailers.add(num);
    });
    const c = buildCoach(G.trailers, coachM, xr, L, firstCar + i);
    Object.assign(c, { lining, glass, plug, paneM, own:internals, lod:0 });
    set.coaches.push(c); allCoaches.push(c);
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
function seatPath(c, i){   // seat -> step out (the way the seat faces) -> aisle -> (upper deck: stair down) -> doorway, set-local
  if (c.paths[i]) return c.paths[i];
  const x = c.seat[3 * i], y = c.seat[3 * i + 1], z = c.seat[3 * i + 2], o = x + 0.42 * c.face[i], xr = c.xr, lo = DECK.lo, up = DECK.up;
  return c.paths[i] = mkPath(c.deck[i]
    ? [x, y, z, o, y, z, o, y, 0, xr + 3.55, up, 0, xr + 3.55, up, -0.9, xr + 1.85, lo, -0.9, xr + 1.35, lo, -0.4, xr + 1.35, lo, 1.25]   // along the aisle to the stair head before turning into it, clear of the first row
    : [x, y, z, o, y, z, o, y, 0, xr + 2.2, lo, 0, xr + 1.95, lo, 0.35, xr + 1.95, lo, 1.25]);
}
function poseSeat(c, i, on){
  const f = c.face[i], x = c.seat[3 * i] + 0.04 * f, y = c.seat[3 * i + 1], z = c.seat[3 * i + 2], k = on ? 1 : 0, q = f > 0 ? Q0 : QB;
  _m4.compose(_p.set(x, y + 0.72, z), q, _s.setScalar(k)); c.bodies.setMatrixAt(i, _m4);
  _m4.compose(_p.set(x, y + 1.12, z), q, _s.setScalar(k)); c.heads.setMatrixAt(i, _m4);
  _m4.compose(_p.set(x, y, z), q, _s.setScalar(k)); c.legs.setMatrixAt(i, _m4);
  c.dirty = true;
}
function poseWalker(c, w){   // walking in the coach: stands up over the first step out of the seat, then walks upright
  const p = w.p, u = Math.min(1, w.s / p.C[1]), x0 = c.seat[3 * w.i] + 0.04 * c.face[w.i], y0 = c.seat[3 * w.i + 1], z0 = c.seat[3 * w.i + 2];
  pathAt(p, w.s, _pw); const bob = u >= 1 ? Math.abs(Math.sin(w.ph)) * 0.04 : 0;
  _m4.compose(_p.set(x0 + (_pw.x - x0) * u, y0 + 0.72 + (_pw.y + 0.465 + bob - y0 - 0.72) * u, z0 + (_pw.z - z0) * u), Q0, _s.set(1 + 0.12 * u, 1 + 0.35 * u, 1 + 0.12 * u)); c.bodies.setMatrixAt(w.i, _m4);
  _m4.compose(_p.set(x0 + (_pw.x - x0) * u, y0 + 1.12 + (_pw.y + 1.05 + bob - y0 - 1.12) * u, z0 + (_pw.z - z0) * u), Q0, _s.setScalar(1 + 0.08 * u)); c.heads.setMatrixAt(w.i, _m4);
  _m4.makeScale(0, 0, 0); c.legs.setMatrixAt(w.i, _m4);   // the capsule stretched to standing height carries the legs
  c.dirty = true;
}
function paxSeed(c){   // the passengers a coach starts with: 30% of the seats, the same people every time
  for (let i = 0; i < c.n; i++){
    const h = hash32(c.id * 1000 + i); c.colB[i] = PAX_COL[h % PAX_COL.length]; c.colH[i] = SKIN[(h >>> 8) % SKIN.length];
    c.bodies.setColorAt(i, _pc.setHex(c.colB[i])); c.heads.setColorAt(i, _pc.setHex(c.colH[i])); c.legs.setColorAt(i, _pc.setHex(trousers(c.colB[i], c.colH[i])));
    c.occ[i] = !c.view.includes(i) && hash32(c.id * 7919 + i) % 100 < 30 ? 1 : 0; poseSeat(c, i, c.occ[i] === 1);   // occ: 0 free, 1 seated, 2 getting off, 3 taken by someone getting on
  }
  c.colDirty = true;
}
function freeSeat(c, deck){   // a random free seat on that deck, or -1 (never the viewer's)
  let n = 0, pick = -1;
  for (let i = 0; i < c.n; i++) if (c.occ[i] === 0 && c.deck[i] === deck && !c.view.includes(i) && Math.random() * ++n < 1) pick = i;
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
    const want = plan === 'terminus' ? 0.35 * c.n : plan === 'origin' ? Math.max(3, 0.43 * c.n - seated) : Math.max(0, 0.4 * c.n - 0.75 * seated);   // the coach leaves a third to two fifths full
    const per = Math.min(21, Math.round(want / 2)), nd = c.xr + 1.65 + (k ? TGV.SET2_X : 0) - TGV.PLAT_FRONT;
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
  c.colB[i] = a.colB; c.colH[i] = a.colH; c.bodies.setColorAt(i, _pc.setHex(a.colB)); c.heads.setColorAt(i, _pc.setHex(a.colH)); c.legs.setColorAt(i, _pc.setHex(trousers(a.colB, a.colH))); c.colDirty = true;
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
    if (c.dirty){ c.bodies.instanceMatrix.needsUpdate = c.heads.instanceMatrix.needsUpdate = c.legs.instanceMatrix.needsUpdate = true; c.dirty = false; }
    if (c.colDirty){ c.bodies.instanceColor.needsUpdate = c.heads.instanceColor.needsUpdate = c.legs.instanceColor.needsUpdate = true; c.colDirty = false; }
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

function coachLod(){   // lod 0 far: opaque glass, plugged doorway, no interior; 1 near: interior, lining, clear glass; 2 own sets in x-ray: interior only
  for (const c of allCoaches){
    let lod;
    if (c.own && shellLevel < 1) lod = 2;
    else { _p.set(c.xr + c.L / 2, 2.5, 0).applyMatrix4(c.g.matrixWorld); lod = _p.distanceTo(camera.position) < COACH_NEAR + (c.lod === 1 ? 10 : 0) ? 1 : 0; }
    if (lod === c.lod) continue;
    c.lod = lod; c.g.visible = lod > 0; c.lining.visible = lod === 1; c.glass.visible = lod < 2; c.glass.material = lod ? c.paneM.near : c.paneM.far; c.plug.visible = lod === 0;
  }
}

/* ---- cameras for the long train (functions: they depend on the formation) */
Object.assign(CAMS, {
  train:    () => S.sets === 2 || S.coupling !== 0 ? [[40, 22, 80], [-120, 3, 0]] : [[45, 22, 75], [-60, 3, 0]],
  rearroof: [[-160, 9.5, 12], [-172, 4.8, 0]],
  coupler:  () => S.sets === 2 || S.coupling !== 0 ? [[-186, 3.4, 6.0], [-186, 1.4, 0]] : [[-183, 3.4, 5.5], [-191, 1.4, 0]],   // from the island platform, inside the row of lamp posts and clear of the train on the far face
  station:  [[-30, 10, 34], [-45, 1.5, 4]],
  door:     [[-48, 2.3, 5.9], [-35, 1.7, 1.4]],   // eye height on the island platform, under the canopy, between the two trains
  seatUp:   () => seatView(1),
  seatLo:   () => seatView(0),
  driver:   () => driverView(),
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
let seatFace = 1;   // the way the viewer's seat faces: the way the train ran when the view was taken (updateTgv moves the viewer when it turns round)
function seatView(d){   // first person in the viewer's seat of coach 1 (deck d), facing the way the train runs, head over the seat, looking ahead toward the window beside it
  const c = tgvSets[0].coaches[0], f = seatFace = S.dir < 0 ? -1 : 1, i = c.view[2 * d + (f > 0 ? 0 : 1)];
  return { obj:c.g, eye:new THREE.Vector3(c.seat[3 * i] + 0.12 * f, c.seat[3 * i + 1] + 1.16, c.seat[3 * i + 2]), yaw:f > 0 ? -0.75 : 0.75 - Math.PI, pitch:-0.14 };
}

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
  for (const set of tgvSets) for (const d of set.doors){ if (d.s < 0) continue; d.g.position.z = d.z0 + 0.13 * k1; d.g.position.x = d.x0 + 1.35 * k2; }
  for (const h of pcHosts) for (const id in h.clones) h.clones[id].visible = parts[id].group.visible;   // copies follow the part toggles
  const fpCab = orbit.fp?.name === 'driver' ? orbit.fp.obj : null;   // in the driver's place the driver is the viewer: not drawn
  tgvDriver.visible = S.dir > 0 && tgvDriver.parent !== fpCab;   // the driver sits in the leading cab
  for (const h of pcHosts) h.driver.visible = S.dir < 0 && h === (wide ? pcHosts[1] : pcHosts[0]) && h.driver.parent !== fpCab;
  const fp = orbit.fp?.name;
  if ((fp === 'seatUp' || fp === 'seatLo') && seatFace !== S.dir) flyPreset(fp);   // the train turned round: the viewer moves to the seat facing the new way
  updatePax(dt);
}
