#!/usr/bin/env bash
set -euo pipefail

readonly EMSDK_VERSION="6.0.3"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EMSDK_DIR="${PROJECT_ROOT}/.toolchains/emsdk"
readonly TPT_DIR="${PROJECT_ROOT}/.cache/the-powder-toy"
readonly BUILD_DIR="${TPT_DIR}/build-wasm-headless"
readonly MESON="${PROJECT_ROOT}/.venv/bin/meson"
readonly TPT_WASM_LIBS_WRAP="tpt-libs-prebuilt-wasm32-emscripten-emscripten-static-release-v20251019131007.wrap"

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

# Meson can fetch this pinned archive itself, but a transient GitHub Releases
# outage otherwise aborts before compilation and prevents the success-only CI
# cache from ever being populated. Preseed Meson's ordinary package cache with
# bounded retries and verify the upstream wrap hash before trusting the bytes.
wrap_path="${TPT_DIR}/subprojects/${TPT_WASM_LIBS_WRAP}"
package_url="$(sed -n 's/^source_url = //p' "${wrap_path}")"
package_filename="$(sed -n 's/^source_filename = //p' "${wrap_path}")"
package_hash="$(sed -n 's/^source_hash = //p' "${wrap_path}")"
package_cache="${TPT_DIR}/subprojects/packagecache"
package_archive="${package_cache}/${package_filename}"
if [[ -z "${package_url}" || -z "${package_filename}" || ! "${package_hash}" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Pinned Powder Toy library wrap is incomplete." >&2
  exit 1
fi
mkdir -p "${package_cache}"
if [[ ! -f "${package_archive}" ]] || ! echo "${package_hash}  ${package_archive}" | sha256sum --check --status; then
  partial_archive="${package_archive}.partial.$$"
  trap 'rm -f "${partial_archive:-}"' EXIT
  curl --fail --location --retry 8 --retry-all-errors --retry-delay 5 \
    --connect-timeout 20 --max-time 300 --output "${partial_archive}" "${package_url}"
  echo "${package_hash}  ${partial_archive}" | sha256sum --check --status || {
    echo "Powder Toy library archive hash verification failed." >&2
    exit 1
  }
  mv "${partial_archive}" "${package_archive}"
  trap - EXIT
fi
echo "Verified cached Powder Toy libraries ${package_filename}"

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
