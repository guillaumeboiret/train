/* ============================================================ 3D scene (Three.js) */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c3d'), stageEl = $('stage'), labelsEl = $('labels');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 800);
const Y_UP = new THREE.Vector3(0, 1, 0);

const hemi = new THREE.HemisphereLight(0xdfe9f3, 0x3d4a36, 0.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1de, 2.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);

/* theme: canvas background + grass follow the CSS tokens */
function cssColor(name, fallback){ const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return new THREE.Color(v || fallback); }
const groundMat = new THREE.MeshStandardMaterial({ color:0x3b5236, roughness:1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
function applyTheme(){
  const bg = cssColor('--canvas', '#1a2330');
  scene.background = bg; scene.fog = new THREE.Fog(bg.getHex(), 160, 420);
  groundMat.color.copy(cssColor('--grass', '#3b5236'));
}
applyTheme();
new MutationObserver(applyTheme).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);

/* shared materials */
const M = {
  ballast: new THREE.MeshStandardMaterial({ color:0x5b5752, roughness:1, side:THREE.DoubleSide }),
  rail: new THREE.MeshStandardMaterial({ color:0xb4bcc4, roughness:0.35, metalness:0.75, side:THREE.DoubleSide }),
  sleeper: new THREE.MeshStandardMaterial({ color:0x5a4737, roughness:0.95 }),
  ring: new THREE.MeshStandardMaterial({ color:0xf28c28, roughness:0.5, emissive:0xf28c28, emissiveIntensity:0.25, side:THREE.DoubleSide }),
  ringBad: new THREE.MeshStandardMaterial({ color:0xff5f45, roughness:0.5, emissive:0xff5f45, emissiveIntensity:0.6, side:THREE.DoubleSide }),
  open: new THREE.MeshStandardMaterial({ color:0x43c977, roughness:0.5, emissive:0x43c977, emissiveIntensity:0.35, side:THREE.DoubleSide }),
  closed: new THREE.MeshStandardMaterial({ color:0xb0402f, roughness:0.7, side:THREE.DoubleSide, transparent:true, opacity:0.55 }),
  stone: new THREE.MeshStandardMaterial({ color:0x7d7873, roughness:0.9 }),
  dark: new THREE.MeshStandardMaterial({ color:0x111418, roughness:1 }),
  buffer: new THREE.MeshStandardMaterial({ color:0xc7402c, roughness:0.6 }),
  post: new THREE.MeshStandardMaterial({ color:0x2b3037, roughness:0.7 }),
  trunk: new THREE.MeshStandardMaterial({ color:0x5b463a, roughness:0.95 }),
  crown: new THREE.MeshStandardMaterial({ color:0x3f6a3a, roughness:0.95 }),
  crown2: new THREE.MeshStandardMaterial({ color:0x4f7d43, roughness:0.95 }),
  hit: new THREE.MeshBasicMaterial({ visible:false }),
};
const TRAIN_COLORS = [0xe4572e, 0x3d8bfd, 0x43c977, 0xf2c53d, 0xc084ff, 0x2ec4b6];

/* ------------------------------------------------------------ geometry helpers */
function samplePts(curve, step){ // [x, z, tx, tz] along an edge curve (track y becomes world z)
  const n = Math.max(2, Math.ceil(curve.len / step) + 1), out = [];
  for (let i = 0; i < n; i++){ const q = curve.at(curve.len * i / (n - 1)); out.push([q[0], q[1], q[2], q[3]]); }
  return out;
}
function ribbonGeometry(strips){ // strips: [{pts:[[x,z,tx,tz]...], halfW, y, off}] -> one BufferGeometry
  const pos = [], idx = [];
  for (const st of strips){
    const base = pos.length / 3, off = st.off || 0;
    for (const [x, z, tx, tz] of st.pts){
      const nx = -tz, nz = tx, cx = x + nx * off, cz = z + nz * off;
      pos.push(cx + nx * st.halfW, st.y, cz + nz * st.halfW, cx - nx * st.halfW, st.y, cz - nz * st.halfW);
    }
    for (let i = 0; i < st.pts.length - 1; i++){ const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function box(w, h, d, m, x, y, z){ const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; }
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function setInstance(im, i, x, y, z, yaw, sc){
  _q.setFromAxisAngle(Y_UP, yaw); _v.set(x, y, z); _s.set(sc, sc, sc);
  _m4.compose(_v, _q, _s); im.setMatrixAt(i, _m4);
}

/* ------------------------------------------------------------ level scenery */
let levelRoot = null;          // everything that belongs to the current level
let switchVis = new Map();     // node.id -> {ring, branches:[mesh, mesh], node, flash, badT}
const labels = [];             // {el, pos:()=>[x,y,z] | null, hide:()=>bool, tf}
function clearLevel(){
  if (levelRoot){
    levelRoot.traverse(o => { if (o.geometry && !o.userData.keepGeo) o.geometry.dispose(); if (o.userData.ownMats) o.userData.ownMats.forEach(m => m.dispose()); });
    scene.remove(levelRoot);
  }
  levelRoot = new THREE.Group(); scene.add(levelRoot);
  switchVis = new Map();
  labels.length = 0; labelsEl.innerHTML = '';
}
function addLabel(cls, html, pos, opts = {}){
  const el = document.createElement('div'); el.className = cls; el.innerHTML = html;
  labelsEl.appendChild(el);
  const L = Object.assign({ el, pos, tf:'translate(-50%,-50%)', hide:null }, opts); labels.push(L); return L;
}
function removeLabel(L){ const i = labels.indexOf(L); if (i >= 0) labels.splice(i, 1); L.el.remove(); }
function outDir(track, node){ // unit direction pointing out of the network at a terminal node
  const e = track.edges[node.edges[0]];
  const t = outTangent(e, node.id); return [-t[0], -t[1]];
}
const PORTAL_LEN = 6.5;
function buildLevelScene(track, seed){
  clearLevel();
  const R = levelRoot;
  const strips = { ballast:[], rail:[] };
  const sleeperSlots = [];
  for (const e of track.edges){
    const pts = samplePts(e.curve, 0.5);
    strips.ballast.push({ pts, halfW:1.35, y:0.03 });
    strips.rail.push({ pts, halfW:0.075, y:0.16, off:0.72 }, { pts, halfW:0.075, y:0.16, off:-0.72 });
    for (let s = 0.3; s < e.curve.len; s += 0.62) sleeperSlots.push(e.curve.at(s));
  }
  const ballast = new THREE.Mesh(ribbonGeometry(strips.ballast), M.ballast); ballast.receiveShadow = true; R.add(ballast);
  const rails = new THREE.Mesh(ribbonGeometry(strips.rail), M.rail); rails.receiveShadow = true; R.add(rails);
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.1, 2.3), M.sleeper, sleeperSlots.length);
  sleeperSlots.forEach((q, i) => setInstance(sleepers, i, q[0], 0.09, q[1], Math.atan2(-q[3], q[2]), 1));
  sleepers.instanceMatrix.needsUpdate = true; sleepers.receiveShadow = true; R.add(sleepers);

  // switches: ring at the toe node + open/closed markers along the two branches
  const ringGeo = new THREE.RingGeometry(1.05, 1.4, 40);
  for (const n of track.nodes.values()){
    if (n.kind !== 'switch') continue;
    const ring = new THREE.Mesh(ringGeo, M.ring); ring.rotation.x = -Math.PI / 2; ring.position.set(n.x, 0.2, n.y); ring.userData.keepGeo = true; R.add(ring);
    const branches = n.branches.map((eid) => {
      const e = track.edges[eid], fromA = e.a === n.id;
      const pts = [];
      for (let s = 0; s <= 4.2; s += 0.35){ const q = fromA ? e.curve.at(s) : e.curve.at(e.curve.len - s); pts.push([q[0], q[1], q[2], q[3]]); }
      const m = new THREE.Mesh(ribbonGeometry([{ pts, halfW:0.34, y:0.19 }]), M.open); R.add(m); return m;
    });
    switchVis.set(n.id, { ring, branches, node:n, flash:0, badT:0 });
    refreshSwitch(n);
  }

  // terminals: stations are tunnel portals with a letter chip; unnamed terminals get a buffer stop
  for (const n of track.nodes.values()){
    if (n.kind !== 'terminal') continue;
    const d = outDir(track, n), yaw = Math.atan2(-d[1], d[0]);
    const g = new THREE.Group(); g.position.set(n.x, 0, n.y); g.rotation.y = yaw; R.add(g);
    if (n.station){
      const body = box(PORTAL_LEN, 3.6, 5.4, M.stone, PORTAL_LEN / 2, 1.75, 0); body.castShadow = true; body.receiveShadow = true; g.add(body);
      g.add(box(0.2, 2.9, 2.7, M.dark, 0.02, 1.4, 0));                          // tunnel mouth
      g.add(box(0.3, 3.9, 5.8, M.stone, 0.32, 1.95, 0));                        // portal face frame
      const grass = box(PORTAL_LEN + 0.4, 0.5, 6.0, groundMat, PORTAL_LEN / 2, 3.75, 0); grass.receiveShadow = true; g.add(grass);
      addLabel('lbl st', n.station.letter, () => [n.x + d[0] * 1.6, 4.9, n.y + d[1] * 1.6]);
    } else {
      g.add(box(0.5, 0.9, 2.2, M.buffer, 0.55, 0.55, 0));
      g.add(box(1.2, 0.25, 0.25, M.post, 0.0, 0.5, 0.8)); g.add(box(1.2, 0.25, 0.25, M.post, 0.0, 0.5, -0.8));
    }
  }

  // trees around the layout, kept off the track band and the portals
  const b = track.bounds, margin = 3.6, portalX = 8;
  let s = seed; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const N = 140, spots = [];
  let tries = 0;
  while (spots.length < N && tries++ < 4000){
    const x = b.minX - 24 + rnd() * (b.maxX - b.minX + 48), z = b.minY - 26 + rnd() * (b.maxY - b.minY + 52);
    const inBand = z > b.minY - margin && z < b.maxY + margin && x > b.minX - portalX && x < b.maxX + portalX;
    if (!inBand) spots.push([x, z, rnd() * Math.PI, 0.75 + rnd() * 0.8, rnd() < 0.5]);
  }
  const crownGeo = new THREE.ConeGeometry(1.15, 3.2, 7), trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.2, 6);
  const crownA = new THREE.InstancedMesh(crownGeo, M.crown, spots.length), crownB = new THREE.InstancedMesh(crownGeo, M.crown2, spots.length), trunk = new THREE.InstancedMesh(trunkGeo, M.trunk, spots.length);
  spots.forEach(([x, z, rot, sc, alt], i) => {
    setInstance(alt ? crownA : crownB, i, x, 1.9 * sc + 0.6, z, rot, sc);
    setInstance(alt ? crownB : crownA, i, 0, -50, 0, 0, 0.001);
    setInstance(trunk, i, x, 0.6 * sc, z, rot, sc);
  });
  [crownA, crownB, trunk].forEach(im => { im.instanceMatrix.needsUpdate = true; im.castShadow = true; R.add(im); });

  // sun follows the level so the shadow frustum stays tight
  const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2, hw = (b.maxX - b.minX) / 2 + 12, hd = (b.maxY - b.minY) / 2 + 14;
  sun.position.set(cx - 28, 48, cz + 18); sun.target.position.set(cx, 0, cz);
  Object.assign(sun.shadow.camera, { left:-hw - 6, right:hw + 6, top:hd + 8, bottom:-hd - 8, near:5, far:140 });
  sun.shadow.camera.updateProjectionMatrix();
}
function refreshSwitch(n, pop = true){
  const v = switchVis.get(n.id); if (!v) return;
  v.branches.forEach((m, i) => { m.material = i === n.state ? M.open : M.closed; m.position.y = i === n.state ? 0.01 : 0; });
  if (pop) v.flash = 1;   // pop animation, eased back in the frame loop
}
function switchBusy(n){ const v = switchVis.get(n.id); if (v) v.badT = 0.45; }
function animateSwitches(dt){
  for (const v of switchVis.values()){
    if (v.flash > 0){ v.flash = Math.max(0, v.flash - dt * 3); }
    v.ring.scale.setScalar(1 + 0.35 * v.flash);
    if (v.badT > 0){ v.badT -= dt; v.ring.material = M.ringBad; v.ring.scale.setScalar(1.15 + 0.15 * Math.sin(v.badT * 40)); }
    else v.ring.material = M.ring;
  }
}

/* ------------------------------------------------------------ trains */
function makeVehicle(color, isLoco, tr){
  const body = new THREE.MeshStandardMaterial({ color, roughness:0.5, metalness:0.15 });
  const roof = new THREE.MeshStandardMaterial({ color:new THREE.Color(color).multiplyScalar(0.55), roughness:0.7 });
  const g = new THREE.Group();
  const L = isLoco ? 4.6 : 4.2;
  g.add(box(L, 0.5, 1.7, M.post, 0, 0.45, 0));                                     // chassis
  const main = box(L - (isLoco ? 1.2 : 0.2), 1.35, 2.0, body, isLoco ? -0.6 : 0, 1.35, 0); main.castShadow = true; g.add(main);
  if (isLoco){
    const cab = box(1.3, 1.7, 2.0, body, L / 2 - 0.75, 1.55, 0); cab.castShadow = true; g.add(cab);
    g.add(box(1.1, 0.12, 1.8, roof, L / 2 - 0.75, 2.46, 0));
    g.add(box(0.8, 0.5, 1.5, M.dark, L / 2 - 0.75, 1.95, 0));                      // windscreen band
    g.add(box(L - 1.7, 0.16, 1.7, roof, -0.7, 2.1, 0));
    g.add(box(0.9, 0.3, 1.1, M.dark, -1.1, 2.27, 0));                               // exhaust / fan block
  } else {
    g.add(box(L - 0.4, 0.16, 1.8, roof, 0, 2.1, 0));
  }
  const hit = box(L + 0.8, 3.0, 3.0, M.hit, 0, 1.5, 0); hit.layers.set(1); hit.userData = { kind:'train', train:tr }; g.add(hit);
  g.userData.ownMats = [body, roof];
  return g;
}
const TRAIN_BACKS = [2.3, 7.2];        // vehicle centres measured back from the head
const TRAIN_HALF = [2.3, 2.1];
const TRAIN_LEN = 9.3;
function makeTrainVisual(color, tr){
  const g = new THREE.Group(); g.visible = false;
  const loco = makeVehicle(color, true, tr), wagon = makeVehicle(color, false, tr);
  g.add(loco); g.add(wagon);
  g.userData.vehicles = [loco, wagon];
  levelRoot.add(g);
  return g;
}

/* ------------------------------------------------------------ camera: tilted top-down fitted to the level */
const view = { cx:0, cz:0, ox:0, oz:0, dist:40, zoom:1, panX:0, panZ:0, elev:0.96, az:0 };
let currentBounds = null;
function screenAxes(){ // ground-plane vectors: right (screen x) and forward (away from the viewer)
  return { rx:Math.cos(view.az), rz:-Math.sin(view.az), fx:-Math.sin(view.az), fz:-Math.cos(view.az) };
}
function placeCamera(){
  const tx = view.cx + view.ox + view.panX, tz = view.cz + view.oz + view.panZ, d = view.dist * view.zoom;
  camera.position.set(tx + d * Math.sin(view.az) * Math.cos(view.elev), d * Math.sin(view.elev), tz + d * Math.cos(view.az) * Math.cos(view.elev));
  camera.lookAt(tx, 0, tz);
}
function fitCamera(bounds){
  const b = bounds; currentBounds = b;
  const aspect = camera.aspect || 1;
  view.az = aspect < 0.9 ? Math.PI / 2 : 0; view.elev = aspect < 0.9 ? 1.05 : 0.96;
  view.zoom = 1; view.panX = 0; view.panZ = 0; view.ox = 0; view.oz = 0;
  view.cx = (b.minX + b.maxX) / 2; view.cz = (b.minY + b.maxY) / 2;
  const mx = PORTAL_LEN + 2.5, mz = 5;
  const corners = [];
  for (const x of [b.minX - mx, b.maxX + mx]) for (const z of [b.minY - mz, b.maxY + mz]) for (const y of [0, 4.5]) corners.push(new THREE.Vector3(x, y, z));
  const yTop = 0.86, yBot = -0.76, xMax = 0.94;         // NDC box left for the layout (status chips above, hint bar below)
  const { fx, fz } = screenAxes();
  view.dist = 30;
  for (let it = 0; it < 10; it++){
    placeCamera();
    let mX = 0, yMin = 1, yMax = -1;
    for (const c of corners){ const p = _p.copy(c).project(camera); mX = Math.max(mX, Math.abs(p.x)); yMin = Math.min(yMin, p.y); yMax = Math.max(yMax, p.y); }
    const scale = Math.max(mX / xMax, (yMax - yMin) / (yTop - yBot));
    view.dist *= scale;
    const dy = (yMax + yMin) / 2 - (yTop + yBot) / 2;   // >0: content too high on screen -> move target away from the viewer
    const shift = dy * view.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.sin(view.elev);
    view.ox += fx * shift; view.oz += fz * shift;
    if (Math.abs(scale - 1) < 0.005 && Math.abs(dy) < 0.005) break;
  }
  view.dist = Math.max(view.dist, 14);
  placeCamera();
}
function panBy(dx, dy){
  const h = stageEl.clientHeight || 1, d = view.dist * view.zoom;
  const k = d * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / h;
  const { rx, rz, fx, fz } = screenAxes();
  view.panX += -rx * dx * k + fx * dy * k / Math.sin(view.elev);
  view.panZ += -rz * dx * k + fz * dy * k / Math.sin(view.elev);
  placeCamera();
}
function zoomBy(f){ view.zoom = Math.min(2.6, Math.max(0.5, view.zoom * f)); placeCamera(); }
function resize(){
  const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(() => { resize(); if (currentBounds) fitCamera(currentBounds); }).observe(stageEl);

/* ------------------------------------------------------------ labels projection */
const _p = new THREE.Vector3();
function updateLabels(){
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  for (const L of labels){
    if (L.hide && L.hide()){ L.el.style.display = "none"; continue; }
    const p = L.pos();
    if (!p){ L.el.style.display = "none"; continue; }
    _p.set(p[0], p[1], p[2]).project(camera);
    if (_p.z > 1){ L.el.style.display = 'none'; continue; }
    L.el.style.display = '';
    L.el.style.transform = `translate(${((_p.x + 1) / 2 * w).toFixed(1)}px, ${((1 - _p.y) / 2 * h).toFixed(1)}px) ` + L.tf;
  }
}

/* ------------------------------------------------------------ picking */
const raycaster = new THREE.Raycaster(); raycaster.layers.set(1);
const groundPlane = new THREE.Plane(Y_UP, -0.2), _hit = new THREE.Vector3();
function pick(clientX, clientY, track){
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera({ x:((clientX - r.left) / r.width) * 2 - 1, y:-((clientY - r.top) / r.height) * 2 + 1 }, camera);
  for (const h of raycaster.intersectObject(levelRoot, true)){ if (h.object.userData.kind === 'train' && h.object.userData.train) return { kind:'train', train:h.object.userData.train }; }
  if (!track || !raycaster.ray.intersectPlane(groundPlane, _hit)) return null;
  let best = null, bd = 2.6;
  for (const v of switchVis.values()){ const d = Math.hypot(v.node.x - _hit.x, v.node.y - _hit.z); if (d < bd){ bd = d; best = v.node; } }
  return best ? { kind:'switch', node:best } : null;
}
