# AniforTPT Work Resume

Last reconciled: 2026-07-18 (Asia/Shanghai)

This is the authoritative handoff for the active AniforTPT workstream. The goal is not complete.

## Active objective

Build a polished browser reinterpretation of The Powder Toy that keeps the pinned native TPT simulation authoritative while replacing direct pixel/cell presentation with a smooth styled material renderer. Preserve exact viewport/input mapping, native reactions and save state, broad element coverage, distinct particle/wall/sign/source/tool semantics, bounded performance, a Canvas2D compatibility path, mobile-first controls, and a cached manual GitHub Pages deployment pipeline.

Immediate priorities are:

1. Keep desktop and mobile camera/input correct: full field visible at minimum zoom, no aspect stretch, exact brush/cursor mapping, middle-button desktop pan, one-finger mobile draw, two-finger pan/pinch, and an explicit mobile Draw/Eraser mode.
2. Continue the graphics overhaul: cohesive liquids and solids, volumetric gases/energy, vivid but readable shading, two output pixels per simulation cell, and no excessive blur.
3. Expand practical TPT interface coverage, especially forces, sources, radioactive/nuclear elements, growing plants, LIFE presets, signs, and simulation tools without misclassifying them as ordinary particles.
4. Make save/share file-based instead of clipboard/URL-based, using native TPT files wherever the native backend is active.
5. Keep desktop tool discovery usable at constrained browser scaling and make the portrait toolbox visible without shrinking the viewport into a strip.
6. Commit and push reviewed work to `main_codex`, run the manual cached `build-and-deploy`, and verify the live Pages runtime rather than accepting a successful workflow alone.

## Repository and deployment snapshot

- Repository: `/home/harry/projects/aniFor_codex`
- Branch: `main_codex`
- Local and remote committed HEAD before the current tranche: `4fef7d6 Add TPT save files and harden mobile Pages runtime`
- The current tranche is uncommitted and unpushed.
- GitHub CLI is authenticated as `harryzhou2000` with `repo` and `workflow` scopes.
- Current live Pages URL: `https://harryzhou2000.github.io/aniFor/`
- Current live Pages deployment is `4fef7d6` from Actions run `29646355429`.
- That deployment contains all 20 referenced resources, serves WASM with `application/wasm`, and boots direct native TPT. It nevertheless selects Canvas2D on a cold load because Pixi presenter initialization takes roughly 1.15–1.22 seconds and crosses the old hard 1.2-second deadline even though WebGL2 and the Pixi asset are both available.

## Committed baseline (`4fef7d6`)

- Pinned official TPT 100.0 native engine, single-threaded 612×384 WebAssembly.
- 170 stable projected material IDs; 165 particle brushes in the catalog, with 160 enabled and five gravity-dependent entries explicitly disabled.
- Reaction-only Steam, Salt Water, Gas, Snow, and Plasma are bidirectionally projected and renderable.
- Ten true native TPT wall-grid tools with separate ABI, physics, rendering, dirty tracking, and save/load preservation.
- Searchable nested catalog, filters, favorites, recents, hazards/limitations, pressure/temperature HUD, and explicit disabled semantic tools.
- Pixi/WebGL semantic-field renderer with independent particle/wall fields, volumetric gas/liquid/emission fields, material-family styles, 30 Hz render cap, bounded dirty chunks, and Canvas2D fallback.
- Two-times backing resolution: 612×384 logical world to 1224×768 backing, independent of DPR and input math.
- Stable desktop viewport aspect and validated desktop pointer/wheel/middle-pan mapping.
- Manual `build` / `build-and-deploy` workflow; `main_codex` pushes do not auto-build; project-local Emscripten/Meson; successful-build-only `ccache` persistence.

## Committed checkpoint details

### Native save files

- `PowderToyBackend.saveFile()` returns the engine's raw `GameSave::Serialise()` bytes; modern output begins with `OPS1`.
- `PowderToyBackend.loadFile()` passes raw bytes through the native parser and refreshes all particle/wall dirty state.
- **Save / share** sends a real file to the system share sheet when file sharing is supported, otherwise downloads it.
- Native output uses `.cps`, matching TPT's desktop save browser. `.cps` and `.stm` input is accepted; native TPT also recognizes legacy `PSv` and `fuC` signatures.
- Non-native fallback engines use a distinct `.anifortpt` text wrapper and are never presented as TPT-compatible.
- Import is limited to 32 MiB. Old AniforTPT hash links are still readable for migration, but the UI no longer creates huge URL/clipboard payloads.
- The user-provided save `GetSave.util?ID=257313` was downloaded only to `/tmp` for validation: 20,599-byte `OPS1`, loaded as 83,767 occupied cells, and reserialized successfully as `OPS1`.

### Desktop/mobile layout and input

- Desktop toolbox width is now 260–340 CSS px and has a 430 px minimum usable height; short/scaled pages scroll instead of collapsing the search/library to zero.
- Actions are a 2×2 grid for Pause, Save/share, Open file, and Clear.
- Portrait layout uses a scrollable page, visible compact toolbox heading, non-collapsing palette, explicit Draw/Eraser buttons, and a square interaction panel.
- At minimum zoom the full 612×384 field is uniformly contained and centered in the square mobile panel; vertical space is letterboxed, never stretched or cropped.
- One touch is a continuous brush. A tap paints once, but initial paint is deferred so an immediate second touch cannot leave a stray dot.
- Two touches pan and pinch without painting. Dropping back to one finger rebases without a connecting stroke.
- Desktop middle drag remains pan and right drag remains erase.

