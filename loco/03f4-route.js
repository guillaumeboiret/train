
/* ============================================================ ROUTE ENGINE: the real Toulouse → Bordeaux → Paris line under the train
   The train stays at the scene origin facing +x; the world (terrain, tracks, stations, other trains) is placed around it
   in route coordinates (X east, Y up, Z south) and rotated by the inverse of the train's frame each frame. */
const _rt = new THREE.Vector3(), _ru = new THREE.Vector3(), _rm = new THREE.Matrix4();
const mkFrame = () => ({ p:new THREE.Vector3(), t:new THREE.Vector3(), r:new THREE.Vector3(), q:new THREE.Quaternion() });
const ROUTE = (() => {
  const D = ROUTE_DATA, L = D.L;
  const dec = s => { const b = Uint8Array.from(atob(s), c => c.charCodeAt(0)); return new Int16Array(b.buffer, b.byteOffset, b.length >> 1); };
  // polyline (Int16 deltas in dm): x east, y north → Three X = east, Z = -north
  const np = D.np, xyd = dec(D.xy), px = new Float64Array(np), pz = new Float64Array(np), ps = new Float64Array(np);
  { let cx = 0, cy = 0;
    for (let i = 0; i < np; i++){ cx += xyd[2 * i]; cy += xyd[2 * i + 1]; px[i] = cx / 10; pz[i] = -cy / 10; if (i) ps[i] = ps[i - 1] + Math.hypot(px[i] - px[i - 1], pz[i] - pz[i - 1]); }
    const k = L / ps[np - 1]; for (let i = 0; i < np; i++) ps[i] *= k; }
  // elevation profile every ES m (dm), Catmull-Rom
  const elev = dec(D.elev), ES = D.ES, NE = elev.length;
  const E = j => elev[Math.max(0, Math.min(NE - 1, j))] / 10;
  const elAt = s => {
    const f = Math.max(0, Math.min(NE - 1.001, s / ES)), i = Math.floor(f), t = f - i;
    const p0 = E(i - 1), p1 = E(i), p2 = E(i + 1), p3 = E(i + 2);
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  };
  // lateral terrain grid: a row every TS m, NW offsets (+w = right of travel), bilinear
  const ter = dec(D.ter), TS = D.TS, TW = D.TW, NW = TW.length, NR = Math.floor(ter.length / NW);
  const terAt = (s, w) => {
    const f = Math.max(0, Math.min(NR - 1.001, s / TS)), i = Math.floor(f), t = f - i;
    let j = 0; while (j < NW - 2 && TW[j + 1] < w) j++;
    const u = Math.max(0, Math.min(1, (w - TW[j]) / (TW[j + 1] - TW[j])));
    const a = ter[i * NW + j] * (1 - u) + ter[i * NW + j + 1] * u, b = ter[(i + 1) * NW + j] * (1 - u) + ter[(i + 1) * NW + j + 1] * u;
    return (a * (1 - t) + b * t) / 10;
  };
  // dense table every DS m
  const DS = 5, N = Math.floor(L / DS) + 1;
  const X = new Float64Array(N), Y = new Float64Array(N), Z = new Float64Array(N), TX = new Float32Array(N), TY = new Float32Array(N), TZ = new Float32Array(N);
  { let j = 0;
    for (let i = 0; i < N; i++){
      const s = i * DS; while (j < np - 2 && ps[j + 1] < s) j++;
      const t = Math.max(0, Math.min(1, (s - ps[j]) / ((ps[j + 1] - ps[j]) || 1)));
      X[i] = px[j] + (px[j + 1] - px[j]) * t; Z[i] = pz[j] + (pz[j + 1] - pz[j]) * t; Y[i] = elAt(s);
    } }
  const smooth = (A, K) => { const B = new Float64Array(A.length), n = A.length; let sum = 0; for (let i = -K; i <= K; i++) sum += A[Math.min(n - 1, Math.max(0, i))]; for (let i = 0; i < n; i++){ B[i] = sum / (2 * K + 1); sum += A[Math.min(n - 1, i + K + 1)] - A[Math.max(0, i - K)]; } A.set(B); };
  smooth(X, 8); smooth(X, 8); smooth(Z, 8); smooth(Z, 8);
  const sstep = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const idx = s => Math.max(0, Math.min(N - 1, Math.round(s / DS)));
  // stations: straight and level along the platform (chord of the real trace, 600 m ramps)
  const stations = D.stations.map(o => ({ ...o }));
  for (const st of stations){
    const sA = st.s - 460, sB = Math.min(L, st.s + 40), RAMP = 600, iA = idx(sA), iB = idx(sB);
    let ux = X[iB] - X[iA], uz = Z[iB] - Z[iA]; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    const ax = X[iA], az = Z[iA], y0 = Y[idx(st.s)];
    const i0 = Math.max(0, Math.floor((sA - RAMP) / DS)), i1 = Math.min(N - 1, Math.ceil((sB + RAMP) / DS));
    for (let i = i0; i <= i1; i++){
      const s = i * DS, u = s < sA ? sstep((s - (sA - RAMP)) / RAMP) : s > sB ? 1 - sstep((s - sB) / RAMP) : 1;
      const cx = ax + ux * (s - sA), cz = az + uz * (s - sA);
      X[i] += (cx - X[i]) * u; Z[i] += (cz - Z[i]) * u; Y[i] += (y0 - Y[i]) * u;
    }
  }
  for (let i = 0; i < N; i++){
    const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 2);
    const tx = X[b] - X[a], ty = Y[b] - Y[a], tz = Z[b] - Z[a], l = Math.hypot(tx, ty, tz) || 1;
    TX[i] = tx / l; TY[i] = ty / l; TZ[i] = tz / l;
  }
  // per-sample attributes: track count, line speed, structure kind, station weight
  const NT = new Uint8Array(N), VM = new Uint16Array(N), KD = new Uint8Array(N), SU = new Float32Array(N);
  { let j = 0; for (let i = 0; i < N; i++){ const s = i * DS; while (j < D.tracks.length - 1 && D.tracks[j + 1][0] <= s) j++; NT[i] = Math.max(2, Math.min(8, D.tracks[j][1])); } }
  { let j = 0; for (let i = 0; i < N; i++){ const s = i * DS; while (j < D.vmax.length - 1 && D.vmax[j + 1][0] <= s) j++; VM[i] = D.vmax[j][1]; } }
  const inStationZone = s => stations.some(st => s > st.s - 760 && s < st.s + 320);
  for (const [s0, s1, k] of D.structs){
    const kind = k === 'b' ? (s1 - s0 >= 550 ? 4 : 1) : k === 't' ? 2 : 3;   // 1 bridge, 4 bridge over water, 2 tunnel, 3 cutting
    for (let i = Math.max(0, Math.ceil(s0 / DS)); i <= Math.min(N - 1, Math.floor(s1 / DS)); i++) if (!inStationZone(i * DS)) KD[i] = kind;
  }
  // LGV stations (Futuroscope, Vendôme, Massy): two side platforms on loops off the through tracks. Ours (lane 0) and the other
  // direction's (lane 'C') swing out SD m over the station ramps while 'B' and 1 run straight through; SS marks the stretch
  const SIDE = { fut:-1, vdm:-1, msy:-1 }, SD = 6.25, SS = new Int8Array(N);
  for (const st of stations){
    st.side = SIDE[st.id] || 1;
    if (st.side > 0) continue;
    let i0 = idx(st.s - 870), i1 = idx(st.s + 470);   // the ramps plus the 200 m fade of any other lane; then the data's own station tracks
    while (i0 > 0 && NT[i0 - 1] > 2 && i0 > idx(st.s - 1500)) i0--;
    while (i1 < N - 1 && NT[i1 + 1] > 2 && i1 < idx(st.s + 1500)) i1++;
    for (let i = i0; i <= i1; i++){ NT[i] = 2; SS[i] = -1; }
  }
  // Bordeaux Saint-Jean: sixteen platform tracks (OSM), from voie 1 along the passenger building to voie 17 on the Belcier side. Lanes 2, 0, 'B', 1 and 3
  // are voies 3 to 7 (lane 3 set 6 m further out, for the island between 6 and 7); the other eleven are named lanes fanned out of lane 2 (west) and lane 3
  // (east) by one ladder per throat: a diagonal across the whole set, each track leaving it at its own offset. The data's 5 to 7 station tracks give way to them
  const SJ = stations.find(st => st.id === 'bdx'), LADDER = {}, SR = 1.5;
  const sramp = D => D <= 0 ? 0 : D < 2 * SR ? D * D / (4 * SR) : D - SR;   // max(D, 0) with a round corner: the turnout curve at each end of a diagonal
  if (SJ){
    for (let i = idx(SJ.s - 1510); i < idx(SJ.s + 390); i++) NT[i] = 4;
    for (const [base, side, xS, xN, mS, mN, tracks] of [[2, -1, -785, 130, 1 / 9, 1 / 6, [['v2', 11], ['v1', 14.5]]],   // x where each diagonal leaves its base lane, slopes
      [3, 1, -1100, 200, 1 / 9, 1 / 7, [['v8', 8.5], ['v9', 11.9], ['v11', 20.8], ['v12', 24.3], ['v14', 32.5], ['s1', 36.8], ['s2', 41.1], ['v16', 45.3], ['v17', 49.6]]]])
      tracks.forEach(([k, off], j) => { LADDER[k] = { base, side, off, par:j ? tracks[j - 1][1] : 0, xS, xN, mS, mN }; });   // off: from the base lane; par: the previous track's
  }
  const ladderD = (o, s) => { const x = s - SJ.s; return Math.min((x - o.xS) * o.mS, (o.xN - x) * o.mN); };   // how far the diagonals have crossed at s
  for (const st of stations){
    const c0 = st.s - 420, c1 = st.s + 20, R = 250;
    for (let i = Math.max(0, Math.floor((c0 - R) / DS)); i <= Math.min(N - 1, Math.ceil((c1 + R) / DS)); i++){
      const s = i * DS, u = s < c0 ? sstep((s - (c0 - R)) / R) : s > c1 ? 1 - sstep((s - c1) / R) : 1;
      if (u > SU[i]) SU[i] = u;
    }
    st.nLeft = Math.ceil(NT[idx(st.s)] / 2);
  }
  // a tunnel goes on into a station's zone as far as the station's own ground: its platforms' reach (SU) and side platforms' loops (SS). Angoulême's ends where the real one does
  for (const [s0, s1, k] of D.structs) if (k === 't')
    for (let i = Math.max(0, Math.ceil(s0 / DS)); i <= Math.min(N - 1, Math.floor(s1 / DS)); i++) if (SU[i] === 0 && !SS[i]) KD[i] = 2;
  const frameAt = (s, out) => {
    const f = Math.max(0, Math.min(N - 1.0001, s / DS)), i = Math.floor(f), t = f - i, i1 = Math.min(N - 1, i + 1);
    out.p.set(X[i] + (X[i1] - X[i]) * t, Y[i] + (Y[i1] - Y[i]) * t, Z[i] + (Z[i1] - Z[i]) * t);
    out.t.set(TX[i] + (TX[i1] - TX[i]) * t, TY[i] + (TY[i1] - TY[i]) * t, TZ[i] + (TZ[i1] - TZ[i]) * t).normalize();
    out.r.crossVectors(out.t, Y_UP).normalize();
    _ru.crossVectors(out.r, out.t);
    _rm.makeBasis(out.t, _ru, out.r); out.q.setFromRotationMatrix(_rm);
    return out;
  };
  const pointAt = (s, w, out) => {   // frameAt's p + r w without its turn: the point w m to the right of the line at s
    const f = Math.max(0, Math.min(N - 1.0001, s / DS)), i = Math.floor(f), t = f - i, i1 = Math.min(N - 1, i + 1);
    const tx = TX[i] + (TX[i1] - TX[i]) * t, tz = TZ[i] + (TZ[i1] - TZ[i]) * t, l = Math.hypot(tx, tz) || 1;
    return out.set(X[i] + (X[i1] - X[i]) * t - tz / l * w, Y[i] + (Y[i1] - Y[i]) * t, Z[i] + (Z[i1] - Z[i]) * t + tx / l * w);
  };
  const stationU = s => { const f = Math.max(0, Math.min(N - 1.0001, s / DS)), i = Math.floor(f), t = f - i; return SU[i] + (SU[Math.min(N - 1, i + 1)] - SU[i]) * t; };
  // lanes: 0 = ours (left, "voie 2"), 1 = opposite direction (right), 2k/2k+1 further out; 'B' = the other face of the island platform.
  // At side-platform stations 'B' is our direction's through track and 'C' the other direction's platform track.
  // Montparnasse gives every track a platform: lanes 4 and 6 step out 5.2 m for the island between 2 and 4, lanes 3 and 5 for the one between 1 and 3,
  // lane 7 twice for the one between 5 and 7 (the islands and lane 6's side platform are in the Paris landmark)
  const PAR = stations.find(st => st.id === 'par');
  const laneW = (k, s, u) => {
    if (u === undefined) u = stationU(s);
    const o = LADDER[k]; if (o){ const D = ladderD(o, s); return laneW(o.base, s, u) + o.side * (sramp(D) - sramp(D - o.off)); }
    if (SS[idx(s)] < 0){ if (k === 0) return -2.25 - SD * u; if (k === 'B') return -2.25; if (k === 'C') return 2.25 + SD * u; if (k === 1) return 2.25; }
    if (k === 'B') return 2.25 + 5.2 * u;
    if (k === 'C') return 2.25;
    if (k === 3 && SJ && Math.abs(s - SJ.s) < 1000) return 6.75 + 15.65 * u;
    const side = k % 2 ? 1 : -1, j = k >> 1, isl = PAR && Math.abs(s - PAR.s) < 1000 ? 5.2 * u * (side > 0 ? Math.ceil(j / 2) : Math.floor(j / 2)) : 0;
    return side * (2.25 + 4.5 * j + isl) + (side > 0 ? 9.65 * u : 0);
  };
  const laneE = (k, s) => {          // how much lane k exists here (fades in/out over 200 m where the track count changes)
    const o = LADDER[k]; if (o) return ladderD(o, s) > o.par ? 1 : 0;   // a ladder track is there once it has left the previous one's diagonal
    if (k === 'C') return SS[idx(s)] < 0 ? stationU(s) : 0;
    if (k === 'B') return stationU(s);
    if (k < 2) return 1;
    const i = idx(s); if (NT[i] <= k) return 0;
    for (let q = 1; q <= 40; q++){ const a = i - q, b = i + q; if ((a >= 0 && NT[a] <= k) || (b < N && NT[b] <= k)) return sstep(q / 40); }
    return 1;
  };
  const gradeAt = s => { const i = idx(s); return TY[i] / (Math.hypot(TX[i], TZ[i]) || 1); };
  const VOLT = D.volt || [[0, 25000]];   // electrification runs [from s, volts]: 1.5 kV DC on the classic lines, 25 kV AC on the LGV
  const voltAt = s => { let v = VOLT[0][1]; for (const [a, k] of VOLT){ if (a > s) break; v = k; } return v; };
  const lanes = [0, 1, 2, 3, 4, 5, 6, 7, 'B', 'C', ...Object.keys(LADDER)];
  const tracksAt = s => lanes.filter(k => laneE(k, s) > 0.5).length;   // the tracks drawn here, as the chunks lay them: a lane more than half there, the island's far face ('B') and the ladder tracks with them
  return { L, N, DS, X, Y, Z, NT, VM, KD, SU, SS, SD, stations, frameAt, pointAt, laneW, laneE, stationU, gradeAt, terAt, elAt, sstep, idx, voltAt, lanes, tracksAt,
    vmax:D.vmax, lineLimit: s => VM[idx(s)], kindAt: s => KD[idx(s)], altAt: s => Y[idx(s)], src:D.src, name:D.name };
})();

