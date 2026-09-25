#!/usr/bin/env bash
# Regenerates the MSDF font atlases in public/fonts/msdf/ used by the in-XR
# reading panel (components/map/XRArticlePanel.tsx, via @react-three/uikit).
#
# One-off tool — run it only when the site's reading fonts or the charset
# change. Works in a temp dir so msdf-bmfont-xml never enters the project's
# dependencies.
#
# Usage: bash scripts/generate-msdf-fonts.sh
set -euo pipefail

OUT="$(cd "$(dirname "$0")/.." && pwd)/public/fonts/msdf"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

# Latin TTFs for the article theme's fonts (article.config.ts):
# Fraunces 700 (titles), Fira Sans 400/600 + italic 400 (body / UI chrome /
# inline emphasis), Fira Code 400 (inline code).
curl -sL "https://gwfh.mranftl.com/api/fonts/fraunces?download=zip&subsets=latin&variants=700&formats=ttf" -o fraunces.zip
curl -sL "https://gwfh.mranftl.com/api/fonts/fira-sans?download=zip&subsets=latin&variants=regular,600,italic&formats=ttf" -o fira.zip
curl -sL "https://gwfh.mranftl.com/api/fonts/fira-code?download=zip&subsets=latin&variants=regular&formats=ttf" -o fira-code.zip
unzip -o -q fraunces.zip && unzip -o -q fira.zip && unzip -o -q fira-code.zip

npm init -y >/dev/null
npm install --no-fund --no-audit msdf-bmfont-xml >/dev/null

# ASCII + typographic punctuation + the accented/arrow characters that appear
# in the site's prose and UI chrome (e.g. "café", the "‹ Back" button).
printf '%s' ' !"#$%&'"'"'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~–—‘’“”…•·×‹›←→éàèöüç°▶' > charset.txt

mkdir -p "$OUT"
gen() { # gen <ttf-basename> <output-name>
  ./node_modules/.bin/msdf-bmfont -f json -i charset.txt -m 512,512 -s 48 -r 6 --smart-size -o "$1.png" "$1.ttf"
  # Rename the pair and point the JSON's "pages" at the renamed texture.
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('$1.json'));
    d.pages = ['$2.png'];
    fs.writeFileSync('$OUT/$2.json', JSON.stringify(d));
    fs.copyFileSync('$1.png', '$OUT/$2.png');
  "
}
gen fraunces-v38-latin-700 fraunces-700
gen fira-sans-v18-latin-regular fira-sans-400
gen fira-sans-v18-latin-600 fira-sans-600
gen fira-sans-v18-latin-italic fira-sans-400-italic
gen "$(basename "$(ls fira-code-v*-latin-regular.ttf)" .ttf)" fira-code-400

echo "Wrote atlases to $OUT"
