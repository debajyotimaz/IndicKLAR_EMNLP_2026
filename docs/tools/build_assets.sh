#!/usr/bin/env bash
# Regenerate web figures for docs/ from the paper's LaTeX figures folder.
# Usage: build_assets.sh <paper_dir> <docs_dir>
set -euo pipefail
F="$1/figures"; O="$2/static/images"; FAV="$2/static/favicon"
mkdir -p "$O" "$FAV"
best() {  # keep the smaller of lossy / lossless WebP, drop the intermediate PNG
  convert "$O/$1.png" -quality 86 -define webp:method=6 "/tmp/_l_$1.webp"
  convert "$O/$1.png" -define webp:lossless=true -define webp:method=6 "/tmp/_ll_$1.webp"
  if [ $(stat -c%s "/tmp/_ll_$1.webp") -lt $(stat -c%s "/tmp/_l_$1.webp") ]; then mv "/tmp/_ll_$1.webp" "$O/$1.webp"; rm "/tmp/_l_$1.webp"
  else mv "/tmp/_l_$1.webp" "$O/$1.webp"; rm "/tmp/_ll_$1.webp"; fi
  rm "$O/$1.png"
}
pdf() {  # pdf <src.pdf> <name> <width>
  pdftoppm -png -singlefile -scale-to-x "$3" -scale-to-y -1 "$F/$1" "/tmp/_asset_$2"
  convert "/tmp/_asset_$2.png" -background white -alpha remove -alpha off -strip "$O/$2.png"
  rm "/tmp/_asset_$2.png"; best "$2"
}
png() {  # png <src.png> <name> <width>
  convert "$F/$1" -resize "$3x" -background white -alpha remove -alpha off -strip "$O/$2.png"
  best "$2"
}
pdf intro_figure.pdf                     teaser                 2400
convert "$O/teaser.webp" -background white -gravity center -resize 1100x -extent 1200x630 "$O/og-image.png"
# favicon / logo from the tiger
T="$F/logos/tiger_face.png"
convert "$T" -resize 512x512 "$FAV/icon-512.png"
convert "$T" -resize 192x192 "$FAV/icon-192.png"
convert "$T" -resize 180x180 "$FAV/apple-touch-icon.png"
convert "$T" -resize 32x32 "$FAV/favicon-32.png"
convert "$T" -define icon:auto-resize=16,32,48 "$FAV/favicon.ico"
convert "$T" -resize 256x256 -quality 90 "$O/tiger.webp"
# small figures for the "In the paper" cards
pdf flip_point_recovery.pdf              flip_point_recovery    1400
pdf transliteration_bar_plot.pdf         romanization_ablation  1200
pdf main_scaling_results.pdf             scaling                1400
