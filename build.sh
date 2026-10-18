#!/usr/bin/env bash
#
# Builds the Chrome Web Store package: dist/ holds only the files the manifest
# uses, and flickwaysurfer-<version>.zip is dist/ zipped, ready to upload.
#
# Why this exists: zipping the folder itself would sweep in .git/,
# store_assets/ and the README, none of which belong in the extension.
#
# Usage:
#   ./build.sh
#
set -euo pipefail

cd "$(dirname "$0")"
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json)
OUT="dist"
ZIP="flickwaysurfer-$VERSION.zip"

rm -rf "$OUT" "$ZIP"
mkdir -p "$OUT/background" "$OUT/content" "$OUT/icons"

# Runtime files, mirroring what manifest.json references.
cp manifest.json "$OUT/"
cp background/service-worker.js "$OUT/background/"
cp content/surfer.js "$OUT/content/"
cp icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png "$OUT/icons/"

# -X leaves out macOS extended attributes, which the store has no use for.
(cd "$OUT" && zip -qrX "../$ZIP" .)

echo "Built $ZIP ($(du -h "$ZIP" | cut -f1)) from $OUT/"