/* ---- world materials */
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0, side:THREE.DoubleSide });
themeMats.push({ mat:terrainMat, token:'--terrain' });
const treeCrownM = pmat(0x2f6b34, { roughness:0.9, metalness:0 }), treeTrunkM = pmat(0x5a3d26, { roughness:0.9, metalness:0 });
const houseWallM = pmat(0xe3ddd0, { roughness:0.9, metalness:0 }), houseRoofM = pmat(0x8a4a3a, { roughness:0.85, metalness:0 });
const bridgeM = pmat(0x9a9da1, { roughness:0.85, metalness:0.05 }), stopM = pmat(0x8a1f1f, { roughness:0.7, metalness:0.1 });
const tunnelM = new THREE.MeshStandardMaterial({ color:0x6f7276, emissive:0x45484c, emissiveIntensity:1, roughness:1, side:THREE.DoubleSide });   // self-lit a little: the inside of a tube never sees the sun
const portalM = new THREE.MeshStandardMaterial({ color:0x8e8f8b, roughness:0.95, side:THREE.DoubleSide });
const WALL_COL = [0.66, 0.65, 0.62], FLOOR_COL = [0.48, 0.47, 0.44];   // concrete retaining walls of a station trench, its floor under a slab (no grass in the dark)
const lampM = new THREE.MeshStandardMaterial({ color:0xfff1c0, emissive:0xffe9a0, emissiveIntensity:1.4, roughness:0.5 });
const dropperM = new THREE.LineBasicMaterial({ color:pal.cat });
{ // ballast: speckle texture repeated along the strip
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 3000; i++){ const v = 110 + Math.floor(Math.random() * 145); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  ballastMat.map = tex; ballastMat.needsUpdate = true;
}

/* ---- geometry accumulator: indexed strips swept along the route */
class GeoAcc {
  constructor(uv){ this.pos = []; this.idx = []; this.uv = uv ? [] : null; }
  strip(count, np, closed, pointFn){          // pointFn(i, k) → [x, y, z] (+ [u, v] when uv)
    const base = this.pos.length / 3;
    for (let i = 0; i < count; i++) for (let k = 0; k < np; k++){ const p = pointFn(i, k); this.pos.push(p[0], p[1], p[2]); if (this.uv) this.uv.push(p[3] || 0, p[4] || 0); }
    const nk = closed ? np : np - 1;
    for (let i = 0; i < count - 1; i++) for (let k = 0; k < nk; k++){
      const k1 = (k + 1) % np, a = base + i * np + k, b = base + i * np + k1, c = base + (i + 1) * np + k1, d = base + (i + 1) * np + k;
      this.idx.push(a, b, c, a, c, d);
    }
  }
  build(){
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx); g.computeVertexNormals(); return g;
  }
}
const RAIL_PROF = [[-0.035, 0], [0.035, 0], [0.035, -0.11], [0.08, -0.13], [0.08, -0.16], [-0.08, -0.16], [-0.08, -0.13], [-0.035, -0.11]];
const TERR_D = [0, 4, 9, 16, 26, 40, 60, 90, 130, 190, 270, 380, 540, 750, 1000];
const LAND_COL = [[0.86, 0.76, 0.40], [0.55, 0.70, 0.36], [0.28, 0.46, 0.24], [0.55, 0.42, 0.30], [0.66, 0.63, 0.58]];   // crop, grass, forest, ploughed, village
const WATER_COL = [0.30, 0.47, 0.62], VERGE_COL = [0.47, 0.58, 0.33];
function hash2(a, b, c = 0){ let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0; h = ((h ^ (h >>> 13)) * 1274126177) | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function landType(x, z){ const h = hash2(Math.floor(x / 120), Math.floor(z / 120)); return h < 0.35 ? 0 : h < 0.65 ? 1 : h < 0.8 ? 2 : h < 0.9 ? 3 : 4; }
function laneWAt(k, s){ const u = ROUTE.stationU(s), w = ROUTE.laneW(k, s, u); if (typeof k === 'string' || k < 2) return w; const w0 = ROUTE.laneW(k - 2, s, u); return w0 + (w - w0) * ROUTE.laneE(k, s); }

/* ---- city approaches: the towns the line stops in (not Futuroscope and Vendôme, out in the fields), Massy's Atlantis district and the last
   kilometres into Paris get urban blocks, boundary walls and road bridges */
const CITY_HALF = { mtb:1500, agn:1500, lbn:1200, ang:1500, pts:2000, chl:1200, spc:2500 };   // half length of the dense core around the station (m)
const CITY_KEY = { mtb:'tls', agn:'tls', lbn:'bdx', ang:'bdx', pts:'bdx', chl:'loire', spc:'loire' };
const CITY_Z = ROUTE.stations.flatMap(st => {   // dense from a to b, fading over fa before and fb after; key = building style: brick south (Toulouse's),
  const s = st.s, L = ROUTE.L, h = CITY_HALF[st.id];   // limestone and Roman tiles (Bordeaux's), white tufa and slate (the Loire's, north of Poitiers)
  return st.id === 'tls' ? [{ key:'tls', a:-1, b:s + 3500, fa:0, fb:2500 }]
    : st.id === 'bdx' ? [{ key:'bdx', a:s - 3500, b:s + 1690, fa:2500, fb:1900 }]
    : st.id === 'par' ? [{ key:'par', a:L - 5500, b:L + 1, fa:3500, fb:0 }]
    : st.id === 'msy' ? [{ key:'par', a:s - 2000, b:s + 5000, fa:1500, fb:1500 }]
    : h ? [{ key:CITY_KEY[st.id], a:s - h, b:s + h, fa:1500, fb:1500 }] : [];
});
const cityAt = s => {   // 0 countryside .. 1 dense city
  let v = 0;
  for (const z of CITY_Z){ const u = s < z.a ? (z.fa ? 1 - ROUTE.sstep((z.a - s) / z.fa) : 0) : s > z.b ? (z.fb ? 1 - ROUTE.sstep((s - z.b) / z.fb) : 0) : 1; if (u > v) v = u; }
  return v;
};
const cityKeyAt = s => { let key = 'par', bd = Infinity; for (const z of CITY_Z){ const d = Math.max(z.a - s, s - z.b, 0); if (d < bd){ bd = d; key = z.key; } } return key; };
const URBAN_COL = { tls:[0.71, 0.60, 0.54], bdx:[0.70, 0.64, 0.55], loire:[0.68, 0.66, 0.61], par:[0.62, 0.60, 0.56] };
const winTex = (() => {   // one window bay per tile: 3.2 m wide, 3 m high; the material colour tints the wall around it
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#c9c4bb'; g.fillRect(40, 20, 48, 78);
  g.fillStyle = '#39424d'; g.fillRect(44, 24, 40, 70);
  g.fillStyle = '#5d6b7a'; g.fillRect(46, 26, 16, 30);
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
})();
const cityWallM = { tls:pmat(0xd49a80, { map:winTex, roughness:0.9, metalness:0, side:THREE.DoubleSide }), bdx:pmat(0xe0d6c4, { map:winTex, roughness:0.9, metalness:0, side:THREE.DoubleSide }), loire:pmat(0xebe5d6, { map:winTex, roughness:0.9, metalness:0, side:THREE.DoubleSide }), par:pmat(0xd6d0c8, { map:winTex, roughness:0.9, metalness:0, side:THREE.DoubleSide }) };
const cityRoofM = { tls:pmat(0xa9573b, { roughness:0.9, metalness:0, side:THREE.DoubleSide }), bdx:pmat(0x9b5b3d, { roughness:0.9, metalness:0, side:THREE.DoubleSide }), loire:pmat(0x4b525c, { roughness:0.75, metalness:0.05, side:THREE.DoubleSide }), par:pmat(0x6a7079, { roughness:0.7, metalness:0.15, side:THREE.DoubleSide }) };
const wallM = pmat(0x8f8a82, { roughness:0.95, metalness:0 }), asphaltM = pmat(0x3a3c40, { roughness:0.95, metalness:0 });
/* a building: four textured facades + a roof frustum (mansard in Paris, hip elsewhere); yaw aligns its length with the track */
function cityBox(walls, roofs, cx, cy, cz, w, h, d, yaw, roofH, inset){
  const c = Math.cos(yaw), s = Math.sin(yaw), hw = w / 2, hd = d / 2;
  const W = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
  const face = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0); walls.strip(2, 2, false, (i, k) => { const p = W(k ? x1 : x0, i ? h : 0, k ? z1 : z0); p.push(k ? len / 3.2 : 0, i ? h / 3 : 0); return p; }); };
  face(-hw, -hd, hw, -hd); face(hw, -hd, hw, hd); face(hw, hd, -hw, hd); face(-hw, hd, -hw, -hd);
  const iw = Math.max(0.5, hw - inset), id = Math.max(0.5, hd - inset);
  const ring = (rw, rd, y) => [[-rw, -rd], [rw, -rd], [rw, rd], [-rw, rd]].map(([x, z]) => W(x, y, z));
  const lo = ring(hw, hd, h), hi = ring(iw, id, h + roofH);
  roofs.strip(2, 5, false, (i, k) => (i ? hi : lo)[k % 4]);
  roofs.strip(2, 2, false, (i, k) => hi[i ? 3 - k : k]);
}
/* keep the generated scenery off the station models: s from/to relative to the station, w from/to, and how far the ground sinks away from the tracks
   (Toulouse: the forecourt, the boulevard and the Canal du Midi on the left stand on their own slabs, the sunk ground keeps the water clear of the relief;
   Massy: a negative sink, the ground is the street level 8.5 m above the trench floor) */
const LM_BOX = { tls:[-560, 210, -215, 40, 1.6], bdx:[-480, 60, -70, 70], par:[-420, 500, -150, 150], msy:[-620, 140, -175, 255, -8.5] };
const LM_ZONES = ROUTE.stations.filter(st => LM_BOX[st.id]).map(st => { const b = LM_BOX[st.id]; return [st.s + b[0], st.s + b[1], b[2], b[3], b[4] || 0]; });
LM_ZONES.push([0, 100, -760, 760, 0]);   // the last 100 m before the Toulouse buffer stop, where the static city behind it begins
const landmarkZone = (s, w) => LM_ZONES.some(z => s > z[0] && s < z[1] && w > z[2] && w < z[3]);
/* the relief t under a landmark zone: flat at track level yF minus its sink (the models stand on it: west of Matabiau the smoothed DEM rose 16 m),
   back to the DEM over LM_FLAT metres; the terrain shape still starts at yF on the ballast edge */
