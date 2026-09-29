
/* ------------------------------------------------------------ wind turbines: the real ones, from OpenStreetMap (baked by route/build_route.py)
   Every turbine within 6 km of the line stands where OSM maps it, with its own hub height and rotor. Three instanced meshes (towers,
   nacelles, rotors) hang in `world` and are refilled each frame with the turbines within 7 km, placed relative to the loco so no
   route-sized coordinate reaches float32; the rotors turn on the CPU. Their fog: the scene's own at the foot, a lighter haze higher up,
   so a farm 4 km out still stands above the fogged fields (the camera's far plane in 03b-scene.js reaches it). */
const WIND_R = 7000, WIND_FROM = 250 * Math.PI / 180;   // the prevailing wind over western France blows from the west-south-west
const WIND = ROUTE_DATA.wind.map(([x, n, y, hub, D, s, w], i) => ({
  x, z:-n, hub, D,
  y:Math.abs(w) < 1000 ? ROUTE.terAt(s, w) - 0.5 : y,   // on the ground as drawn near the line; further out on the DEM, where nothing else is drawn
  yaw:Math.PI / 2 - WIND_FROM + (hash2(i, 7, 1) - 0.5) * 0.1,
  a0:hash2(i, 7, 2) * 6.283,
  om:hash2(i, 7, 3) < 0.06 ? 0 : 130 / D * (0.92 + 0.16 * hash2(i, 7, 4)),   // blade tips near 65 m/s, 10 to 17 rpm; one in sixteen stands still
}));
/* the shapes for a 100 m hub and a 100 m rotor; the rotor faces +x, into the wind */
const WIND_GEO = (() => {
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const tower = new THREE.LatheGeometry([V2(2.15, -60), V2(2.1, 0), V2(1.3, 100)], 16);   // runs 60 m underground, so a tower on a hill past the drawn ground never floats
  const nacelle = new THREE.BoxGeometry(12, 4, 3.8).translate(-2.5, 0.4, 0);
  const spinner = new THREE.LatheGeometry([V2(2.0, 0), V2(1.9, 2.0), V2(1.2, 3.6), V2(0.05, 4.5)], 12).rotateZ(-Math.PI / 2).translate(-1.3, 0, 0);
  // a blade: a thin diamond section swept root to tip, the chord turning from 14° at the root to flat at the tip; it turns clockwise seen from upwind
  const ST = [[1.6, 2.4, 2.0, 14], [6, 3.9, 1.3, 12], [13, 3.5, 0.85, 7], [25, 2.6, 0.55, 3], [40, 1.6, 0.35, 1], [50, 0.3, 0.12, 0]];
  const blades = [0, 1, 2].map(b => {
    const f = b * 2 * Math.PI / 3, rd = new THREE.Vector3(0, Math.cos(f), Math.sin(f)), td = new THREE.Vector3(0, Math.sin(f), -Math.cos(f)), X = new THREE.Vector3(1, 0, 0);
    const pos = [], idx = [], c = new THREE.Vector3(), nn = new THREE.Vector3(), p = new THREE.Vector3();
    const ring = ST.map(([r, ch, th, tw]) => {
      const be = tw * Math.PI / 180;
      c.copy(td).multiplyScalar(Math.cos(be)).addScaledVector(X, Math.sin(be)); nn.copy(td).multiplyScalar(-Math.sin(be)).addScaledVector(X, Math.cos(be));
      return [[0.3 * ch, 0], [0, th / 2], [-0.7 * ch, 0], [0, -th / 2]].map(([u, v]) => p.copy(rd).multiplyScalar(r).addScaledVector(c, u).addScaledVector(nn, v).toArray());
    });
    for (let k = 0; k < 4; k++){   // each face its own strip, so the section keeps its edges
      const o = pos.length / 3;
      ring.forEach(q => pos.push(...q[k], ...q[(k + 1) % 4]));
      for (let j = 0; j < ST.length - 1; j++){ const a = o + 2 * j; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  });
  return { tower, nacelle, rotor:mergeGeos([spinner, ...blades]) };
})();
const windM = new THREE.MeshStandardMaterial({ color:0xe4e7e5, roughness:0.55, metalness:0 });   // RAL 7035, the light grey French turbines are painted
windM.onBeforeCompile = sh => {
  sh.vertexShader = 'attribute float aGround;\nvarying float vWindH;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWindH = (instanceMatrix * vec4(transformed, 1.0)).y - aGround;');
  sh.fragmentShader = 'varying float vWindH;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
    float fG = smoothstep(fogNear, fogFar, vFogDepth), fH = 1.0 - exp(-max(0.0, vFogDepth - fogNear) / (2.4 * (fogFar - fogNear)));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, mix(fG, min(fG, fH), smoothstep(6.0, 50.0, vWindH)));
  #endif`);
};
const windG = new THREE.Group(); windG.name = 'wind'; world.add(windG);
const windGround = new THREE.InstancedBufferAttribute(new Float32Array(WIND.length), 1).setUsage(THREE.DynamicDrawUsage);   // each turbine's foot, for its fog
const windIM = [WIND_GEO.tower, WIND_GEO.nacelle, WIND_GEO.rotor].map(geo => {
  geo.setAttribute('aGround', windGround);
  const im = new THREE.InstancedMesh(geo, windM, WIND.length); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  windG.add(im); return im;
});
const WIND_TILT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 5 * Math.PI / 180), WIND_AX = new THREE.Vector3(1, 0, 0);
const _tq = new THREE.Quaternion(), _tq2 = new THREE.Quaternion(), _tp = new THREE.Vector3(), _tv = new THREE.Vector3(), _ts = new THREE.Vector3(), _tm = new THREE.Matrix4();
let windClock = 0;
function updateWind(dt){
  windClock += dt;
  let n = 0;
  for (const t of WIND){
    const dx = t.x - P_loco.x, dz = t.z - P_loco.z;
    if (dx * dx + dz * dz > WIND_R * WIND_R) continue;
    const y = t.y - P_loco.y, k = t.hub / 100, kd = t.D / 100;
    _tq.setFromAxisAngle(Y_UP, t.yaw);
    windIM[0].setMatrixAt(n, _tm.compose(_tp.set(dx, y, dz), _tq, _ts.set(k, k, k)));
    _tq.multiply(WIND_TILT); _tp.y += t.hub;   // the nacelle and the rotor shaft tilt 5° up at the front
    windIM[1].setMatrixAt(n, _tm.compose(_tp, _tq, _ts.set(kd, kd, kd)));
    _tp.add(_tv.set(4.9 * kd, 0, 0).applyQuaternion(_tq));
    _tq.multiply(_tq2.setFromAxisAngle(WIND_AX, t.a0 - t.om * windClock));
    windIM[2].setMatrixAt(n, _tm.compose(_tp, _tq, _ts));
    windGround.array[n++] = y;
  }
  for (const im of windIM){ im.count = n; im.instanceMatrix.needsUpdate = true; }
  windGround.needsUpdate = true;
}
function windClear(x, z, r){   // no tree at a turbine's foot, no house within the 500 m French law keeps between a turbine and a home
  for (const t of WIND) if ((t.x - x) ** 2 + (t.z - z) ** 2 < r * r) return false;
  return true;
}
