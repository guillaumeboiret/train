#!/bin/sh
# Static site for train.boiret.com. The built pages at the repo root have no document head (the claude.ai host adds one),
# so each gets a real head here, and its links to the other artifacts point at the site's own paths.
# Usage: sh site/build.sh [repo root] [output dir]   (the Dockerfile runs it; locally it writes site/public)
set -eu
SRC=${1:-.}
OUT=${2:-$SRC/site/public}
page(){   # page <built page> <url path>
  mkdir -p "$OUT/$2"
  {
    printf '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<link rel="icon" href="/favicon.svg">\n'
    sed -e 's#https://claude.ai/artifact/EMVu67YYfT7DzW8UozZAj6#/locomotive/#g' \
        -e 's#https://claude.ai/artifact/UWxzgcLXNw8nW2AxP75imT#/conducteur/#g' \
        -e 's#https://claude.ai/artifact/YTRJvuYiFZpzyjxXD6vqQR#/aiguillages/#g' "$SRC/$1"
  } > "$OUT/$2/index.html"
}
rm -rf "$OUT"; mkdir -p "$OUT"
page locomotive-kid.html conducteur
page locomotive-3d.html locomotive
page aiguillages.html aiguillages
cp "$SRC/site/index.html" "$SRC/site/favicon.svg" "$OUT/"