const LM_FLAT = 150;
const landmarkGround = (s, w, yF, t) => {
  let v = 0, sink = 0;
  for (const z of LM_ZONES){ const d = Math.hypot(Math.max(z[0] - s, s - z[1], 0), Math.max(z[2] - w, w - z[3], 0)); if (d < LM_FLAT){ const k = 1 - ROUTE.sstep(d / LM_FLAT); if (k > v){ v = k; sink = z[4]; } } }
  return t + (yF - sink - t) * v;
};
/* stations dug below the surrounding ground: [depth (m), floor width beyond the ballast edge, from, to relative to the station, both ends ramped over 60 m].
   Massy TGV really sits in a trench between two tunnels, under its hall, bus station and car park (the smoothed relief is flat there) */
const TRENCH = { msy:[8.5, 5, -700, 130] };
const TRENCH_Z = ROUTE.stations.filter(st => TRENCH[st.id]).map(st => { const T = TRENCH[st.id]; return { a:st.s + T[2], b:st.s + T[3], depth:T[0], F:T[1] }; });
const trenchAt = s => { for (const z of TRENCH_Z){ const w = Math.min(ROUTE.sstep((s - z.a) / 60), ROUTE.sstep((z.b - s) / 60)); if (w > 0) return { tz:z.depth * w, F:z.F }; } return null; };
/* slabs and sheds over a station's tracks (x from, to, z from, to in station coordinates): no catenary masts for the tracks under them, the wires hang
   from the soffit or the roof. A slab (Massy's, Montparnasse's garden) also keeps the floor under it bare; Saint-Jean's 1898 shed covers voies 1 to 7 */
const STATION_DECK = { msy:[-510, -68, -14, 31], par:[-366, -8, -62, 62] }, STATION_SHED = { bdx:[-403, -104, -29.3, 31.8] };
const roofZones = o => ROUTE.stations.filter(st => o[st.id]).map(st => { const r = o[st.id], w0 = ROUTE.laneW(0, st.s, 1); return [st.s + r[0], st.s + r[1], w0 + r[2], w0 + r[3]]; });
const DECK_Z = roofZones(STATION_DECK), ROOF_Z = DECK_Z.concat(roofZones(STATION_SHED));
const underDeck = s => DECK_Z.some(z => s > z[0] && s < z[1]);
const roofAt = s => ROOF_Z.find(z => s > z[0] && s < z[1]) || null;
const NO_WALL_AT = { tls:[-Infinity, 350], mtb:[-800, 350], agn:[-800, 350], bdx:[-800, 350], lbn:[-800, 350], ang:[-800, 350], pts:[-800, 350], chl:[-800, 350], spc:[-800, 350], par:[-500, Infinity], msy:[-800, 400] };   // no boundary wall between a station building and its tracks
const NO_WALL = ROUTE.stations.filter(st => NO_WALL_AT[st.id]).map(st => [st.s + NO_WALL_AT[st.id][0], st.s + NO_WALL_AT[st.id][1]]);
const paveM = pmat(0x9b968e, { roughness:0.95, metalness:0 });
/* the city behind each terminus, in station coordinates: the route data ends at the buffer stops, so these blocks are static and only shown with the landmark.
   opts: cell pitch cx/cz, street width, ground level y, pave (false: the blocks stand on a landmark's own ground) */
function terminusCity(key, G, x0, x1, z0, z1, keepOut, opts = {}){
  if (!G) return 0;
  const par = key === 'par', walls = new GeoAcc(true), roofs = new GeoAcc(false);
  const cx = opts.cx || (par ? 44 : 34), cz = opts.cz || (par ? 62 : 44), street = opts.street || (par ? 15 : 11), y0 = opts.y !== undefined ? opts.y : -0.3;
  let n = 0;
  for (let x = x0; x + cx <= x1; x += cx) for (let z = z0; z + cz <= z1; z += cz){
    const bx = x + cx / 2, bz = z + cz / 2;
    if (keepOut.some(k => bx > k[0] - cx / 2 && bx < k[1] + cx / 2 && bz > k[2] - cz / 2 && bz < k[3] + cz / 2)) continue;
    const h1 = hash2(Math.round(x), Math.round(z), 91), h2 = hash2(Math.round(x), Math.round(z), 93);
    if (h1 < 0.08) continue;   // a square or a car park now and then
    const h = par ? (h2 < 0.04 ? 30 + 20 * h1 : 15 + 9 * h1) : 5 + 7 * h1;
    cityBox(walls, roofs, bx, y0, bz, cx - street, h, cz - street, 0, par ? 3.0 : 1.8, par ? 1.2 : 2.2); n++;
  }
  const wm = new THREE.Mesh(walls.build(), cityWallM[key]), rm = new THREE.Mesh(roofs.build(), cityRoofM[key]);
  wm.receiveShadow = rm.receiveShadow = true; G.add(wm, rm);
  if (opts.pave !== false){ const gm = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), paveM); gm.rotation.x = -Math.PI / 2; gm.position.set((x0 + x1) / 2, y0 - 0.06, (z0 + z1) / 2); gm.receiveShadow = true; G.add(gm); }
  return n;
}
terminusCity('par', landmarks.par, 70, 1350, -760, 760, [[100, 150, 44, 112]]);   // tower footprint kept clear
// Toulouse: the data runs on 1.2 km past Matabiau and curves 56 m east to a buffer stop, so the city beyond it lives in a group posed at s = 0;
// around the station the blocks stand on the landmark's forecourt and on the far bank of the canal
{ const st = ROUTE.stations.find(q => q.id === 'tls'), f0 = mkFrame(), f1 = mkFrame(), g = new THREE.Group(), w0 = ROUTE.laneW(0, st.s, 1);
  ROUTE.frameAt(st.s, f0); ROUTE.frameAt(0, f1); const qi = f0.q.clone().invert();
  g.position.copy(f1.p).addScaledVector(f1.r, w0).sub(f0.p.clone().addScaledVector(f0.r, w0)).applyQuaternion(qi);
  g.quaternion.copy(qi).multiply(f1.q); landmarks.tls.add(g);
  terminusCity('tls', g, -1400, 0, -760, 760, []);
  terminusCity('tls', landmarks.tls, -540, 190, -205, -115, [], { cz:45, y:0.5, pave:false });
  terminusCity('tls', landmarks.tls, -540, -330, -56, -22, [], { cz:34, y:0.5, pave:false });
  terminusCity('tls', landmarks.tls, -80, 190, -56, -22, [], { cz:34, y:0.5, pave:false }); }
// Massy: the Atlantis towers north of the forecourt, the RER B building and the workshops south of the tracks (OSM footprints and levels) on the
// street level 8.5 m above the trench floor, their window rows starting at it; filler blocks around them, clear of the camera views over the forecourt
{ const G = landmarks.msy, walls = new GeoAcc(true), roofs = new GeoAcc(false), shed = new GeoAcc(true), shedRoofs = new GeoAcc(false), YS = 8.08, Y0 = YS - 12;
  for (const [x0, x1, z0, z1, lv] of [[-484, -458, 73, 103, 12], [-447, -403, 69, 100, 10], [-452, -408, 102, 135, 10], [-489, -461, 108, 153, 14], [-458, -437, 137, 161, 9],
    [-433, -415, 138, 169, 8], [-489, -445, 173, 259, 16], [-515, -497, 63, 88, 10], [-385, -321, 74, 95.5, 7], [-320, -268, 74, 126.5, 5], [-326, -279, 128, 163, 4],
    [-395, -375, 97, 119, 5], [-350, -334, 97, 138, 6], [-410, -340, 131, 201, 5], [-580, -530, 67, 82, 8], [-526, -502, 31, 40, 3], [-286, -234, -44, -31, 3], [-326, -303, -42.5, -33.5, 2]])
    cityBox(walls, roofs, (x0 + x1) / 2, Y0, (z0 + z1) / 2, x1 - x0, YS + 3 * lv + 3 - Y0, z1 - z0, 0, 0.8, 0.4);
  cityBox(shed, shedRoofs, -236.5, Y0, -109, 217, YS + 12 - Y0, 74, 0, 1.2, 3);
  const add = (acc, m) => { const o = new THREE.Mesh(acc.build(), m); o.receiveShadow = true; G.add(o); };
  add(walls, cityWallM.par); add(roofs, cityRoofM.par); add(shed, pmat(0xbdb9b0, { roughness:0.9, metalness:0, side:THREE.DoubleSide })); add(shedRoofs, cityRoofM.par);
  terminusCity('par', G, -250, 140, 31, 263, [[-120, 100, 25, 100]], { y:7.8, pave:false });
  terminusCity('par', G, -620, 140, -166, -14, [[-495, -360, -50, -14], [-345, -128, -146, -72], [-326, -234, -44.5, -31]], { y:7.8, pave:false });
  terminusCity('par', G, -620, -495, 90, 263, [], { y:7.8, pave:false }); }

