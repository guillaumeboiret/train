
/* ------------------------------------------------------------ renderer */
const canvas = document.getElementById('c3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 9000);   // far enough for the wind farms 7 km out (03f4b-wind.js)

const hemi = new THREE.HemisphereLight(0xc4d6f0, 0x3b3a33, 1.05);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2de, 2.3);
sun.position.set(18, 28, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-64, right:30, top:26, bottom:-16, near:1, far:120 });
sun.shadow.bias = -0.0005;
/* fit the shadow frustum to a world box along the track (the light looks at the origin) */
function setShadowBox(xMin, xMax, mapSize, zMin = -14, zMax = 14){
  const cam = sun.shadow.camera, az = sun.position.clone().normalize();
  const ax = new THREE.Vector3(0, 1, 0).cross(az).normalize(), ay = az.clone().cross(ax);
  let l = Infinity, r = -Infinity, b = Infinity, t = -Infinity, n = Infinity, f = -Infinity;
  const p = new THREE.Vector3();
  for (const px of [xMin, xMax]) for (const py of [-1, 9]) for (const pz of [zMin, zMax]){
    p.set(px, py, pz).sub(sun.position);
    const cx = p.dot(ax), cy = p.dot(ay), cz = -p.dot(az);
    l = Math.min(l, cx); r = Math.max(r, cx); b = Math.min(b, cy); t = Math.max(t, cy); n = Math.min(n, cz); f = Math.max(f, cz);
  }
  Object.assign(cam, { left:l - 2, right:r + 2, bottom:b - 2, top:t + 2, near:Math.max(0.5, n - 2), far:f + 4 });
  cam.updateProjectionMatrix();
  if (sun.shadow.mapSize.x !== mapSize){ sun.shadow.mapSize.set(mapSize, mapSize); if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } }
}
setShadowBox(-82, 14, 2048);
sun.shadow.normalBias = 0.02;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xa9c6ff, 0.55);
fill.position.set(-16, 9, -14);
scene.add(fill);

