import json, os, time, urllib.request, urllib.parse, sys
MIRRORS = ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter',
           'https://overpass.private.coffee/api/interpreter', 'https://z.overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter']
Q = {   # name: Overpass body, saved as rails_<name>.json for build_route.py
 'hs':   'way["railway"="rail"]["highspeed"="yes"](44.70,-0.95,48.90,2.50);',
 'bdx':  'way["railway"="rail"](44.78,-0.66,45.05,-0.40);',
 'paris':'way["railway"="rail"](48.70,2.15,48.85,2.36);',
 # south to Toulouse: the Bordeaux - Sete line (640000) by number, and every track around the stations the TGV calls at
 'sud':  'way["railway"="rail"]["ref"="640000"](43.55,-0.62,44.85,1.50);',
 'agn':  'way["railway"="rail"](44.192,0.595,44.218,0.650);',
 'mtb':  'way["railway"="rail"](43.995,1.318,44.022,1.358);',
 'tls':  'way["railway"="rail"](43.592,1.425,43.632,1.478);',
 # the stops between Bordeaux and Paris off the LGV: the classic Paris - Bordeaux line (570000), the Poitiers - La Rochelle line (538000)
 # that the southern Poitiers connections join, and the connections from both to the LGV; then every track around each of those stations
 'classic':'way["railway"="rail"]["ref"~"^(570000|538000|538310|538311|570345|570350|570360|570380|570385|570390|431315)$"](44.80,-0.75,47.56,1.15);',
 'lbn':  'way["railway"="rail"](44.903,-0.263,44.929,-0.209);',
 'ang':  'way["railway"="rail"](45.641,0.137,45.667,0.191);',
 'pts':  'way["railway"="rail"](46.570,0.306,46.596,0.360);',
 'fut':  'way["railway"="rail"](46.657,0.351,46.683,0.405);',
 'chl':  'way["railway"="rail"](46.806,0.522,46.832,0.576);',
 'spc':  'way["railway"="rail"](47.373,0.697,47.399,0.751);',
}
EXTRA = {   # not rails: name: (Overpass body, output file, output statement)
 'wind': ('node["power"="generator"]["generator:source"="wind"](43.50,-0.95,48.90,2.50);', 'wind.json', 'out body;'),
 'stations_sud': ('nwr["railway"="station"]["name"~"^(Agen|Montauban Ville Bourbon|Toulouse-Matabiau)$"](43.55,0.55,44.25,1.50);', 'stations_sud.json', 'out center;'),
 'stations_ouest': ('nwr["railway"="station"]["name"~"^(Châtellerault|Futuroscope)$"](46.55,0.25,46.90,0.65);', 'stations_ouest.json', 'out center;'),
}
def fetch(name, body, out=None, stmt='out body;>;out skel qt;'):
    q = f'[out:json][timeout:240][maxsize:1073741824];({body});{stmt}'
    for attempt in range(8):
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'loco-explainer/1.0 (personal project)'})
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=300) as r:
                raw = r.read()
            d = json.loads(raw)
            if 'elements' not in d: raise ValueError('no elements')
            open(out or f'rails_{name}.json', 'wb').write(raw)
            print(name, 'OK', len(raw), 'bytes', len(d['elements']), 'elements', round(time.time() - t0, 1), 's', url, flush=True)
            return
        except Exception as e:
            print(name, 'attempt', attempt, url, 'FAIL', str(e)[:120], flush=True)
            time.sleep(15 + 15 * attempt)
    print(name, 'GAVE UP', flush=True)
# No argument: fetch what is missing. Names as arguments: refetch those.
only = sys.argv[1:]
for k, v in Q.items():
    if k in only or (not only and not os.path.exists(f'rails_{k}.json')): fetch(k, v)
for k, (v, out, stmt) in EXTRA.items():
    if k in only or (not only and not os.path.exists(out)): fetch(k, v, out, stmt)
print('DONE')
