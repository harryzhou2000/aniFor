#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DIST_DIR="${PROJECT_ROOT}/dist"
readonly ASSETS_DIR="${DIST_DIR}/assets"

if [[ ! -f "${ASSETS_DIR}/app.js" || ! -f "${ASSETS_DIR}/style.css" ]]; then
  echo "Stable Pages entry assets are missing." >&2
  exit 1
fi

legacy_scripts=(
  index-DqhU2VfC.js
  index-DsD3cf_4.js
)
legacy_styles=(
  index-CSuzU66U.css
  index-40yMQDz6.css
)

for filename in "${legacy_scripts[@]}"; do
  cp "${ASSETS_DIR}/app.js" "${ASSETS_DIR}/${filename}"
done
for filename in "${legacy_styles[@]}"; do
  cp "${ASSETS_DIR}/style.css" "${ASSETS_DIR}/${filename}"
done

grep -Fq 'src="./assets/app.js"' "${DIST_DIR}/index.html"
grep -Fq 'href="./assets/style.css"' "${DIST_DIR}/index.html"
grep -Fq 'id="boot-status"' "${DIST_DIR}/index.html"

echo "Pages bundle has stable entries, a visible boot shell, and legacy migration aliases"
