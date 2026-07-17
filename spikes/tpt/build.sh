#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPIKE="$ROOT/spikes/tpt"
SOURCE="$ROOT/vendor/tpt/source"
EMSDK="$ROOT/tools/emsdk"
BUILD="$ROOT/build/tpt-wasm"
CACHE="$ROOT/.cache/tpt"
MESON_VENV="$CACHE/meson-venv"
DEPS="$CACHE/deps"
BZ2_ARCHIVE="$DEPS/bzip2-1.0.8.tar.gz"
BZ2_SOURCE="$DEPS/bzip2-1.0.8"
BZ2_PREFIX="$DEPS/bzip2/prefix"
LUA_ARCHIVE="$DEPS/lua-5.2.4.tar.gz"
LUA_SOURCE="$DEPS/lua-5.2.4"
LUA_PREFIX="$DEPS/lua/prefix"
FFTW_ARCHIVE="$DEPS/fftw-3.3.10.tar.gz"
FFTW_SOURCE="$DEPS/fftw-3.3.10"
FFTW_PREFIX="$DEPS/fftw/prefix"
TPT_LIBS_ARCHIVE="$CACHE/tpt-libs/tpt-libs-prebuilt-wasm32-emscripten-emscripten-static-release-v20251019131007.zip"
TPT_LIBS_DIR="$SOURCE/subprojects/tpt-libs-prebuilt-wasm32-emscripten-emscripten-static-release-v20251019131007"
TPT_SHA="9c94feba3ed5eaa75a819ac000c0d29e4ce92570"
EMSDK_SHA="75eb9522ae0d24a9057c29ff6c72336beddf9508"
BZ2_SHA="ab5a03176ee106d3f0fa90e381da478ddae405918153cca248e682cd0c4a2269"
LUA_SHA="b9e2e4aad6789b3b63a056d442f7b39f0ecfca3ae0f1fc0ae4e9614401b69f4b"
FFTW_SHA="56c932549852cddcfafdab3820b0200c7742675be92179e59e6215b340e26467"
TPT_LIBS_SHA="1736b0607f95f653a13bc42aa8da853a185e637e27b343057e5441e3b6a96549"
TPT_LIBS_URL="https://github.com/The-Powder-Toy/tpt-libs/releases/download/v20251019131007/tpt-libs-prebuilt-wasm32-emscripten-emscripten-static-release-v20251019131007.zip"

