# AniforTPT

A mobile-first particle playground backed by The Powder Toy. Its searchable, nested catalog exposes 165 particle brushes across powders, liquids, solids, gases, energy, explosives, special, radioactive, force, electronics, powered, sensors, and life. Of those, 160 are enabled in the current headless build and five gravity-dependent entries remain visible but explicitly disabled. Native reactions and phase changes project all 170 supported material IDs, including products that are intentionally not selectable. The interface also includes live pressure and particle-temperature inspection, touch/pointer painting, pinch/pan navigation, favorites and recents, URL sharing, and local autosave.

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

Deploy `dist/` to GitHub Pages, Cloudflare Pages, or Netlify. Vite uses relative asset paths, so subdirectory hosting works. `.github/workflows/ci.yml` verifies ordinary pushes and pull requests, while pushes to `main_codex` are intentionally manual. Run the **verify-static-game** workflow on `main_codex` and choose either `build` or `build-and-deploy`; successful runs upload the static artifact, and the latter publishes through the GitHub Pages environment. C++ recompilation is accelerated by a project-local ccache directory restored from GitHub Actions cache and saved only after a successful build. In the repository settings, choose **GitHub Actions** as the Pages source.

## Backend boundary

The shipped default is the official Powder Toy 100.0 simulation compiled directly to a single-threaded 612×384 WebAssembly module. `native/tpt/tpt_adapter.cpp` keeps upstream types and numeric element IDs behind a small C ABI and exposes material, pressure, particle-temperature, and velocity fields. The old compact C++ kernel and deterministic TypeScript backend remain startup fallbacks only.

The Emscripten SDK lives under ignored `.toolchains/emsdk`, Meson under ignored `.venv`, and the pinned upstream checkout/build under ignored `.cache`. `npm run build:wasm` fetches the recorded upstream revision, applies `patches/the-powder-toy-headless.patch`, builds the headless target, and publishes adjacent ES-module glue and WASM files to `public/wasm`.

Run `npm run fetch:tpt` to obtain the pinned official Powder Toy revision in the ignored `.cache` directory. See `docs/powder-toy-integration.md` for the headless extraction sequence and GPL distribution requirements.

## Rendering

The active renderer uploads material ID, temperature, and velocity as one compact RGBA semantic field instead of drawing simulation cells. A Pixi/WebGL shader reconstructs local occupancy into softened chunk boundaries, contour normals, cohesive liquid depth and highlights, volumetric gas motion, and emissive heat/energy. Material colors and visual families come from lookup textures, so every projected reaction product remains renderable without shader branches for individual elements. Upload work is coalesced in halo-aware 32-cell dirty chunks, rendering is capped at 30 Hz, and device pixel ratio is capped at 1.5. Canvas2D retains the allocation-free neighborhood-density renderer as the compatibility path, so deployment does not require WebGPU, pthreads, `SharedArrayBuffer`, or custom response headers.