/* ---- chunks: 1 km of track, ballast, sleepers, catenary, terrain, trees, houses, bridges and tunnels, built on demand */
const CH = 1000, chunks = new Map(), LANES = ROUTE.lanes;
const _cf = mkFrame(), _cm = new THREE.Matrix4(), _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cs = new THREE.Vector3(1, 1, 1), X_AX = new THREE.Vector3(1, 0, 0);
function instanced(geo, mat, mats, parent, shadow){
  if (!mats.length) return null;
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
  if (shadow){ im.castShadow = true; im.receiveShadow = true; }
  parent.add(im); return im;
}
const GEO = {
  sleeper: new THREE.BoxGeometry(0.26, 0.12, 2.5).translate(0, -0.22, 0),
  mast: new THREE.BoxGeometry(0.3, 7.4, 0.3).translate(0, 3.7, 0),
  found: new THREE.BoxGeometry(0.8, 0.2, 0.8).translate(0, 0.05, 0),
  arm: new THREE.BoxGeometry(0.1, 0.1, 1),
  beam: new THREE.BoxGeometry(0.16, 0.3, 1),
  crown: new THREE.ConeGeometry(2.4, 6, 7).translate(0, 5, 0),
  trunk: new THREE.CylinderGeometry(0.22, 0.32, 2.2, 6).translate(0, 1.1, 0),
  house: new THREE.BoxGeometry(9, 4, 7).translate(0, 2, 0),
  roof: new THREE.ConeGeometry(6.4, 2.8, 4).rotateY(Math.PI / 4).translate(0, 5.4, 0),
  pier: new THREE.BoxGeometry(1, 1, 1),
  lamp: new THREE.BoxGeometry(0.25, 0.12, 0.6),
  stop: new THREE.BoxGeometry(0.5, 1.1, 2.8).translate(0, 0.55, 0),
};
function buildChunk(ci){
  const s0 = ci * CH, s1 = Math.min(ROUTE.L, s0 + CH), DS = ROUTE.DS, n = Math.round((s1 - s0) / DS) + 1;
  const org = mkFrame(); ROUTE.frameAt(Math.min(ROUTE.L, s0 + 500), org); const O = org.p.clone();
  const g = new THREE.Group(), cat = new THREE.Group(); g.add(cat);
  const ch = { ci, group:g, cat, origin:O, geos:[], s0, s1 };
  const frameFor = s => {
    const f = mkFrame(); ROUTE.frameAt(Math.max(0, Math.min(ROUTE.L, s)), f); f.p.sub(O);
    f.s = s; f.u = ROUTE.stationU(s); f.up = new THREE.Vector3().crossVectors(f.r, f.t); f.kind = ROUTE.kindAt(s); f.yAbs = f.p.y + O.y;
    return f;
  };
  const SM = [];
  for (let i = 0; i < n; i++) SM.push(frameFor(Math.min(s1, s0 + i * DS)));
  const kAt = i => i >= 0 && i < n ? SM[i].kind : ROUTE.kindAt(Math.max(0, Math.min(ROUTE.L, s0 + i * DS)));
  const tubeR = i => Math.max(6.6, (wMax[i] - wMin[i]) / 2 + 4.6);
  const portals = [];   // [s, +1 when the tunnel lies toward +s]: the tube mouths of this chunk (the lining runs one sample past the tagged tunnel)
  for (let i = -1; i <= n; i++){
    if (kAt(i) !== 2) continue;
    const s = s0 + i * DS;
    if (kAt(i - 1) !== 2 && s - DS >= s0 - 1e-6 && s - DS <= s1 + 1e-6) portals.push([s - DS, 1]);
    if (kAt(i + 1) !== 2 && s + DS >= s0 - 1e-6 && s + DS <= s1 + 1e-6) portals.push([s + DS, -1]);
  }
  const P = (f, a, b) => [f.p.x + f.r.x * a + f.up.x * b, f.p.y + f.r.y * a + f.up.y * b, f.p.z + f.r.z * a + f.up.z * b];
  // lanes present at each sample
  const lanes = LANES.map(k => { const w = new Float64Array(n), e = new Float64Array(n); for (let i = 0; i < n; i++){ e[i] = ROUTE.laneE(k, SM[i].s); w[i] = laneWAt(k, SM[i].s); } return { k, w, e }; });
  const wMin = new Float64Array(n), wMax = new Float64Array(n);
  for (let i = 0; i < n; i++){ let a = 1e9, b = -1e9; for (const ln of lanes) if (ln.e[i] > 0.05){ a = Math.min(a, ln.w[i]); b = Math.max(b, ln.w[i]); } wMin[i] = a; wMax[i] = b; }
  const addMesh = (geo, mat, parent = g, shadow = false) => { ch.geos.push(geo); const m = new THREE.Mesh(geo, mat); if (shadow){ m.castShadow = true; m.receiveShadow = true; } parent.add(m); return m; };
  // rails: closed profile swept per run of each lane
  { const acc = new GeoAcc(false);
    for (const ln of lanes){
      let i = 0;
      while (i < n){
        while (i < n && ln.e[i] <= 0.05) i++;
        let j = i; while (j < n && ln.e[j] > 0.05) j++;
        if (j - i >= 2) for (const side of [-0.75, 0.75]) acc.strip(j - i, RAIL_PROF.length, true, (q, k) => P(SM[i + q], ln.w[i + q] + side + RAIL_PROF[k][0], RAIL_PROF[k][1]));
        i = j;
      }
    }
    const m = addMesh(acc.build(), railMat); m.receiveShadow = true;
  }
  // ballast strip under the whole bundle
  { const acc = new GeoAcc(true), prof = i => [[wMin[i] - 3.4, -0.42], [wMin[i] - 2.2, -0.21], [wMax[i] + 2.2, -0.21], [wMax[i] + 3.4, -0.42]];
    acc.strip(n, 4, false, (i, k) => { const pr = prof(i)[k], p = P(SM[i], pr[0], pr[1]); p.push(SM[i].s / 2, k / 3); return p; });
    addMesh(acc.build(), ballastMat).receiveShadow = true;
  }
  // sleepers every 0.6 m on each lane that is really there
  { const mats = [];
    for (const ln of lanes){
      if (!ln.e.some(v => v > 0.5)) continue;
      for (let s = Math.ceil(s0 / 0.6) * 0.6; s < s1; s += 0.6){
        const i = Math.min(n - 1, Math.round((s - s0) / DS)); if (ln.e[i] <= 0.5) continue;
        ROUTE.frameAt(s, _cf); _cp.copy(_cf.p).sub(O).addScaledVector(_cf.r, laneWAt(ln.k, s));
        mats.push(new THREE.Matrix4().compose(_cp, _cf.q, _cs));
      }
    }
    const im = instanced(GEO.sleeper, sleeperMat, mats, g, false); if (im) im.receiveShadow = true;
  }
  // catenary: 54 m spans on a global grid, contact wire staggered ±0.2 m, messenger wire, droppers, masts, cantilevers or crossbeams.
  // 1.5 kV DC (the classic lines, the last 7 km into Paris): twin contact wires for the heavier current, lattice portals over the whole bundle
  { const wire = new GeoAcc(false), drop = [], mastM = [], armM = [], beamM = [], lacM = [];
    const SPAN = 54, m0 = Math.ceil(s0 / SPAN), m1 = Math.floor((s1 - 0.01) / SPAN);
    const pt = (s, w, y, out) => { ROUTE.frameAt(Math.min(ROUTE.L, s), _cf); out.copy(_cf.p).sub(O).addScaledVector(_cf.r, w); out.addScaledVector(_ru.crossVectors(_cf.r, _cf.t), y); return out; };
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    for (let m = m0; m <= m1; m++){
      const sm = m * SPAN, i = Math.min(n - 1, Math.round((sm - s0) / DS));
      const present = lanes.filter(ln => ln.e[i] > 0.5 && ROUTE.laneE(ln.k, Math.min(ROUTE.L, sm + SPAN)) > 0.5);
      if (!present.length) continue;
      const zig = m % 2 ? 0.2 : -0.2, dc = ROUTE.voltAt(sm) < 3000;
      for (const ln of present){
        const pts = [];
        for (let j = 0; j <= 9; j++){
          const s = Math.min(ROUTE.L, sm + SPAN * j / 9), w = laneWAt(ln.k, s), tt = j / 9;
          const c = pt(s, w + zig * (1 - 2 * tt), 5.55, new THREE.Vector3()), me = pt(s, w, 6.15 + 0.6 * (2 * tt - 1) * (2 * tt - 1), new THREE.Vector3());
          ROUTE.frameAt(s, _cf); const up = new THREE.Vector3().crossVectors(_cf.r, _cf.t), r = _cf.r.clone();
          pts.push({ c, me, up, r });
          if (j > 0 && j < 9) drop.push(me.x, me.y, me.z, c.x, c.y, c.z);
        }
        for (const [key, hw, dw] of dc ? [['c', 0.03, -0.06], ['c', 0.03, 0.06], ['me', 0.025, 0]] : [['c', 0.03, 0], ['me', 0.025, 0]]){
          wire.strip(pts.length, 2, false, (j, k) => { const q = pts[j], v = tmpA.copy(q[key]).addScaledVector(q.r, dw + (k ? hw : -hw)); return [v.x, v.y, v.z]; });
          wire.strip(pts.length, 2, false, (j, k) => { const q = pts[j], v = tmpA.copy(q[key]).addScaledVector(q.r, dw).addScaledVector(q.up, k ? hw : -hw); return [v.x, v.y, v.z]; });
        }
      }
      // supports at this mast position, for the tracks out in the open: in a tunnel, under a station slab or shed the wires hang from the lining or the roof
      const roof = roofAt(sm), sup = roof ? present.filter(ln => ln.w[i] < roof[2] || ln.w[i] > roof[3]) : present;
      if (ROUTE.kindAt(sm) === 2 || !sup.length) continue;
      let a = 1e9, b = -1e9; for (const ln of sup){ a = Math.min(a, ln.w[i]); b = Math.max(b, ln.w[i]); }
      const back = ROUTE.stations.some(st => (st.side < 0 || st.id === 'par') && sm > st.s - 405 && sm < st.s + 5) ? 7.9 : 3.4;   // side platforms (Montparnasse's outer one too): masts at their back edges
      ROUTE.frameAt(sm, _cf); const wl = a - back, wr = b + back;
      for (const wm of [wl, wr]){ _cp.copy(_cf.p).sub(O).addScaledVector(_cf.r, wm); mastM.push(new THREE.Matrix4().compose(_cp, _cf.q, tmpB.set(1, dc ? 1.1 : 1, 1))); }
      if (dc){   // portal: the crossbeam as lower chord, an upper chord at 7.95 m on masts raised to 8.1 m, Warren lacing between them
        const up = _ru.crossVectors(_cf.r, _cf.t).clone(), nL = Math.max(2, Math.round((wr - wl) / 1.6)), dl = (wr - wl) / nL, ang = Math.atan2(0.65, dl), len = Math.hypot(0.65, dl);
        _cp.copy(_cf.p).sub(O).addScaledVector(_cf.r, (wl + wr) / 2).addScaledVector(up, 7.95);
        beamM.push(new THREE.Matrix4().compose(_cp, _cf.q, tmpB.set(1, 0.6, wr - wl)));
        for (let q = 0; q < nL; q++){
          _cp.copy(_cf.p).sub(O).addScaledVector(_cf.r, wl + dl * (q + 0.5)).addScaledVector(up, 7.625);
          _cq.setFromAxisAngle(X_AX, q % 2 ? ang : -ang).premultiply(_cf.q);
          lacM.push(new THREE.Matrix4().compose(_cp, _cq, tmpB.set(1, 1, len)));
        }
      }
      if (sup.length <= 2 && !dc){
        for (const ln of sup){ const wm = ln.w[i] < (a + b) / 2 || sup.length === 1 ? wl : wr, len = Math.abs(ln.w[i] - wm);
          _cp.copy(_cf.p).sub(O).addScaledVector(_cf.r, (ln.w[i] + wm) / 2); _cp.addScaledVector(_ru.crossVectors(_cf.r, _cf.t), 6.75);
          armM.push(new THREE.Matrix4().compose(_cp, _cf.q, tmpB.set(1, 1, len))); }
      } else {
        _cp.copy(_cf.p).sub(O).addScaledVector(_cf.r, (wl + wr) / 2); _cp.addScaledVector(_ru.crossVectors(_cf.r, _cf.t), 7.3);
        beamM.push(new THREE.Matrix4().compose(_cp, _cf.q, tmpB.set(1, 1, wr - wl)));
        for (const ln of sup){ _cp.copy(_cf.p).sub(O).addScaledVector(_cf.r, ln.w[i]); _cp.addScaledVector(_ru.crossVectors(_cf.r, _cf.t), 6.95); armM.push(new THREE.Matrix4().compose(_cp, _cf.q, tmpB.set(1, 4, 0.6))); }
      }
    }
    if (wire.pos.length){ const m = addMesh(wire.build(), catWireM, cat); m.userData.partId = 'catenary'; }
    if (drop.length){ const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(drop, 3)); ch.geos.push(dg); cat.add(new THREE.LineSegments(dg, dropperM)); }
    for (const [geo, mats, mat] of [[GEO.mast, mastM, catMastM], [GEO.found, mastM, catMastM], [GEO.arm, armM, catMastM], [GEO.beam, beamM, catMastM], [GEO.arm, lacM, catMastM]]){ const im = instanced(geo, mat, mats, cat, false); if (im){ im.userData.partId = 'catenary'; im.castShadow = true; } }
  }
  // terrain ribbon: rows every 10 m, 15 offsets per side; flat colour per quad from a 120 m land-use hash; real relief shaped by the structure:
  // open line blended to track level over 60 m (cuttings 25 m), bridges keep the ground under the deck, tunnels get a cover above the arch,
  // each tube mouth a pair of rows with a hole for the portal, stations dug into the ground (Massy) a trench with concrete walls
  { const ROW = 2, rows = [], NTD = TERR_D.length;
    const portalNear = (s, kind) => {          // 0..1: how close an open row is to a tube mouth (the ground rises to bury the tube)
      if (kind === 2) return 0;
      let best = 1e9;
      for (let k = 1; k <= 9; k++){ if (ROUTE.kindAt(Math.min(ROUTE.L, s + DS * k)) === 2){ best = Math.min(best, DS * (k - 1)); break; } }
      for (let k = 1; k <= 9; k++){ if (ROUTE.kindAt(Math.max(0, s - DS * k)) === 2){ best = Math.min(best, DS * (k - 1)); break; } }
      return best > 45 ? 0 : ROUTE.sstep(1 - best / 45);
    };
    const mkRow = (f, i, kind, mouth = false) => {
      const yF = f.yAbs - 0.42, a = wMin[i] - 3.4, b = wMax[i] + 3.4, crown = f.yAbs + 0.3 + tubeR(i) + 1.5;
      const head = mouth ? f.yAbs + 0.3 + tubeR(i) + 2.5 : 1e9;   // just inside a mouth the ground over the tube meets the top of the portal collar, never above it
      let yW = -1e9; if (kind === 4){ yW = 1e9; for (let w = -400; w <= 400; w += 50) yW = Math.min(yW, ROUTE.terAt(f.s, w)); yW += 1.2; }
      const pd = portalNear(f.s, kind), tr = kind === 0 && !pd ? trenchAt(f.s) : null, tz = tr ? tr.tz : 0, tF = tr ? tr.F : 0;
      const cover = (t, d) => { const cov = Math.max(t, crown); if (d <= 4) return cov; const bl = Math.min(60, Math.max(22, 1.5 * (cov - t))); return cov + (t - cov) * ROUTE.sstep((d - 4) / bl); };
      const shape = (t, d) => {
        if (kind === 2) return cover(t, d);
        if (kind === 1 || kind === 4){ const cap = Math.min(t, yF - 2.5); return d <= 9 ? cap : cap + (t - cap) * ROUTE.sstep((d - 9) / 31); }
        if (tz > 0){ if (d <= tF) return yF; const top = Math.max(t, yF + tz); return top + (t - top) * ROUTE.sstep((d - tF) / 104); }
        let y = yF + (t - yF) * ROUTE.sstep(d / (kind === 3 ? 25 : 60));
        if (pd > 0 && d > 4) y += (cover(t, d) - y) * pd * ROUTE.sstep((d - 4) / 12);
        return y;
      };
      const vert = (w, d) => {
        const t0 = ROUTE.terAt(f.s, w), wet = kind === 4 && Math.abs(w) <= 400 && t0 < yW, t = landmarkGround(f.s, w, yF, wet ? yW : t0);
        return [f.p.x + f.r.x * w, (d <= 4 ? Math.min(head, shape(t, d)) : shape(t, d)) - O.y, f.p.z + f.r.z * w, w, d, wet ? 1 : 0];
      };
      const cW = tz > 0 ? TERR_D.findIndex(v => v >= tF) : -9;   // trench: that column moves to the foot of the wall, the next one to its top
      const dOf = c => c === cW ? tF : c === cW + 1 ? tF + 0.01 : TERR_D[c];
      const v = [];
      for (let c = NTD - 1; c >= 0; c--) v.push(vert(a - dOf(c), dOf(c)));
      v.push(vert((wMin[i] + wMax[i]) / 2, 0));
      for (let c = 0; c < NTD; c++) v.push(vert(b + dOf(c), dOf(c)));
      return { f, s:f.s, v, hole:false, kind, i };
    };
    for (let i = 0; i < n; i += ROW){ const f = SM[i]; if (portals.some(pp => Math.abs(pp[0] - f.s) < 0.5)) continue; rows.push(mkRow(f, i, f.kind)); }
    for (const [sp, dirIn] of portals){       // the mouth: a row just outside (open profile, quads over the tube skipped) and one just inside (cover)
      const i = Math.max(0, Math.min(n - 1, Math.round((sp - s0) / DS)));
      for (const side of [-1, 1]){
        const s = sp + 0.3 * side; if (s < s0 || s > s1 + 0.5) continue;
        const kind = side === dirIn ? 2 : ROUTE.kindAt(sp - dirIn * DS) === 2 ? 0 : ROUTE.kindAt(sp - dirIn * DS);
        const row = mkRow(frameFor(s), i, kind, side === dirIn); row.hole = side < 0; rows.push(row);
      }
    }
    rows.sort((p, q) => p.s - q.s);
    { const NR = rows.length, NCv = rows[0].v.length, G = { n:NR, nc:NCv, s:new Float64Array(NR), kind:new Uint8Array(NR), rail:new Float64Array(NR),
        a:new Float32Array(NR), b:new Float32Array(NR), wc:new Float32Array(NR), rr:new Float32Array(NR), w:new Float32Array(NR * NCv), y:new Float32Array(NR * NCv) };
      rows.forEach((r, k) => {   // kept for the camera's fence (camFence): the ground's profile row by row, the bed and the tube of each
        G.s[k] = r.s; G.kind[k] = r.kind; G.rail[k] = r.f.yAbs; G.a[k] = wMin[r.i] - 3.4; G.b[k] = wMax[r.i] + 3.4; G.wc[k] = (wMin[r.i] + wMax[r.i]) / 2; G.rr[k] = tubeR(r.i);
        r.v.forEach((q, c) => { G.w[k * NCv + c] = q[3]; G.y[k * NCv + c] = q[1] + O.y; });
      });
      ch.ground = G; }
    const pos = [], col = [], trees = [], houses = [], blocks = [], NC = rows[0].v.length, cityKey = cityKeyAt(s0);
    const boxes = [], box = (x, y, z, c, s, hw, hd, top) => boxes.push(x + O.x, z + O.z, c, s, hw, hd, y + O.y + top);   // the buildings for the camera (camOver): centre, yaw, half sizes, top
    for (let r = 0; r < rows.length - 1; r++){
      const A = rows[r], B = rows[r + 1];
      for (let c = 0; c < NC - 1; c++){
        const a0 = A.v[c], a1 = A.v[c + 1], b0 = B.v[c], b1 = B.v[c + 1];
        const cx = (a0[0] + a1[0] + b0[0] + b1[0]) / 4 + O.x, cz = (a0[2] + a1[2] + b0[2] + b1[2]) / 4 + O.z, d = (a0[4] + a1[4]) / 2;
        if (A.hole && c >= TERR_D.length - 2 && c <= TERR_D.length + 1) continue;   // the tube mouth: the portal collar fills this, up to the capped inside row
        let type = landType(cx, cz), rgb;
        const inner = c === TERR_D.length - 1 || c === TERR_D.length, wall = Math.abs(a1[3] - a0[3]) < 0.06 && Math.abs(b1[3] - b0[3]) < 0.06;
        if (wall) rgb = WALL_COL;
        else if (a0[5] + a1[5] + b0[5] + b1[5] >= 2 && !inner) rgb = WATER_COL;
        else if (inner || d < 12){ rgb = underDeck((A.s + B.s) / 2) ? FLOOR_COL : VERGE_COL; type = 1; }
        else rgb = LAND_COL[type];
        const water = rgb === WATER_COL, city = cityAt(A.f.s);
        if (city > 0 && !water && !inner && d >= 12){ const U = URBAN_COL[cityKey]; rgb = [rgb[0] + (U[0] - rgb[0]) * city, rgb[1] + (U[1] - rgb[1]) * city, rgb[2] + (U[2] - rgb[2]) * city]; }
        const sh = 0.9 + 0.2 * hash2(Math.floor(cx * 0.37), Math.floor(cz * 0.37), 7);
        pos.push(a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], b1[0], b1[1], b1[2], a0[0], a0[1], a0[2], b1[0], b1[1], b1[2], b0[0], b0[1], b0[2]);
        for (let q = 0; q < 6; q++) col.push(rgb[0] * sh, rgb[1] * sh, rgb[2] * sh);
        // vegetation and houses
        if (water || inner || wall || d < 14 || B.s - A.s < 1) continue;
        const width = Math.abs(a1[3] - a0[3]);
        const put = (arr, u, v) => { const x = a0[0] + (a1[0] - a0[0]) * u, y = a0[1] + (a1[1] - a0[1]) * u, z = a0[2] + (a1[2] - a0[2]) * u; const x2 = b0[0] + (b1[0] - b0[0]) * u, y2 = b0[1] + (b1[1] - b0[1]) * u, z2 = b0[2] + (b1[2] - b0[2]) * u; arr.push([x + (x2 - x) * v, y + (y2 - y) * v, z + (z2 - z) * v]); };
        const hq = hash2(r + ci * 1000, c, 3);
        if (landmarkZone(A.f.s, (a0[3] + a1[3]) / 2)) continue;
        if (city > 0 && hash2(r, c, 53) < city){   // urban cell: blocks of buildings every other row (20 m pitch), a few boulevard trees
          if (r % 2 === 0 && d >= 16 && d <= 420 && hq < 0.6 && blocks.length < 1400){
            const cnt = Math.min(5, Math.max(1, Math.round(width / 22)));
            for (let t = 0; t < cnt; t++) blocks.push({ u:(t + 0.5) / cnt + (hash2(r, c, 61 + t) - 0.5) * 0.3 / cnt, r, c:c * 8 + t, width:width / cnt, s:A.f.s, a0, a1, b0, b1 });
          } else if (hq > 0.96 && trees.length < 520) put(trees, hash2(r, c, 11), hash2(r, c, 41));
          continue;
        }
        if (type === 2 && trees.length < 520){ const cnt = Math.min(8, Math.max(1, Math.round(width / 14))); for (let t = 0; t < cnt; t++) put(trees, hash2(r, c, 11 + t), hash2(r, c, 41 + t)); }
        else if ((type === 0 || type === 1) && hq < 0.12 && trees.length < 520) put(trees, hq * 8 % 1, hash2(r, c, 5));
        else if (type === 4 && d > 20 && hq < 0.6 && houses.length < 70) put(houses, 0.2 + 0.6 * hash2(r, c, 13), 0.2 + 0.6 * hash2(r, c, 17));
      }
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.computeVertexNormals();
    addMesh(tg, terrainMat).receiveShadow = true;
    const tm = trees.map(([x, y, z], i) => { const sc = 0.8 + 0.7 * hash2(i, ci, 23); return new THREE.Matrix4().compose(_cp.set(x, y - 0.2, z), _cq.setFromAxisAngle(Y_UP, hash2(i, ci, 29) * 6.283), _cs.set(sc, sc, sc)); }).filter((m, i) => windClear(trees[i][0] + O.x, trees[i][2] + O.z, 20) && sightClear(trees[i][0] + O.x, trees[i][2] + O.z));
    _cs.set(1, 1, 1);
    const crowns = instanced(GEO.crown, treeCrownM, tm, g, false), trunks = instanced(GEO.trunk, treeTrunkM, tm, g, false);
    if (tm.length) ch.trees = { tm, crowns, trunks, hid:new Set(), B:Float64Array.from(tm.flatMap(m => { const e = m.elements; return [e[12] + O.x, e[14] + O.z, 2.2 * e[5], e[13] + O.y + 8 * e[5]]; })) };   // for the camera (camTrees): centre, half width and top of a crown 4.8 m wide at its foot and 8 m high, both times its scale
    const hm = houses.map(([x, y, z], i) => new THREE.Matrix4().compose(_cp.set(x, y - 0.1, z), _cq.setFromAxisAngle(Y_UP, hash2(i, ci, 31) * 6.283), _cs)).filter((m, i) => windClear(houses[i][0] + O.x, houses[i][2] + O.z, 500) && sightClear(houses[i][0] + O.x, houses[i][2] + O.z));
    instanced(GEO.house, houseWallM, hm, g, false); instanced(GEO.roof, houseRoofM, hm, g, false);
    for (const m of hm){ const e = m.elements; box(e[12], e[13], e[14], e[0], e[8], 4.6, 4.6, 6.8); }   // 9 by 7 m under a roof 9 m square, 6.8 m high
    if (blocks.length){   // city blocks: merged facades with window UVs + roofs, two draw calls per chunk
      const walls = new GeoAcc(true), roofs = new GeoAcc(false), par = cityKey === 'par';
      for (const b of blocks){
        const { a0, a1, b0, b1, u } = b;
        const x = a0[0] + (a1[0] - a0[0]) * u, y = a0[1] + (a1[1] - a0[1]) * u, z = a0[2] + (a1[2] - a0[2]) * u;
        const x2 = b0[0] + (b1[0] - b0[0]) * u, y2 = b0[1] + (b1[1] - b0[1]) * u, z2 = b0[2] + (b1[2] - b0[2]) * u;
        if (!sightClear((x + x2) / 2 + O.x, (z + z2) / 2 + O.z)) continue;
        const yaw = Math.atan2(-(b0[2] - a0[2]), b0[0] - a0[0]);
        const along = 12 + 7 * hash2(b.r, b.c, 81), deep = Math.max(6, Math.min(b.width - 0.5, 9 + 5 * hash2(b.r, b.c, 83))), hh = hash2(b.r, b.c, 85);
        const h = par ? (b.s > ROUTE.L - 3000 && hh < 0.06 ? 30 + 15 * hash2(b.r, b.c, 87) : 14 + 10 * hh) : 5 + 6 * hh;
        cityBox(walls, roofs, (x + x2) / 2, Math.min(y, y2) - 0.3, (z + z2) / 2, along, h, deep, yaw, par ? 3.0 : 1.8, par ? 1.2 : 2.2);
        box((x + x2) / 2, Math.min(y, y2) - 0.3, (z + z2) / 2, Math.cos(yaw), Math.sin(yaw), along / 2, deep / 2, h + (par ? 3.0 : 1.8));
      }
      addMesh(walls.build(), cityWallM[cityKey]).receiveShadow = true;
      addMesh(roofs.build(), cityRoofM[cityKey]).receiveShadow = true;
    }
    ch.boxes = new Float64Array(boxes);
  }
  // urban corridor: boundary walls along the line and road bridges over it (mid-span of the 54 m catenary grid, every 594 m)
  { const wall = new GeoAcc(false), roadM = [], asphM = [];
    const urban = i => cityAt(SM[i].s) >= 0.99 && SM[i].kind === 0 && !NO_WALL.some(z => SM[i].s > z[0] && SM[i].s < z[1]);
    let i = 0;
    while (i < n){
      if (!urban(i)){ i++; continue; }
      let j = i; while (j < n && urban(j)) j++;
      if (j - i >= 2) for (const side of [-1, 1]) wall.strip(j - i, 4, true, (q, kk) => { const f = SM[i + q], wc = side < 0 ? wMin[i + q] - 4.5 : wMax[i + q] + 4.5, pr = [[wc - 0.2, -0.6], [wc - 0.2, 3.0], [wc + 0.2, 3.0], [wc + 0.2, -0.6]][kk]; return P(f, pr[0], pr[1]); });
      i = j;
    }
    if (wall.pos.length) addMesh(wall.build(), wallM, g, true);
    for (let s = Math.ceil((s0 - 27) / 594) * 594 + 27; s < s1; s += 594){
      const q = Math.min(n - 1, Math.round((s - s0) / DS)); if (!urban(q)) continue;
      const f = SM[q], span = wMax[q] - wMin[q] + 24, wc = (wMin[q] + wMax[q]) / 2;
      const place = (arr, a, y, sx, sy, sz) => { _cp.copy(f.p).addScaledVector(f.r, a).addScaledVector(f.up, y); arr.push(new THREE.Matrix4().compose(_cp, f.q, _cs.set(sx, sy, sz))); };
      place(roadM, wc, 8.2, 10, 1.0, span);                                                      // deck, soffit 7.7 m above the rails
      for (const sd of [-1, 1]) place(roadM, wc + sd * (span / 2 - 0.15), 9.25, 10, 1.1, 0.3);   // parapets
      for (const sd of [-1, 1]) place(roadM, sd < 0 ? wMin[q] - 8 : wMax[q] + 8, 3.64, 1.6, 8.12, 1.6);   // piers
      place(asphM, wc, 8.75, 9.6, 0.1, span - 0.8);
      _cs.set(1, 1, 1);
    }
    instanced(GEO.pier, bridgeM, roadM, g, true); instanced(GEO.pier, asphaltM, asphM, g, false);
  }
  // bridges (deck, parapets, piers) and tunnels (lining, lamps)
  { const deck = new GeoAcc(false), tun = new GeoAcc(false), por = new GeoAcc(false), pierM = [], lampMt = [];
    const tubeAng = kk => Math.PI + 0.08 - (Math.PI + 0.16) * (kk - 1) / 11;
    const tubePt = (ix, kk) => { if (kk === 0) return [wMin[ix] - 3.4, -0.42]; if (kk === 13) return [wMax[ix] + 3.4, -0.42]; const wc = (wMin[ix] + wMax[ix]) / 2, rr = tubeR(ix), ang = tubeAng(kk); return [wc + rr * Math.cos(ang), 0.3 + rr * Math.sin(ang)]; };
    const collar = ix => {   // portal: a concrete face around the mouth, out to a rectangle 10 m wider than the tube and 2.5 m above its crown
      const f = SM[ix], wc = (wMin[ix] + wMax[ix]) / 2, rr = tubeR(ix);
      por.strip(2, 14, false, (ring, kk) => {
        const p = tubePt(ix, kk); if (ring === 0) return P(f, p[0], p[1]);
        const ang = kk === 0 ? Math.PI + 0.35 : kk === 13 ? -0.35 : tubeAng(kk);
        return P(f, Math.max(wc - rr - 10, Math.min(wc + rr + 10, wc + 60 * Math.cos(ang))), Math.max(-1.5, Math.min(0.3 + rr + 2.5, 0.3 + 60 * Math.sin(ang))));
      });
    };
    let i = 0;
    while (i < n){
      const k = SM[i].kind; if (!k || k === 3){ i++; continue; }
      let j = i; while (j < n && SM[j].kind === k) j++;
      const i0 = Math.max(0, i - 1), j1 = Math.min(n, j + 1), cnt = j1 - i0;
      if (k === 1 || k === 4){
        deck.strip(cnt, 4, false, (q, kk) => { const f = SM[i0 + q], pr = [[wMax[i0 + q] + 3.6, -0.42], [wMax[i0 + q] + 3.6, -1.6], [wMin[i0 + q] - 3.6, -1.6], [wMin[i0 + q] - 3.6, -0.42]][kk]; return P(f, pr[0], pr[1]); });
        for (const side of [-1, 1]) deck.strip(cnt, 4, true, (q, kk) => { const f = SM[i0 + q], wc = side < 0 ? wMin[i0 + q] - 3.5 : wMax[i0 + q] + 3.5, pr = [[wc - 0.15, -0.42], [wc - 0.15, 0.9], [wc + 0.15, 0.9], [wc + 0.15, -0.42]][kk]; return P(f, pr[0], pr[1]); });
        for (let s = Math.ceil((SM[i].s + 15) / 40) * 40; s < SM[j - 1].s - 15; s += 40){
          const q = Math.min(n - 1, Math.round((s - s0) / DS)), f = SM[q], wc = (wMin[q] + wMax[q]) / 2, tAbs = ROUTE.terAt(f.s, wc), top = f.yAbs - 1.6, h = top - tAbs;
          if (h < 2) continue;
          _cp.copy(f.p).addScaledVector(f.r, wc).addScaledVector(f.up, -1.6 - h / 2);
          pierM.push(new THREE.Matrix4().compose(_cp, f.q, _cs.set(2.6, h, wMax[q] - wMin[q] + 4.4))); _cs.set(1, 1, 1);
        }
      } else {
        tun.strip(cnt, 14, false, (q, kk) => { const f = SM[i0 + q], p = tubePt(i0 + q, kk); return P(f, p[0], p[1]); });
        if (i > 0) collar(i0); if (j < n) collar(j1 - 1);
        for (let s = Math.ceil(SM[i].s / 25) * 25; s < SM[j - 1].s; s += 25){
          const q = Math.min(n - 1, Math.round((s - s0) / DS)), f = SM[q];
          _cp.copy(f.p).addScaledVector(f.r, wMax[q] + 2.6).addScaledVector(f.up, 4.3);
          lampMt.push(new THREE.Matrix4().compose(_cp, f.q, _cs));
        }
      }
      i = j;
    }
    if (deck.pos.length) addMesh(deck.build(), bridgeM, g, true);
    if (tun.pos.length){ const m = addMesh(tun.build(), tunnelM); m.castShadow = true; }
    if (por.pos.length) addMesh(por.build(), portalM, g, true);
    instanced(GEO.pier, bridgeM, pierM, g, false); instanced(GEO.lamp, lampM, lampMt, g, false);
  }
  // buffer stops at both ends of the line
  if (ci === 0 || s1 >= ROUTE.L){
    const s = ci === 0 ? 6 : ROUTE.L - 3, mats = [];
    for (const k of [0, 1]){ ROUTE.frameAt(s, _cf); _cp.copy(_cf.p).sub(O).addScaledVector(_cf.r, laneWAt(k, s)); mats.push(new THREE.Matrix4().compose(_cp, _cf.q, _cs)); }
    instanced(GEO.stop, stopM, mats, g, true);
  }
  world.add(g);
  return ch;
}
function ensureChunks(s){
  const last = Math.floor((ROUTE.L - 1) / CH), ci = Math.max(0, Math.min(last, Math.floor(s / CH)));
  for (const [k, ch] of chunks) if (k < ci - 1 || k > ci + 1){ world.remove(ch.group); ch.geos.forEach(q => q.dispose()); ch.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); chunks.delete(k); }
  for (let k = ci - 1; k <= ci + 1; k++) if (k >= 0 && k <= last && !chunks.has(k)) chunks.set(k, buildChunk(k));
}

