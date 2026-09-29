#!/usr/bin/env python3
"""Bake the Toulouse Matabiau -> Bordeaux Saint-Jean -> Paris Montparnasse alignment from OSM + terrain tiles into loco/03a2-route.js.
Inputs: rails_*.json (Overpass, out body + skel nodes), stations.json, stations_sud.json, stations_ouest.json. Elevation: AWS terrarium tiles (cached in ./tiles).
Legs: Toulouse -> the old Bordeaux start (the southern half stays metre for metre what it was), then on to Paris through every station
a Paris - Bordeaux TGV calls at off the LGV (VIA), on the LGV everywhere else.
"""
import json, math, heapq, base64, struct, sys, os, io, urllib.request, time, glob, re
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
def msp(t):
    v = t.get('maxspeed') or t.get('maxspeed:forward') or t.get('maxspeed:backward')
    if v:
        try: return int(float(v.split()[0]))
        except: pass
    return 320 if t.get('highspeed') == 'yes' else 160

# ------------------------------------------------------------------ graph
adj = {}   # node -> {next node: (weight, way, heading from node to next (None under 0.5 m), running time)}
def add(u, v, wgt, wid, d, tm):
    adj.setdefault(u, {}); adj.setdefault(v, {})
    h = bearing(nodes[u], nodes[v]) if d >= 0.5 else None
    if v not in adj[u] or adj[u][v][0] > wgt: adj[u][v] = (wgt, wid, h, tm)
    if u not in adj[v] or adj[v][u][0] > wgt: adj[v][u] = (wgt, wid, None if h is None else h + math.pi, tm)
for wid, w in use.items():
    t = w.get('tags', {})
    k = 1.0 if t.get('highspeed') == 'yes' else 2.5
    x = 1.5 if t.get('service') == 'crossover' else 1
    ns = w['nodes']
    for i in range(len(ns) - 1):
        d = hav(nodes[ns[i]], nodes[ns[i + 1]])
        add(ns[i], ns[i + 1], d * k * x, wid, d, d * x / max(msp(t), 30))

def nearest_node(lat, lon, maxd=400, pred=None):
    best = None
    for nid in adj:
        if pred and not pred(nid): continue
        d = hav((lat, lon), nodes[nid])
        if d < maxd and (best is None or d < best[0]): best = (d, nid)
    return best

def dijkstra(src, dst, back=None, cost=0):
    """Shortest path a train can run: over (node, node it came from) states, so it never folds back through a switch or at a stop
    (a turn over 90 degrees at a node). back: the node the train came into src from. cost: 0 adds up the weight, 3 the running time."""
    dist = {(src, back): 0}; prev = {}; pq = [(0, src, back)]; end = None
    while pq:
        d, v, u = heapq.heappop(pq)
        if v == dst: end = (v, u); break
        if d > dist.get((v, u), 1e30): continue
        hin = adj[u][v][2] if u is not None else None
        for w, e in adj[v].items():
            h = e[2]
            if w == u or (hin is not None and h is not None and abs((h - hin + math.pi) % (2 * math.pi) - math.pi) > math.pi / 2): continue
            nd = d + e[cost]
            if nd < dist.get((w, v), 1e30): dist[(w, v)] = nd; prev[(w, v)] = ((v, u), e[1]); heapq.heappush(pq, (nd, w, v))
    if end is None: return None
    path = []; x = end
    while x != (src, back): p, wid = prev[x]; path.append((x[0], wid)); x = p
    path.append((src, None)); path.reverse()
    return path   # list of (node, way used to arrive)

SRC = (43.6012823, 1.4585053)   # Toulouse: main line 1.1 km south of the Matabiau building, past the platforms on the Narbonne side
MID = (44.8190, -0.5495)        # ~700 m south of Bordeaux Saint-Jean: the start of the old Bordeaux -> Paris route
DST = (48.8412, 2.3195)         # Paris Montparnasse buffer stops
st = json.load(open('stations.json'))['elements'] + json.load(open('stations_sud.json'))['elements'] + json.load(open('stations_ouest.json'))['elements']
def st_pos(name):
    e = next(e for e in st if e.get('tags', {}).get('name') == name)
    c = e.get('center', e); return c['lat'], c['lon']
