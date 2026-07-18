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
7. Preserve the completed responsive UI geometry pass: visible desktop category scrolling, no short-window card overlap, compact mobile catalog with page-scroll chaining and safe touch whitespace, and a non-obstructive mobile field/backend HUD.

## Repository and deployment snapshot

- Repository: `/home/harry/projects/aniFor_codex`
- Branch: `main_codex`
- Local and remote committed HEAD before the current graphics/UI tranche: `088adba Add native TPT simulation tools`
- The gas/liquid styling and responsive geometry work described below is the next checkpoint after that baseline.
- GitHub CLI is authenticated as `harryzhou2000` with `repo` and `workflow` scopes.
- Current live Pages URL: `https://harryzhou2000.github.io/aniFor/`
- Verified live baseline before the current local tranche: `088adba` from Actions run `29650381262`.
- Build, deploy, and post-deployment verification all passed. The live closure contains all 20 referenced resources with correct WASM MIME; live app, WASM glue, and WASM binary hashes exactly matched the local production artifacts. The restored compiler cache produced 265/270 hits (98.15%) and saved the new successful-build key.

## Committed/live baseline (`088adba`)

- Pinned official TPT 100.0 native engine, single-threaded 612×384 WebAssembly.
- 170 stable projected material IDs; 165 particle brushes in the catalog, with 160 enabled and five gravity-dependent entries explicitly disabled.
- Reaction-only Steam, Salt Water, Gas, Snow, and Plasma are bidirectionally projected and renderable.
- Ten true native TPT wall-grid tools with separate ABI, physics, rendering, dirty tracking, and save/load preservation.
- Searchable nested catalog, filters, favorites, recents, hazards/limitations, pressure/temperature HUD, and explicit disabled semantic tools.
- Pixi/WebGL semantic-field renderer with independent particle/wall fields, volumetric gas/liquid/emission fields, material-family styles, 30 Hz render cap, bounded dirty chunks, and Canvas2D fallback.
- Two-times backing resolution: 612×384 logical world to 1224×768 backing, independent of DPR and input math.
- Stable desktop viewport aspect and validated desktop pointer/wheel/middle-pan mapping.
- Manual `build` / `build-and-deploy` workflow; `main_codex` pushes do not auto-build; project-local Emscripten/Meson; successful-build-only `ccache` persistence.
- Native Air, Vacuum, Wind, Heat, and Cool tools with typed point/vector dispatch, wall-aware air processing, safe validation, residual-air isolation, and OPS preservation of pending Wind.

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
- The pre-tranche live `edfcf94` deployment passes the closure verifier for all 20 referenced resources. A fresh live trace promoted from Canvas to WebGL in 3.090 seconds with no missing asset, shader, runtime, or network error; its app/Pixi hashes differ from the newer local renderer output.

### Native projection cleanup

- The five reaction-only material IDs now map in both directions in `tpt_adapter.cpp`.
- Native tests project all 170 IDs and verify Steam as an actual reaction product.
- The published WASM artifact was rebuilt locally.

## Native simulation-tool checkpoint (`088adba`)

