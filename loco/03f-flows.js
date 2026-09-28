
/* ============================================================ ENERGY FLOWS */
/* A flow is a polyline with animated particles. `level(S)` returns -1..1 (sign = direction).
   Heat is not a current in a conductor, so it has no path: a `plume` rises from each source {y, src:[[x, z, half width x, half width z]]}. */
const FLOW_DEFS = {
  diesel: [
    { id:'fuel', key:'f_fuel', token:'--fuel', parts:['fuelTank','engine'], speed:0.25,
      path:[[1.8,0.9,0.6],[0.6,1.3,1.0],[0.6,1.75,1.3],[-0.2,2.9,1.15],[-0.6,3.6,0.55],[-0.6,3.75,0.1],[-3.0,3.75,0]],
      level:S => S.rpm > 30 ? 0.2 + 0.8 * S.fuel : 0 },
    { id:'air', key:'f_air', token:'--air', parts:['turbo','engine'], speed:0.6,
      path:[[-3.25,3.75,1.6],[-3.25,3.85,1.0],[-3.25,3.85,0.4],[-3.0,3.55,0.2],[-2.6,3.55,0],[1.2,3.5,0]],
      level:S => S.rpm > 30 ? 0.25 + 0.75 * S.rpmN : 0 },
    { id:'exh', key:'f_exh', token:'--exh', parts:['engine','turbo','exhaust'], speed:0.7,
      path:[[-0.6,3.7,-0.62],[-2.4,3.7,-0.68],[-3.1,3.78,-0.6],[-3.25,3.85,-0.45],[-3.25,4.2,-0.4],[-3.25,4.6,0],[-3.25,5.1,0]],
      level:S => S.rpm > 30 ? 0.25 + 0.75 * S.rpmN : 0 },
    { id:'ac', key:'f_ac', token:'--ac', parts:['alternator','rectifier'], speed:0.9,
      path:[[3.5,3.15,0],[4.0,3.45,0],[4.6,3.45,0],[5.0,3.4,0]],
      level:S => S.excitation },
    { id:'dc1', key:'f_dc', token:'--dc', parts:['rectifier','inverters'], speed:0.9,
      path:[[5.0,3.95,0.5],[5.3,3.9,0.7],[5.5,3.6,0.85],[6.0,3.4,0.85]],
      level:S => S.dcN * (S.regenN > 0.02 ? -1 : 1) },
    { id:'dc2', key:'f_dc', token:'--dc', parts:['rectifier','inverters'], speed:0.9,
      path:[[5.0,3.95,-0.5],[5.3,3.9,-0.7],[5.5,3.6,-0.85],[6.0,3.4,-0.85]],
      level:S => S.dcN * (S.regenN > 0.02 ? -1 : 1) },
    { id:'regen', key:'f_regen', token:'--hot', parts:['inverters','brakeGrids'], speed:0.9,
      path:[[5.5,3.95,0.9],[4.6,4.2,0.9],[4.2,4.5,0.62],[3.4,4.6,0.4]],
      level:S => S.regenN },
    { id:'heatG', key:'f_heat', token:'--heat', parts:['brakeGrids'], plume:{ y:4.9, src:[[3.4,0,0.6,0.85]] },
      level:S => S.gridHeat },
    { id:'ctl', key:'f_ctl', token:'--ok', parts:['battery','control'], speed:0.5,
      path:[[3.7,1.5,0.6],[4.6,1.72,0.2],[5.9,1.75,0],[6.0,2.2,0],[6.0,3.6,0]],
      level:S => S.battery ? 0.35 : 0 },
    { id:'cool', key:'f_cool', token:'--cold', parts:['engine','radiator'], speed:0.5,
      path:[[-3.85,2.75,0.5],[-4.2,3.4,0.9],[-4.4,3.85,1.15],[-5.8,3.9,1.25],[-6.6,3.6,1.25],[-6.6,2.3,1.25],[-5.8,2.2,1.25],[-4.4,2.25,1.15],[-4.1,2.2,0.8],[-3.85,2.45,0.5]],
      level:S => S.rpm > 30 ? 0.3 + 0.7 * S.rpmN : 0 },
    { id:'heatR', key:'f_heat', token:'--heat', parts:['radiator'], plume:{ y:4.45, src:[[-5.0,0,0.55,0.55],[-6.6,0,0.55,0.55]] },
      level:S => S.fans * 0.9 },
  ],
  electric: [
    { id:'cat', key:'f_cat', token:'--cat', parts:['catenary','pantograph','vcb','transformer'], speed:1.1,
      path:[[30,5.55,0],[14,5.55,0],[2.6,5.5,0],[2.2,4.9,0.3],[2.0,4.6,0.5],[3.4,4.5,0.6],[4.6,4.9,0.3],[4.6,5.3,0.3],[5.0,5.35,0.1],[5.4,4.9,-0.2],[5.4,4.3,-0.2],[5.5,3.3,-1.25],[3.0,1.75,-1.25],[2.2,1.35,-1.0]],
      level:S => !S.lineOn ? 0 : (S.vcb ? 0.25 + 0.75 * S.powerN : 0.12) * (S.regenN > 0.02 ? -1 : 1) },
    { id:'lv1', key:'f_ac_tr', token:'--ac', parts:['transformer','converter4q'], speed:0.9,
      path:[[2.2,1.35,0.6],[2.6,1.7,0.6],[4.6,2.2,0.72],[5.0,2.5,0.5]],
      level:S => S.vcb ? (0.2 + 0.8 * S.powerN) * (S.regenN > 0.02 ? -1 : 1) : 0 },
    { id:'lv2', key:'f_ac_tr', token:'--ac', parts:['transformer','converter4q'], speed:0.9,
      path:[[2.2,1.35,-0.6],[2.6,1.7,-0.6],[4.6,2.2,-0.72],[5.0,2.5,-0.5]],
      level:S => S.vcb ? (0.2 + 0.8 * S.powerN) * (S.regenN > 0.02 ? -1 : 1) : 0 },
    { id:'dc1', key:'f_dc', token:'--dc', parts:['converter4q','inverters'], speed:0.9,
      path:[[5.0,3.95,0.5],[5.3,3.9,0.7],[5.5,3.6,0.85],[6.0,3.4,0.85]],
      level:S => S.dcN * (S.regenN > 0.02 ? -1 : 1) },
    { id:'dc2', key:'f_dc', token:'--dc', parts:['converter4q','inverters'], speed:0.9,
      path:[[5.0,3.95,-0.5],[5.3,3.9,-0.7],[5.5,3.6,-0.85],[6.0,3.4,-0.85]],
      level:S => S.dcN * (S.regenN > 0.02 ? -1 : 1) },
    { id:'res', key:'f_regen', token:'--hot', parts:['converter4q','roofResistors'], speed:0.9,
      path:[[4.6,3.95,-0.9],[2.6,4.28,-1.1],[-1.4,4.35,-0.9],[-1.9,4.5,-0.62],[-2.5,4.6,-0.4]],
      level:S => S.regenN * 0.6 },
    { id:'heatG', key:'f_heat', token:'--heat', parts:['roofResistors'], plume:{ y:4.9, src:[[-2.5,0,0.6,0.85]] },
      level:S => S.gridHeat },
    { id:'ret', key:'f_ret', token:'--ret', parts:['bogies','catenary'], speed:1.0,
      path:[[6.72,0.5,0.75],[6.72,0.02,0.75],[2,0.02,0.75],[-10,0.02,0.75],[-30,0.02,0.75]],
      level:S => S.vcb ? (0.15 + 0.85 * S.powerN) * (S.regenN > 0.02 ? -1 : 1) : 0 },
    { id:'aux', key:'f_ctl', token:'--ok', parts:['transformer','auxConverter','cooling'], speed:0.5,
      path:[[2.2,1.4,0.4],[1.2,2.3,0.5],[0.5,2.4,0.7],[-1.1,2.4,0.7],[-2.0,2.4,0.8],[-3.3,2.6,0.9],[-4.4,2.8,0.5]],
      level:S => S.vcb ? 0.4 : 0 },
    { id:'ctl', key:'f_ctl', token:'--ok', parts:['battery','control'], speed:0.5,
      path:[[3.7,1.5,0.6],[4.6,1.72,0.2],[5.9,1.75,0],[6.0,2.2,0],[6.0,3.6,0]],
      level:S => S.battery ? 0.35 : 0 },
    { id:'cool', key:'f_cool', token:'--cold', parts:['transformer','cooling'], speed:0.5,
      path:[[-2.2,1.35,0.8],[-3.0,1.7,0.8],[-3.3,2.0,0.7],[-4.0,2.4,0.9],[-4.9,3.0,1.15],[-6.1,3.8,1.25],[-7.2,3.4,1.25],[-7.2,2.3,1.25],[-6.1,2.2,1.25],[-4.9,2.3,-1.15],[-4.2,2.2,-0.9],[-3.3,1.9,-0.7],[-2.2,1.35,-0.8]],
      level:S => S.dcN > 0.2 ? 0.8 : 0 },
    { id:'heatR', key:'f_heat', token:'--heat', parts:['cooling'], plume:{ y:4.45, src:[[-5.4,0,0.5,0.5],[-6.8,0,0.5,0.5]] },
      level:S => S.fans * 0.9 },
  ],
};
// shared: 3-phase inverter -> motor cables, both modes (front bogie from +z inverter, rear bogie from -z inverter)
const AC3 = [
  { id:'ac3f', key:'f_ac3', token:'--ac3', parts:['inverters','motors'], speed:1.0,
    path:[[6.0,1.65,0.85],[6.0,1.25,1.1],[6.4,1.15,1.0],[6.72,0.95,0.5],[6.72,0.7,0.2]],
    level:S => S.tractionN * (S.regenN > 0.02 ? -1 : 1) },
  { id:'ac3f2', key:'f_ac3', token:'--ac3', parts:['inverters','motors'], speed:1.0,
    path:[[6.0,1.65,0.85],[6.0,1.25,1.1],[5.6,1.15,1.0],[5.28,0.95,0.5],[5.28,0.7,0.2]],
    level:S => S.tractionN * (S.regenN > 0.02 ? -1 : 1) },
  { id:'ac3r', key:'f_ac3', token:'--ac3', parts:['inverters','motors'], speed:1.0,
    path:[[6.0,1.65,-0.85],[6.0,1.25,-1.15],[3.0,1.25,-1.4],[-3.0,1.25,-1.4],[-5.28,1.05,-1.1],[-5.28,0.75,-0.5]],
    level:S => S.tractionN * (S.regenN > 0.02 ? -1 : 1) },
  { id:'ac3r2', key:'f_ac3', token:'--ac3', parts:['inverters','motors'], speed:1.0,
    path:[[6.0,1.65,-0.85],[6.0,1.25,-1.15],[3.0,1.25,-1.4],[-3.0,1.25,-1.4],[-6.4,1.05,-1.1],[-6.72,0.75,-0.5]],
    level:S => S.tractionN * (S.regenN > 0.02 ? -1 : 1) },
];
FLOW_DEFS.diesel.push(...AC3); FLOW_DEFS.electric.push(...AC3);
{
  const catLevel = FLOW_DEFS.electric[0].level;
  FLOW_DEFS.tgv = [
    { id:'cat', key:'f_cat', token:'--cat', parts:['catenary','powerCars'], speed:1.1,
      path:[[-206,5.55,0],[-190,5.55,0],[-172.5,5.5,0],[-172.5,4.95,0.15],[-172.4,4.62,0.25],[-168,4.62,0.25]], level:catLevel },
    { id:'roof', key:'f_roof', token:'--cat', parts:['roofLine','vcb'], speed:8,
      path:[[-168,4.62,0.25],[-120,4.62,0.25],[-60,4.62,0.25],[-9.8,4.62,0.25],[-7.4,4.5,0.3],[-1.0,4.55,0.32],[3.6,4.55,0.32],[4.4,4.5,0.3],[4.6,4.9,0.3]], level:catLevel },
    { id:'vcbx', key:'f_cat', token:'--cat', parts:['vcb','transformer'], speed:1.1,
      path:[[4.6,4.9,0.3],[4.6,5.3,0.3],[5.0,5.35,0.1],[5.4,4.9,-0.2],[5.4,4.3,-0.2],[5.5,3.3,-1.25],[3.0,1.75,-1.25],[2.2,1.35,-1.0]], level:catLevel },
    ...FLOW_DEFS.electric.slice(1),
  ];
}