# the calls on the classic line, south to north: the path goes through a main line node next to each station building
VIA = ['Libourne', 'Angoulême', 'Poitiers', 'Futuroscope', 'Châtellerault', 'Saint-Pierre-des-Corps']
main = set()   # nodes of the through lines (not sidings, yards or crossovers)
for w in use.values():
    t = w.get('tags', {})
    if 'service' not in t and t.get('ref') in ('570000', '538000'): main.update(w['nodes'])
s = nearest_node(*SRC, 600); m = nearest_node(*MID, 600); t = nearest_node(*DST, 600)
via = [nearest_node(*st_pos(n), 400, lambda nid: nid in main) for n in VIA]
print('src', s, 'mid', m, 'dst', t, 'via', [(n, round(v[0])) for n, v in zip(VIA, via)])
leg1 = dijkstra(s[1], m[1])
if not leg1: print('NO PATH'); sys.exit(1)
# from Bordeaux on, each leg leaves a stop the way the train came in and takes the quickest line, as TGVs do (the shortest one
# leaves Bordeaux on the 110 km/h Chartres line through Bassens); leg1 keeps the weight it was built and checked with
leg2 = [(m[1], None)]
for a, b in zip([m] + via, via + [t]):
    part = dijkstra(a[1], b[1], (leg1 if len(leg2) == 1 else leg2)[-2][0], 3)
    if not part: print('NO PATH to', b); sys.exit(1)
    leg2 += part[1:]
path = leg1 + leg2[1:]
print('path nodes', len(path), 'legs', len(leg1), len(leg2))

# ------------------------------------------------------------------ project along the path (bearing integration keeps true lengths)
P = [nodes[n] for n, _ in path]
W = [wid for _, wid in path]      # way used to arrive at node i
def run_s(P):
    S = [0.0]
    for i in range(1, len(P)): S.append(S[-1] + hav(P[i - 1], P[i]))
    return S
# cut the first metres so the old start lands on a multiple of 200 m: its 100 m samples and 200 m terrain rows then fall where they did
S = run_s(P); cut = S[len(leg1) - 1] % 200
j = next(i for i in range(1, len(S)) if S[i] > cut)
f = (cut - S[j - 1]) / (S[j] - S[j - 1])
P = [(P[j - 1][0] + (P[j][0] - P[j - 1][0]) * f, P[j - 1][1] + (P[j][1] - P[j - 1][1]) * f)] + P[j:]
W = [None] + W[j:]
OFF = run_s(P)[len(leg1) - j]     # the old start (Bordeaux, 700 m south of Saint-Jean) on the new route
print('trimmed', round(cut, 1), 'm at the Toulouse end; old start at s =', round(OFF, 1))
E = [0.0]; N = [0.0]; S = [0.0]
for i in range(1, len(P)):
    d = hav(P[i - 1], P[i]); b = bearing(P[i - 1], P[i])
    E.append(E[-1] + d * math.sin(b)); N.append(N[-1] + d * math.cos(b)); S.append(S[-1] + d)
L = S[-1]
print('route length km', round(L / 1000, 2))
# no reversal through a switch: the heading may turn, never fold back
kinks = []
for i in range(1, len(P) - 1):
    if S[i] - S[i - 1] < 0.5 or S[i + 1] - S[i] < 0.5: continue
    a = bearing(P[i - 1], P[i]); b = bearing(P[i], P[i + 1]); da = abs((b - a + math.pi) % (2 * math.pi) - math.pi)
    if da > 0.5: kinks.append((round(S[i]), round(da / D2R)))
print('kinks > 29 deg', kinks[:20])
# way tags along the path
wtags = [use[wid].get('tags', {}) if wid else {} for wid in W]   # tag of the edge arriving at node i

def runs_from(fn, default):
    out = []; cur = None
    for i in range(1, len(P)):
        v = fn(wtags[i]); v = default if v is None else v
        if v != cur: out.append([S[i - 1], v]); cur = v
    return out
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
# supply voltage (1500 V DC on the classic lines into Bordeaux and Paris and all the way south, 25 kV AC on the LGV); untagged ways keep the one before
def volts(t):
    v = (t.get('voltage') or '').split(';')[0]
    return int(v) if v.isdigit() else None