- Air, Vacuum, Wind, Heat, and Cool are now enabled as true simulation tools with stable project-owned ABI IDs rather than particle aliases.
- Point and raw-vector dispatch are separated. Wind point samples explicitly no-op, so selecting Wind cannot paint the previously selected material; the un-interpolated drag segment is applied once while ordinary brush tools retain continuous grid interpolation.
- Air/Vacuum apply TPT's exact ±0.05 pressure delta per brush pixel. Heat/Cool apply ±2 K to ordinary particles and ±0.1 K to PUMP/GPMP, with upstream pressure/temperature clamps.
- Wind clears inactive particle-authored coarse velocity at the start of a new gesture epoch, writes the authored `vx`/`vy`, enables `AIR_ON` for exactly one `BeforeSim` pass, and returns to `AIR_VELOCITYOFF` before particle advection. This preserves diffusion, pressure coupling, clamping, and air-blocker semantics without globally reactivating unrelated residual air or reintroducing the earlier long-term water ejection.
- Wall mutation now refreshes the corresponding native `bmap_blockair` cell immediately, so a newly authored blocker is effective for the next Wind update.
- A pending, unstepped Wind vector round-trips through ordinary OPS velocity maps plus the optional namespaced `aniforTptWindPending` Boolean. Stock TPT ignores the unknown field; AniforTPT restores the one-frame intent without misclassifying ordinary imported-save velocity.
- Native validation rejects invalid IDs, coordinates, radii over 64, and oversized vectors. Integer vector arguments prevent NaN/Infinity from contaminating the air arrays.
- Signs and configured-source targeting remain disabled and distinct; this tranche does not misclassify them as particle brushes.

## Current local graphics and responsive UI tranche

- Canvas gas now passes through an allocation-free directional relief stage at half resolution. It copies atmosphere alpha exactly, preserves RGB channel ordering, and adds density depth without expanding the gas footprint. The Canvas atmosphere blur is tightened from 0.9× to 0.55× output scale.
- Dense WebGL gas blends semantic particle color toward the shared atmosphere mixture, removing the raw orange/cyan dot island while retaining the intentional sparse control row.
- WebGL liquids add broad low-frequency sheen, vertical depth, and restrained caustics inside the existing species-aware silhouette. Browser evidence shows brighter rims, darker bodies, and visible internal variation without edge blur or seam bleed.
- Desktop tool filters retain a constant 40 px track and expose a thin horizontal scrollbar; `Recent` is reachable at every constrained desktop width. Desktop toolbox tracks now reserve space for the palette and actions, with a compact short-height rule and shell scrolling rather than card overlap.
- Mobile uses a 230–300 px catalog, inner vertical/horizontal scrolling with document overscroll chaining, compact actions, and 24 px toolbox touch whitespace. The HUD is 132 px wide with smaller labels and a truncated backend row; the touch hint moved to the lower-left so overlap is zero.
- Viewport fitting is animation-frame coalesced across frame observation, window resize, visual-viewport resize, and compact-media changes. This fixed a reproduced stale 1280-wide viewport after resizing to 1024×600.

## Verification completed for the current local tree

