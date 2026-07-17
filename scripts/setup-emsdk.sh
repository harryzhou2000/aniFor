#!/usr/bin/env bash
set -euo pipefail

readonly EMSDK_VERSION="6.0.3"
readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly TOOLCHAINS_DIR="${PROJECT_ROOT}/.toolchains"
readonly EMSDK_DIR="${TOOLCHAINS_DIR}/emsdk"
readonly EMSDK_REPOSITORY="https://github.com/emscripten-core/emsdk.git"

mkdir -p "${TOOLCHAINS_DIR}"

if [[ ! -x "${EMSDK_DIR}/emsdk" ]]; then
  if [[ -e "${EMSDK_DIR}" ]]; then
    echo "Refusing to replace incomplete emsdk directory: ${EMSDK_DIR}" >&2
    echo "Remove or repair that directory, then rerun npm run setup:emsdk." >&2
    exit 1
  fi

  git clone --depth 1 "${EMSDK_REPOSITORY}" "${EMSDK_DIR}"
fi

"${EMSDK_DIR}/emsdk" install "${EMSDK_VERSION}"
"${EMSDK_DIR}/emsdk" activate "${EMSDK_VERSION}"

# Activation is intentionally local: emsdk writes its configuration inside
# .toolchains/emsdk, and callers source emsdk_env.sh only for their own process.
# shellcheck disable=SC1091
export EMSDK_QUIET=1
source "${EMSDK_DIR}/emsdk_env.sh" >/dev/null

actual_version="$(em++ --version | sed -n '1s/.*emcc ([^)]*) \([0-9][0-9.]*\).*/\1/p')"
if [[ "${actual_version}" != "${EMSDK_VERSION}" ]]; then
  echo "Expected Emscripten ${EMSDK_VERSION}, found ${actual_version:-unknown}." >&2
  exit 1
fi

echo "Emscripten ${EMSDK_VERSION} is ready in ${EMSDK_DIR}"
