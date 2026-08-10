#!/usr/bin/env bash
set -euo pipefail

readonly EMSDK_VERSION="6.0.3"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EMSDK_DIR="${PROJECT_ROOT}/.toolchains/emsdk"
readonly TPT_DIR="${PROJECT_ROOT}/.cache/the-powder-toy"
readonly BUILD_DIR="${TPT_DIR}/build-wasm-headless"
readonly MESON="${PROJECT_ROOT}/.venv/bin/meson"

if [[ ! -f "${EMSDK_DIR}/emsdk_env.sh" ]]; then
  echo "Project-local Emscripten is not installed; run npm run setup:emsdk." >&2
  exit 1
fi
if [[ ! -x "${MESON}" ]]; then
  echo "Project-local Meson is not installed; run npm run setup:build-tools." >&2
  exit 1
fi

export EMSDK_QUIET=1
# shellcheck disable=SC1091
source "${EMSDK_DIR}/emsdk_env.sh" >/dev/null
actual_version="$(em++ --version | sed -n '1s/.*emcc ([^)]*) \([0-9][0-9.]*\).*/\1/p')"
[[ "${actual_version}" == "${EMSDK_VERSION}" ]] || {
  echo "Expected Emscripten ${EMSDK_VERSION}, found ${actual_version:-unknown}." >&2
  exit 1
}

bash "${PROJECT_ROOT}/scripts/fetch-powder-toy.sh"
if git -C "${TPT_DIR}" apply --check "${PROJECT_ROOT}/patches/the-powder-toy-headless.patch" 2>/dev/null; then
  git -C "${TPT_DIR}" apply "${PROJECT_ROOT}/patches/the-powder-toy-headless.patch"
elif ! git -C "${TPT_DIR}" apply --reverse --check "${PROJECT_ROOT}/patches/the-powder-toy-headless.patch" 2>/dev/null; then
  echo "Powder Toy checkout does not match the pinned headless patch." >&2
  exit 1
fi

cp "${PROJECT_ROOT}/native/tpt/tpt_adapter.cpp" "${TPT_DIR}/src/StillroomAdapter.cpp"
cp "${PROJECT_ROOT}/native/tpt/headless_gravity.cpp" "${TPT_DIR}/src/StillroomGravity.cpp"
cp "${PROJECT_ROOT}/native/tpt/headless_renderer_tables.cpp" "${TPT_DIR}/src/StillroomRendererTables.cpp"
cp "${PROJECT_ROOT}/native/tpt/headless_sign_metrics.cpp" "${TPT_DIR}/src/StillroomSignMetrics.cpp"

setup_args=(
  -Dbuildtype=release
  -Dbuild_powder=false
  -Dbuild_stillroom_headless=true
  -Dstatic=prebuilt
  -Dlua=none
  -Dhttp=false
  -Dapp_exe=stillroom_core
  -Dcan_install=no
  --cross-file="${TPT_DIR}/.github/emscripten-ghactions.ini"
)
if [[ ! -f "${BUILD_DIR}/build.ninja" ]]; then
  "${MESON}" setup "${BUILD_DIR}" "${TPT_DIR}" "${setup_args[@]}"
fi
"${MESON}" compile -C "${BUILD_DIR}"
sed -i -e 's/[[:space:]]*$//' -e '${/^$/d;}' "${BUILD_DIR}/stillroom_core.js"

mkdir -p "${PROJECT_ROOT}/public/wasm"
cp "${BUILD_DIR}/stillroom_core.js" "${PROJECT_ROOT}/public/wasm/stillroom_core.js"
cp "${BUILD_DIR}/stillroom_core.wasm" "${PROJECT_ROOT}/public/wasm/stillroom_core.wasm"
echo "Built direct Powder Toy 612x384 WebAssembly module with Emscripten ${EMSDK_VERSION}"
