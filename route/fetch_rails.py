import json, time, urllib.request, urllib.parse, sys
MIRRORS = ['https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter', 'https://overpass-api.de/api/interpreter']
Q = {
 'hs':   'way["railway"="rail"]["highspeed"="yes"](44.70,-0.95,48.90,2.50);',
 'bdx':  'way["railway"="rail"](44.78,-0.66,45.05,-0.40);',
 'paris':'way["railway"="rail"](48.70,2.15,48.85,2.36);',
 'monts':'way["railway"="rail"](47.20,0.55,47.40,0.80);',
}
def fetch(name, body):
    q = f'[out:json][timeout:240][maxsize:1073741824];({body});out body;>;out skel qt;'
    for attempt in range(8):
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'loco-explainer/1.0 (personal project)'})
            t0 = time.time()
            with urllib.request.urlopen(req, timeout=300) as r:
                raw = r.read()
            d = json.loads(raw)
            if 'elements' not in d: raise ValueError('no elements')
            open(f'rails_{name}.json', 'wb').write(raw)
            print(name, 'OK', len(raw), 'bytes', len(d['elements']), 'elements', round(time.time() - t0, 1), 's', url, flush=True)
            return
        except Exception as e:
            print(name, 'attempt', attempt, url, 'FAIL', str(e)[:120], flush=True)
            time.sleep(15 + 15 * attempt)
    print(name, 'GAVE UP', flush=True)
for k, v in Q.items(): fetch(k, v)
print('DONE')
