# TPT Gate A results

## Status

**Official configure/build succeeded; browser Gate A remains unmeasured.** The
manual bzip2/Lua/FFTW experiment is superseded by the official pinned
`tpt-libs` prebuilt Meson subproject. No browser or runtime Gate A success is
claimed.

## Exact blocker

The previous run (2026-07-18) found:

```text
/usr/bin/git
/home/linuxbrew/.linuxbrew/bin/python3
/usr/bin/node
/usr/bin/ninja
Meson: missing (previous blocker)
```

The official target is a Meson build. `build.sh` now creates
`.cache/tpt/meson-venv` with Python's `venv` module and installs exactly
`meson==1.4.2` from its PyPI source distribution using that venv's pip,
`--no-cache-dir`, and project-local
`TMPDIR`/`PIP_CACHE_DIR`. It invokes the resulting Meson executable by local
path. No system/user package installation or `/tmp` use is permitted.

The first resume attempt used Python 3.14.3 and stopped at the local pip
bootstrap because PyPI offers no compatible `meson==1.4.2` distribution for
that interpreter. Python 3.12 is already available at `/usr/bin/python3.12`,
so the script now recreates the project-local venv with that interpreter and
does not install Python. The second attempt succeeded with Meson 1.4.2 from
the PyPI source distribution (wheel built locally; reported SHA-256 was
`19849dca2eb224f918c809dff996f677be3d0c6e4ec57621ca3a1c0edd3ae691`).

## Build attempt result

The project-local emsdk 3.1.72 setup completed, and Meson configured the
official TPT source as project version 100.0.399. It then stopped exactly at:

```text
vendor/tpt/source/meson.build:122:15: ERROR: C++ header 'bzlib.h' not usable
```

No system package was installed. Per the instruction to stop at the exact
new prerequisite failure, no workaround or further build step was attempted.

## bzip2 resume result

The pinned bzip2 `1.0.8` archive downloaded into `.cache/tpt/deps` and passed
SHA-256 verification. Its seven C sources were compiled with the pinned
Emscripten compiler and installed as a project-local `bzlib.h` and
`libbz2.a`. Meson then reported `Check usable header "bzlib.h" : YES` and
`Library bz2 found: YES`.

The next configure blocker was:

```text
Found pkg-config: NO
Found CMake: NO
Run-time dependency lua5.2-c++ found: NO (tried pkgconfig and cmake)
vendor/tpt/source/meson.build:190:3: ERROR: Problem encountered: your system lua5.2 is not compatible with C++, configure with -Dworkaround_noncpp_lua=true to disable this error
```

The build stopped at this exact point. No project-local Lua workaround was
attempted, and no system package manager was used.

## Lua resume result

The pinned Lua `5.2.4` archive passed SHA-256 verification. Its library
sources were compiled with emcc and installed under `.cache/tpt/deps/lua`.
Both `lua5.2.pc` and the upstream-requested `lua5.2-c++.pc` descriptors point
only to that prefix. Because no host `pkg-config` executable was available,
the build also creates a small project-local descriptor-backed shim and puts
it first in `PATH`; Meson confirmed:

```text
Found pkg-config: YES (.../.cache/tpt/deps/bin/pkg-config) pkg-config 0.1
Run-time dependency lua5.2-c++ found: YES 5.2.4
```

The next exact configure blocker was:

```text
Run-time dependency fftw3f found: NO (tried pkgconfig)
vendor/tpt/source/meson.build:220:11: ERROR: Dependency "fftw3f" not found, tried pkgconfig
```

The run stopped there. No FFTW workaround or further build step was
attempted.

## FFTW resume result

The pinned FFTW `3.3.10` archive passed SHA-256 verification. The configured
flags were `--enable-single --disable-fortran --disable-shared
--enable-static --disable-doc`, with a project-local install prefix. The
first configure command stopped exactly at:

