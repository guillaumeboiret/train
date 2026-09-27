import fs from 'node:fs';
const src = fs.readFileSync('g2-track.js','utf8') + fs.readFileSync('g3-levels.js','utf8') + '\nreturn {buildTrack, LEVELS, reachableTerminals, placeTrain, advanceTrain, nextEdge};';
const M = new Function(src)();
let bad = 0;
M.LEVELS.forEach((L, i) => {
  const t = M.buildTrack(L);
  const sw = [...t.nodes.values()].filter(n => n.kind === 'switch');
  const term = [...t.nodes.values()].filter(n => n.kind === 'terminal');
  const lines = [];
  if (t.problems.length){ bad++; lines.push('  PROBLEMS: ' + t.problems.join(' | ')); }
  for (const tr of L.trains){
    const from = t.byLetter(tr.from), to = t.byLetter(tr.to);
    const reach = M.reachableTerminals(t, from);
    if (!reach.has(to.id)){ bad++; lines.push(`  UNREACHABLE ${tr.from}->${tr.to}`); }
  }
  // deterministic run with initial switch states, no player action (ignores collisions)
  const t2 = M.buildTrack(L);
  let trivial = true;
  for (const tr of L.trains){
    const from = t2.byLetter(tr.from), to = t2.byLetter(tr.to);
    const s = {}; M.placeTrain(t2, s, from, 0);
    const ev = M.advanceTrain(t2, s, 1000);
    const end = ev.find(e => e.type === 'end');
    if (!end || end.node !== to) trivial = false;
  }
  if (trivial){ bad++; lines.push('  TRIVIAL: solved with no action'); }
  const unnamedTerms = term.filter(n => !n.station).length;
  const switchKeys = sw.map(n => n.id + '(' + n.state + ')').join(' ');
  console.log(`L${i+1} ${L.name.en}: edges=${t.edges.length} switches=${sw.length} terminals=${term.length} buffers=${unnamedTerms} bounds=${t.bounds.minX},${t.bounds.minY}..${t.bounds.maxX},${t.bounds.maxY}`);
  console.log('  switches: ' + switchKeys);
  const specKeys = Object.keys(L.switches || {});
  const missing = sw.filter(n => !specKeys.includes(n.id)).map(n => n.id);
  if (missing.length) console.log('  (unspecified switch state, default 0): ' + missing.join(' '));
  lines.forEach(l => console.log(l));
});
console.log(bad ? `BAD=${bad}` : 'ALL LEVELS OK');