usage() { printf '%s\n' "Usage: $0 [--help] [--check-only]" "Builds only the pinned official TPT full-game Emscripten target." "All source, toolchain, cache, temp, and output paths are project-local."; }
[[ "${1:-}" == --help ]] && { usage; exit 0; }
CHECK_ONLY=false
[[ "${1:-}" == --check-only ]] && CHECK_ONLY=true
[[ $# -le 1 ]] || { usage >&2; exit 2; }

# Never allow Emscripten, Meson, or subprocesses to use global temporary/cache paths.
mkdir -p "$SOURCE" "$EMSDK" "$BUILD" "$CACHE"
export TMPDIR="$CACHE/tmp" EM_CACHE="$CACHE/em-cache" EM_CONFIG="$CACHE/.emscripten"
export EMSDK_HOME="$CACHE/emsdk-home" XDG_CACHE_HOME="$CACHE/xdg-cache"
export HOME="$CACHE/home"
export PIP_CACHE_DIR="$CACHE/pip-cache" PIP_DISABLE_PIP_VERSION_CHECK=1
mkdir -p "$TMPDIR" "$EM_CACHE" "$EMSDK_HOME" "$XDG_CACHE_HOME" "$HOME"

bootstrap_bzip2() {
  mkdir -p "$DEPS"
  if [[ ! -f "$BZ2_ARCHIVE" ]]; then
    curl --fail --location --output "$BZ2_ARCHIVE" \
      "https://sourceware.org/pub/bzip2/bzip2-1.0.8.tar.gz"
  fi
  [[ "$(sha256sum "$BZ2_ARCHIVE" | cut -d ' ' -f1)" == "$BZ2_SHA" ]] || {
    echo 'BLOCKER: bzip2 archive SHA-256 verification failed' >&2; exit 7;
  }
  if [[ ! -f "$BZ2_SOURCE/bzlib.h" ]]; then
    rm -rf "$BZ2_SOURCE"
    tar -xzf "$BZ2_ARCHIVE" -C "$DEPS"
  fi
  mkdir -p "$BZ2_PREFIX/include" "$BZ2_PREFIX/lib" "$DEPS/bzip2/objects"
  cp "$BZ2_SOURCE/bzlib.h" "$BZ2_PREFIX/include/bzlib.h"
  local objects=() source object
  for source in blocksort huffman crctable randtable compress decompress bzlib; do
    object="$DEPS/bzip2/objects/$source.o"
    if [[ ! -f "$object" ]]; then
      emcc -I"$BZ2_SOURCE" -O2 -fPIC -c "$BZ2_SOURCE/$source.c" -o "$object"
    fi
    objects+=("$object")
  done
  emar rcs "$BZ2_PREFIX/lib/libbz2.a" "${objects[@]}"
  emranlib "$BZ2_PREFIX/lib/libbz2.a"
}

bootstrap_lua() {
  mkdir -p "$DEPS"
  if [[ ! -f "$LUA_ARCHIVE" ]]; then
    curl --fail --location --output "$LUA_ARCHIVE" \
      "https://www.lua.org/ftp/lua-5.2.4.tar.gz"
  fi
  [[ "$(sha256sum "$LUA_ARCHIVE" | cut -d ' ' -f1)" == "$LUA_SHA" ]] || {
    echo 'BLOCKER: Lua archive SHA-256 verification failed' >&2; exit 8;
  }
  if [[ ! -f "$LUA_SOURCE/src/lua.h" ]]; then
    rm -rf "$LUA_SOURCE"
    tar -xzf "$LUA_ARCHIVE" -C "$DEPS"
  fi
  mkdir -p "$LUA_PREFIX/include" "$LUA_PREFIX/lib" "$LUA_PREFIX/lib/pkgconfig" "$DEPS/lua/objects" "$DEPS/bin"
  cp "$LUA_SOURCE"/src/{lua.h,lualib.h,lauxlib.h,luaconf.h} "$LUA_PREFIX/include/"
  local objects=() source object
  for source in lapi lauxlib lbaselib lbitlib lcode lcorolib lctype ldebug ldo ldump lfunc lgc linit liolib llex lmathlib lmem loadlib lobject lopcodes loslib lparser lstate lstring lstrlib ltable ltablib ltm lundump lvm lzio; do
    object="$DEPS/lua/objects/$source.o"
    if [[ ! -f "$object" ]]; then
      emcc -I"$LUA_SOURCE/src" -O2 -fPIC -c "$LUA_SOURCE/src/$source.c" -o "$object"
    fi
    objects+=("$object")
  done
  emar rcs "$LUA_PREFIX/lib/liblua5.2.a" "${objects[@]}"
  emranlib "$LUA_PREFIX/lib/liblua5.2.a"
  local pc
  for pc in lua5.2 lua5.2-c++; do
    printf '%s\n' \
      "prefix=$LUA_PREFIX" \
      'exec_prefix=${prefix}' \
      'libdir=${prefix}/lib' \
      'includedir=${prefix}/include' \
      '' \
      "Name: $pc" \
      'Description: Lua 5.2 (project-local Emscripten build)' \
      'Version: 5.2.4' \
      'Libs: -L${libdir} -llua5.2' \
      'Cflags: -I${includedir}' \
      > "$LUA_PREFIX/lib/pkgconfig/$pc.pc"
  done
  # The image does not provide host pkg-config. This local, descriptor-backed
  # shim is sufficient for the two Lua queries made by the pinned Meson file.
  cat > "$DEPS/bin/pkg-config" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
want_cflags=false
want_libs=false
want_version=false
want_tool_version=false
want_prefix=false
for arg in "$@"; do
  case "$arg" in
    --exists|--validate|--print-errors|--silence-errors|--static) ;;
    --libs|--libs-only-L|--libs-only-l) want_libs=true ;;
    --cflags|--cflags-only-I|--cflags-only-other) want_cflags=true ;;
    --modversion) want_version=true ;;
    --version) want_tool_version=true ;;
    --variable=prefix) want_prefix=true ;;
    lua5.2|lua5.2-c++) package="$arg" ;;
    --atleast-version=*) ;;
    *) [[ "$arg" == --* ]] || exit 1 ;;
  esac
done
if [[ "$want_tool_version" == true ]]; then printf 'pkg-config 0.1\n'; exit 0; fi
[[ "${package:-}" == lua5.2 || "${package:-}" == lua5.2-c++ || "${package:-}" == fftw3f ]] || exit 1
if [[ "$package" == fftw3f ]]; then
  pkg_prefix="$FFTW_PREFIX"; pkg_version=3.3.10; pkg_libs='-lfftw3f -lm'
else
  pkg_prefix="$LUA_PREFIX"; pkg_version=5.2.4; pkg_libs=-llua5.2