```text
checking host system type... Invalid configuration `wasm32-unknown-emscripten': system `emscripten' not recognized
configure: error: /bin/bash ../config.sub wasm32-unknown-emscripten failed
emconfigure: error: configure ... failed (returned 1)
```

No FFTW compilation/install, TPT retry, or transfer inventory was performed
after this blocker. No system package manager was used.

## Official tpt-libs resume result

The build now caches and SHA-256 verifies the official archive
`v20251019131007`, extracts its exact Meson subproject directory under the
ignored upstream `subprojects/` path, and invokes the upstream path with:

```text
-Dstatic=prebuilt -Dtpt_libs_vtag=v20251019131007
```

Meson confirmed the pinned subproject and overrides:

```text
Subproject tpt-libs-prebuilt-wasm32-emscripten-emscripten-static-release-v20251019131007: YES
Dependency lua5.2-c++ found: YES 5.2.4-tpt-libs (overridden)
Dependency fftw3f found: YES 3.3.8-tpt-libs (overridden)
Dependency jsoncpp found: YES 1.9.5-tpt-libs (overridden)
```

The official TPT build completed all 413 Ninja targets and produced
`powder.js` and `powder.wasm` under `build/tpt-wasm/out`. The output directory
contains only runtime artifacts plus the source map; build intermediates stay
under `build/tpt-wasm/tmp`.

The archive's license files were inspected and are recorded in
`TPT-LIBS-LICENSES.md`. They identify FFTW GPLv2, Lua.org permissive terms, and
JsonCpp public-domain/MIT terms. This is metadata only; GPL compatibility and
redistribution compliance are not claimed.

The prior manually compiled bzip2 1.0.8, Lua 5.2.4, and failed FFTW 3.3.10
route remains documented above as a superseded experiment and is not invoked
by the Gate A build.

## Transfer inventory

`node spikes/tpt/gate-a.mjs` measured the successful build's runtime artifacts
(maps reported but excluded from the production total):

```text
powder.js       raw 480306   gzip 112762   brotli 90875
powder.wasm     raw 6295914 gzip 1714635  brotli 1273475
powder.wasm.map raw 3129949 gzip 809792   brotli 632122 (map)
Required cold-cache Brotli total: 1364350 bytes (1.30 MiB)
Target <= 12 MiB: PASS (inventory only)
```

## Measurements

## Browser evidence attempt

Command: `TPT_GATE_PORT=45011 node spikes/tpt/browser-gate.mjs`, using installed
Google Chrome and Playwright. The server returned these actual headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

Observed browser results:

- `crossOriginIsolated`: `true`.
- JS and WASM loaded; the factory initialized and the first harness frame was
  observed at approximately **1,475 ms** after navigation start.
- Pthread/worker errors: none observed by the harness; no browser crash event
  was reported.
- A 30-second post-start wait was attempted, but the page closed before the
  final sample (`pageClosed: true`); the observed wall interval was 72.0 s due
  to the browser/page shutdown behavior, so 30-second stability **did not
  pass**.
- One external `Startup.json` request failed with
  `net::ERR_PROXY_CONNECTION_FAILED`; it produced a TPT `TypeError: Failed to
  fetch` and status 600 warning. A favicon-style 404 was also logged. Other
  console output consisted of enumerated missing optional UI/resource warnings
  and WebGL context-loss warning.
- The harness observed 1 failed request, 3 console errors (including the
  proxy failure and 404), no browser crash event, and no unhandled rejection
  event from the harness.
- `performance.measureUserAgentSpecificMemory()` was available, but its final
  value was unavailable because the page closed before sampling. No memory
  budget pass is claimed.
- Native TPT save/reload proof was not attempted: the isolated harness exposes
  no native save UI and no save proof is inferred.

Run `node spikes/tpt/gate-a.mjs` for inventory and
`node spikes/tpt/browser-gate.mjs` for a fresh browser attempt. The separate
header-capable server remains `node spikes/tpt/serve.mjs`.

## Reproduction

```sh
bash spikes/tpt/build.sh --help
bash spikes/tpt/build.sh
node spikes/tpt/gate-a.mjs
node spikes/tpt/serve.mjs
```

The build pins the official TPT commit and emsdk 3.1.72 commit recorded in
`PINS.json`, keeps all temporary/cache/toolchain/output paths project-local,
and never writes `public/` or Vite `dist/`.
