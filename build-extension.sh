#!/bin/sh
# Packages the Chrome extension build into extension.zip, containing only the files the
# extension actually needs — not the website-only service-worker.js/github.json/README.md.
#
# assets/google-suggest.js (JSONP, with a runtime check that dynamically loads
# google-suggest.ext.js when running as the extension) is overridden with
# google-suggest.ext.js's content in the staged copy, so the packaged bundle never contains
# the website's JSONP <script src> at all — not even as an unreachable branch.
set -e

cd "$(dirname "$0")"

OUT="extension.zip"
FILES="
manifest.json
index.html
assets/main.css
assets/main.js
assets/google-suggest.js
assets/favicon.png
assets/icon-16.png
assets/icon-48.png
assets/icon-128.png
"

for f in $FILES; do
  if [ ! -f "$f" ]; then
    echo "Missing file: $f" >&2
    exit 1
  fi
done

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

for f in $FILES; do
  mkdir -p "$STAGE/$(dirname "$f")"
  cp "$f" "$STAGE/$f"
done
cp assets/google-suggest.ext.js "$STAGE/assets/google-suggest.js"

rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OLDPWD/$OUT" $FILES)

echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