/* ---- placing things on the line: the loco is the origin; every other car, the station and the other trains get their own frame */
const F0 = mkFrame(), Fc = mkFrame(), P_loco = new THREE.Vector3(), qInv = new THREE.Quaternion(), Q_FLIP = new THREE.Quaternion().setFromAxisAngle(Y_UP, Math.PI);
const _pv = new THREE.Vector3(), _pb = new THREE.Box3();
const cars = [];                                  // {xc, jF, jR, pv, tag}: tag 0 wagons, 1 TGV set 1, 2 TGV set 2
const coaches = [];                               // the same by car: {tag, xc, jF, jR, pvs}
const byCar = (list, out) => { for (const c of list){ let k = out.find(q => q.tag === c.tag && q.xc === c.xc); if (!k) out.push(k = { tag:c.tag, xc:c.xc, jF:c.jF, jR:c.jR, pvs:[] }); k.pvs.push(c.pv); } return out; };
/* A train is rigid: its cars keep their real lengths along their track, each on the chord between its joints (the gangways or couplings,
   halfway between two cars' ends, mirrored at a train's ends), which sit on the track: two neighbours share theirs. The line's s is not the distance along a track everywhere: the lanes spread
   apart at stations and cross over, and where a station's straight platform is blended into the curved trace s runs up to a quarter off.
   Cars set at s + x and turned with the line parted at their joints, by 1 m sideways and 5 m lengthways at worst. A chain maps a train's
   x to s every CH_DX m of real distance along its own lane ('mix': ours, changing tracks). */
