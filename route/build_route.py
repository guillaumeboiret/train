#!/usr/bin/env python3
"""Bake the Bordeaux Saint-Jean -> Paris Montparnasse alignment from OSM + terrain tiles into loco/03a2-route.js.
Inputs: rails_*.json (Overpass, out body + skel nodes), stations.json. Elevation: AWS terrarium tiles (cached in ./tiles).
"""
import json, math, heapq, base64, struct, sys, os, io, urllib.request, time, glob
from PIL import Image

R = 6371008.8
D2R = math.pi / 180
def hav(a, b):
    la1, lo1 = a; la2, lo2 = b
    dl = (la2 - la1) * D2R; dn = (lo2 - lo1) * D2R
    h = math.sin(dl / 2) ** 2 + math.cos(la1 * D2R) * math.cos(la2 * D2R) * math.sin(dn / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))
def bearing(a, b):
    la1, lo1 = a; la2, lo2 = b
    y = math.sin((lo2 - lo1) * D2R) * math.cos(la2 * D2R)
    x = math.cos(la1 * D2R) * math.sin(la2 * D2R) - math.sin(la1 * D2R) * math.cos(la2 * D2R) * math.cos((lo2 - lo1) * D2R)
    return math.atan2(y, x)

# ------------------------------------------------------------------ load OSM
els = []
for f in sorted(glob.glob('rails_*.json')):
    d = json.load(open(f)); els += d['elements']; print('loaded', f, len(d['elements']))
nodes = {}; ways = {}
for e in els:
    if e['type'] == 'node': nodes[e['id']] = (e['lat'], e['lon'])
    elif e['type'] == 'way': ways[e['id']] = e
def usable(w):
    t = w.get('tags', {})
    if t.get('railway') != 'rail': return False
    if t.get('service') in ('siding', 'yard', 'spur'): return False
    if t.get('usage') in ('industrial', 'military', 'tourism', 'test'): return False
    if t.get('disused') == 'yes' or t.get('abandoned') == 'yes' or t.get('razed') == 'yes': return False
    return True
use = {wid: w for wid, w in ways.items() if usable(w) and all(n in nodes for n in w['nodes'])}
print('ways total', len(ways), 'usable', len(use), 'nodes', len(nodes))

# ------------------------------------------------------------------ graph
adj = {}
def add(u, v, wgt, wid):
    adj.setdefault(u, {}); adj.setdefault(v, {})
    if v not in adj[u] or adj[u][v][0] > wgt: adj[u][v] = (wgt, wid)
    if u not in adj[v] or adj[v][u][0] > wgt: adj[v][u] = (wgt, wid)
for wid, w in use.items():
    t = w.get('tags', {})
    k = 1.0 if t.get('highspeed') == 'yes' else 2.5
    if t.get('service') == 'crossover': k *= 1.5
    ns = w['nodes']
    for i in range(len(ns) - 1):
        d = hav(nodes[ns[i]], nodes[ns[i + 1]])
        add(ns[i], ns[i + 1], d * k, wid)

def nearest_node(lat, lon, maxd=400, pred=None):
    best = None
    for nid in adj:
        if pred and not pred(nid): continue
        d = hav((lat, lon), nodes[nid])
        if d < maxd and (best is None or d < best[0]): best = (d, nid)
    return best