- `npm run typecheck`
- `npm test -- --run`: 32 files, 127 tests passed
- `npm run build`
- Static build closure: 20 referenced resources verified (including the explicit favicon)
- Current live Pages closure: 20 resources verified, including `stillroom_core.wasm` with the correct MIME
- Real TPT save-file load/reserialize check passed for the user-provided `OPS1` save
- Earlier desktop browser audit at DPR 1 and 2 proved 612×384 CSS/logical geometry, 1224×768 backing, exact left/center/right painting, continuous drag, middle pan, touch pan/pinch, and wheel anchoring within browser-event quantization.
- Final rebuilt mobile smoke at 390×844 DPR 2 booted direct native TPT with the Canvas2D compatibility renderer and 1224×768 backing. The 378×378 viewport contained a 378×237.176 canvas at aspect 1.59375012, with no crop or horizontal overflow.
- The mobile filter row now has a constant 40 px track with a visible thin scrollbar; filter buttons remain 28 px high. One-finger painting, two-finger pinch without stray paint, and explicit Eraser restoration passed with zero console, exception, or network failures.
- Fresh render-lab browser evidence at 1280×720 and `renderScale=2` passed for both forced Canvas and SwiftShader WebGL. In the final tree, the badge visibly transitioned from `Canvas 2D · starting WebGL` to `WebGL` as promotion completed in 6.029 seconds. The viewport retained a 1224×768 backing and 827×518.902 CSS canvas with no shader, console, runtime, HTTP, or network errors.
- The WebGL and Canvas screenshots show cohesive water/oil/acid/lava columns without black pinholes or cross-family bleeding, continuous mixed gas volumes, and preserved sparse control rows. Canvas deliberately remains softer and more internally speckled than WebGL.
- A retained real-browser interaction audit painted full 3×3 landmark grids before and after promotion. All 18 HUD-selected cells matched; footprint centroid error stayed below 1.5 CSS px, off-center wheel-anchor error was 0.035 CSS px, middle pan was within 0.013 px, and promotion produced zero canvas-rectangle or world-cell drift.
- A repeated production resize sequence `1280×720 → 1024×600 → 1440×900 → 1024×600` now refits on every transition. The 1024 viewport is 686×430.422 inside its 686.188×470 frame, aspect 1.593785, with subpixel containment and unchanged 1224×768 backing; no stale size, runtime, console, or network error remains.
- Fresh touch-emulated metrics at 390×844 and 360×640 show compact palette/toolbox sizes of 300/533 px and 230.39/463.39 px, a 132×37.78 HUD with zero touch-hint overlap, no viewport/palette/actions/footer overlap, reachable footer, exact square interaction panels, 1.59375 canvas aspect, symmetric 70.41/64.82 px letterboxing, and 1224×768 backing. With the catalog already at its 241 px inner-scroll maximum, one trusted swipe kept it at max and advanced document scrollY from 0 to 144, proving page-scroll chaining.
- Current WebGL/Canvas browser acceptance has zero shader/runtime/network errors. Dense WebGL gas is continuous without the prior raw-dot island; Canvas gas has clearer relief/species separation; liquid caps and columns show brighter rims, darker depth, and caustic variation while retaining crisp silhouettes and clean unlike-species seams.
- Latest warmed field profile at 612×384: atmosphere 6.91 ms median, species-aware liquid 12.03 ms, emission 3.25 ms, Canvas atmosphere relief 1.31 ms median / 1.48 ms p90, solid reconstruction 1.28 ms, and liquid reconstruction 1.69 ms. Shared volume storage remains 8,173,320 bytes; the relief pass adds no persistent allocation.
- Native semantic-tool coverage now proves exact scalar deltas, stable typed routing, no vector-to-particle fallthrough, no vector emission during pinch navigation, malformed ABI rejection, Wind response, `WL_BLOCKAIR` isolation, stable-water regression, and unstepped OPS Wind round-tripping.

The `088adba` native-tool checkpoint is committed, pushed, and verified live. The current graphics/responsive-UI tranche passes unit, type, build, profile, desktop-resize, visual, and mobile geometry checks; its remaining handoff is final review, commit, manual deployment, and cache-busted live validation.

## Current blockers and risks

- The current local graphics/responsive-UI tranche is not live until it is committed, pushed to `main_codex`, manually deployed, and tested at the Pages URL.
- WebGL runtime GLSL is not compiled by TypeScript/Vite; preserve the fresh browser audit for every shader change.
- The post-deploy verifier proves network asset closure and MIME, but not shader execution or interaction by itself.
- Configured sources, signs, LIFE presets, and several special editing semantics remain future work.
- Newtonian FFT gravity is intentionally omitted from the headless build, so gravity-dependent tools/elements must remain disabled or limited.
- GPU partial texture upload, long-session allocation behavior, context loss, and full performance budgets need further profiling.

## Next sequence

1. Review `git diff`, ensure no unintended/untracked files, and commit the graphics/responsive-UI tranche.
2. Push only `main_codex`, then trigger `verify-static-game` manually with `operation=build-and-deploy`.
3. Inspect ccache restore/save and the local/live asset-closure steps.
4. Open the cache-busted live Pages URL; confirm native status, backend promotion, Canvas/WebGL gas and liquid visuals, repeated desktop resize containment, mobile catalog/HUD geometry, page-scroll chaining, and no console/network failures.
5. Return to sources/signs/LIFE expansion and the next bounded graphics/performance tranche; keep the persistent goal active.