fi
if [[ "$want_version" == true ]]; then printf '%s\n' "$pkg_version"; fi
if [[ "$want_prefix" == true ]]; then printf '%s\n' "$pkg_prefix"; fi
if [[ "$want_cflags" == true ]]; then printf '%s ' "-I$pkg_prefix/include"; fi
if [[ "$want_libs" == true ]]; then printf '%s ' "-L$pkg_prefix/lib $pkg_libs"; fi
printf '\n'
EOF
  chmod +x "$DEPS/bin/pkg-config"
}

bootstrap_fftw() {
  mkdir -p "$DEPS"
  if [[ ! -f "$FFTW_ARCHIVE" ]]; then
    curl --fail --location --output "$FFTW_ARCHIVE" \
      "https://www.fftw.org/fftw-3.3.10.tar.gz"
  fi
  [[ "$(sha256sum "$FFTW_ARCHIVE" | cut -d ' ' -f1)" == "$FFTW_SHA" ]] || {
    echo 'BLOCKER: FFTW archive SHA-256 verification failed' >&2; exit 9;
  }
  if [[ ! -f "$FFTW_SOURCE/configure" ]]; then
    rm -rf "$FFTW_SOURCE"
    tar -xzf "$FFTW_ARCHIVE" -C "$DEPS"
  fi
  if [[ ! -f "$FFTW_PREFIX/lib/libfftw3f.a" ]]; then
    rm -rf "$FFTW_SOURCE/build"
    mkdir -p "$FFTW_SOURCE/build"
    cd "$FFTW_SOURCE/build"
    emconfigure ../configure \
      --host=wasm32-unknown-emscripten \
      --prefix="$FFTW_PREFIX" \
      --enable-single --disable-fortran --disable-shared --enable-static --disable-doc
    emmake make -j2
    emmake make install
    cd "$ROOT"
  fi
  mkdir -p "$FFTW_PREFIX/lib/pkgconfig" "$DEPS/bin"
  printf '%s\n' \
    "prefix=$FFTW_PREFIX" \
    'exec_prefix=${prefix}' \
    'libdir=${prefix}/lib' \
    'includedir=${prefix}/include' \
    '' \
    'Name: fftw3f' \
    'Description: FFTW single precision (project-local Emscripten build)' \
    'Version: 3.3.10' \
    'Libs: -L${libdir} -lfftw3f -lm' \
    'Cflags: -I${includedir}' \
    > "$FFTW_PREFIX/lib/pkgconfig/fftw3f.pc"
}

bootstrap_tpt_libs() {
  mkdir -p "$(dirname "$TPT_LIBS_ARCHIVE")" "$SOURCE/subprojects"
  if [[ ! -f "$TPT_LIBS_ARCHIVE" ]]; then
    curl --fail --location --output "$TPT_LIBS_ARCHIVE" "$TPT_LIBS_URL"
  fi
  [[ "$(sha256sum "$TPT_LIBS_ARCHIVE" | cut -d ' ' -f1)" == "$TPT_LIBS_SHA" ]] || {
    echo 'BLOCKER: tpt-libs prebuilt archive SHA-256 verification failed' >&2; exit 10;
  }
  if [[ ! -f "$TPT_LIBS_DIR/meson.build" ]]; then
    local staging="$CACHE/tpt-libs/unpacked"
    rm -rf "$staging" "$TPT_LIBS_DIR"
    mkdir -p "$staging"
    unzip -q "$TPT_LIBS_ARCHIVE" -d "$staging"
    mv "$staging"/tpt-libs-prebuilt-wasm32-emscripten-emscripten-static-release-v20251019131007 "$TPT_LIBS_DIR"
  fi
}

need() { command -v "$1" >/dev/null 2>&1 || { printf 'BLOCKER: required host command missing: %s\n' "$1" >&2; exit 3; }; }
need git; need python3; need ninja; need curl; need tar; need make; need unzip
if [[ ! -x "$MESON_VENV/bin/meson" ]]; then
  printf 'Bootstrapping pinned Meson 1.4.2 in %s\n' "$MESON_VENV"
  PYTHON_BOOTSTRAP="$(command -v python3.12 || command -v python3)"
  # Meson 1.4.2 predates Python 3.14; use the already-installed 3.12
  # interpreter when available, without installing or modifying it.
  if [[ -f "$MESON_VENV/pyvenv.cfg" ]] && ! "$MESON_VENV/bin/python" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)'; then
    rm -rf "$MESON_VENV"
  fi
  python3.12 -m venv "$MESON_VENV" 2>/dev/null || "$PYTHON_BOOTSTRAP" -m venv "$MESON_VENV"
  "$MESON_VENV/bin/python" -m pip install --no-cache-dir 'meson==1.4.2'
