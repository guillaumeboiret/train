#!/bin/sh
set -e
cd "$(dirname "$0")"
cat g0-style.html g1-markup.html g2-track.js g3-levels.js g4-scene.js g5-game.js > ../aiguillages.html
cd ..
sed -n '/<script type="module">/,/<\/script>/p' aiguillages.html | sed '1d;$d' > game-check.mjs
node --check game-check.mjs
{ printf '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat aiguillages.html; printf '</head></html>'; } > aiguillages-test.html
cp aiguillages-test.html loco/aiguillages-test.html
echo "BUILD-OK $(wc -c < aiguillages.html) bytes"