const CH_DX = 10, _chA = new THREE.Vector3(), _chB = new THREE.Vector3(), _chD = new THREE.Vector3(), _chU = new THREE.Vector3(), _chR = new THREE.Vector3(), _chM = new THREE.Matrix4();
const _chP = new THREE.Vector3(), _chQ = new THREE.Quaternion();
const mkChain = () => ({ lane:'mix', dir:1, k0:0, n:0, s:new Float64Array(128) });
const chainPt = (ch, s, out) => ROUTE.pointAt(s, ch.lane === 'mix' ? laneMix(s) : ROUTE.laneW(ch.lane, s), out);
function chainBuild(ch, lane, s0, dir, xMax, xMin){   // x = 0 at s0, the train's +x toward s growing when dir > 0
  const k0 = Math.floor(xMin / CH_DX), n = Math.ceil(xMax / CH_DX) - k0 + 1;
  if (ch.s.length < n) ch.s = new Float64Array(n + 32);
  ch.lane = lane; ch.dir = dir; ch.k0 = k0; ch.n = n; ch.s[-k0] = s0;
  for (const st of [1, -1]){
    let s = s0; chainPt(ch, s, _chA);
    for (let i = -k0 + st; i >= 0 && i < n; i += st){
      let sn = s + dir * st * CH_DX; const d = chainPt(ch, sn, _chB).distanceTo(_chA);
      if (d > 1e-6) sn = s + (sn - s) * CH_DX / d;   // stretched to CH_DX m of real distance (at the line's ends the point stops: s runs on)
      ch.s[i] = sn; chainPt(ch, sn, _chA); s = sn;
    }
  }
}
function chainS(ch, x){   // s at the train's x; beyond the nodes it runs on at the last ones' pace
  if (ch.n < 2) return S.dist + x;   // ours before its first frame
  const f = x / CH_DX - ch.k0, i = Math.max(0, Math.min(ch.n - 2, Math.floor(f)));
  return ch.s[i] + (ch.s[i + 1] - ch.s[i]) * (f - i);
}
function chainPose(ch, jF, jR, xc, P, Q){   // a car on the chord between its joints (on a curve its middle sits a little inside); P, Q in the route's frame
  chainPt(ch, chainS(ch, jF), _chA); chainPt(ch, chainS(ch, jR), _chB);
  _chD.subVectors(_chA, _chB).normalize(); _chR.crossVectors(_chD, Y_UP).normalize(); _chU.crossVectors(_chR, _chD);
  Q.setFromRotationMatrix(_chM.makeBasis(_chD, _chU, _chR));
  return P.copy(_chB).addScaledVector(_chD, xc - jR);
}
const OUR = mkChain(), LEAD_J = {};               // ours; the leading car's rear joint by mode (its frame is the scene's)
/* ---- the outside camera's fence (Orbit.fence, 03b-scene.js): never under the ground or the rails, nor inside a hill. A camera in a tunnel's
   rock is drawn into the tube. While the train it looks at is in a tunnel or 40 m from one, it keeps to the tube's shape, in the tube and
   before its mouths, so the hill never stands between them; anywhere else the lowest height it may take is returned, 0.6 m over the ground,
   the bed or a bridge deck */
const _fx = new THREE.Vector3(), _ff = mkFrame();
function groundRow(G, k, w){   // the ground's height (absolute) at w across row k
  const o = k * G.nc; let c = 0;
  while (c < G.nc - 2 && G.w[o + c + 1] < w) c++;
  const w0 = G.w[o + c], u = Math.max(0, Math.min(1, (w - w0) / ((G.w[o + c + 1] - w0) || 1)));
  const y = G.y[o + c] + (G.y[o + c + 1] - G.y[o + c]) * u;
  return (G.kind[k] === 1 || G.kind[k] === 4) && w > G.a[k] - 0.2 && w < G.b[k] + 0.2 ? Math.max(y, G.rail[k] - 0.42) : y;   // a bridge: its deck, not the valley under it
}
const CP = { s:0, w:0, G:null, lo:0, hi:0, t:0, yG:0 };   // camPlace's answer: along the line, across it, the ground's row and its height there
function camPlace(p){   // p in scene coordinates: _fx gets it in route coordinates, CP where it is over the line; false off the line or the built ground
  _fx.copy(p).applyQuaternion(F0.q).add(P_loco);
  let s = S.dist;
  for (let it = 0; it < 2; it++){ ROUTE.frameAt(Math.max(0, Math.min(ROUTE.L, s)), _ff); s += (_fx.x - _ff.p.x) * _ff.t.x + (_fx.z - _ff.p.z) * _ff.t.z; }   // along the curve, twice
  if (s < 0 || s > ROUTE.L) return false;
  ROUTE.frameAt(s, _ff);
  const w = (_fx.x - _ff.p.x) * _ff.r.x + (_fx.z - _ff.p.z) * _ff.r.z, G = chunks.get(Math.floor(s / CH))?.ground;
  if (!G || s < G.s[0] || s > G.s[G.n - 1]) return false;
  let lo = 0, hi = G.n - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (G.s[m] <= s) lo = m; else hi = m; }
  const t = (s - G.s[lo]) / ((G.s[hi] - G.s[lo]) || 1);
  const a = groundRow(G, lo, w);
  CP.s = s; CP.w = w; CP.G = G; CP.lo = lo; CP.hi = hi; CP.t = t; CP.yG = a + (groundRow(G, hi, w) - a) * t;
  return true;
}
function tunnelNear(s, d){ const i1 = ROUTE.idx(Math.min(ROUTE.L, s + d)); for (let i = ROUTE.idx(Math.max(0, s - d)); i <= i1; i++) if (ROUTE.KD[i] === 2) return true; return false; }
function camFence(p){   // p: the camera in scene coordinates
  const near = camPlace(orbit.target) && tunnelNear(CP.s, 40);   // what it looks at is in a tunnel or 40 m from one
  if (!camPlace(p)) return null;
  const { w, G, lo, hi, t, yG } = CP, lerp = (A, B) => A + (B - A) * t, inT = G.kind[lo] === 2 || G.kind[hi] === 2;   // in the tube, its lining one sample past the tagged tunnel, or in its mouth
  if ((inT && _fx.y < yG) || near){   // in the tube or drawn into it; out of a tunnel, the same shape before its mouth
    const k = t < 0.5 ? lo : hi, u = w - G.wc[k], R = G.rr[k] - 0.7, yc = lerp(G.rail[lo], G.rail[hi]) + 0.3;   // the arch's centre, 0.3 m over the rails
    let v = Math.max(_fx.y - yc, -0.1), du = u;   // no lower than 0.2 m over the rails
    const d = Math.hypot(u, Math.max(v, 0));
    if (d > R){ du = u * R / d; if (v > 0) v *= R / d; }
    const w2 = G.wc[k] + du, gy = inT ? -1e9 : lerp(groundRow(G, lo, w2), groundRow(G, hi, w2)) + 0.6;   // out in the open, still over the ground
    _fx.copy(_ff.p).addScaledVector(_ff.r, w2); _fx.y = Math.max(yc + v, gy);
    p.copy(_fx).sub(P_loco).applyQuaternion(qInv);
    return null;
  }
  _fx.y = yG + 0.6;
  return _fx.sub(P_loco).applyQuaternion(qInv).y;
}
orbit.fence = camFence;
/* ---- nor behind a building (Orbit.over, after the fence): a building or a house anywhere on its line of sight to the train lifts the camera on
   its sphere until it looks over the roof or stands in front of it; in a city, a view over the roofs. The train running, the camera rises as a
   building comes within a second of the line, so it is up when the building gets there; down again 1.5 s after nothing is in the way, so a
   street going by does not drop it. The orbit keeps the angle it was given. A tree the camera stands in or right behind is hidden instead; one
   further out may hide the train as it goes by, as a tree does */
