
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
const sun = new THREE.DirectionalLight(0xfff2de, 2.3);   // the sun by day, the moon by night (updateWeather)
const LIGHT_DIR = new THREE.Vector3(18, 28, 16).normalize();   // towards it, in the scene; setShadowBox places the light on this line
sun.position.copy(LIGHT_DIR);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-64, right:30, top:26, bottom:-16, near:1, far:120 });
sun.shadow.bias = -0.0005;
/* fit the shadow frustum to a world box along the track (the light looks at the origin from far enough to see the whole box in front of it) */
function setShadowBox(xMin, xMax, mapSize, zMin = -14, zMax = 14){
  const cam = sun.shadow.camera, az = LIGHT_DIR;
  let far = -Infinity;
  for (const px of [xMin, xMax]) for (const py of [-1, 9]) for (const pz of [zMin, zMax]) far = Math.max(far, px * az.x + py * az.y + pz * az.z);
  sun.position.copy(az).multiplyScalar(far + 10);
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

/* sky dome: gradient from the horizon colour (shared with the fog) up to the zenith's, with the sun and the moon on it. It turns with the
   route (03f4-route.js), so vR, the way the camera looks through each pixel, is in the route frame (x east, y up, z south) like sunR */
const skyMat = new THREE.ShaderMaterial({
  side:THREE.BackSide, depthWrite:false, fog:false,
  uniforms:{ horizon:{ value:new THREE.Color(0x4a5b70) }, zenith:{ value:new THREE.Color(0x1a2330) }, sunR:{ value:new THREE.Vector3(0, 1, 0) },
    sunC:{ value:new THREE.Color(0, 0, 0) }, moonC:{ value:new THREE.Color(0, 0, 0) }, glow:{ value:0 } },
  vertexShader:`varying vec3 vR; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vR = (vec4(w.xyz - cameraPosition, 0.0) * modelMatrix).xyz;
    gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader:`uniform vec3 horizon, zenith, sunR, sunC, moonC; uniform float glow; varying vec3 vR;
    void main(){ vec3 r = normalize(vR); vec3 c = mix(horizon, zenith, smoothstep(0.0, 0.42, r.y));
      float a = length(r - sunR), m = length(r + sunR), fa = fwidth(a), fm = fwidth(m);   // the angles to the sun and to the moon (radians, near them)
      c += sunC * (glow * (0.1 * exp(-a * 2.5) + 0.3 * exp(-a * 14.0)) + 8.0 * (1.0 - smoothstep(0.0105 - fa, 0.0105 + fa, a)));   // a disc of 1.2 degrees, twice the real one
      c += moonC * (0.05 * exp(-m * 12.0) + 1.5 * (1.0 - smoothstep(0.0085 - fm, 0.0085 + fm, m)));
      gl_FragColor = vec4(c, 1.0);
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
/* ---- the weather and the time of day ("a real clock to set the time of day", "I would like to see the sun", "a weather system").
   A weather is a daylight look. The time of day moves it the way it moves a clear sky (SKY_KEYS, by the sun's height in degrees): a grey sky at
   sunset turns as orange as a clear one does, at night as dark. A new weather blends in over 6 s. */
const WEATHER = {
  sun:  { horizon:0xa8cbe9, zenith:0x2b6cc4, fog:0xb8d2e8, near:1.4, far:1.6, light:[0xfff3dc, 2.6], hemi:[0xc9dcf5, 0x5c5646, 1.0], fill:0.5, exposure:1.05, ground:0xffffff, rain:0, clear:1 },
  cloud:{ horizon:0x8d98a3, zenith:0x5b6873, fog:0x8d98a3, near:1.0, far:1.0, light:[0xe8ecf0, 1.1], hemi:[0xb8c2cc, 0x4a4a44, 1.25], fill:0.45, exposure:1.0, ground:0xd9dbdd, rain:0, clear:0 },
  rain: { horizon:0x6b7580, zenith:0x3a434c, fog:0x6b7580, near:0.53, far:0.58, light:[0xcfd6dd, 0.7], hemi:[0x9aa4ae, 0x3a3a36, 1.2], fill:0.4, exposure:0.95, ground:0xb4b9bf, rain:1, clear:0 },
};
const SKY_KEYS = [   // a clear sky as the sun goes down; under -1.5 degrees the light is the moon's
  { h:-12, horizon:0x1c2846, zenith:0x070c1c, fog:0x1a2338, light:[0xa8c0ff, 0.6], hemi:[0x5a6c9c, 0x1e2230, 0.85], fill:0.25, exposure:1.15, ground:0x8890a8 },
  { h:-6, horizon:0x4a4868, zenith:0x101634, fog:0x3a3c56, light:[0xa8c0ff, 0.25], hemi:[0x6070a0, 0x262630, 0.85], fill:0.3, exposure:1.08, ground:0xa8a8c0 },
  { h:-1.5, horizon:0xc07860, zenith:0x1e2448, fog:0x9a7068, light:[0xff8848, 0], hemi:[0x7a88b8, 0x3c3232, 0.85], fill:0.4, exposure:1.0, ground:0xccb4a8 },
  { h:0.5, horizon:0xf0a060, zenith:0x2a2f55, fog:0xd99a6a, light:[0xffa060, 1.4], hemi:[0x8c9ac8, 0x4e3e34, 0.9], fill:0.45, exposure:1.0, ground:0xe6cbb0 },
  { h:4, horizon:0xe8c8a0, zenith:0x34589c, fog:0xdcc0a4, light:[0xffc890, 2.1], hemi:[0xb0bcda, 0x584c3c, 0.95], fill:0.5, exposure:1.03, ground:0xf4e2cc },
  { h:10, horizon:0xbcd0e2, zenith:0x3168b8, fog:0xc4d4e2, light:[0xffe6c4, 2.4], hemi:[0xc4d4ec, 0x5c5444, 1.0], fill:0.5, exposure:1.05, ground:0xfdf6ee },
  { h:20, ...WEATHER.sun },
];
const GROUND_BASE = { '--ballast':0xa9a49a, '--terrain':0xffffff };
/* a look as 29 numbers, colours in linear RGB: horizon 0, zenith 3, fog 6, light 9 and 12, sky light 13 and 16 and 19, fill 20, exposure 21,
   ground 22; the weather's own: fog near 25 and far 26, rain 27, clear 28 (stars, the sun's disc, the moonlight) */
const PAL_N = 29, PAL_TIME = 25;   // the first 25 change with the time of day
function palOf(p){
  const a = new Float32Array(PAL_N), c = new THREE.Color();
  let i = 0; const put = hex => { c.setHex(hex); a[i++] = c.r; a[i++] = c.g; a[i++] = c.b; };
  put(p.horizon); put(p.zenith); put(p.fog); put(p.light[0]); a[i++] = p.light[1];
  put(p.hemi[0]); put(p.hemi[1]); a[i++] = p.hemi[2]; a[i++] = p.fill; a[i++] = p.exposure; put(p.ground);
  a[25] = p.near ?? 1; a[26] = p.far ?? 1; a[27] = p.rain ?? 0; a[28] = p.clear ?? 1;
  return a;
}
const WX_PAL = Object.fromEntries(Object.entries(WEATHER).map(([k, w]) => [k, palOf(w)]));
const KEY_PAL = SKY_KEYS.map(palOf), DAY_PAL = KEY_PAL[KEY_PAL.length - 1];
const _clear = new Float32Array(PAL_N), PAL = new Float32Array(PAL_N), _ratio = new Float32Array(PAL_N), _r = new Float32Array(PAL_N);
const PAL_RGB = [0, 3, 6, 9, 13, 16, 22];   // where the colours start
function clearAt(h){   // the clear sky with the sun h degrees high
  let i = 0; while (i < SKY_KEYS.length - 2 && h > SKY_KEYS[i + 1].h) i++;
  const t = Math.max(0, Math.min(1, (h - SKY_KEYS[i].h) / (SKY_KEYS[i + 1].h - SKY_KEYS[i].h))), A = KEY_PAL[i], B = KEY_PAL[i + 1];
  for (let j = 0; j < PAL_N; j++) _clear[j] = A[j] + (B[j] - A[j]) * t;
  return _clear;
}
scene.background = new THREE.Color(); scene.fog = new THREE.Fog(0xb8d2e8, 238, 832);   // set every frame by updateWeather
let weatherId = 'sun';
const wxW = { sun:1, cloud:0, rain:0 };   // how much of each weather is in the sky now (they blend)
/* ---- the clock: French time, minutes after midnight. Live, it is the real time; set by hand, it runs with the simulation (x1 to x16) */
const CLOCK = { live:true, min:720, pick:null };   // pick: the time of day a button chose (TOD), until the clock is set another way
let tzOff = 120, tzT = -1e9;   // France's offset from UTC (minutes), read once a minute
function frOff(){
  const now = Date.now(); if (now - tzT < 60000) return tzOff;
  tzT = now;
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Paris', hourCycle:'h23', hour:'numeric', minute:'numeric' }).formatToParts(new Date(now)).map(x => [x.type, x.value]));
    const d = new Date(now); tzOff = ((+p.hour * 60 + +p.minute) - (d.getUTCHours() * 60 + d.getUTCMinutes()) + 2160) % 1440 - 720;
  } catch (e) {}
  return tzOff;
}
const liveMin = () => { const d = new Date(); return (d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + frOff() + 1440) % 1440; };
const dayOfYear = () => { const d = new Date(); return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1; };
function setClock(min){   // null: back to the real time
  CLOCK.live = min == null; CLOCK.pick = null;
  CLOCK.min = CLOCK.live ? liveMin() : ((min % 1440) + 1440) % 1440;
}
const hhmm = min => { const m = Math.floor(min) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
/* the sun over the train (NOAA's approximation), in the route frame: x east, y up, z south. The route's x and z are metres from Toulouse,
   north up: the latitude and longitude come back within a few kilometres, a few seconds of the sun's time */
const SUN_R = new THREE.Vector3(0, 1, 0);
let sunH = 45;   // the sun's height over the horizon, degrees
function sunAt(out, min, lat, lon){
  const doy = dayOfYear(), utc = min - frOff(), g = 2 * Math.PI / 365 * (doy - 1 + (utc / 60 - 12) / 24);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const de = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const ha = ((utc + eq + 4 * lon) / 4 - 180) * Math.PI / 180, la = lat * Math.PI / 180;
  return out.set(-Math.cos(de) * Math.sin(ha), Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(ha), Math.sin(la) * Math.cos(de) * Math.cos(ha) - Math.cos(la) * Math.sin(de));
}
function trainLatLon(){ const lat = 43.6114 + (-P_loco.z - 1150) / 111200; return [lat, 1.4536 + (P_loco.x + 349) / (111320 * Math.cos(lat * Math.PI / 180))]; }
const _sv = new THREE.Vector3();
function sunHAt(min){ const [la, lo] = trainLatLon(); return Math.asin(sunAt(_sv, min, la, lo).y) * 180 / Math.PI; }
function sunTime(h, evening){   // when the sun crosses h degrees today, going up in the morning or down in the evening (null if it never does)
  for (let m = evening ? 720 : 0; m < (evening ? 1440 : 720); m += 5){
    const a = sunHAt(m), b = sunHAt(m + 5);
    if ((a - h) * (b - h) <= 0 && a !== b) return m + 5 * (h - a) / (b - a);
  }
  return null;
}
/* the times of day the playground's and the iPad's button go through: now (the real time), the morning with the sun 4 degrees up, noon, the
   evening with the sun 1 degree up before it sets, midnight by the sun */
const TOD = ['now', 'morning', 'noon', 'evening', 'night'];
function solarNoon(){ const a = sunTime(-0.833, false), b = sunTime(-0.833, true); return a != null && b != null ? (a + b) / 2 : 825; }
function setTod(id){
  const m = id === 'morning' ? sunTime(4, false) : id === 'noon' ? solarNoon() : id === 'evening' ? sunTime(1, true) : id === 'night' ? solarNoon() + 720 : null;
  if (id === 'now') setClock(null); else if (m != null){ setClock(m); CLOCK.pick = id; }
}
const todPick = () => CLOCK.live ? 'now' : CLOCK.pick || 'set';
const todIcon = () => sunH < -4 ? '🌙' : sunH > 12 ? '☀️' : SUN_R.x > 0 ? '🌅' : '🌇';   // the sun in the east: morning
/* rain: 1500 short streaks in a 60 m box that follows the camera; the vertex shader wraps them vertically over time */
const RAIN_N = 1500;
const rainMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, fog:false,
  uniforms:{ time:{ value:0 }, amount:{ value:0 } },
  vertexShader:`attribute float aEnd; uniform float time; varying float vA;
    void main(){ vec3 p = position; p.y = mod(p.y - time * 24.0, 40.0) - aEnd * 0.7; vA = aEnd;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader:`uniform float amount; varying float vA; void main(){ gl_FragColor = vec4(0.78, 0.83, 0.9, (0.42 - 0.3 * vA) * amount); }`,
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
/* the stars: 1600 points on the sky's upper half, drawn 8 km out around the camera wherever it is, turning with the route like the sky */
const starMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, fog:false,
  uniforms:{ night:{ value:0 }, px:{ value:1 } },
  vertexShader:`attribute float aMag; uniform float night, px; varying float vA;
    void main(){ vA = night * (0.3 + 0.7 * aMag); gl_PointSize = px * (1.3 + 1.7 * aMag);
      gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + mat3(modelMatrix) * position * 8000.0, 1.0); }`,
  fragmentShader:`varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.9, 0.93, 1.0, vA * smoothstep(0.5, 0.15, d)); }`,
});
const stars = (() => {
  const N = 1600, pos = new Float32Array(N * 3), mag = new Float32Array(N);
  for (let i = 0; i < N; i++){
    const y = -0.03 + Math.random() * 1.03, r = Math.sqrt(1 - y * y), a = Math.random() * 2 * Math.PI;
    pos.set([r * Math.cos(a), y, r * Math.sin(a)], i * 3); mag[i] = Math.random() ** 3;   // most of them faint
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  const m = new THREE.Points(g, starMat); m.frustumCulled = false; m.visible = false; m.renderOrder = -1;
  scene.add(m); return m;
})();
let rainT = 0;
const _fillD = new THREE.Vector3();
function updateWeather(dt){
  CLOCK.min = CLOCK.live ? liveMin() : (CLOCK.min + dt * S.timeScale / 60) % 1440;
  const [lat, lon] = trainLatLon();
  sunAt(SUN_R, CLOCK.min, lat, lon); sunH = Math.asin(SUN_R.y) * 180 / Math.PI;
  // the weather: each one's share moves towards the one asked for
  let sum = 0;
  for (const k in wxW){ wxW[k] = approach(wxW[k], k === weatherId ? 1 : 0, dt / 6); sum += wxW[k]; }
  // the look: each weather's daylight look moved the way the clear sky moves from daylight to now
  const C = clearAt(sunH);
  for (let j = 0; j < PAL_TIME; j++) _ratio[j] = Math.min(2.5, C[j] / Math.max(1e-4, DAY_PAL[j]));
  PAL.fill(0);
  for (const k in wxW){
    const f = wxW[k] / sum; if (!f) continue;
    const W = WX_PAL[k], sat = 0.3 + 0.7 * W[28];   // under clouds the hour's colours show less: a grey sunset, a grey night
    for (let j = 0; j < PAL_N; j++) _r[j] = j < PAL_TIME ? _ratio[j] : 1;
    for (const t of PAL_RGB){ const l = 0.2126 * _r[t] + 0.7152 * _r[t + 1] + 0.0722 * _r[t + 2]; for (let i = t; i < t + 3; i++) _r[i] = l + (_r[i] - l) * sat; }
    for (let j = 0; j < PAL_N; j++) PAL[j] += f * W[j] * _r[j];
  }
  const P = PAL, clear = P[28], moon = sunH < -1.5;
  skyMat.uniforms.horizon.value.setRGB(P[0], P[1], P[2]); skyMat.uniforms.zenith.value.setRGB(P[3], P[4], P[5]);
  scene.background.setRGB(P[0], P[1], P[2]);
  scene.fog.color.setRGB(P[6], P[7], P[8]); scene.fog.near = 170 * fogK * P[25]; scene.fog.far = 520 * fogK * P[26];
  sun.color.setRGB(P[9], P[10], P[11]); sun.intensity = P[12];   // clouds dim the moon as they dim the sun, they do not hide its light
  hemi.color.setRGB(P[13], P[14], P[15]); hemi.groundColor.setRGB(P[16], P[17], P[18]); hemi.intensity = P[19];
  fill.intensity = P[20];
  renderer.toneMappingExposure = P[21];
  for (const { mat, token } of themeMats) mat.color.setHex(GROUND_BASE[token] ?? 0xffffff).multiply(_tint.setRGB(P[22], P[23], P[24]));
  // the sun and the moon in the sky, the stars
  skyMat.uniforms.sunR.value.copy(SUN_R);
  const sunVis = clear * Math.max(0, Math.min(1, (sunH + 2.5) / 2)), moonVis = clear * Math.max(0, Math.min(1, (-sunH - 2) / 5));
  skyMat.uniforms.sunC.value.setRGB(P[9], P[10], P[11]).multiplyScalar(sunVis);
  skyMat.uniforms.moonC.value.setRGB(0.8, 0.85, 1).multiplyScalar(moonVis);
  skyMat.uniforms.glow.value = 0.6 + 0.8 * Math.max(0, Math.min(1, 1 - sunH / 20));
  starMat.uniforms.night.value = clear * Math.max(0, Math.min(1, (-sunH - 4) / 7)); starMat.uniforms.px.value = renderer.getPixelRatio();
  stars.visible = starMat.uniforms.night.value > 0.005;
  // the light comes from the sun, or from the moon opposite it; the sky's fill from the other side, low
  LIGHT_DIR.copy(SUN_R); if (moon) LIGHT_DIR.negate();
  LIGHT_DIR.applyQuaternion(world.quaternion);
  _fillD.set(-LIGHT_DIR.x, 0, -LIGHT_DIR.z); if (_fillD.lengthSq() < 1e-6) _fillD.set(-1, 0, -1);
  fill.position.copy(_fillD.normalize().multiplyScalar(19)).setY(9);
  fitShadow();
  // rain
  rainMat.uniforms.amount.value = P[27]; rain.visible = P[27] > 0.01;
  if (!rain.visible) return;
  rainT += dt; rainMat.uniforms.time.value = rainT;
  rain.position.set(camera.position.x, camera.position.y - 20, camera.position.z);
}
const _tint = new THREE.Color();
function applyWeather(){ updateWeather(0); }
function setWeather(id){
  if (!WEATHER[id]) return;
  weatherId = id;
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
