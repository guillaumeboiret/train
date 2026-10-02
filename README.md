# train

Three static [Three.js](https://threejs.org) pages about trains, in French and English. A personal side project.

| Page | What it is | Live |
|---|---|---|
| `locomotive-3d.html` | **Anatomie d'une locomotive**: an interactive explainer of a diesel-electric locomotive, an electric locomotive and a TGV Duplex, driven along the real Toulouse Matabiau to Paris Montparnasse line with its TGV stops (Montauban, Agen, Bordeaux Saint-Jean, Libourne, Angoulême, Poitiers, Futuroscope, Châtellerault, Saint-Pierre-des-Corps, Vendôme and Massy; 829.5 km: the classic lines under 1.5 kV DC through the towns, the LGVs under 25 kV AC between them), with a nine-step guide, energy-flow animations, station autopilot, weather and time scale. Inside the TGV: drive from the cab, walk among the passengers car to car and sit in a free seat, or order at the bar in car 4 with play money | [train.boiret.com/locomotive](https://train.boiret.com/locomotive/) |
| `locomotive-kid.html` | **Conducteur de train**: the same engine with one screen of big buttons for young children (lever, horn, pantograph, next station autopilot in both directions, cameras, weather, sound) | [train.boiret.com/conducteur](https://train.boiret.com/conducteur/) |
| `aiguillages.html` | **Aiguillages**: a railway switch puzzle game, 10 levels plus a tutorial | [train.boiret.com/aiguillages](https://train.boiret.com/aiguillages/) |

Each page is plain HTML plus one ES module. Three.js 0.170 is loaded from jsDelivr, nothing else is fetched at runtime.

## Build

```sh
bash loco/build.sh   # writes locomotive-3d.html and locomotive-kid.html at the repo root
bash game/build.sh   # writes aiguillages.html
```

Both scripts concatenate the split sources, run `node --check` on the extracted module and write local test wrappers (`loco/locomotive-test.html`, `loco/kid-test.html`, `loco/aiguillages-test.html`).

The three built pages at the root have no doctype and no `<head>` on purpose: they are published as claude.ai artifacts, and that host wraps them in its own document skeleton. To try them locally, serve the test wrappers, which add the missing skeleton:

```sh
cd loco && python3 -m http.server 8765
# http://localhost:8765/locomotive-test.html
# http://localhost:8765/kid-test.html
# http://localhost:8765/aiguillages-test.html
```

## Site

https://train.boiret.com serves the three pages plus a landing page. `site/build.sh` gives each built page a real document head and points its links to the other pages at the site paths (`/conducteur/`, `/locomotive/`, `/aiguillages/`); the root `Dockerfile` runs it and serves the result with Caddy (`site/Caddyfile`). Railway builds that image on every push to `main`, and `/version.txt` gives the commit that is live. Local preview: `sh site/build.sh && python3 -m http.server -d site/public 8767`.

### Languages

The whole site speaks one language at a time, French or English. `site/lang.js`, inlined first in every page's head by `site/build.sh`, picks it before anything renders: a `?lang=fr` or `?lang=en` link wins and is remembered, then the visitor's last pick, then the browser's languages, then English. Every page's switcher saves the pick under the `lang` key of `localStorage`, so the next page opens in the same language. Each page starts in `<html lang>`; while its dictionary is not applied yet, its `[data-i18n]` markup text is hidden rather than shown in the wrong language, at most until `DOMContentLoaded`, so a page whose script fails (no WebGL) still shows its text.

Adding a language: its code in `OK` in `site/lang.js`, a button in each switcher (`site/index.html`, `loco/02-markup.html`, `loco/03i-kid.js`, `game/g1-markup.html`), and its strings wherever `fr` has some: the landing dictionary in `site/index.html`, `T`, `PARTS` and `STEPS` in `loco/03a-data.js`, `KID_T` in `loco/03i-kid.js`, `I18N` in `game/g5-game.js` and the level texts in `game/g3-levels.js`.

## Source layout

`loco/` is one module split into files, concatenated in this order. It is a single scope and `const` declarations do not hoist, so a file must not call a helper declared in a later file while loading.

- `locomotive.html`, `02-markup.html`: title, styles, DOM
- `03a-data.js`: FR/EN strings (`T`), guide steps, component data
- `03a2-route.js`: the baked route database (generated, see below)
- `03b-scene.js`, `03c-common.js`: renderer, camera controls, shared builders
- `03d-diesel.js`, `03e-electric.js`, `03f3-tgv.js`, `03f3b-landmarks.js`: the three trains and the terminus landmarks
- `03f-flows.js`, `03f2-world.js`, `03f4-route.js`: energy-flow animations, the world group, route scenery (terrain per section kind, tunnels, bridges, cuttings, stations, catenary, opposing trains)
- `03f5-sound.js`: Web Audio ambience (rolling noise, inverter whine, diesel, birds, rain, oncoming TGVs with Doppler shift and horn)
- `03g-sim.js`, `03h-ui.js`: physics and autopilot, UI, HUD, main loop
- `03i-kid.js`: the kid layer, appended only to `locomotive-kid.html`
- `04-end.html`: closing tags

`game/` follows the same pattern (`g0-style.html` to `g5-game.js`). `node check-levels.mjs`, run from inside `game/`, checks that every level is solvable.

## Route data

`route/` bakes the line into `loco/03a2-route.js`:

```sh
cd route
python3 fetch_rails.py    # Overpass: the high-speed lines, the Bordeaux and Paris approaches, the Bordeaux to Toulouse line (640000), the classic Paris to Bordeaux line (570000) from Bordeaux to Tours and the stations, about 13 MB of JSON; fetches only the missing files, or the names given as arguments
python3 build_route.py    # needs Pillow; downloads terrain tiles into route/tiles/ (about 12 MB, cached) and rewrites loco/03a2-route.js
cd .. && node route/analyze.mjs   # sanity statistics on the baked data
```

The bake finds the alignment through the OpenStreetMap rail graph, resamples it, samples elevation from Terrarium tiles, smooths the profile and clamps grades to 2.5 %, then stores track counts, structures (tunnels, bridges, cuttings), stations and approximate per-section speed limits.

## Data and licences

- Code: MIT, see `LICENSE`.
- Track alignment, stations and structures: © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The baked database in `loco/03a2-route.js` and the extracts in `route/stations.json`, `route/stations_sud.json` and `route/stations_ouest.json` are derivative databases and remain under ODbL.
- Elevation: [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium format) hosted by the AWS Open Data programme, built from SRTM and the other public sources listed on that page.
- Three.js: MIT.

## Known simplifications

- The track profile is smoothed terrain, not the real rail profile. Tunnels come from OSM tags; where the smoothed terrain dips below rail level the tunnel lid is forced.
- Massy TGV is modelled as its real open-air trench between two tunnels, with a forced depth of 5 m.
- Toulouse Matabiau is a through station in reality; the line here ends at a buffer stop 1.2 km south of the building. The TGV has one pantograph for both voltages, where the real one has a second, DC only.
- Scenery, towns and landmarks are procedural on real relief. Station layouts are simplified.
- Opposing trains are random. Speed limits per section are approximated from public line data.
- The kid build boosts the physics on purpose: a TGV reaches 320 km/h in 80 s.
- Sounds are synthesised with Web Audio.

Built with [Claude Code](https://claude.com/claude-code).
