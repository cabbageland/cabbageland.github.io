#!/bin/zsh
# AI-upscales the panoramas in source/ into source/hd/ (2× the scene units) with Real-ESRGAN x4plus:
# 4× through the network, then a clean Lanczos step down to 2×, which keeps edges crisp without inventing mush.
# Needs world/.tools/realesrgan/realesrgan-ncnn-vulkan (github.com/xinntao/Real-ESRGAN, release v0.2.5.0, macOS build).
set -e
cd "${0:A:h}/.."
bin=.tools/realesrgan/realesrgan-ncnn-vulkan
[[ -x $bin ]] || { echo "Real-ESRGAN not found at world/$bin; skipping AI upscale"; exit 0; }
units=($(python3 -c 'import json;u=json.load(open("scene.json"))["units"];print(int(u[0]),int(u[1]))'))
mkdir -p source/hd .build
for f in source/*.png; do
  out=source/hd/${f:t}
  [[ -f $out && $out -nt $f ]] && continue
  echo "AI upscale ${f:t}…"
  $bin -i $f -o .build/x4.png -n realesrgan-x4plus -s 4 -m .tools/realesrgan/models >/dev/null 2>&1
  w=$(( units[1] * 2 )); h=$(( units[2] * 2 ))
  src_w=$(sips -g pixelWidth $f | awk '/pixelWidth/{print $2}')
  (( src_w != units[1] )) && w=$(( src_w * 2 )) && h=$(( $(sips -g pixelHeight $f | awk '/pixelHeight/{print $2}') * 2 ))
  sips -z $h $w .build/x4.png --out $out >/dev/null
  rm -f .build/x4.png
done
