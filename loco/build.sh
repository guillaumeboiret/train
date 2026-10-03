#!/bin/sh
# Builds both pages from the split sources. Order matters: one module scope, consts do not hoist.
set -e
cd "$(dirname "$0")"
SRC="02-markup.html 03a-data.js 03a2-route.js 03b-scene.js 03c-common.js 03d-diesel.js 03e-electric.js 03f-flows.js 03f2-world.js 03f3-tgv.js 03f3b-landmarks.js 03f4-route.js 03f4b-wind.js 03f4c-sights.js 03f5-sound.js 03g-sim.js 03h-ui.js"
check(){ sed -n '/<script type="module">/,/<\/script>/p' "$1" | sed '1d;$d' > "$2" && node --check "$2"; }
wrap(){ { printf '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'; cat "$1"; printf '</head></html>'; } > "$2"; }
# full explainer
cat locomotive.html $SRC 04-end.html > ../locomotive-3d.html
check ../locomotive-3d.html ../loco-check.mjs
wrap ../locomotive-3d.html locomotive-test.html
# kid mode: same engine, different title, kid layer appended; its loading screen (kid-boot.html) ahead of the markup, so it paints first
{ sed '1s/.*/<title>Jouer au train<\/title>/' locomotive.html; cat kid-boot.html $SRC 03i-kid.js 03i2-cine.js 03i3-phone.js 03j-remote.js 03k-desk.js 04-end.html; } > ../locomotive-kid.html
check ../locomotive-kid.html ../kid-check.mjs
wrap ../locomotive-kid.html kid-test.html
ls -la ../locomotive-3d.html ../locomotive-kid.html