### Pages/runtime hardening

- Canvas mounts synchronously so `Game.start()` can expose controls and start native TPT without waiting for the Pixi module, GPU startup, or shader compilation.
- WebGL may promote the same viewport for up to ten seconds. The known-good Canvas remains mounted until the candidate has seeded its semantic fields and completed a first render; a failed or timed-out candidate is destroyed without blanking the viewport.
- `scripts/verify-static-assets.mjs` recursively checks HTML references, nested JS imports, runtime WASM URLs, file existence, and non-empty output.
- `scripts/verify-live-pages.mjs` performs the same closure check against the deployed URL with retry/cache-busting and validates WASM MIME.
- A separate least-privilege verification job checks out the verifier and runs it after `actions/deploy-pages`; repository code does not execute with Pages write or OIDC permissions.
- The current live `4fef7d6` deployment passes the closure verifier for all 20 referenced resources; its remaining issue is the old cold-start renderer deadline, not a missing asset.

### Native projection cleanup

- The five reaction-only material IDs now map in both directions in `tpt_adapter.cpp`.
- Native tests project all 170 IDs and verify Steam as an actual reaction product.
- The published WASM artifact was rebuilt locally.

## Current local renderer tranche

- The viewport HUD now shows `WebGL` or `Canvas 2D` and exposes a machine-readable fallback reason.
- Canvas mounts synchronously on WebGL-capable browsers, the game and controls can paint, and Pixi initialization starts on the following frame. A ready presenter promotes the same viewport in place within a bounded ten-second window; failure or timeout keeps the working Canvas renderer.
- The previous permanent 1.2-second Pixi cutoff is removed. A fresh production browser trace observed Canvas with `webgl-starting` before Pixi, then promoted to WebGL 6.173 seconds later without geometry drift or runtime/network errors.
- WebGL and Canvas now share canonical phase/color/emission lookups plus the staggered 12 Hz atmosphere, liquid-density, and emission field set.
- Canvas uses the shared density field to close small empty liquid pinholes while preserving occupied grains and hard particles, then combines a high-quality surface pass with a restrained crisp 2× pass. Gas and emission use the shared widened/color-mixed volume bytes rather than only discrete blurred source cells.
- An unchanged native scene no longer forces a full Canvas raster rebuild at 30 Hz merely because temperature and velocity arrays exist; dynamic-only refreshes use the existing 12 Hz ceiling.

## Verification completed for the current local tree

- `npm run typecheck`
- `npm test -- --run`: 28 files, 107 tests passed
- `npm run build`
- Static build closure: 20 referenced resources verified (including the explicit favicon)
- Current live Pages closure: 20 resources verified, including `stillroom_core.wasm` with the correct MIME
- Real TPT save-file load/reserialize check passed for the user-provided `OPS1` save
- Earlier desktop browser audit at DPR 1 and 2 proved 612×384 CSS/logical geometry, 1224×768 backing, exact left/center/right painting, continuous drag, middle pan, touch pan/pinch, and wheel anchoring within browser-event quantization.
- Final rebuilt mobile smoke at 390×844 DPR 2 booted direct native TPT with the Canvas2D compatibility renderer and 1224×768 backing. The 378×378 viewport contained a 378×237.176 canvas at aspect 1.59375012, with no crop or horizontal overflow.
- The mobile filter row measured exactly 34 px, and all filter buttons measured 28 px high. One-finger painting, two-finger pinch without stray paint, and explicit Eraser restoration passed with zero console, exception, or network failures.
- Fresh render-lab browser evidence at 1280×720 and `renderScale=2` passed for both forced Canvas and SwiftShader WebGL. Canvas mounted with `webgl-starting`, the HUD appeared, and WebGL promoted 6.173 seconds later. Four WebGL draws completed while the fallback remained connected; only then was Canvas removed and all seven backing stores zeroed. Both retained a 1224×768 backing and 827×518.902 CSS canvas with no console, runtime, HTTP, or network errors.
- The WebGL and Canvas screenshots show cohesive water/oil/acid/lava columns without black pinholes or cross-family bleeding, continuous mixed gas volumes, and preserved sparse control rows. Canvas deliberately remains softer and more internally speckled than WebGL.

The new local renderer audit is complete. Do not claim the live renderer-selection issue fixed until a new deployment and a cache-busted live promotion trace pass.

## Current blockers and risks

- The live site is not fixed until the current local changes are committed, pushed to `main_codex`, manually deployed, and tested at the Pages URL.
- WebGL runtime GLSL is not compiled by TypeScript/Vite; the fresh browser audit remains mandatory.
- The post-deploy verifier proves network asset closure and MIME, but not shader execution or interaction by itself.
- Full simulation-force tools, configured sources, signs, LIFE presets, and several special editing semantics remain future work.
- Newtonian FFT gravity is intentionally omitted from the headless build, so gravity-dependent tools/elements must remain disabled or limited.
- GPU partial texture upload, long-session allocation behavior, context loss, and full performance budgets need further profiling.

## Next sequence

1. Review `git diff`, ensure no unintended/untracked files, and commit the integrated tranche.
2. Push only `main_codex`.
3. Trigger `verify-static-game` manually with `operation=build-and-deploy`.
4. Inspect ccache restore/save and the new local/live asset-closure steps.
5. Open the cache-busted live Pages URL; confirm native status, mounted canvas, WebGL or Canvas fallback, desktop toolbox, mobile square/full-field view, brush/eraser, pinch/pan, file controls, and no console/network failures.
6. Resume the styled rendering and wider semantic-tool roadmap; the persistent goal stays active.