const _ot = new THREE.Vector3(), _op = new THREE.Vector3(), OVER = { lift:0, hold:0, hid:0 }, ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
function overNeed(r, ux, uz, e0, tx, tz){   // the least elevation from e0 up at which no building stands on the line of sight from (tx, tz)
  const ci = Math.floor(S.dist / CH), hc = r * Math.cos(e0);   // across the ground: the camera, at its lowest; higher, it is nearer and the line steeper, so one pass
  let e = e0;
  for (let k = ci - 1; k <= ci + 1; k++){
    const B = chunks.get(k)?.boxes; if (!B) continue;
    for (let j = 0; j < B.length; j += 7){
      const dx = tx - B[j], dz = tz - B[j + 1], c = B[j + 2], s = B[j + 3], hw = B[j + 4], hd = B[j + 5];
      if (dx * dx + dz * dz > (hc + hw + hd) ** 2) continue;
      const ox = dx * c - dz * s, oz = dx * s + dz * c, lx = ux * c - uz * s, lz = ux * s + uz * c;   // the sight line across the ground, in the box's frame
      let h0 = -Infinity, h1 = Infinity;
      if (Math.abs(lx) > 1e-9){ const a = (-hw - ox) / lx, b = (hw - ox) / lx; h0 = Math.max(h0, Math.min(a, b)); h1 = Math.min(h1, Math.max(a, b)); } else if (Math.abs(ox) > hw) continue;
      if (Math.abs(lz) > 1e-9){ const a = (-hd - oz) / lz, b = (hd - oz) / lz; h0 = Math.max(h0, Math.min(a, b)); h1 = Math.min(h1, Math.max(a, b)); } else if (Math.abs(oz) > hd) continue;
      if (h0 > h1 || h0 < 0.5 || h0 >= hc) continue;   // missed, round what it looks at, or past the camera
      const eb = Math.min(Math.acos(Math.min(1, (h0 - 0.5) / r)), Math.atan2(B[j + 6] + 0.5 - _ot.y, h0));   // in front of it, or over its roof
      if (eb > e) e = eb;
    }
  }
  return e;
}
function camTrees(r, ux, uz, e){   // hide the trees the camera stands in or beside (3 m), or that its last 10 m of sight cross under their top; no arguments: show them all
  if (r === undefined && !OVER.hid) return;
  const ci = Math.floor(S.dist / CH), ce = Math.cos(e), hc = r * ce, near = (r - 10) * ce, te = Math.tan(e), cx = _ot.x + ux * hc, cz = _ot.z + uz * hc, cy = _ot.y + r * Math.sin(e);
  OVER.hid = 0;
  for (let k = ci - 1; k <= ci + 1; k++){
    const T = chunks.get(k)?.trees; if (!T) continue;
    for (let j = 0, i = 0; j < T.B.length; j += 4, i++){
      let hide = false;
      if (r !== undefined){
        const X = T.B[j], Z = T.B[j + 1], h = T.B[j + 2], top = T.B[j + 3];
        if (Math.abs(cx - X) < h + 3 && Math.abs(cz - Z) < h + 3 && cy < top + 1) hide = true;
        else {
          const dx = X - _ot.x, dz = Z - _ot.z;
          let h0 = -Infinity, h1 = Infinity;
          if (Math.abs(ux) > 1e-9){ const a = (dx - h) / ux, b = (dx + h) / ux; h0 = Math.min(a, b); h1 = Math.max(a, b); } else if (Math.abs(dx) > h) h0 = Infinity;
          if (Math.abs(uz) > 1e-9){ const a = (dz - h) / uz, b = (dz + h) / uz; h0 = Math.max(h0, Math.min(a, b)); h1 = Math.min(h1, Math.max(a, b)); } else if (Math.abs(dz) > h) h0 = Infinity;
          hide = h0 <= h1 && h0 < hc && h1 > near && _ot.y + Math.max(h0, near) * te < top + 0.3;
        }
      }
      if (hide) OVER.hid++;
      if (hide === T.hid.has(i)) continue;
      if (hide) T.hid.add(i); else T.hid.delete(i);
      T.crowns.setMatrixAt(i, hide ? ZERO_M : T.tm[i]); T.trunks.setMatrixAt(i, hide ? ZERO_M : T.tm[i]);
      T.crowns.instanceMatrix.needsUpdate = T.trunks.instanceMatrix.needsUpdate = true;
    }
  }
}
function camOver(p, dt, open){   // p: the camera in scene coordinates, after the fence; open: the fence left it over the ground, not in a tube. No p: a seat's view
  if (!p || !open){ OVER.lift = 0; camTrees(); return; }
  _ot.copy(orbit.target).applyQuaternion(F0.q).add(P_loco); _op.copy(p).applyQuaternion(F0.q).add(P_loco);
  const vx = _op.x - _ot.x, vz = _op.z - _ot.z, hl = Math.hypot(vx, vz), r = _op.distanceTo(_ot);
  if (hl < 0.5){ OVER.lift = 0; camTrees(); return; }
  const ux = vx / hl, uz = vz / hl, e0 = Math.atan2(_op.y - _ot.y, hl), now = overNeed(r, ux, uz, e0, _ot.x, _ot.z) - e0;
  const v = S.speed * S.dir, n = Math.min(12, Math.ceil(Math.abs(v) / 8));   // where the line will be within a second, every 8 m or less
  let soon = now;
  for (let i = 1; i <= n; i++){ const d = v * i / n; soon = Math.max(soon, overNeed(r, ux, uz, e0, _ot.x + F0.t.x * d, _ot.z + F0.t.z * d) - e0); }
  if (now > OVER.lift) OVER.lift = now;   // in the way already (a jump along the line, a drag): up at once
  if (soon >= OVER.lift){ OVER.lift += (soon - OVER.lift) * (1 - Math.exp(-dt / 0.3)); OVER.hold = 1.5; }
  else if ((OVER.hold -= dt) < 0) OVER.lift -= (OVER.lift - soon) * (1 - Math.exp(-dt / 0.8));
  const e = Math.max(e0, Math.min(1.4, e0 + OVER.lift)), hc = r * Math.cos(e);
  if (OVER.lift > 1e-3){ _op.set(_ot.x + ux * hc, _ot.y + r * Math.sin(e), _ot.z + uz * hc); p.copy(_op).sub(P_loco).applyQuaternion(qInv); }
  camTrees(r, ux, uz, e);
}
orbit.over = camOver;
/* ---- the train's lights ("add lights on the train when it's dark or in the tunnels"). As it gets dark around the camera, at night or deep in a
   tunnel, the lamps glow (halos, 03c-common.js) and the coaches' windows light up; the leading lamps throw a beam down the line at night and
   once the head of the train is in a tunnel. Deep in a tunnel the daylight fades out (DARK.cam, updateWeather), and the tube's own glow with it */