/* sky dome: gradient from the horizon colour (shared with the fog) up to the canvas colour overhead */
const skyMat = new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ horizon:{ value:new THREE.Color(0x4a5b70) }, zenith:{ value:new THREE.Color(0x1a2330) } },
  vertexShader:`varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader:`uniform vec3 horizon; uniform vec3 zenith; varying vec3 vP;
    void main(){ float t = smoothstep(0.0, 0.42, normalize(vP).y); gl_FragColor = vec4(mix(horizon, zenith, t), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
sky.frustumCulled = false; sky.renderOrder = -1;
scene.add(sky);
/* theme-aware background: read tokens from CSS */
const themeMats = []; // materials that follow theme tokens: {mat, token}
function cssColor(name){
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || '#161e27');
}
let fogK = 1;
/* weather presets: sky gradient, fog, light colours, ground tint. The sun direction stays fixed (the shadow box is fitted to it). */
const WEATHER = {
  sun:  { horizon:0xa8cbe9, zenith:0x2b6cc4, fog:0xb8d2e8, near:1.4, far:1.6, sun:[0xfff3dc, 2.6], hemi:[0xc9dcf5, 0x5c5646, 1.0], fill:0.5, exposure:1.05, ground:0xffffff, rain:false },
  cloud:{ horizon:0x8d98a3, zenith:0x5b6873, fog:0x8d98a3, near:1.0, far:1.0, sun:[0xe8ecf0, 1.1], hemi:[0xb8c2cc, 0x4a4a44, 1.25], fill:0.45, exposure:1.0, ground:0xd9dbdd, rain:false },
  rain: { horizon:0x6b7580, zenith:0x3a434c, fog:0x6b7580, near:0.53, far:0.58, sun:[0xcfd6dd, 0.7], hemi:[0x9aa4ae, 0x3a3a36, 1.2], fill:0.4, exposure:0.95, ground:0xb4b9bf, rain:true },
  dusk: { horizon:0xf0a060, zenith:0x2a2f55, fog:0xd99a6a, near:1.1, far:1.2, sun:[0xffb070, 2.2], hemi:[0x8090c0, 0x4a3a30, 0.8], fill:0.35, exposure:1.0, ground:0xe6cbb0, rain:false },
};
const GROUND_BASE = { '--ballast':0xa9a49a, '--terrain':0xffffff };
let weatherId = 'sun';
/* rain: 1500 short streaks in a 60 m box that follows the camera; the vertex shader wraps them vertically over time */
const RAIN_N = 1500;
const rainMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, fog:false,
  uniforms:{ time:{ value:0 } },
  vertexShader:`attribute float aEnd; uniform float time; varying float vA;
    void main(){ vec3 p = position; p.y = mod(p.y - time * 24.0, 40.0) - aEnd * 0.7; vA = aEnd;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader:`varying float vA; void main(){ gl_FragColor = vec4(0.78, 0.83, 0.9, 0.42 - 0.3 * vA); }`,
});
const rain = (() => {
  const pos = new Float32Array(RAIN_N * 6), end = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++){
    const x = (Math.random() - 0.5) * 60, y = Math.random() * 40, z = (Math.random() - 0.5) * 60;
    pos.set([x, y, z, x, y, z], i * 6); end.set([0, 1], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.LineSegments(g, rainMat); m.frustumCulled = false; m.visible = false; m.renderOrder = 6;
  scene.add(m); return m;
})();
let rainT = 0;
function updateWeather(dt){
  if (!rain.visible) return;
  rainT += dt; rainMat.uniforms.time.value = rainT;
  rain.position.set(camera.position.x, camera.position.y - 20, camera.position.z);
}
function applyWeather(){
  const w = WEATHER[weatherId] || WEATHER.sun;
  const hz = new THREE.Color(w.horizon);
  scene.background = hz.clone();
  scene.fog = new THREE.Fog(w.fog, 170 * fogK * w.near, 520 * fogK * w.far);
  skyMat.uniforms.horizon.value.copy(hz); skyMat.uniforms.zenith.value.setHex(w.zenith);
  sun.color.setHex(w.sun[0]); sun.intensity = w.sun[1];
  hemi.color.setHex(w.hemi[0]); hemi.groundColor.setHex(w.hemi[1]); hemi.intensity = w.hemi[2];
  fill.intensity = w.fill;
  renderer.toneMappingExposure = w.exposure;
  rain.visible = w.rain;
  const tint = new THREE.Color(w.ground);
  themeMats.forEach(({mat, token}) => mat.color.setHex(GROUND_BASE[token] ?? 0xffffff).multiply(tint));
}
function setWeather(id){
  if (!WEATHER[id]) return;
  weatherId = id; applyWeather();
  document.querySelectorAll('#wxSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wx === id)));
}
function applyTheme(){ applyWeather(); }   // the UI theme no longer drives the sky; kept for the theme observers below
const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
darkMq.addEventListener('change', applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });

/* ------------------------------------------------------------ helpers */
const clipMats = [];   // every locomotive material (gets the section plane)
const pal = {
  steel:0x8c97a3, dark:0x3f4750, frame:0x4a545e, body:0x2f5f9e, band:0xe8eaec, roof:0x6b737b,
  glass:0x9fd0ff, wheel:0x5a6068, engine:0x4f7ea0, engineDark:0x35576f, copper:0xc77b3a, coil:0xb8652b,
  cabinet:0xb9c0c7, cabinetBlue:0x3a74c8, tank:0x3c434b, battery:0x2f4f3f, radiator:0x8a3b2f, fan:0x9aa3ad,
  grid:0x5a5f66, panto:0xc8ccd0, insulator:0x9c6b3a, cable:0x222831, black:0x1b1f24, piston:0xd8dde2, rod:0xb6bec7,
  yellow:0xf2c53d, cat:0xc9a27c, sleeper:0x4a423a, rail:0x7b7f84, red:0xc0392b
};
function mat(color, o = {}){
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness:0.55, metalness:0.3, side:THREE.DoubleSide }, o));
  clipMats.push(m);
  return m;
}
function glassMat(){
  const m = mat(pal.glass, { transparent:true, opacity:0.32, roughness:0.15, metalness:0.1, depthWrite:false });
  m.userData.glass = true;
  return m;
}
function seeThrough(color, opacity = 0.32){
  return mat(color, { transparent:true, opacity, depthWrite:false, roughness:0.4, metalness:0.4 });
}
function box(w, h, d, m, x = 0, y = 0, z = 0){
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  g.position.set(x, y, z); g.castShadow = true; g.receiveShadow = true;
  return g;
}
function cyl(r, h, m, axis = 'y', x = 0, y = 0, z = 0, seg = 28, opts = {}){
  const geo = new THREE.CylinderGeometry(opts.rTop ?? r, opts.rBot ?? r, h, seg, 1, !!opts.open);
  const g = new THREE.Mesh(geo, m);
  if (axis === 'x') g.rotation.z = Math.PI / 2;
  if (axis === 'z') g.rotation.x = Math.PI / 2;
  g.position.set(x, y, z); g.castShadow = true; g.receiveShadow = true;
  return g;
}
function torus(r, tube, m, axis = 'y', x = 0, y = 0, z = 0){
  const g = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 40), m);
  if (axis === 'y') g.rotation.x = Math.PI / 2;      // ring lies flat (axis Y)
  if (axis === 'x') g.rotation.y = Math.PI / 2;      // axis X
  g.position.set(x, y, z); g.castShadow = true;
  return g;
}
function gearGeo(rOuter, teeth, thick, depth = 0.8){
  const s = new THREE.Shape();
  const rIn = rOuter * depth, n = teeth * 4;
  for (let i = 0; i < n; i++){
    const a = (i / n) * Math.PI * 2, k = i % 4;
    const r = (k === 0 || k === 1) ? rOuter : rIn;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) s.moveTo(px, py); else s.lineTo(px, py);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth:thick, bevelEnabled:false });
  g.translate(0, 0, -thick / 2);
  return g;
}
function gear(rOuter, teeth, thick, m, axis = 'z'){
  const g = new THREE.Mesh(gearGeo(rOuter, teeth, thick), m);   // gear axis = local Z
  if (axis === 'x') g.rotation.y = Math.PI / 2;
  if (axis === 'y') g.rotation.x = Math.PI / 2;
  g.castShadow = true;
  return g;
}
function fan(r, blades, m, hubM){
  const g = new THREE.Group();
  g.add(cyl(r * 0.22, 0.08, hubM, 'y'));
  for (let i = 0; i < blades; i++){
    const b = box(r * 0.78, 0.02, r * 0.28, m, r * 0.55, 0, 0);
    b.rotation.x = 0.55;
    const h = new THREE.Group(); h.rotation.y = (i / blades) * Math.PI * 2; h.add(b); g.add(h);
  }
  return g;
}
/* cable along a polyline: tube */
function cable(points, r, m){
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.05);
  const g = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), r, 8, false), m);
  g.castShadow = true;
  return g;
}

/* --------------------------------------------------------- part registry */
const loco = new THREE.Group();
scene.add(loco);
const parts = {};
function definePart(id, build){
  const info = PARTS[id];
  const g = new THREE.Group();
  g.name = id; g.userData.partId = id;
  build(g);
  const mats = [];
  g.traverse(o => {
    if (o.isMesh){
      o.userData.partId = id;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { if (!mats.includes(m)) mats.push(m); });
    }
  });
  const p = { id, group:g, mats, explode:new THREE.Vector3(...info.explode), anchor:new THREE.Vector3(...info.anchor),
              modes:info.modes, hidden:false, anim:{} };
  parts[id] = p;
  loco.add(g);
  return p;
}

/* ------------------------------------------------------- orbit camera (or first person: an eye riding a car of the train, the head free to turn) */
const _fpP = new THREE.Vector3(), _fpQ = new THREE.Quaternion(), _fpR = new THREE.Quaternion(), _fpE = new THREE.Euler();
const fpFov = aspect => THREE.MathUtils.clamp(2 * Math.atan(Math.tan(37.5 * Math.PI / 180) / aspect) * 180 / Math.PI, 55, 95);   // about 75° across, kept within 55..95° tall
class Orbit {
  constructor(cam, dom){
    this.cam = cam; this.dom = dom;
    this.target = new THREE.Vector3(0, 2.2, 0);
    this.sph = new THREE.Spherical(30, 1.12, 0.62);
    this.tTarget = this.target.clone(); this.tSph = this.sph.clone();
    this.autoRotate = false; this.moved = 0;
    this.ptrs = new Map(); this.lastPinch = 0; this.lastMid = null;
    this.fence = null;   // fence(position): may move the eye out of a hill's rock; returns the lowest height it may take there, or null (03f4-route.js)
    this.onClick = null; this.onPress = null; this.onWheel = null;   // onPress(e) returns true when it took the press (a cab button, the cab's lever), so the view does not turn; onWheel(e), when it took the wheel (walking: it looks), so it does not zoom
    this.fp = null; this.fpZoom = 1; this.fov = cam.fov;   // first person {obj, eye, yaw, pitch, t, from, fromQ}; fov: the orbit's own lens
    dom.addEventListener('pointerdown', e => this.down(e));
    dom.addEventListener('pointermove', e => this.move(e));
    dom.addEventListener('pointerup', e => this.up(e));
    dom.addEventListener('pointercancel', e => this.up(e));
    dom.addEventListener('wheel', e => { e.preventDefault(); if (!this.onWheel?.(e)) this.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive:false });
    dom.addEventListener('contextmenu', e => e.preventDefault());
  }
  down(e){
    if (this.onPress?.(e)) return;
    this.dom.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x:e.clientX, y:e.clientY, b:e.button, shift:e.shiftKey });
    this.moved = 0; this.dom.classList.add('dragging');
    if (this.ptrs.size === 2){ const [a, b] = [...this.ptrs.values()]; this.lastPinch = Math.hypot(a.x - b.x, a.y - b.y); this.lastMid = { x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 }; }
  }
  move(e){
    const p = this.ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    this.moved += Math.abs(dx) + Math.abs(dy);
    p.x = e.clientX; p.y = e.clientY;
    if (this.ptrs.size === 2){
      const [a, b] = [...this.ptrs.values()];
      const pinch = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.lastPinch > 0) this.zoom(this.lastPinch / pinch);
      this.lastPinch = pinch;
      const mid = { x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 };
      if (this.lastMid) this.pan(mid.x - this.lastMid.x, mid.y - this.lastMid.y);
      this.lastMid = mid;
      return;
    }
    if (this.fp){ const k = this.cam.fov * Math.PI / 180 / Math.max(1, this.dom.clientHeight); this.turn(dx * k, dy * k); }   // the view follows the finger
    else if (p.b === 2 || p.b === 1 || p.shift) this.pan(dx, dy);
    else { this.tSph.theta -= dx * 0.0055; this.tSph.phi -= dy * 0.0055; this.clamp(); }
  }
  up(e){
    const p = this.ptrs.get(e.pointerId);
    this.ptrs.delete(e.pointerId);
    if (this.ptrs.size < 2){ this.lastPinch = 0; this.lastMid = null; }
    if (this.ptrs.size === 0) this.dom.classList.remove('dragging');
    if (p && this.moved < 6 && p.b === 0 && this.onClick) this.onClick(e);
  }
  zoom(f){
    if (this.fp){ this.fpZoom = THREE.MathUtils.clamp(this.fpZoom * f, 0.45, 1); return; }   // first person: the lens narrows, the eye stays in its seat
    this.tSph.radius = THREE.MathUtils.clamp(this.tSph.radius * f, 0.5, this.maxR || 90);   // 0.5 m: the camera can enter the train
  }
  pan(dx, dy){
    if (this.fp) return;
    const k = this.sph.radius * 0.0016;
    const right = new THREE.Vector3(), up = new THREE.Vector3();
    right.setFromMatrixColumn(this.cam.matrix, 0); up.setFromMatrixColumn(this.cam.matrix, 1);
    this.tTarget.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    this.tTarget.y = THREE.MathUtils.clamp(this.tTarget.y, -2, 12);
  }
  clamp(){ this.tSph.phi = THREE.MathUtils.clamp(this.tSph.phi, 0.06, Math.PI - 0.06); }
  turn(yaw, pitch){ const f = this.fp; f.yaw += yaw; f.pitch = THREE.MathUtils.clamp(f.pitch + pitch, -1.2, 1.2); }
  look(obj, eye, yaw, pitch){   // first person: eye is in obj's frame and rides it rigidly, so the landscape moves past and the car does not; yaw 0 looks along +x, π/2 toward -z
    this.fp = { obj, eye, yaw, pitch, t:0, from:this.cam.position.clone(), fromQ:this.cam.quaternion.clone() };
    this.fpZoom = 1;
  }
  free(){   // back to orbiting from where the eye is, around a point 4 m ahead of it, so the view does not jump
    if (!this.fp) return;
    this.fp = null;
    const d = _fpP.set(0, 0, -4).applyQuaternion(this.cam.quaternion);
    this.target.copy(this.cam.position).add(d); this.tTarget.copy(this.target);
    this.sph.setFromVector3(d.negate()); this.tSph.copy(this.sph);
  }
  flyTo(pos, target){
    this.free();
    this.tTarget.copy(target);
    this.tSph.setFromVector3(new THREE.Vector3().subVectors(pos, target));
    // keep theta continuous (avoid spinning the long way round)
    const d = this.tSph.theta - this.sph.theta;
    if (d > Math.PI) this.sph.theta += Math.PI * 2; else if (d < -Math.PI) this.sph.theta -= Math.PI * 2;
    this.clamp();
  }
  update(dt){
    const cam = this.cam, k = 1 - Math.exp(-dt * 7);
    if (this.fp){
      const f = this.fp;
      f.obj.getWorldQuaternion(_fpQ).multiply(_fpR.setFromEuler(_fpE.set(f.pitch, f.yaw - Math.PI / 2, 0, 'YXZ')));   // also refreshes obj.matrixWorld
      _fpP.copy(f.eye).applyMatrix4(f.obj.matrixWorld);
      f.t = Math.min(1, f.t + dt / 0.9); const b = f.t * f.t * (3 - 2 * f.t);   // a 0.9 s glide into the seat, then rigid
      cam.position.copy(f.from).lerp(_fpP, b); cam.quaternion.copy(f.fromQ).slerp(_fpQ, b);
    } else {
      if (this.autoRotate && this.ptrs.size === 0) this.tSph.theta += dt * 0.18;
      this.sph.radius += (this.tSph.radius - this.sph.radius) * k;
      this.sph.phi += (this.tSph.phi - this.sph.phi) * k;
      this.sph.theta += (this.tSph.theta - this.sph.theta) * k;
      this.target.lerp(this.tTarget, k);
      cam.position.setFromSpherical(this.sph).add(this.target);
      const yMin = this.fence?.(cam.position);
      if (yMin != null && cam.position.y < yMin){   // never under the ground or the rails: lifted by closing the angle from the zenith, so dragging further down has nothing to undo
        const phi = Math.acos(THREE.MathUtils.clamp((yMin - this.target.y) / this.sph.radius, -1, 1));
        this.sph.phi = Math.min(this.sph.phi, phi); this.tSph.phi = Math.min(this.tSph.phi, this.sph.phi);
        cam.position.setFromSpherical(this.sph).add(this.target); cam.position.y = Math.max(cam.position.y, yMin);
      }
      cam.lookAt(this.target);
    }
    const fov = this.fp ? fpFov(cam.aspect) * this.fpZoom : this.fov;   // a wider lens in first person, as a seat sees through a window
    if (Math.abs(cam.fov - fov) > 0.01){ cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix(); }
  }
}
const orbit = new Orbit(camera, canvas);

const CAMS = {
  overview:[[22, 10, 26], [-2, 2.2, 0]],
  far:[[46, 15, 54], [-12, 2, 0]],
  side:[[1, 4.5, 26], [0, 2.4, 0]],
  cab:[[14.5, 4.6, 7.5], [8.4, 2.9, 0]],
  engine:[[-0.5, 5.2, 9.5], [-0.6, 2.7, 0]],
  alternator:[[5.5, 4.6, 7.5], [3.4, 2.7, 0]],
  bogie:[[10.5, 1.8, 6.5], [6.2, 0.9, 0]],
  battery:[[8.5, 1.4, 7], [3.8, 1.0, 0.4]],
  grids:[[6, 8.5, 6.5], [3.4, 4.3, 0]],
  roof:[[6, 11, 8], [0.5, 4.6, 0]],
  under:[[6, 0.3, 8.5], [0, 1.0, 0]],   // from the rails' height: never under the ground (Orbit.fence)
};
function flyPreset(name){   // a preset is [eye, target] to orbit, or {obj, eye, yaw, pitch} to ride in first person; a station can have its own (stationCam)
  let c = stationCam(name) || CAMS[name]; if (typeof c === 'function') c = c(); if (!c) return;
  if (c.obj){ orbit.look(c.obj, c.eye, c.yaw, c.pitch); orbit.fp.name = name; } else orbit.flyTo(new THREE.Vector3(...c[0]), new THREE.Vector3(...c[1]));
}
