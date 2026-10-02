#!/bin/sh
# Static site for train.boiret.com. The built pages at the repo root have no document head (the claude.ai host adds one),
# so each gets a real head here, and its links to the other artifacts point at the site's own paths.
# Every page, the landing page included, runs site/lang.js first in its head: one language for the whole site.
# Usage: sh site/build.sh [repo root] [output dir]   (the Dockerfile runs it; locally it writes site/public)
set -eu
SRC=${1:-.}
OUT=${2:-$SRC/site/public}
langjs(){ printf '<script>\n'; cat "$SRC/site/lang.js"; printf '</script>\n'; }
# the credit the licence makes every copy carry: the "Required Notice:" lines of LICENSE, as a comment in each page's head
notice(){ printf '<!--\n'; grep '^Required Notice:' "$SRC/LICENSE"; printf 'Licence: /LICENSE.txt\n-->\n'; }
page(){   # page <built page> <url path>; the built pages' markup is French, hence lang="fr" (site/lang.js switches it)
  mkdir -p "$OUT/$2"
  {
    printf '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
    langjs
    notice
    printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<link rel="icon" href="/favicon.svg">\n'
    sed -e 's#https://claude.ai/artifact/EMVu67YYfT7DzW8UozZAj6#/locomotive/#g' \
        -e 's#https://claude.ai/artifact/UWxzgcLXNw8nW2AxP75imT#/playground/#g' \
        -e 's#https://claude.ai/artifact/YTRJvuYiFZpzyjxXD6vqQR#/aiguillages/#g' "$SRC/$1"
  } > "$OUT/$2/index.html"
}
rm -rf "$OUT"; mkdir -p "$OUT"
page locomotive-kid.html playground
# the kid page's first address, French and named for the driver: old links and home screen icons land on the new one, ?lang= and #... kept
mkdir -p "$OUT/conducteur"
printf '%s\n' '<!doctype html><html><head><meta charset="utf-8"><title>Train playground</title><link rel="canonical" href="/playground/">' \
  "<script>location.replace('/playground/' + location.search + location.hash)</script>" \
  '<meta http-equiv="refresh" content="0; url=/playground/"></head><body><a href="/playground/">/playground/</a></body></html>' > "$OUT/conducteur/index.html"
page locomotive-3d.html locomotive
page aiguillages.html aiguillages
{ sed '/<meta charset="utf-8">/q' "$SRC/site/index.html"; langjs; notice; sed '1,/<meta charset="utf-8">/d' "$SRC/site/index.html"; } > "$OUT/index.html"
# the playground's remote, for the iPad (site/server.mjs relays it to the TV)
mkdir -p "$OUT/remote"
{ sed '/<meta charset="utf-8">/q' "$SRC/site/remote.html"; langjs; notice; sed '1,/<meta charset="utf-8">/d' "$SRC/site/remote.html"; } > "$OUT/remote/index.html"
cp "$SRC/site/favicon.svg" "$OUT/"
cp "$SRC/LICENSE" "$OUT/LICENSE.txt"
cp -R "$SRC/site/audio" "$OUT/"   # the recorded TGV sounds (site/audio/CREDITS.txt), fetched by the pages as ../audio/
# the deployed commit, to check what is live: Railway passes RAILWAY_GIT_COMMIT_SHA (Dockerfile ARG), a local build asks git
printf '%s\n' "${RAILWAY_GIT_COMMIT_SHA:-$(git -C "$SRC" rev-parse HEAD 2>/dev/null || echo unknown)}" > "$OUT/version.txt"
