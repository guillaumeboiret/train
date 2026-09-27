/* ============================================================ track graph (pure, no THREE) */
const SP = 3;   // spacing between parallel tracks
const TL = 6;   // length of a turnout S-curve
const nkey = (x, y) => (Math.round(x * 100) / 100) + ',' + (Math.round(y * 100) / 100);
const norm2 = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

function makeCurve(kind, p){
  const N = kind === 'L' ? 1 : 48;
  const pts = [];
  for (let i = 0; i <= N; i++){
    const t = i / N;
    if (kind === 'L') pts.push([p[0][0] + (p[1][0] - p[0][0]) * t, p[0][1] + (p[1][1] - p[0][1]) * t]);
    else {
      const mt = 1 - t, a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
      pts.push([a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]);
    }
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const len = cum[cum.length - 1];
  function at(s){
    s = Math.max(0, Math.min(len, s));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1){ const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const seg = cum[hi] - cum[lo] || 1, f = (s - cum[lo]) / seg;
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f,
            (pts[hi][0] - pts[lo][0]) / seg, (pts[hi][1] - pts[lo][1]) / seg];
  }
  return { kind, p, pts, cum, len, at };
}

function outTangent(e, nodeId){
  const c = e.curve;
  if (e.a === nodeId){ const q = c.at(Math.min(0.5, c.len)); return norm2([q[0] - c.pts[0][0], q[1] - c.pts[0][1]]); }
  const q = c.at(Math.max(c.len - 0.5, 0)), last = c.pts[c.pts.length - 1];
  return norm2([q[0] - last[0], q[1] - last[1]]);
}