def dijkstra(src, dst):
    dist = {src: 0}; prev = {}; pq = [(0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst: break
        if d > dist.get(u, 1e30): continue
        for v, (w, wid) in adj[u].items():
            nd = d + w
            if nd < dist.get(v, 1e30): dist[v] = nd; prev[v] = (u, wid); heapq.heappush(pq, (nd, v))
    if dst not in dist: return None
    path = []; u = dst
    while u != src: p, wid = prev[u]; path.append((u, wid)); u = p
    path.append((src, None)); path.reverse()
    return path   # list of (node, way used to arrive)

SRC = tuple(float(x) for x in sys.argv[1].split(',')) if len(sys.argv) > 1 else (44.8190, -0.5495)   # ~700 m south of Bordeaux Saint-Jean
DST = tuple(float(x) for x in sys.argv[2].split(',')) if len(sys.argv) > 2 else (48.8412, 2.3195)   # Paris Montparnasse buffer stops
s = nearest_node(*SRC, 600); t = nearest_node(*DST, 600)
print('src', s, 'dst', t)
path = dijkstra(s[1], t[1])
if not path: print('NO PATH'); sys.exit(1)
print('path nodes', len(path))

# ------------------------------------------------------------------ project along the path (bearing integration keeps true lengths)
P = [nodes[n] for n, _ in path]
E = [0.0]; N = [0.0]; S = [0.0]
for i in range(1, len(P)):
    d = hav(P[i - 1], P[i]); b = bearing(P[i - 1], P[i])
    E.append(E[-1] + d * math.sin(b)); N.append(N[-1] + d * math.cos(b)); S.append(S[-1] + d)
L = S[-1]
print('route length km', round(L / 1000, 2))
# way tags along the path
wtags = [use[wid].get('tags', {}) if wid else {} for _, wid in path]   # tag of the edge arriving at node i

def runs_from(fn, default):
    out = []; cur = None
    for i in range(1, len(path)):
        v = fn(wtags[i]); v = default if v is None else v
        if v != cur: out.append([S[i - 1], v]); cur = v
    return out
def msp(t):
    v = t.get('maxspeed') or t.get('maxspeed:forward') or t.get('maxspeed:backward')
    if v:
        try: return int(float(v.split()[0]))
        except: pass
    return 320 if t.get('highspeed') == 'yes' else 160
vmax = runs_from(msp, 160)
# merge short runs (< 300 m) into neighbours
def clean_runs(rs, minlen):
    rs = [r[:] for r in rs]
    changed = True
    while changed and len(rs) > 1:
        changed = False
        for i in range(len(rs)):
            s0 = rs[i][0]; s1 = rs[i + 1][0] if i + 1 < len(rs) else L
            if s1 - s0 < minlen:
                del rs[i]; changed = True; break
    out = []
    for r in rs:
        if out and out[-1][1] == r[1]: continue
        out.append(r)
    return out
vmax = clean_runs(vmax, 400)
structs = []
cur = None
for i in range(1, len(path)):
    t = wtags[i]
    kind = 'b' if t.get('bridge') in ('yes', 'viaduct') else ('t' if t.get('tunnel') in ('yes', 'building_passage') else ('c' if t.get('cutting') == 'yes' else None))
    key = (kind, t.get('name', '')) if kind else None
    if key != cur:
        if cur: structs[-1][1] = S[i - 1]
        if key: structs.append([S[i - 1], None, key[0], key[1]])
        cur = key
if cur: structs[-1][1] = L
structs = [x for x in structs if x[1] - x[0] > 40]
print('vmax runs', len(vmax), 'structures', len(structs))

# ------------------------------------------------------------------ dense samples every 100 m along the path (for terrain, track count)
def interp_at(sv):
    # binary search segment
    lo, hi = 0, len(S) - 1
    while hi - lo > 1:
        m = (lo + hi) // 2
        if S[m] <= sv: lo = m
        else: hi = m
    f = 0 if S[hi] == S[lo] else (sv - S[lo]) / (S[hi] - S[lo])
    lat = P[lo][0] + (P[hi][0] - P[lo][0]) * f; lon = P[lo][1] + (P[hi][1] - P[lo][1]) * f
    b = bearing(P[lo], P[hi]) if S[hi] > S[lo] else 0
    return lat, lon, b
ES = 100
NS = int(L // ES) + 2
samples = [interp_at(min(i * ES, L)) for i in range(NS)]

# ------------------------------------------------------------------ parallel track count (distinct lateral offsets of usable ways within 30 m)
cell = 0.01
grid = {}
for wid, w in use.items():
    ns = w['nodes']
    for i in range(len(ns) - 1):
        a = nodes[ns[i]]; b = nodes[ns[i + 1]]
        for la in range(int(min(a[0], b[0]) // cell), int(max(a[0], b[0]) // cell) + 1):
            for lo in range(int(min(a[1], b[1]) // cell), int(max(a[1], b[1]) // cell) + 1):
                grid.setdefault((la, lo), []).append((wid, a, b))
def local(p0, p):
    return ((p[1] - p0[1]) * D2R * R * math.cos(p0[0] * D2R), (p[0] - p0[0]) * D2R * R)
def seg_dist_lat(p0, a, b, tx, ty):
    ax, ay = local(p0, a); bx, by = local(p0, b)
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    u = 0 if l2 == 0 else max(0, min(1, -(ax * dx + ay * dy) / l2))
    qx, qy = ax + u * dx, ay + u * dy
    d = math.hypot(qx, qy)
    lat = -qx * ty + qy * tx    # signed lateral offset (left positive) relative to tangent (tx, ty)
    return d, lat
counts = []
for (lat, lon, b) in samples:
    tx, ty = math.sin(b), math.cos(b)
    la, lo = int(lat // cell), int(lon // cell)
    best = {}
    for dla in (-1, 0, 1):
        for dlo in (-1, 0, 1):
            for wid, a, bb in grid.get((la + dla, lo + dlo), []):
                d, off = seg_dist_lat((lat, lon), a, bb, tx, ty)
                if d < 30 and (wid not in best or best[wid][0] > d): best[wid] = (d, off)
    offs = sorted(o for d, o in best.values())
    clusters = []
    for o in offs:
        if not clusters or o - clusters[-1] > 2.2: clusters.append(o)
    counts.append(max(1, len(clusters)))
# median filter +-3 samples, then runs
def med(arr, k):
    out = []
    for i in range(len(arr)):
        win = sorted(arr[max(0, i - k):i + k + 1]); out.append(win[len(win) // 2])
    return out
counts = med(counts, 3)
tracks = []
for i, c in enumerate(counts):
    c = min(c, 8)
    if not tracks or tracks[-1][1] != c: tracks.append([i * ES, c])
tracks = clean_runs(tracks, 300)
print('track runs', len(tracks), 'hist', {c: counts.count(c) for c in sorted(set(counts))})

# ------------------------------------------------------------------ elevation (terrarium z12, cached)
Z = 12
os.makedirs('tiles', exist_ok=True)
tile_cache = {}
def tile(tx, ty):
    key = (tx, ty)
    if key in tile_cache: return tile_cache[key]
    fn = f'tiles/{Z}_{tx}_{ty}.png'
    if not os.path.exists(fn):
        url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png'
        for k in range(5):
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'loco-explainer/1.0'})
                with urllib.request.urlopen(req, timeout=60) as r: open(fn, 'wb').write(r.read())
                break
            except Exception as e:
                print('tile fail', url, e); time.sleep(2 + 3 * k)
    im = Image.open(fn).convert('RGB'); px = im.load()
    tile_cache[key] = px
    return px
def elev(lat, lon):
    n = 2 ** Z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(lat * D2R) + 1 / math.cos(lat * D2R)) / math.pi) / 2 * n
    tx, ty = int(x), int(y)
    fx, fy = (x - tx) * 256 - 0.5, (y - ty) * 256 - 0.5
    def px(i, j):
        ttx, tty = tx, ty
        if i < 0: ttx -= 1; i += 256
        if i > 255: ttx += 1; i -= 256
        if j < 0: tty -= 1; j += 256
        if j > 255: tty += 1; j -= 256
        r, g, b = tile(ttx, tty)[i, j]
        return r * 256 + g + b / 256 - 32768
    i0, j0 = int(math.floor(fx)), int(math.floor(fy))
    ax, ay = fx - i0, fy - j0
    return (px(i0, j0) * (1 - ax) * (1 - ay) + px(i0 + 1, j0) * ax * (1 - ay) + px(i0, j0 + 1) * (1 - ax) * ay + px(i0 + 1, j0 + 1) * ax * ay)
def offset(lat, lon, b, w):
    # move w metres to the right of bearing b
    br = b + math.pi / 2
    dn = w * math.cos(br) / R / D2R; de = w * math.sin(br) / (R * math.cos(lat * D2R)) / D2R
    return lat + dn, lon + de
print('sampling elevation...', flush=True)
raw = [elev(lat, lon) for (lat, lon, b) in samples]
print('elev raw min/max', round(min(raw), 1), round(max(raw), 1))
# smooth (gaussian sigma 500 m) then slope-limit to 2.5 %
sig = 5.0; K = 15
ker = [math.exp(-0.5 * (k / sig) ** 2) for k in range(-K, K + 1)]
prof = []
for i in range(len(raw)):
    acc = 0; wsum = 0
    for k in range(-K, K + 1):
        j = min(max(i + k, 0), len(raw) - 1); acc += raw[j] * ker[k + K]; wsum += ker[k + K]
    prof.append(acc / wsum)
GMAX = 0.025 * ES
for i in range(1, len(prof)): prof[i] = min(prof[i], prof[i - 1] + GMAX); prof[i] = max(prof[i], prof[i - 1] - GMAX)
for i in range(len(prof) - 2, -1, -1): prof[i] = min(prof[i], prof[i + 1] + GMAX); prof[i] = max(prof[i], prof[i + 1] - GMAX)
# lateral terrain grid every 200 m
TW = [-1000, -600, -350, -200, -120, -60, 60, 120, 200, 350, 600, 1000]
TS = 200
ter = []
for i in range(0, NS, 2):
    lat, lon, b = samples[i]
    for w in TW:
        la, lo = offset(lat, lon, b, w); ter.append(elev(la, lo))
print('terrain samples', len(ter), 'tiles used', len(tile_cache))

# ------------------------------------------------------------------ stations
st = json.load(open('stations.json'))['elements']
WANT = { 'Bordeaux-Saint-Jean':('bdx', 'Bordeaux Saint-Jean', 2), 'Vendôme-Villiers TGV':('vdm', 'Vendôme-Villiers-sur-Loir TGV', 1), 'Massy-TGV':('msy', 'Massy TGV', 1) }
stations = []
def nearest_s(lat, lon):
    best = None
    for i, (la, lo, b) in enumerate(samples):
        d = hav((lat, lon), (la, lo))
        if best is None or d < best[0]: best = (d, i * ES)
    return best
for e in st:
    name = e.get('tags', {}).get('name', '')
    if name not in WANT: continue
    c = e.get('center', {'lat': e.get('lat'), 'lon': e.get('lon')})
    d, sv = nearest_s(c['lat'], c['lon'])
    sid, label, sets = WANT[name]
    print('station', name, 'offset m', round(d), 's', round(sv))
    if d > 1500: continue
    stations.append({ 'id': sid, 'name': label, 's': round(min(max(sv + 210, 470), L - 470), 1), 'sets': sets })
stations.append({ 'id': 'par', 'name': 'Paris Montparnasse', 's': round(L - 6, 1), 'sets': 2 })
stations.sort(key=lambda x: x['s'])

# ------------------------------------------------------------------ simplify path (Douglas-Peucker on the local plane), cap segment length
pts = list(zip(E, N))
def dp(pts, eps):
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay; l = math.hypot(dx, dy) or 1
        best = -1; bi = -1
        for i in range(a + 1, b):
            d = abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / l
            if d > best: best = d; bi = i
        if best > eps: keep[bi] = True; stack.append((a, bi)); stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]
simp = dp(pts, 0.35)
out = [simp[0]]
for p in simp[1:]:
    q = out[-1]; d = math.hypot(p[0] - q[0], p[1] - q[1])
    n = int(d // 2000) + 1
    for k in range(1, n + 1): out.append((q[0] + (p[0] - q[0]) * k / n, q[1] + (p[1] - q[1]) * k / n))
simp = out
print('points', len(pts), '-> simplified', len(simp))

def b64i16(vals):
    return base64.b64encode(struct.pack('<%dh' % len(vals), *[max(-32768, min(32767, int(round(v)))) for v in vals])).decode()
dxy = []
px, py = 0, 0
for (x, y) in simp:
    xi, yi = int(round(x * 10)), int(round(y * 10))
    dxy += [xi - px, yi - py]; px, py = xi, yi
route = {
    'name': 'Bordeaux Saint-Jean → Paris Montparnasse',
    'L': round(L, 1), 'np': len(simp), 'xy': b64i16(dxy),
    'ES': ES, 'elev': b64i16([v * 10 for v in prof]),
    'TS': TS, 'TW': TW, 'ter': b64i16([v * 10 for v in ter]),
    'tracks': [[round(a, 1), b] for a, b in tracks], 'vmax': [[round(a, 1), b] for a, b in vmax],
    'structs': [[round(a, 1), round(b, 1), k, n] for a, b, k, n in structs],
    'stations': stations,
    'src': 'Tracé: © OpenStreetMap contributors (ODbL). Relief: Mapzen/AWS Terrain Tiles (SRTM). Profil de la voie lissé et limité à 2,5 %.',
}
js = 'const ROUTE_DATA = ' + json.dumps(route, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('../loco/03a2-route.js', 'w').write('\n/* ============================================================ ROUTE DATA (baked by route/build_route.py) */\n' + js)
json.dump({ 'L': L, 'stations': stations, 'tracks': tracks, 'vmax': vmax, 'structs': structs, 'prof': prof[::10], 'raw': raw[::10] }, open('route_debug.json', 'w'), ensure_ascii=False)
print('wrote 03a2-route.js', len(js), 'bytes; stations', stations)
