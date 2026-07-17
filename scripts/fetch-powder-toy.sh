#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REVISION="$(tr -d '[:space:]' < "$PROJECT_ROOT/third_party/the-powder-toy/REVISION")"
TARGET="$PROJECT_ROOT/.cache/the-powder-toy"

if [[ -d "$TARGET/.git" ]]; then
  CURRENT="$(git -C "$TARGET" rev-parse HEAD)"
  if [[ "$CURRENT" == "$REVISION" ]]; then
    echo "Powder Toy is already pinned at $REVISION"
    exit 0
  fi
  echo "Refusing to replace an existing checkout at $TARGET ($CURRENT)." >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"
git init "$TARGET"
git -C "$TARGET" remote add origin https://github.com/The-Powder-Toy/The-Powder-Toy.git
git -C "$TARGET" fetch --depth 1 origin "$REVISION"
git -C "$TARGET" checkout --detach FETCH_HEAD

ACTUAL="$(git -C "$TARGET" rev-parse HEAD)"
[[ "$ACTUAL" == "$REVISION" ]] || { echo "Revision verification failed" >&2; exit 1; }
grep -q 'GNU GENERAL PUBLIC LICENSE' "$TARGET/LICENSE" || { echo "Upstream license verification failed" >&2; exit 1; }
echo "Fetched Powder Toy $ACTUAL into $TARGET"
