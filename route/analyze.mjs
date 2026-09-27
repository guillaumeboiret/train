import fs from 'fs';
const src = fs.readFileSync('loco/03a2-route.js', 'utf8');
const ROUTE_DATA = eval(src.replace(/^[\s\S]*?const ROUTE_DATA = /, '(') .replace(/;\s*$/, ')'));
const i16 = s => { const b = Buffer.from(s, 'base64'); return new Int16Array(b.buffer, b.byteOffset, b.length >> 1); };
const D = ROUTE_DATA, np = D.np, xyd = i16(D.xy);
const px = new Float64Array(np), py = new Float64Array(np), ps = new Float64Array(np);
let cx = 0, cy = 0; for (let i = 0; i < np; i++){ cx += xyd[2*i]/10; cy += xyd[2*i+1]/10; px[i] = cx; py[i] = cy; }
for (let i = 1; i < np; i++) ps[i] = ps[i-1] + Math.hypot(px[i]-px[i-1], py[i]-py[i-1]);
console.log('L data', D.L, 'polyline', ps[np-1].toFixed(1), 'elev n', i16(D.elev).length, 'ter rows', i16(D.ter).length / D.TW.length);
const k = D.L / ps[np-1]; for (let i = 0; i < np; i++) ps[i] *= k;
const DS = 5, N = Math.floor(D.L / DS) + 1;
const X = new Float64Array(N), Z = new Float64Array(N);
let j = 0; for (let i = 0; i < N; i++){ const s = Math.min(i*DS, D.L); while (j < np-2 && ps[j+1] < s) j++; const t = (s-ps[j])/Math.max(1e-9, ps[j+1]-ps[j]); X[i] = px[j]+(px[j+1]-px[j])*t; Z[i] = -(py[j]+(py[j+1]-py[j])*t); }
function smooth(A, K){ const B = new Float64Array(A.length), n = A.length; let sum = 0; for (let i = -K; i <= K; i++) sum += A[Math.min(n-1, Math.max(0, i))]; for (let i = 0; i < n; i++){ B[i] = sum/(2*K+1); sum += A[Math.min(n-1, i+K+1)] - A[Math.max(0, i-K)]; } A.set(B); }
smooth(X, 8); smooth(Z, 8); smooth(X, 8); smooth(Z, 8);
// curvature stats
let minR = 1e9, minRs = 0; const rad = [];
for (let i = 2; i < N-2; i++){ const ax = X[i]-X[i-2], az = Z[i]-Z[i-2], bx = X[i+2]-X[i], bz = Z[i+2]-Z[i]; const la = Math.hypot(ax,az), lb = Math.hypot(bx,bz); const cr = (ax*bz-az*bx)/(la*lb); const ang = Math.asin(Math.max(-1, Math.min(1, cr))); const R = Math.abs(ang) > 1e-9 ? 10/Math.abs(ang) : 1e9; if (R < minR){ minR = R; minRs = i*DS; } rad.push(R); }
console.log('min R after smoothing', minR.toFixed(0), 'at s', minRs);
const counts = {}; for (const R of rad){ const b = R < 500 ? '<500' : R < 1000 ? '<1000' : R < 2000 ? '<2000' : R < 4000 ? '<4000' : '>=4000'; counts[b] = (counts[b]||0)+1; } console.log('R buckets (samples 5 m)', counts);
// station chord deviation
for (const st of D.stations){
  const sA = Math.max(0, st.s - 460), sB = Math.min(D.L, st.s + 40); const iA = Math.round(sA/DS), iB = Math.round(sB/DS);
  const dx = X[iB]-X[iA], dz = Z[iB]-Z[iA], len = Math.hypot(dx,dz); let maxd = 0;
  for (let i = iA; i <= iB; i++){ const d = Math.abs(((X[i]-X[iA])*dz - (Z[i]-Z[iA])*dx)/len); if (d > maxd) maxd = d; }
  // heading change across zone
  const h1 = Math.atan2(Z[iA+4]-Z[iA], X[iA+4]-X[iA]), h2 = Math.atan2(Z[iB]-Z[iB-4], X[iB]-X[iB-4]);
  console.log(st.id, 'zone', sA, sB, 'chord', len.toFixed(1), 'max dev', maxd.toFixed(2), 'heading change deg', ((h2-h1)*180/Math.PI).toFixed(2));
}
// elevation stats
const el = i16(D.elev); let maxg = 0; for (let i = 1; i < el.length; i++){ const g = Math.abs(el[i]-el[i-1])/10/D.ES; if (g > maxg) maxg = g; } console.log('max grade', (maxg*1000).toFixed(1), 'permille; elev min/max', Math.min(...el)/10, Math.max(...el)/10);
for (const st of D.stations){ const i = Math.round(st.s/D.ES); console.log(st.id, 'elev around', Array.from(el.slice(Math.max(0,i-5), i+2)).map(v=>(v/10).toFixed(1)).join(' ')); }
// track count at stations
const nAt = s => { let n = 2; for (const [ss, nn] of D.tracks){ if (ss <= s) n = nn; else break; } return n; };
for (const st of D.stations) console.log(st.id, 'tracks at station', nAt(st.s - 200), nAt(st.s), nAt(st.s + 200));
console.log('tracks runs count', D.tracks.length, 'vmax runs', D.vmax.length, 'structs', D.structs.length);
console.log('--- bdx placement search (front s, max dev, heading change)');
for (let sf = 700; sf <= 1260; sf += 20){
  const sA = Math.max(0, sf - 460), sB = Math.min(D.L, sf + 40); const iA = Math.round(sA/DS), iB = Math.min(N-1, Math.round(sB/DS));
  const dx = X[iB]-X[iA], dz = Z[iB]-Z[iA], len = Math.hypot(dx,dz); let maxd = 0;
  for (let i = iA; i <= iB; i++){ const d = Math.abs(((X[i]-X[iA])*dz - (Z[i]-Z[iA])*dx)/len); if (d > maxd) maxd = d; }
  const h1 = Math.atan2(Z[iA+4]-Z[iA], X[iA+4]-X[iA]), h2 = Math.atan2(Z[iB]-Z[iB-4], X[iB]-X[iB-4]);
  console.log(sf, maxd.toFixed(1), ((h2-h1)*180/Math.PI).toFixed(1));
}
console.log('--- heading along 0..1400 every 100 m');
for (let s = 0; s <= 1400; s += 100){ const i = Math.round(s/DS); const h = Math.atan2(Z[Math.min(N-1,i+4)]-Z[i], X[Math.min(N-1,i+4)]-X[i])*180/Math.PI; console.log(s, h.toFixed(1)); }
