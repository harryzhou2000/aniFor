#!/usr/bin/env bash
set -euo pipefail

readonly EMSDK_VERSION="6.0.3"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EMSDK_DIR="${PROJECT_ROOT}/.toolchains/emsdk"

if [[ ! -f "${EMSDK_DIR}/emsdk_env.sh" ]]; then
  echo "Project-local Emscripten is not installed." >&2
  echo "Run npm run setup:emsdk, then rerun npm run build:wasm." >&2
  exit 1
fi

# shellcheck disable=SC1091
export EMSDK_QUIET=1
source "${EMSDK_DIR}/emsdk_env.sh" >/dev/null

actual_version="$(em++ --version | sed -n '1s/.*emcc ([^)]*) \([0-9][0-9.]*\).*/\1/p')"
if [[ "${actual_version}" != "${EMSDK_VERSION}" ]]; then
  echo "Expected project-local Emscripten ${EMSDK_VERSION}, found ${actual_version:-unknown}." >&2
  echo "Run npm run setup:emsdk to activate the pinned toolchain." >&2
  exit 1
fi

mkdir -p "${PROJECT_ROOT}/public/wasm"
em++ "${PROJECT_ROOT}/native/powder_core.cpp" -O3 -s WASM=1 -s STANDALONE_WASM=1 \
  -s EXPORTED_FUNCTIONS='["_powder_width","_powder_height","_powder_cells","_powder_tick","_powder_set_tick","_powder_clear","_powder_set","_powder_step"]' \
  --no-entry -o "${PROJECT_ROOT}/public/wasm/powder_core.wasm"
echo "Built public/wasm/powder_core.wasm with Emscripten ${EMSDK_VERSION}"
