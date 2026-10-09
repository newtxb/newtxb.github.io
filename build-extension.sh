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
MANIFEST="manifest.json"
WHITELIST="
manifest.json
index.html
assets/main.css
assets/main.js
assets/google-suggest.js
assets/almanax-data.json
assets/favicon.png
assets/icon-16.png
assets/icon-48.png
assets/icon-128.png
assets/img/almanax.svg
assets/img/banks/american-express.png
assets/img/banks/boursobank.png
assets/img/banks/credit-agricole.png
assets/img/banks/fortuneo.png
assets/img/banks/hello-bank.png
assets/img/banks/lydia.png
assets/img/banks/n26.png
assets/img/banks/natixis.png
assets/img/banks/paypal.png
assets/img/banks/revolut.png
assets/img/google/calendar.png
assets/img/google/docs.png
assets/img/google/drive.png
assets/img/google/gemini.png
assets/img/google/gmail.png
assets/img/google/maps.png
assets/img/google/sheets.png
assets/img/google/slides.png
"

BLACKLIST="
.gitignore
README.md
build-extension.sh
github.json
service-worker.js
assets/google-suggest.ext.js
"

in_list() {
  needle="$1"
  list="$2"
  printf '%s\n' "$list" | grep -Fqx -- "$needle"
}

echo "Checking tracked files..."
UNCATEGORIZED=""
for f in $(git ls-files); do
  if in_list "$f" "$WHITELIST" || in_list "$f" "$BLACKLIST"; then
    continue
  fi
  UNCATEGORIZED="$UNCATEGORIZED\n$f"
done

if [ -n "$UNCATEGORIZED" ]; then
  echo "Error: uncategorized tracked files found." >&2
  echo "Each tracked file must be listed in WHITELIST or BLACKLIST in build-extension.sh:" >&2
  # shellcheck disable=SC2059
  printf "$UNCATEGORIZED\n" >&2
  exit 1
fi

for f in $WHITELIST; do
  if [ ! -f "$f" ]; then
    echo "Missing file: $f" >&2
    exit 1
  fi
done

# Bump the manifest patch version (1.1.1 -> 1.1.2) so each build ships a new version.
OLD_VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([0-9.]*\)".*/\1/p' "$MANIFEST" | head -1)"
if [ -z "$OLD_VERSION" ]; then
  echo "Could not read version from $MANIFEST" >&2
  exit 1
fi
NEW_VERSION="$(echo "$OLD_VERSION" | awk -F. -v OFS=. '{ $NF = $NF + 1; print }')"
sed "s/\"version\"[[:space:]]*:[[:space:]]*\"$OLD_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$MANIFEST" > "$MANIFEST.tmp"
mv "$MANIFEST.tmp" "$MANIFEST"
echo "Version $OLD_VERSION -> $NEW_VERSION"

echo "Staging files..."
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

for f in $WHITELIST; do
  mkdir -p "$STAGE/$(dirname "$f")"
  cp "$f" "$STAGE/$f"
done
cp assets/google-suggest.ext.js "$STAGE/assets/google-suggest.js"

# Minify the staged JS/CSS in place. The scripts are classic (non-module) scripts sharing
# globals, which is fine: esbuild's transform mode never renames top-level identifiers.
echo "Minifying (esbuild):"
MINIFY=""
for f in $WHITELIST; do
  case "$f" in
    *.js|*.css)
      echo "  - $f"
      MINIFY="$MINIFY $STAGE/$f"
      ;;
  esac
done
# shellcheck disable=SC2086
npx --yes esbuild@0.25.0 $MINIFY --minify --log-level=warning --outbase="$STAGE" --outdir="$STAGE" --allow-overwrite

echo "Zipping..."
rm -f "$OUT"
(cd "$STAGE" && zip -qr "$OLDPWD/$OUT" $WHITELIST)

echo "Wrote $OUT v$NEW_VERSION ($(du -h "$OUT" | cut -f1)) to Downloads"
mv "$OUT" "$HOME/Downloads"
