#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly VENV="${PROJECT_ROOT}/.venv"
readonly MESON_VERSION="1.11.2"

if [[ ! -x "${VENV}/bin/python" ]]; then
  python3 -m venv "${VENV}"
fi
"${VENV}/bin/python" -m pip install --disable-pip-version-check "meson==${MESON_VERSION}"
"${VENV}/bin/meson" --version
