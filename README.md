# train-3d

Three static [Three.js](https://threejs.org) pages about trains, in French and English. A personal side project.

| Page | What it is | Live |
|---|---|---|
| `locomotive-3d.html` | **Anatomie d'une locomotive**: an interactive explainer of a diesel-electric locomotive, an electric locomotive and a TGV Duplex, driven along the real Bordeaux Saint-Jean to Paris Montparnasse line (537.8 km), with a nine-step guide, energy-flow animations, station autopilot, weather and time scale | [claude.ai artifact](https://claude.ai/artifact/EMVu67YYfT7DzW8UozZAj6) |
| `locomotive-kid.html` | **Conducteur de train**: the same engine with one screen of big buttons for young children (lever, horn, pantograph, next station autopilot in both directions, cameras, weather, sound) | private artifact, build it locally |
| `aiguillages.html` | **Aiguillages**: a railway switch puzzle game, 10 levels plus a tutorial | private artifact, build it locally |

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

## Source layout

`loco/` is one module split into files, concatenated in this order. It is a single scope and `const` declarations do not hoist, so a file must not call a helper declared in a later file while loading.

- `locomotive.html`, `02-markup.html`: title, styles, DOM
- `03a-data.js`: FR/EN strings, guide steps, component data
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
python3 fetch_rails.py    # Overpass: the high-speed line plus the Bordeaux, Paris and Monts approaches, about 7 MB of JSON
python3 build_route.py    # needs Pillow; downloads terrain tiles into route/tiles/ (about 12 MB, cached) and rewrites loco/03a2-route.js
cd .. && node route/analyze.mjs   # sanity statistics on the baked data
```

The bake finds the alignment through the OpenStreetMap rail graph, resamples it, samples elevation from Terrarium tiles, smooths the profile and clamps grades to 2.5 %, then stores track counts, structures (tunnels, bridges, cuttings), stations and approximate per-section speed limits.

## Data and licences

- Code: MIT, see `LICENSE`.
- Track alignment, stations and structures: © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The baked database in `loco/03a2-route.js` and the extract in `route/stations.json` are derivative databases and remain under ODbL.
- Elevation: [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium format) hosted by the AWS Open Data programme, built from SRTM and the other public sources listed on that page.
- Three.js: MIT.

## Known simplifications

- The track profile is smoothed terrain, not the real rail profile. Tunnels come from OSM tags; where the smoothed terrain dips below rail level the tunnel lid is forced.
- Massy TGV is modelled as its real open-air trench between two tunnels, with a forced depth of 5 m.
- Scenery, towns and landmarks are procedural on real relief. Station layouts are simplified.
- Opposing trains are random. Speed limits per section are approximated from public line data.
- The kid build boosts the physics on purpose: a TGV reaches 320 km/h in 80 s.
- Sounds are synthesised with Web Audio.

Built with [Claude Code](https://claude.com/claude-code).