volt = []; cur = None
for i in range(1, len(P)):
    v = volts(wtags[i]) or cur or 1500
    if v != cur: volt.append([S[i - 1], v]); cur = v
volt = clean_runs(volt, 1000)
print('voltage runs', [(round(a), v) for a, v in volt])
structs = []
cur = None
for i in range(1, len(P)):
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
WANT = { 'Toulouse-Matabiau':('tls', 'Toulouse Matabiau', 2), 'Montauban Ville Bourbon':('mtb', 'Montauban Ville Bourbon', 1), 'Agen':('agn', 'Agen', 1),
         'Bordeaux-Saint-Jean':('bdx', 'Bordeaux Saint-Jean', 2), 'Libourne':('lbn', 'Libourne', 2), 'Angoulême':('ang', 'Angoulême', 2),
         'Poitiers':('pts', 'Poitiers', 2), 'Futuroscope':('fut', 'Futuroscope', 2), 'Châtellerault':('chl', 'Châtellerault', 1),
         'Saint-Pierre-des-Corps':('spc', 'Saint-Pierre-des-Corps', 2), 'Vendôme-Villiers TGV':('vdm', 'Vendôme-Villiers-sur-Loir TGV', 2), 'Massy-TGV':('msy', 'Massy TGV', 2) }   # sets: 2 where the OSM platforms reach 400 m
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
# where the tour's 320 km/h step drops the train: 3.8 km into the first 20 km cleared for 320 north of Bordeaux
bdx_s = next(x['s'] for x in stations if x['id'] == 'bdx')
FAST = next(round(a + 3800, -2) for (a, v), b in zip(vmax, [r[0] for r in vmax[1:]] + [L]) if a > bdx_s and v >= 320 and b - a >= 20000)
print('tour step 5 at', FAST)

# ------------------------------------------------------------------ wind turbines: the real ones within 6 km of the line (OSM power=generator,
# generator:source=wind, in wind.json from fetch_rails.py). Placed in the route plane from their nearest 100 m sample plus their own east/north
# offset (a sample's bearing is too noisy to carry a point 5 km sideways); (s, w) kept for the ground near the line. Hub height and rotor from
# their tags (height is the tip when it clears half a rotor above hub level, else the hub), else their farm's median, else 90 m and 100 m.
# Micro turbines (rotor under 20 m or under 40 m tall) are left out, and so is an untagged turbine with no farm around it.
def en_at(sv):
    lo, hi = 0, len(S) - 1
    while hi - lo > 1:
        m = (lo + hi) // 2
        if S[m] <= sv: lo = m
        else: hi = m
    f = 0 if S[hi] == S[lo] else (sv - S[lo]) / (S[hi] - S[lo])
    return E[lo] + (E[hi] - E[lo]) * f, N[lo] + (N[hi] - N[lo]) * f
def tnum(t, k):
    m = re.match(r'\s*(\d+(?:[.,]\d+)?)', t.get(k, ''))
    return float(m.group(1).replace(',', '.')) if m else None
def model_d(t):   # V112-3.0MW, N117/3000, SWT130, E-92, SGRE 155-6,6 MW: the rotor diameter is the model's number
    m = re.search(r'(?:^|[^\d.,])(\d{2,3})(?![\d.,])', t.get('model') or t.get('generator:model') or '')
    return float(m.group(1)) if m and 40 <= float(m.group(1)) <= 175 else None