function tunnelIn(s, ramp = 40){   // how far into a tunnel s is: 0 outside or at a portal, 1 from `ramp` m in
  const KD = ROUTE.KD, DS = ROUTE.DS, i = ROUTE.idx(s), n = Math.ceil(ramp / DS) + 1;
  if (KD[i] !== 2) return 0;
  let a = 1, b = 1;   // samples to the first one out of it, ahead and behind; each portal lies halfway to it
  while (a <= n && i + a < ROUTE.N && KD[i + a] === 2) a++;
  while (b <= n && i - b >= 0 && KD[i - b] === 2) b++;
  return Math.max(0, Math.min(1, Math.min((i + a - 0.5) * DS - s, s - (i - b + 0.5) * DS) / ramp));
}
const beam = new THREE.SpotLight(0xfff0d8, 0, 160, 0.42, 0.6, 1);   // always in the scene, off by day: adding a light would rebuild every shader
scene.add(beam, beam.target);
const BEAM_I = 60, SALOON_I = 1.6, _hp = new THREE.Vector3(), _hx = new THREE.Vector3();
const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };   // drawn: it and every parent visible
function updateLights(){   // every frame, the camera placed
  DARK.cam = camPlace(camera.position) && ROUTE.kindAt(CP.s) === 2 && _fx.y < CP.yG ? tunnelIn(CP.s) : 0;   // under the hill, not over it
  tunnelM.emissiveIntensity = 1 - 0.85 * DARK.cam;
  const glow = Math.max(DARK.night, DARK.cam);
  for (const m of winMats) if (!m.userData.hl) m.emissiveIntensity = 1.1 * glow;
  SALOON.value.setRGB(1, 0.93, 0.82).multiplyScalar(SALOON_I * glow);
  let head = null, best = 0;
  for (const h of halos){
    const lit = Math.min(1, h.lens.emissiveIntensity / h.peak), on = lit > 0 && shown(h.host);
    if (on && h.own && h.head && lit > best){ best = lit; head = h; }
    let o = 0;
    if (on && glow > 0){   // brightest straight ahead, gone from the side and behind (from the driver's seat too)
      const e = h.host.matrixWorld.elements;
      _hp.copy(h.at).applyMatrix4(h.host.matrixWorld); _hx.set(e[0], e[1], e[2]).normalize();
      const f = Math.max(0, Math.min(1, (_hx.dot(_hp.subVectors(camera.position, _hp).normalize()) - 0.05) / 0.4));
      o = glow * lit * f * f * (3 - 2 * f);
    }
    h.sm.opacity = o; h.sm.visible = o > 0.004;
  }
  if (head){   // from just ahead of the leading lamps, 40 m down the line
    head.host.updateWorldMatrix(true, false);
    beam.position.set(head.tip.x + 0.6, head.tip.y + 0.2, 0).applyMatrix4(head.host.matrixWorld);
    beam.target.position.set(head.tip.x + 40, 0, 0).applyMatrix4(head.host.matrixWorld); beam.target.updateMatrixWorld();
  }
  beam.intensity = head ? BEAM_I * best * Math.max(DARK.night, tunnelIn(S.dist + beam.position.x)) : 0;
}
const trk = { from:0, to:0, s0:-1e9 };            // track change: an S-curve over 400 m starting just ahead of where it was requested
const trackFAt = s => trk.from + (trk.to - trk.from) * ROUTE.sstep((s - trk.s0) / 400);
const laneMix = (s, u) => { const a = ROUTE.laneW(0, s, u), f = trackFAt(s); return f <= 0 ? a : a + (ROUTE.laneW(1, s, u) - a) * f; };
const trainLen = () => S.mode === 'tgv' ? (S.sets === 2 || S.coupling !== 0 ? 400 : 200) : 90;
const trackSettled = () => trk.s0 < -1e8 || S.dist - trk.s0 > 450 + trainLen();
function requestTrack(k){                          // false: refused (a change is still under the train, or a train is coming on that track)
  if (k === trk.to) return 'same';
  if (!trackSettled()) return 'busy';
  if (opp.some(o => { const rel = (o.s - S.dist) * S.dir; return o.active && rel > -400 && rel < 3500; })) return 'occupied';
  trk.from = trk.to; trk.to = k; trk.s0 = S.dist + 20; S.track = k; return 'ok';
}
function tgvRanges(){
  const r = [{ xc:0, a:-9.9, b:11.4 }];
  for (const [xr, L] of TGV.TRAILERS) r.push({ xc:xr + L / 2, a:xr - 0.3, b:xr + L + 0.3 });
  r.push({ xc:TGV.REAR_PC, a:-185.6, b:-164.3 });
  r.forEach((q, i) => { q.jF = i ? (r[i - 1].a + q.b) / 2 : NaN; q.jR = i < r.length - 1 ? (q.a + r[i + 1].b) / 2 : NaN; });   // the joints, halfway between two cars' ends
  for (const q of r){ if (isNaN(q.jF)) q.jF = 2 * q.xc - q.jR; if (isNaN(q.jR)) q.jR = 2 * q.xc - q.jF; }   // mirrored at the set's ends
  return r;
}
function carify(group, ranges, tag, out){          // regroup a part's meshes per car so each car can sit on its own bit of curve
  const pivots = new Map();
  for (const o of [...group.children]){
    _pb.setFromObject(o, true); if (_pb.isEmpty()) continue;
    _pb.getCenter(_pv); group.worldToLocal(_pv);
    let r = ranges.find(q => _pv.x >= q.a && _pv.x <= q.b);
    if (!r){ let best = 1e9; for (const q of ranges){ const d = Math.abs(_pv.x - q.xc); if (d < best){ best = d; r = q; } } }
    let pv = pivots.get(r);
    if (!pv){ pv = new THREE.Group(); pv.name = 'car'; group.add(pv); pivots.set(r, pv); out.push({ xc:r.xc, jF:r.jF, jR:r.jR, pv, tag }); }
    pv.add(o); o.position.x -= r.xc;
  }
}
function poseWorld(obj, s, w, flip){               // for objects living in `world` (route frame, translated to the loco)
  ROUTE.frameAt(s, Fc);
  obj.position.copy(Fc.p).addScaledVector(Fc.r, w).sub(P_loco);
  obj.quaternion.copy(Fc.q); if (flip) obj.quaternion.multiply(Q_FLIP);
}
function curveLocal(x, y, z, out){                 // a point given in straight loco coordinates → where it really is on the curve (x in real metres along our track)
  return routeLocal(chainS(OUR, x), y, z, out);
}
function routeLocal(s, y, z, out){                 // the point y m over our track and z m right of it at s, in the scene
  ROUTE.frameAt(s, Fc);
  _pv.set(0, y, z).applyQuaternion(Fc.q);
  return out.copy(Fc.p).addScaledVector(Fc.r, laneMix(s)).add(_pv).sub(P_loco).applyQuaternion(qInv);
}
function nearestStation(){ const x = S.dist + TGV.PLAT_FRONT; let best = null, bd = 1e18; for (const st of ROUTE.stations){ const d = Math.abs(st.s - x); if (d < bd){ bd = d; best = st; } } return best; }
function nextStation(v = S.speed){                 // first station ahead in the running direction that can still be reached with a 0.85 m/s² stop
  const x = S.dist + TGV.PLAT_FRONT, list = S.dir > 0 ? ROUTE.stations : [...ROUTE.stations].reverse();
  for (const st of list){ const d = (st.s - x) * S.dir; if (d > 30 && v * v / (2 * 0.85) <= d + 0.5) return st; }   // within 30 m of the mark = already there (a turn-around at a buffer stop must not make that station 'next')
  return null;
}
function stationOffset(){ return nearestStation().s - TGV.PLAT_FRONT - S.dist; }
function stationDeck(){   // the nearest station's slab over the tracks in loco coordinates [x from, to, z from, to], or null
  const st = nearestStation(), d = STATION_DECK[st.id]; if (!d) return null;
  const x = TGV.PLAT_FRONT + stationOffset(), z = ROUTE.laneW(0, st.s, 1) - laneMix(S.dist);
  return [d[0] + x, d[1] + x, d[2] + z, d[3] + z];
}
function stationCam(name){   // the nearest station's own view for a camera preset while the train stands at it (Massy: the trench and its slab hide the usual ones), or null
  const cams = landmarks[nearestStation().id]?.userData.cams;
  let c = cams && Math.abs(stationOffset()) < 600 ? cams[name] : null;
  if (typeof c === 'function') c = c();
  return c || null;
}
let stationBuilding = null;
const BLDG_AT = { fut:[-40, -14, 0], vdm:[-208, 30, Math.PI] };   // [x, z, turn] where the generic building stands in for the real one: Vendôme's is across the tracks
function poseStation(){
  const st = nearestStation();
  poseWorld(station, st.s, ROUTE.laneW(0, st.s, 1), false);
  setPlatformSide(st.side); setStationName(st.name);
  if (!stationBuilding) stationBuilding = station.getObjectByName('stationBuilding');
  const lm = landmarks[st.id];
  for (const k in landmarks) landmarks[k].visible = landmarks[k] === lm;
  setPlatformRoof(!lm || lm.userData.platRoof !== false);
  if (stationBuilding){
    const b = BLDG_AT[st.id] || [-40, st.side < 0 ? -13.5 : -(Math.max(0, st.nLeft - 1) * 4.5 + 12), 0];   // behind the last track on our left, clear of a side platform
    stationBuilding.visible = !lm; stationBuilding.position.x = b[0]; stationBuilding.position.z = b[1]; stationBuilding.rotation.y = b[2];
  }
}
/* other TGVs: one parked on the far face of the island platform or at the far side platform (facing the other way, doors open) and two running against us.
   Like ours they run on the rear pantograph under 25 kV and raise the front one too under 1.5 kV DC (pantos[1] is the front power car's). */
const dcUp = s => ROUTE.voltAt(s) < 3000 ? 1 : 0;
function extraSet(firstCar, parent){
  const G = { power:new THREE.Group(), roof:new THREE.Group(), trailers:new THREE.Group(), jacobs:new THREE.Group(), doors:new THREE.Group() };
  Object.values(G).forEach(g => parent.add(g));
  const bA = axles.length, bL = lampMats.length, bR = motorRotors.length, bF = roofFans.length;
  const set = buildSet({ mk:pmat, groups:G, withFront:true, firstCar });
  const ax = axles.splice(bA); lampMats.length = bL; motorRotors.length = bR; roofFans.length = bF;
  posePanto(set.pantos[0], 1);
  return { G, set, ax, cars:[] };
}
const parkedG = new THREE.Group(); world.add(parkedG);
const parked = extraSet(21, parkedG);
const opp = [];
for (const n of [31, 41]){ const g = new THREE.Group(); g.visible = false; world.add(g); const o = extraSet(n, g); o.group = g; o.active = false; o.s = 0; o.v = 0; o.lane = 1; o.dir = -1; o.horned = false; opp.push(o); }
{
  scene.updateMatrixWorld(true);
  const R = tgvRanges();
  for (const id of ['powerCars', 'roofLine', 'trailers', 'jacobs', 'doors']) carify(parts[id].group, R, 1, cars);
  for (const g of tgvSets[1].group.children) carify(g, R, 2, cars);
  for (const set of tgvSets) for (const d of set.doors){ d.x0 = d.g.position.x; d.z0 = d.g.position.z; }
  for (const w of wagons.children) cars.push({ xc:w.position.x, jF:w.userData.j[0], jR:w.userData.j[1], pv:w, tag:0 });
  for (const o of [parked, ...opp]) for (const g of Object.values(o.G)) carify(g, R, 'x', o.cars);
  byCar(cars, coaches); for (const o of opp){ o.coaches = byCar(o.cars, []); o.ch = mkChain(); }
  LEAD_J.tgv = R[0].jR; LEAD_J.loco = wagons.children[0].userData.j[0];
  for (const d of parked.set.doors){ d.x0 = d.g.position.x; d.z0 = d.g.position.z; }
  parked.side = 0;
  parked.set.lamps.rear.tl.emissiveIntensity = 1.4;
  for (const o of opp){ o.set.lamps.front.hl.emissiveIntensity = 2.2; o.set.lamps.rear.tl.emissiveIntensity = 1.4; }
}
let oppTimer = 25;
// where a train running into a terminus stops (its leading power car's origin): on the platform, level with our own train at that terminus
const oppEnd = dir => dir > 0 ? ROUTE.stations[ROUTE.stations.length - 1].s - TGV.PLAT_FRONT : ROUTE.stations[0].s - TGV.PLAT_FRONT + TGV.TIP_R + TGV.TIP_F;
function updateOpposing(dt){
  // a train only comes and goes out of sight: the fog hides it fully beyond its far distance in depth, and the corners of the view see up to 1.7 times
  // further than the middle, so twice the fog's reach from the camera (in the TGV mode 1.3 km in the sun, 0.5 km in the rain; 1.6 times less in the others)
  const camS = S.dist + camera.position.x, gone = 2 * scene.fog.far, reach = Math.max(2500, gone + 150);
  oppTimer -= dt;
  if (oppTimer <= 0){
    oppTimer = 90 + Math.random() * 150;
    const free = opp.find(o => !o.active), sp = camS + reach * S.dir;
    if (free && trackSettled() && !opp.some(o => o.active && o.v < 0.1) && sp > oppEnd(-1) && sp < oppEnd(1)){   // out of sight ahead, running against us on the other track; none while one stands at a terminus
      free.active = true; free.group.visible = true; free.lane = 1 - trk.to; free.s = sp; free.dir = -S.dir; free.horned = false;
      free.v = Math.min(300, ROUTE.lineLimit(free.s)) / 3.6; posePanto(free.set.pantos[1], dcUp(free.s));
    }
  }
  for (const o of opp){
    if (!o.active) continue;
    const room = Math.max(0, (oppEnd(o.dir) - o.s) * o.dir);   // to its stop at the terminus ahead, braking at 0.5 m/s²
    o.v = Math.min(approach(o.v, Math.min(300, ROUTE.lineLimit(o.s)) / 3.6, dt * 0.5), Math.sqrt(room));
    o.s += o.v * o.dir * dt;
    if ((o.s - oppEnd(o.dir)) * o.dir >= 0){ o.s = oppEnd(o.dir); o.v = 0; }
    { const p = o.set.pantos[1], up = dcUp(o.s); if (p.f !== up) posePanto(p, approach(p.f, up, dt * (up ? 1 / 7 : 1 / 3))); }
    const a = o.s + TGV.TIP_F * o.dir, b = o.s + TGV.TIP_R * o.dir, lo = Math.min(a, b), hi = Math.max(a, b);
    const away = o.v < 0.1 || (lo > camS) === (o.dir > 0);   // standing, or running away from the camera
    if ((Math.max(lo - camS, camS - hi) > gone && away) || Math.abs(o.s - camS) > reach + 1000){ o.active = false; o.group.visible = false; continue; }
    for (const ax of o.ax) ax.rotation.z -= (o.v / (ax.userData.r || WHEEL_R)) * dt;
    chainBuild(o.ch, o.lane, o.s, o.dir, TGV.TIP_F + 10, TGV.TIP_R - 10);
    for (const k of o.coaches){ chainPose(o.ch, k.jF, k.jR, k.xc, _chP, _chQ).sub(P_loco); for (const pv of k.pvs){ pv.position.copy(_chP); pv.quaternion.copy(_chQ); } }
  }
}
function updateRoute(dt){
  S.track = trk.to; S.trackF = trackFAt(S.dist);
  ROUTE.frameAt(S.dist, F0);
  const tgv = S.mode === 'tgv', wide2 = tgv && tgvSets[1].group.visible, base2 = TGV.SET2_X + S.set2Off, jl = tgv ? LEAD_J.tgv : LEAD_J.loco;
  chainBuild(OUR, 'mix', S.dist, 1, 110, -tailLen() - 110);   // 110 m beyond both ends for the cameras aimed off the train
  chainPose(OUR, -jl, jl, 0, P_loco, F0.q);   // the scene's frame is the leading car's
  qInv.copy(F0.q).invert();
  world.quaternion.copy(qInv);
  ensureChunks(S.dist);
  const catOn = parts.catenary.group.visible;
  for (const ch of chunks.values()){ ch.group.position.copy(ch.origin).sub(P_loco); ch.cat.visible = catOn; }
  for (const k of coaches){
    if (k.tag === 0 ? tgv : !tgv) continue;
    if (k.tag === 2 && !wide2) continue;
    const o = k.tag === 2 ? base2 : 0;
    chainPose(OUR, k.jF + o, k.jR + o, k.xc + o, _chP, _chQ).sub(P_loco).applyQuaternion(qInv); _chQ.premultiply(qInv);
    for (const pv of k.pvs){ pv.position.copy(_chP); pv.quaternion.copy(_chQ); }
  }
  poseStation(); fitShadow();
  parkedG.visible = S.mode === 'tgv';   // the train on the other face of the platform belongs to the TGV scene
  { const st = nearestStation(), so = st.s - 187, lane = st.side < 0 ? 'C' : 'B';
    for (const c of parked.cars){ const s = so - c.xc; poseWorld(c.pv, s, ROUTE.laneW(lane, s), true); }
    if (parked.side !== st.side){ parked.side = st.side; for (const d of parked.set.doors){ const k = d.s === st.side ? 1 : 0; d.g.position.z = d.z0 + 0.13 * k * d.s; d.g.position.x = d.x0 + 1.35 * k; } }   // turned round, it faces its platform with the doors on the same side number as ours
    if (parked.set.pantos[1].f !== dcUp(so)) posePanto(parked.set.pantos[1], dcUp(so)); }
  updateOpposing(dt); updateWind(dt); updateSights(dt);
}
scene.remove(sky, stars); world.add(sky, stars);   // the sky and the stars turn with the world so its horizon stays level