const flowRoot = new THREE.Group(); scene.add(flowRoot);
const flowObjs = [];        // {def, mesh, line, curve, phase, level, mat}
const N_PART = 26;
const sphereGeo = new THREE.SphereGeometry(1, 10, 8);
let hostedShown = null;   // last `show` state pushed to the flows that live inside power car groups
/* Heat plume: soft warm puffs rise from every source, widen, sway, drift back in the train's airflow and fade from orange to red.
   Their edges ripple the way air shimmers above a radiator. Sizes are in metres (the vertex shader projects them). */
const PLUME_N = 28;   // puffs per source
const plumeMat = () => new THREE.ShaderMaterial({
  transparent:true, depthWrite:false,
  uniforms:{ uA:{ value:new THREE.Color() }, uB:{ value:new THREE.Color() }, uTime:{ value:0 }, uH:{ value:400 } },
  vertexShader:`uniform float uH; attribute float aSize; attribute float aAlpha; attribute float aT; attribute float aSeed;
    varying float vA; varying float vT; varying float vSeed;
    void main(){ vA = aAlpha; vT = aT; vSeed = aSeed;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * projectionMatrix[1][1] * uH / max(0.05, -mv.z);
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader:`uniform vec3 uA; uniform vec3 uB; uniform float uTime; varying float vA; varying float vT; varying float vSeed;
    void main(){ vec2 p = gl_PointCoord - 0.5;
      p.x += 0.07 * sin(p.y * 11.0 + uTime * 7.0 + vSeed * 40.0);   // ripples travel up the puff
      p.x *= 1.45;                                                   // taller than wide
      float r = length(p) * 2.0; if (r >= 1.0) discard;
      float a = 1.0 - r * r;
      gl_FragColor = vec4(mix(uA, uB, vT), a * a * vA); }`,
});
const _white = new THREE.Color(1, 0.9, 0.62), _red = new THREE.Color(0.78, 0.16, 0.1);
function plumeColors(f){ f.mat.uniforms.uA.value.copy(f.color).lerp(_white, 0.35); f.mat.uniforms.uB.value.copy(f.color).lerp(_red, 0.55); }
function buildFlows(){
  for (const f of flowObjs){
    const root = f.host || flowRoot; root.remove(f.mesh); f.mat.dispose();
    if (f.plume) f.mesh.geometry.dispose(); else { root.remove(f.line); f.mesh.dispose?.(); f.line.geometry.dispose(); }
  }
  flowObjs.length = 0; hostedShown = null;
  const makePlume = (def, host) => {
    const src = def.plume.src, n = PLUME_N * src.length, g = new THREE.BufferGeometry();
    const u = new Float32Array(n), v = new Float32Array(n), o = new Float32Array(n), seed = new Float32Array(n);
    for (let i = 0; i < n; i++){   // a start point in the source's ellipse, a place in the cycle, a sway seed
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      u[i] = Math.cos(a) * r; v[i] = Math.sin(a) * r; o[i] = (i + Math.random() * 0.8) / n; seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (const k of ['aSize', 'aAlpha', 'aT']) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setDrawRange(0, 0);
    const m = plumeMat(), mesh = new THREE.Points(g, m);
    mesh.frustumCulled = false; mesh.renderOrder = 5;
    (host || flowRoot).add(mesh);
    const f = { def, mesh, mat:m, color:new THREE.Color(cssColor(def.token)), phase:Math.random(), level:0, host, set2:false, plume:{ n, u, v, o, time:0 } };
    plumeColors(f); flowObjs.push(f);
  };
  // host: a group the flow is parented to (a copied power car's internals, in car coordinates); set2: shifted onto the second set
  const make = (def, host = null, set2 = false) => {
    if (def.plume) return makePlume(def, host);
    const curve = new THREE.CatmullRomCurve3(def.path.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.1);
    const col = new THREE.Color(cssColor(def.token));
    const m = new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.95, depthWrite:false, toneMapped:false });
    const mesh = new THREE.InstancedMesh(sphereGeo, m, N_PART);
    mesh.frustumCulled = false; mesh.renderOrder = 5;
    const pts = curve.getSpacedPoints(Math.max(24, def.path.length * 12));
    const lm = new THREE.LineBasicMaterial({ color:col, transparent:true, opacity:0.22, toneMapped:false });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm);
    line.renderOrder = 4;
    (host || flowRoot).add(line, mesh);
    flowObjs.push({ def, mesh, line, curve, phase:Math.random(), level:0, mat:m, lmat:lm, color:col, len:curve.getLength(), host, set2 });
  };
  for (const def of FLOW_DEFS[S.mode]) make(def);
  if (S.mode === 'tgv'){
    for (const def of FLOW_DEFS.tgv) if (def.id === 'cat' || def.id === 'roof') make(def, null, true);
    for (const h of pcHosts) for (const def of FLOW_DEFS.tgv) if (def.id !== 'cat' && def.id !== 'roof') make(def, h.ig);
  }
}
const _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _wq = new THREE.Quaternion(), _wv = new THREE.Vector3();
function updatePlume(f, lv, dt){
  const P = f.plume, g = f.mesh.geometry, A = g.attributes, pos = A.position.array, src = f.def.plume.src;
  P.time += dt;
  f.mat.uniforms.uTime.value = P.time; f.mat.uniforms.uH.value = renderer.domElement.height / 2;
  if (lv < 0.02){ g.setDrawRange(0, 0); return; }
  const rate = 0.35 + 0.35 * lv, rise = 1.5 + 0.9 * lv;   // a puff lives 1.4 to 2.9 s and climbs 1.5 to 2.4 m
  f.phase = (f.phase + dt * rate) % 1;
  // the air the train runs through pushes the plume back: the smoke's wind, turned into the frame the plume lives in
  _wv.set(clamp(-S.speed * S.dir, -12, 12) * 0.4 / rate, 0, 0);
  if (f.host) _wv.applyQuaternion(f.host.getWorldQuaternion(_wq).invert());
  for (let i = 0; i < P.n; i++){
    const t = (P.o[i] + f.phase) % 1, sc = src[i % src.length], e = A.aSeed.array[i], spread = 1 + 1.3 * t, sway = 0.14 * t;
    pos[i * 3] = sc[0] + P.u[i] * sc[2] * spread + Math.sin(P.time * 1.7 + e * 6.3 + t * 5) * sway + _wv.x * t;
    pos[i * 3 + 1] = f.def.plume.y + rise * t;
    pos[i * 3 + 2] = sc[1] + P.v[i] * sc[3] * spread + Math.cos(P.time * 1.3 + e * 4.1 + t * 4) * sway + _wv.z * t;
    A.aSize.array[i] = (0.35 + 0.8 * t) * (0.75 + 0.25 * lv);
    A.aAlpha.array[i] = Math.min(1, t * 7) * Math.pow(1 - t, 1.5) * (0.3 + 0.4 * lv);
    A.aT.array[i] = t;
  }
  g.setDrawRange(0, P.n);
  for (const k of ['position', 'aSize', 'aAlpha', 'aT']) A[k].needsUpdate = true;
}
function updateFlows(dt){
  const show = S.flowsOn && S.explode < 0.02;
  flowRoot.visible = show;
  if (hostedShown !== show){ hostedShown = show; for (const f of flowObjs) if (f.host){ f.mesh.visible = show; if (!show && f.line) f.line.visible = false; } }
  if (!show) return;
  const s2on = S.mode === 'tgv' && tgvSets[1].group.visible, xoff2 = s2on ? TGV.SET2_X + S.set2Off : 0;
  for (const f of flowObjs){
    const target = THREE.MathUtils.clamp(f.def.level(S), -1, 1);
    f.level += (target - f.level) * Math.min(1, dt * 4);
    const lv = Math.abs(f.level);
    const partVisible = f.def.parts.every(id => !parts[id] || parts[id].group.visible) && (!f.set2 || s2on);
    if (f.plume){ updatePlume(f, partVisible ? lv : 0, dt); continue; }
    f.line.visible = partVisible && lv > 0.01 && f.def.id !== 'cat' && f.def.id !== 'roof';
    if (!partVisible || lv < 0.02){ f.mesh.count = 0; continue; }
    f.phase = (f.phase + Math.sign(f.level) * dt * f.def.speed * (0.4 + 0.6 * lv) * (6 / Math.max(3, f.len)) + 1) % 1;
    const n = Math.max(3, Math.round(N_PART * (0.3 + 0.7 * lv) * Math.min(1, f.len / 4)));
    const r = 0.045 + 0.05 * lv;
    f.mesh.count = n;
    for (let i = 0; i < n; i++){
      const t = (i / n + f.phase) % 1;
      f.curve.getPointAt(t, _p);
      if (f.def.id === 'cat' || f.def.id === 'roof') curveLocal(_p.x + (f.set2 ? xoff2 : 0), _p.y, _p.z, _p);
      const edge = Math.min(1, Math.min(t, 1 - t) * 8);
      _s.setScalar(r * (0.4 + 0.6 * edge));
      _m4.compose(_p, _q, _s);
      f.mesh.setMatrixAt(i, _m4);
    }
    f.mesh.instanceMatrix.needsUpdate = true;
    f.mat.opacity = 0.5 + 0.5 * lv;
    f.lmat.opacity = 0.1 + 0.25 * lv;
  }
}
function recolorFlows(){ for (const f of flowObjs){ f.color.set(cssColor(f.def.token)); if (f.plume){ plumeColors(f); continue; } f.mat.color.copy(f.color); f.lmat.color.copy(f.color); } }

/* ------------------------------------------------------------- smoke */
const SMOKE_N = 260;
const smoke = (() => {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(SMOKE_N * 3), age = new Float32Array(SMOKE_N), life = new Float32Array(SMOKE_N), dark = new Float32Array(SMOKE_N), vel = new Float32Array(SMOKE_N * 3), seed = new Float32Array(SMOKE_N);
  for (let i = 0; i < SMOKE_N; i++){ age[i] = 1e9; life[i] = 1; seed[i] = Math.random(); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAge', new THREE.BufferAttribute(age, 1));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aDark', new THREE.BufferAttribute(dark, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, depthTest:true,
    uniforms:{ uBase:{ value:new THREE.Color(0xb9c0c8) }, uPx:{ value:renderer.getPixelRatio() } },
    vertexShader:`uniform float uPx; attribute float aAge; attribute float aLife; attribute float aDark; attribute float aSeed;
      varying float vA; varying float vDark;
      void main(){ float k = clamp(aAge / aLife, 0.0, 1.0); vA = (1.0 - k) * (1.0 - k) * 0.55; vDark = aDark;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uPx * (0.5 + 2.4 * k) * 260.0 / max(1.0, -mv.z);
        if (aAge > aLife) gl_PointSize = 0.0;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader:`uniform vec3 uBase; varying float vA; varying float vDark;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
        float soft = smoothstep(0.5, 0.05, r);
        vec3 c = mix(uBase, vec3(0.1, 0.1, 0.11), vDark);
        gl_FragColor = vec4(c, vA * soft); }`,
  });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 6;
  scene.add(pts);
  let head = 0, acc = 0;
  return {
    pts,
    emit(n, darkness){
      for (let k = 0; k < n; k++){
        const i = head; head = (head + 1) % SMOKE_N;
        pos[i * 3] = -3.25 + (Math.random() - 0.5) * 0.15; pos[i * 3 + 1] = 5.0; pos[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
        vel[i * 3] = (Math.random() - 0.5) * 0.3; vel[i * 3 + 1] = 1.4 + Math.random() * 0.8; vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        age[i] = 0; life[i] = 1.8 + Math.random() * 1.4; dark[i] = darkness;
      }
    },
    update(dt, rate, darkness, wind){
      if (rate > 0){ acc += rate * dt; const n = Math.floor(acc); if (n > 0){ this.emit(n, darkness); acc -= n; } }
      for (let i = 0; i < SMOKE_N; i++){
        if (age[i] > life[i]) continue;
        age[i] += dt;
        pos[i * 3] += (vel[i * 3] + wind) * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] *= 1 - dt * 0.35;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aAge.needsUpdate = true; geo.attributes.aLife.needsUpdate = true; geo.attributes.aDark.needsUpdate = true;
    },
  };
})();
