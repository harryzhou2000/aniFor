# AniforTPT

A mobile-first particle playground backed by The Powder Toy. Its searchable, nested catalog exposes 165 particle brushes across powders, liquids, solids, gases, energy, explosives, special, radioactive, force, electronics, powered, sensors, and life, plus ten true native wall-grid brushes. Of the particle brushes, 160 are enabled in the current headless build and five gravity-dependent entries remain visible but explicitly disabled. Native reactions and phase changes project all 170 supported material IDs, including products that are intentionally not selectable. Air, Vacuum, Wind, Heat, and Cool are native simulation tools with their own pressure/vector/thermal operations; signs and configured-source targeting remain visible but disabled rather than being misrepresented as particles. The interface also includes live pressure and particle-temperature inspection, desktop and mobile brush modes, one-finger painting, two-finger pinch/pan navigation, favorites and recents, native save-file exchange, and local autosave.

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

## Save files

**Save / share** passes a real file to the system share sheet when file sharing is available, otherwise it downloads it. The native engine's serialized bytes use TPT's `.cps` extension: modern files begin with `OPS1` and can be opened by desktop TPT. **Open file** accepts those files as well as the legacy TPT formats that the pinned engine supports. This avoids expanding a full world into the URL or clipboard. Older AniforTPT hash links remain importable for backward compatibility, but the interface no longer generates them. If startup falls back to the compact compatibility engine, export uses a clearly separate `.anifortpt` format rather than claiming TPT compatibility. Files are capped at 32 MiB before parsing.

## Backend boundary

The shipped default is the official Powder Toy 100.0 simulation compiled directly to a single-threaded 612×384 WebAssembly module. `native/tpt/tpt_adapter.cpp` keeps upstream types and numeric element/wall/tool IDs behind a small C ABI and exposes material, native wall, pressure, particle-temperature, and velocity fields. The old compact C++ kernel and deterministic TypeScript backend remain startup fallbacks only.

The Emscripten SDK lives under ignored `.toolchains/emsdk`, Meson under ignored `.venv`, and the pinned upstream checkout/build under ignored `.cache`. `npm run build:wasm` fetches the recorded upstream revision, applies `patches/the-powder-toy-headless.patch`, builds the headless target, and publishes adjacent ES-module glue and WASM files to `public/wasm`.

Run `npm run fetch:tpt` to obtain the pinned official Powder Toy revision in the ignored `.cache` directory. See `docs/powder-toy-integration.md` for the headless extraction sequence and GPL distribution requirements.

## Rendering

The active renderer uploads material ID, temperature, and velocity as one compact RGBA semantic field and native walls as an independent field instead of drawing simulation cells directly. A Pixi/WebGL shader reconstructs local occupancy into softened chunk boundaries, contour normals, cohesive liquid depth and highlights, volumetric gas motion, and emissive heat/energy, then composites wall patterns behind particles without conflating their IDs. Material colors and visual families come from lookup textures, so every projected reaction product remains renderable without shader branches for individual elements. Upload work is coalesced in halo-aware 32-cell dirty chunks, rendering is capped at 30 Hz, and the default 612×384 logical world renders to a 1224×768 backing without putting DPR into world/input math. The shared liquid field carries both species color and density, so same-liquid pinholes join while water/oil/acid interfaces do not inherit an arbitrary neighbor's color. Canvas2D consumes the same liquid, atmosphere, emission, palette, and family data; it adds enclosed solid-pinhole reconstruction and deterministic granular/rigid/organic/radioactive/device/field styling while remaining the immediate compatibility presentation during cold Pixi startup. A ready WebGL presenter replaces it in place rather than losing the richer renderer to a short startup deadline. The viewport badge shows the active backend and, while Canvas is retained, whether WebGL is starting, forced, unavailable, timed out, or failed.