WIND_W = 6000
SEN = [en_at(min(i * ES, L)) for i in range(NS)]
cells = {}
for i, (la, lo, b) in enumerate(samples): cells.setdefault((math.floor(la * 10), math.floor(lo * 10)), []).append(i)
wind = []
for e in json.load(open('wind.json'))['elements']:
    la, lo, t = e['lat'], e['lon'], e.get('tags', {})
    ci, cj = math.floor(la * 10), math.floor(lo * 10)
    best = min(((hav((la, lo), samples[i][:2]), i) for a in (ci - 1, ci, ci + 1) for b in (cj - 1, cj, cj + 1) for i in cells.get((a, b), ())), default=None)
    if best is None or best[0] > WIND_W + 100: continue
    i = best[1]; sla, slo, _ = samples[i]
    de = (lo - slo) * D2R * R * math.cos(sla * D2R); dn = (la - sla) * D2R * R
    (ea, na), (eb, nb) = SEN[max(0, i - 1)], SEN[min(NS - 1, i + 1)]
    tl = math.hypot(eb - ea, nb - na) or 1; tx, ty = (eb - ea) / tl, (nb - na) / tl
    w = de * ty - dn * tx
    if abs(w) > WIND_W: continue
    D = tnum(t, 'rotor:diameter') or model_d(t); H = tnum(t, 'height'); hub = tnum(t, 'height:hub')
    if (D is not None and D < 20) or (H is not None and H < 40 and hub is None): continue
    wind.append({ 'E': SEN[i][0] + de, 'N': SEN[i][1] + dn, 'la': la, 'lo': lo, 's': min(max(i * ES + de * tx + dn * ty, 0), L), 'w': w, 'D': D, 'H': H, 'hub': hub,
                  'tagged': any(k in t for k in ('model', 'height', 'height:hub', 'rotor:diameter', 'manufacturer', 'generator:output:electricity')) })
farm = list(range(len(wind)))
def froot(k):
    while farm[k] != k: farm[k] = farm[farm[k]]; k = farm[k]
    return k
for a in range(len(wind)):
    for b in range(a + 1, len(wind)):
        if math.hypot(wind[a]['E'] - wind[b]['E'], wind[a]['N'] - wind[b]['N']) < 2000: farm[froot(a)] = froot(b)
farms = {}
for k in range(len(wind)): farms.setdefault(froot(k), []).append(wind[k])
def median(v): v = sorted(v); return v[len(v) // 2] if v else None
WIND = []
for grp in farms.values():
    if len(grp) < 3: grp = [u for u in grp if u['tagged']]
    if not grp: continue
    mD = median([u['D'] for u in grp if u['D']]) or 100
    for u in grp:
        if not u['hub'] and u['H'] and not u['D']: u['D'] = mD
        if not u['hub'] and u['H']: u['hub'] = u['H'] - u['D'] / 2 if u['H'] - u['D'] / 2 >= 0.55 * u['D'] else u['H']
    mH = median([u['hub'] for u in grp if u['hub']]) or 90
    for u in grp: WIND.append([round(u['E'], 1), round(u['N'], 1), round(elev(u['la'], u['lo']), 1), round(u['hub'] or mH, 1), round(u['D'] or mD, 1), round(u['s']), round(u['w'])])
WIND.sort(key=lambda v: v[5])
print('wind turbines', len(WIND), 'in', sum(1 for g in farms.values() if len(g) >= 3), 'farms; tiles used', len(tile_cache))

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
    'name': 'Toulouse Matabiau → Bordeaux Saint-Jean → Paris Montparnasse',
    'L': round(L, 1), 'np': len(simp), 'xy': b64i16(dxy),
    'ES': ES, 'elev': b64i16([v * 10 for v in prof]),
    'TS': TS, 'TW': TW, 'ter': b64i16([v * 10 for v in ter]),
    'tracks': [[round(a, 1), b] for a, b in tracks], 'vmax': [[round(a, 1), b] for a, b in vmax], 'volt': [[round(a, 1), b] for a, b in volt],
    'structs': [[round(a, 1), round(b, 1), k, n] for a, b, k, n in structs],
    'stations': stations, 'fast': FAST, 'wind': WIND,
    'src': 'Tracé: © OpenStreetMap contributors (ODbL). Relief: Mapzen/AWS Terrain Tiles (SRTM). Profil de la voie lissé et limité à 2,5 %.',
}
js = 'const ROUTE_DATA = ' + json.dumps(route, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('../loco/03a2-route.js', 'w').write('\n/* ============================================================ ROUTE DATA (baked by route/build_route.py) */\n' + js)
json.dump({ 'L': L, 'OFF': OFF, 'stations': stations, 'tracks': tracks, 'vmax': vmax, 'volt': volt, 'structs': structs, 'prof': prof[::10], 'raw': raw[::10] }, open('route_debug.json', 'w'), ensure_ascii=False)
print('wrote 03a2-route.js', len(js), 'bytes; stations', stations)
