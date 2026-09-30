#!/bin/zsh
# Rebuilds the paper layers for the site from scene.json. Run after changing a source image or scene.json:
#   ./world/rebuild.sh
# With cwebp installed (brew install webp) the variant layers are then packed as WebP, about a fifth of the size.
set -e
cd "${0:A:h}"
mkdir -p .build
if [[ ! -x .build/build-layers || tools/build-layers.swift -nt .build/build-layers ]]; then
  echo "compiling tools/build-layers.swift…"
  swiftc -O tools/build-layers.swift -o .build/build-layers
fi
./tools/upscale-sources.sh
rm -rf layers  # generated; start clean so nothing stale is served
.build/build-layers scene.json

if ! command -v cwebp >/dev/null; then
  echo "cwebp not found: keeping PNG/JPEG layers"
  exit 0
fi
echo "packing layers as WebP…"
out=layers
# Cut-out paper (pieces, clouds, front) keeps a lossless alpha edge; the base is plain colour.
find $out/day $out/night \( -path '*/pieces/*.png' -o -path '*/clouds/*.png' -o -name front.png \) -print0 |
  xargs -0 -P 8 -I{} sh -c 'cwebp -quiet -q 88 -alpha_q 100 -m 6 "$1" -o "${1%.png}.webp" && rm "$1"' _ {}
for v in $out/day $out/night; do
  [[ -f $v/base.jpg ]] && cwebp -quiet -q 86 -m 6 $v/base.jpg -o $v/base.webp && rm $v/base.jpg
done
# Masks in shared/ are packed losslessly. Point layers.js at the new files.
find $out/shared -name '*.png' -print0 | xargs -0 -P 8 -I{} sh -c 'cwebp -quiet -lossless -z 9 "$1" -o "${1%.png}.webp" && rm "$1"' _ {}
perl -pi -e 's/"((?:pieces|clouds|shared)\\\/[^"]+)\.png"/"$1.webp"/g; s/"base":"base\.jpg"/"base":"base.webp"/; s/"front":"front\.png"/"front":"front.webp"/' $out/layers.js
du -sh $out/day $out/night $out/shared | sed 's/^/  /'