function buildTrack(spec){
  let segs = [];
  for (const t of spec.tracks){
    if (t[0] === 'L') segs.push({ kind: 'L', p: [[t[1], t[2]], [t[3], t[4]]] });
    else if (t[0] === 'T'){ const x = t[1], y = t[2], dir = t[3], side = t[4], L = t[5] || TL, g = t[6] || SP;
      segs.push({ kind: 'B', p: [[x, y], [x + dir * L / 2, y], [x + dir * L / 2, y + side * g], [x + dir * L, y + side * g]] }); }
    else if (t[0] === 'C') segs.push({ kind: 'B', p: [[t[1], t[2]], [t[3], t[4]], [t[5], t[6]], [t[7], t[8]]] });
  }
  const endpoints = [];
  for (const s of segs) endpoints.push(s.p[0], s.p[s.p.length - 1]);
  let changed = true;
  while (changed){
    changed = false;
    const out = [];
    for (const s of segs){
      if (s.kind !== 'L'){ out.push(s); continue; }
      const [A, B] = s.p, dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy;
      let split = null;
      for (const P of endpoints){
        const t = ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / L2;
        if (t <= 1e-6 || t >= 1 - 1e-6) continue;
        if (Math.hypot(A[0] + dx * t - P[0], A[1] + dy * t - P[1]) < 1e-6){ split = [A[0] + dx * t, A[1] + dy * t]; break; }
      }
      if (split){ out.push({ kind: 'L', p: [A, split] }, { kind: 'L', p: [split, B] }); changed = true; }
      else out.push(s);
    }
    segs = out;
  }
  const nodes = new Map(), edges = [], problems = [];
  const getNode = (P) => { const k = nkey(P[0], P[1]); if (!nodes.has(k)) nodes.set(k, { id: k, x: P[0], y: P[1], edges: [], kind: 'through', station: null, toe: -1, branches: null, state: 0 }); return nodes.get(k); };
  segs.forEach((s, i) => {
    const a = getNode(s.p[0]), b = getNode(s.p[s.p.length - 1]);
    if (a === b){ problems.push('degenerate segment at ' + a.id); return; }
    edges.push({ id: i, a: a.id, b: b.id, curve: makeCurve(s.kind, s.p) });
    a.edges.push(i); b.edges.push(i);
  });
  for (const n of nodes.values()){
    if (n.edges.length === 1) n.kind = 'terminal';
    else if (n.edges.length === 2) n.kind = 'through';
    else if (n.edges.length === 3){
      n.kind = 'switch';
      const tg = n.edges.map(id => outTangent(edges[id], n.id));
      let best = -1, bestScore = -Infinity;
      for (let i = 0; i < 3; i++){
        const j = (i + 1) % 3, k = (i + 2) % 3;
        const score = -(tg[i][0] * (tg[j][0] + tg[k][0]) + tg[i][1] * (tg[j][1] + tg[k][1])) + (tg[j][0] * tg[k][0] + tg[j][1] * tg[k][1]);
        if (score > bestScore){ bestScore = score; best = i; }
      }
      if (bestScore < 1.2) problems.push('ambiguous switch at ' + n.id + ' score ' + bestScore.toFixed(2));
      n.toe = n.edges[best];
      const tt = tg[best];
      const br = n.edges.filter(id => id !== n.toe);
      const align = (id) => { const t = outTangent(edges[id], n.id); return -(t[0] * tt[0] + t[1] * tt[1]); };
      br.sort((p, q) => align(q) - align(p));
      n.branches = br;
    } else { n.kind = 'bad'; problems.push('node ' + n.id + ' has ' + n.edges.length + ' edges'); }
  }
  for (const st of spec.stations || []){
    const n = nodes.get(nkey(st.at[0], st.at[1]));
    if (!n){ problems.push('station ' + st.l + ' not on a node'); continue; }
    if (n.kind !== 'terminal') problems.push('station ' + st.l + ' not at a terminal');
    n.station = { letter: st.l, role: 'station' };
  }
  const byLetter = (l) => [...nodes.values()].find(n => n.station && n.station.letter === l);
  for (const tr of spec.trains || []){
    const from = byLetter(tr.from), to = byLetter(tr.to);
    if (!from) problems.push('train from unknown station ' + tr.from); else from.station.role = 'portal';
    if (!to) problems.push('train to unknown station ' + tr.to);
  }
  for (const [k, v] of Object.entries(spec.switches || {})){
    const n = nodes.get(k);
    if (!n || n.kind !== 'switch') problems.push('switch spec ' + k + ' is not a switch'); else n.state = v;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of edges) for (const p of e.curve.pts){ minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  return { nodes, edges, problems, bounds: { minX, minY, maxX, maxY }, byLetter };
}

/* ------------------------------------------------------------ movement */
function edgePos(track, edgeId, dir, s){
  const c = track.edges[edgeId].curve;
  if (dir > 0) return c.at(s);
  const q = c.at(c.len - s);
  return [q[0], q[1], -q[2], -q[3]];
}
function nextEdge(node, fromEdgeId){
  if (node.kind === 'terminal') return { edge: null, flipped: -1 };
  if (node.kind === 'through') return { edge: node.edges[0] === fromEdgeId ? node.edges[1] : node.edges[0], flipped: -1 };
  if (node.kind === 'switch'){
    if (fromEdgeId === node.toe) return { edge: node.branches[node.state], flipped: -1 };
    const idx = node.branches.indexOf(fromEdgeId);
    return { edge: node.toe, flipped: idx !== node.state ? idx : -1 };
  }
  return { edge: null, flipped: -1 };
}
function placeTrain(track, tr, node, s){
  const e = track.edges[node.edges[0]];
  tr.edge = e.id; tr.dir = e.a === node.id ? 1 : -1; tr.s = s;
  tr.route = [{ edge: tr.edge, dir: tr.dir }];
}
function advanceTrain(track, tr, ds){
  const events = [];
  let guard = 0;
  while (ds > 0 && guard++ < 50){
    const e = track.edges[tr.edge];
    const remain = e.curve.len - tr.s;
    if (ds < remain){ tr.s += ds; break; }
    ds -= remain;
    const endNode = track.nodes.get(tr.dir > 0 ? e.b : e.a);
    const nx = nextEdge(endNode, tr.edge);
    if (nx.flipped >= 0){ endNode.state = nx.flipped; events.push({ type: 'flip', node: endNode }); }
    if (nx.edge == null){ tr.s = e.curve.len; events.push({ type: 'end', node: endNode }); break; }
    const ne = track.edges[nx.edge];
    tr.edge = nx.edge; tr.dir = ne.a === endNode.id ? 1 : -1; tr.s = 0;
    tr.route.push({ edge: tr.edge, dir: tr.dir });
    events.push({ type: 'node', node: endNode });
  }
  return events;
}
function posBehind(track, tr, back){
  let s = tr.s;
  for (let i = tr.route.length - 1; i >= 0; i--){
    const r = tr.route[i];
    if (back <= s){ const p = edgePos(track, r.edge, r.dir, s - back); p[4] = false; return p; }
    back -= s;
    if (i > 0) s = track.edges[tr.route[i - 1].edge].curve.len;
  }
  const r0 = tr.route[0], p = edgePos(track, r0.edge, r0.dir, 0);
  return [p[0] - p[2] * back, p[1] - p[3] * back, p[2], p[3], true];
}
function distanceAhead(track, tr, node){ // distance from head to a node along the deterministic path (or Infinity)
  let d = 0, edge = tr.edge, dir = tr.dir, s = tr.s, guard = 0;
  while (guard++ < 30){
    const e = track.edges[edge];
    d += e.curve.len - s;
    const endNode = track.nodes.get(dir > 0 ? e.b : e.a);
    if (endNode === node) return d;
    const nx = nextEdge(endNode, edge);
    if (nx.edge == null) return Infinity;
    const ne = track.edges[nx.edge];
    edge = nx.edge; dir = ne.a === endNode.id ? 1 : -1; s = 0;
  }
  return Infinity;
}
/* reachability under switch semantics (for level validation and hints) */
function reachableTerminals(track, fromNode){
  const e0 = track.edges[fromNode.edges[0]];
  const start = e0.id + ':' + (e0.a === fromNode.id ? 1 : -1);
  const seen = new Set([start]), stack = [start], out = new Set();
  while (stack.length){
    const [eid, dir] = stack.pop().split(':').map(Number);
    const e = track.edges[eid];
    const endNode = track.nodes.get(dir > 0 ? e.b : e.a);
    let nexts = [];
    if (endNode.kind === 'terminal'){ out.add(endNode.id); continue; }
    if (endNode.kind === 'through') nexts = [endNode.edges[0] === eid ? endNode.edges[1] : endNode.edges[0]];
    else if (endNode.kind === 'switch') nexts = eid === endNode.toe ? endNode.branches.slice() : [endNode.toe];
    for (const n of nexts){
      const ne = track.edges[n], nd = ne.a === endNode.id ? 1 : -1, k = n + ':' + nd;
      if (!seen.has(k)){ seen.add(k); stack.push(k); }
    }
  }
  return out;
}
