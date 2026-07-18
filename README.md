# AniforTPT

A mobile-first particle playground backed by The Powder Toy. It includes 36 selectable brushes in seven responsive categories, reaction and phase-change product rendering, live pressure and particle-temperature inspection, touch/pointer painting, pinch/pan navigation, URL sharing, and local autosave.

## Run locally

```sh
npm install
npm run dev
```

Production output is fully static:

```sh
npm run setup:emsdk # one-time, downloads pinned Emscripten 6.0.3 locally
npm run setup:build-tools # one-time, installs pinned Meson in .venv
npm run build:all   # WebAssembly -> tests -> typecheck/Vite production build
```

The SDK and its compiler caches live under the ignored `.toolchains/emsdk`
directory; no global emsdk activation is needed. Individual pipeline stages remain
available as `npm run build:wasm`, `npm run test`, and `npm run build`.

Deploy `dist/` to GitHub Pages, Cloudflare Pages, or Netlify. Vite uses relative asset paths, so subdirectory hosting works. GitHub Actions verifies every push and pull request, uploads the static artifact, and deploys successful `main` builds through the repository's GitHub Pages environment. In the repository settings, choose **GitHub Actions** as the Pages source.

## Backend boundary

The shipped default is the official Powder Toy 100.0 simulation compiled directly to a single-threaded 612×384 WebAssembly module. `native/tpt/tpt_adapter.cpp` keeps upstream types and numeric element IDs behind a small C ABI and exposes material, pressure, particle-temperature, and velocity fields. The old compact C++ kernel and deterministic TypeScript backend remain startup fallbacks only.

The Emscripten SDK lives under ignored `.toolchains/emsdk`, Meson under ignored `.venv`, and the pinned upstream checkout/build under ignored `.cache`. `npm run build:wasm` fetches the recorded upstream revision, applies `patches/the-powder-toy-headless.patch`, builds the headless target, and publishes adjacent ES-module glue and WASM files to `public/wasm`.

Run `npm run fetch:tpt` to obtain the pinned official Powder Toy revision in the ignored `.cache` directory. See `docs/powder-toy-integration.md` for the headless extraction sequence and GPL distribution requirements.

## Rendering

The active renderer turns native simulation fields into a continuous shaded surface rather than drawing particle dots. It uses allocation-free neighbourhood density and contour lighting, smooth liquid depth and specular rims, volumetric gas layers, and temperature-driven fire bloom. Rendering is capped at 30 Hz while physics continues at 60 Hz. Hardware WebGL progressively enables a lazy Pixi presenter; Canvas2D remains the automatic fallback, so deployment does not require WebGPU, WebGL, pthreads, `SharedArrayBuffer`, or custom response headers.