fi
MESON="$MESON_VENV/bin/meson"
[[ -x "$MESON" ]] || { echo 'BLOCKER: project-local Meson bootstrap did not produce an executable' >&2; exit 4; }

if [[ ! -d "$SOURCE/.git" ]]; then
  git clone --no-checkout https://github.com/The-Powder-Toy/The-Powder-Toy.git "$SOURCE"
fi
git -C "$SOURCE" fetch --quiet --tags origin "$TPT_SHA"
git -C "$SOURCE" checkout --quiet --detach "$TPT_SHA"
[[ "$(git -C "$SOURCE" rev-parse HEAD)" == "$TPT_SHA" ]] || { echo 'TPT commit verification failed' >&2; exit 5; }

if [[ ! -d "$EMSDK/.git" ]]; then
  git clone --filter=blob:none --no-checkout https://github.com/emscripten-core/emsdk.git "$EMSDK"
fi
git -C "$EMSDK" fetch --quiet origin "$EMSDK_SHA"
git -C "$EMSDK" checkout --quiet --detach "$EMSDK_SHA"
[[ "$(git -C "$EMSDK" rev-parse HEAD)" == "$EMSDK_SHA" ]] || { echo 'emsdk commit verification failed' >&2; exit 6; }
"$EMSDK/emsdk" install 3.1.72
"$EMSDK/emsdk" activate 3.1.72 --permanent
# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh"
# emsdk_env.sh deliberately clears some variables; restore the project-local
# values after sourcing it so Meson/compiler subprocesses cannot fall back to
# a global cache or temporary directory.
export TMPDIR="$CACHE/tmp" EM_CACHE="$CACHE/em-cache" EM_CONFIG="$CACHE/.emscripten"
export EMSDK_HOME="$CACHE/emsdk-home" XDG_CACHE_HOME="$CACHE/xdg-cache" HOME="$CACHE/home"
export PIP_CACHE_DIR="$CACHE/pip-cache" PIP_DISABLE_PIP_VERSION_CHECK=1
# emsdk_env.sh clears EM_CONFIG and the SDK expects a settings file. Generate
# that file locally once, then override its guessed host paths with the pinned
# SDK binaries (never the system LLVM/Binaryen/Node locations).
if [[ ! -f "$EM_CONFIG" ]]; then
  EM_CONFIG="$EM_CONFIG" "$EMSDK/upstream/emscripten/emcc" --generate-config >/dev/null
fi
export EM_LLVM_ROOT="$EMSDK/upstream/bin"
export EM_BINARYEN_ROOT="$EMSDK/upstream"
export EM_NODE_JS="$EMSDK/node/20.18.0_64bit/bin/node"
bootstrap_tpt_libs
export CPPFLAGS="-I$BZ2_PREFIX/include ${CPPFLAGS:-}"
export CFLAGS="-I$BZ2_PREFIX/include ${CFLAGS:-}"
export CXXFLAGS="-I$BZ2_PREFIX/include ${CXXFLAGS:-}"
export LDFLAGS="-L$BZ2_PREFIX/lib ${LDFLAGS:-}"
export LIBRARY_PATH="$BZ2_PREFIX/lib${LIBRARY_PATH:+:$LIBRARY_PATH}"
export PKG_CONFIG_PATH="$BZ2_PREFIX/lib/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
export PKG_CONFIG_PATH="$LUA_PREFIX/lib/pkgconfig:$PKG_CONFIG_PATH"
export LUA_PREFIX PATH="$DEPS/bin:$PATH" PKG_CONFIG="$DEPS/bin/pkg-config"
export FFTW_PREFIX

[[ "$CHECK_ONLY" == true ]] && { echo 'Pinned source/toolchain verified; check only requested.'; exit 0; }
rm -rf "$BUILD/tmp" "$BUILD/out"
mkdir -p "$BUILD/tmp" "$BUILD/out"
# This is deliberately the upstream Meson/Emscripten full-game target. No ABI
# wrapper, app integration, or copy to public/ or Vite dist is performed.
"$MESON" setup "$BUILD/tmp" "$SOURCE" --cross-file "$SOURCE/.github/emscripten-ghactions.ini" -Dbuildtype=release -Dstatic=prebuilt -Dtpt_libs_vtag=v20251019131007
"$MESON" compile -C "$BUILD/tmp"
# Keep the artifact directory limited to runtime transfer files and the map;
# Meson/Ninja intermediates remain in tmp and are never inventory inputs.
for artifact in powder.js powder.wasm powder.wasm.map powder.data powder.worker.js; do
  [[ -f "$BUILD/tmp/$artifact" ]] && cp "$BUILD/tmp/$artifact" "$BUILD/out/$artifact"
done
printf 'Build complete: %s\n' "$BUILD/out"
