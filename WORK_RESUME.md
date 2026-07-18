# AniforTPT Work Resume

Last reconciled: 2026-07-19 (Asia/Shanghai)

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

Queued after the renderer checkpoint: revisit desktop/mobile geometry as a dedicated visual pass. Desktop tool categories must not become an unscrollable over-wide row, short windows must never let the Brush card cover the tool library, and constrained scaling must retain usable catalog height. Mobile must keep the material menu conspicuous, compact the pressure/temperature/backend HUD, avoid page-width overflow, and leave deliberate whitespace so touch users can hand page scrolling back from nested tool lists.

## Repository and deployment snapshot

- Repository: `/home/harry/projects/aniFor_codex`
- Branch: `main_codex`
- Remote branch and live Pages revision before the next graphics checkpoint: `c967261 Reconcile graphics deployment notes`; that commit changes only this resume document. Its renderer parent is `a64dde9 Style energy as luminous material volumes`.
- Current graphics checkpoint: `Style materials by cross-phase roles`, committed and pushed to `main_codex`; its manual Pages deployment is pending GitHub CLI reauthentication.
- Git pushes currently authenticate, but the saved GitHub CLI token for `harryzhou2000` is invalid. Manual Actions dispatch is blocked until `gh auth login -h github.com` succeeds again.
- Current live Pages URL: `https://harryzhou2000.github.io/aniFor/`
- Verified live graphics baseline: `a64dde9` from Actions run `29654711283`.
- Build, deploy, and post-deployment verification all passed. The live closure contains all 20 referenced resources with correct WASM MIME and the exact expected revision. The restored compiler cache produced 269/270 hits (99.63%); the successful primary key already existed, so the save step correctly skipped.

## Committed/live baseline through `a64dde9`

- Pinned official TPT 100.0 native engine, single-threaded 612×384 WebAssembly.
- 170 stable projected material IDs; 165 particle brushes in the catalog, with 160 enabled and five gravity-dependent entries explicitly disabled.
- Reaction-only Steam, Salt Water, Gas, Snow, and Plasma are bidirectionally projected and renderable.
- Ten true native TPT wall-grid tools with separate ABI, physics, rendering, dirty tracking, and save/load preservation.
- Searchable nested catalog, filters, favorites, recents, hazards/limitations, pressure/temperature HUD, and explicit disabled semantic tools.
- Pixi/WebGL semantic-field renderer with independent particle/wall fields, volumetric gas/liquid/emission fields, material-family styles, 30 Hz render cap, bounded dirty chunks, and Canvas2D fallback.
- Two-times backing resolution: 612×384 logical world to 1224×768 backing, independent of DPR and input math.
- Stable desktop viewport aspect and validated desktop pointer/wheel/middle-pan mapping.
- Automated Chrome integration coverage for actual Canvas/Pixi bounds through `screenToWorld`, pointer events, exact radius-zero painted cells, cursor-anchored wheel zoom, middle pan, repeated desktop resizes, and mobile one-/two-touch gestures. The same audit can retain a populated render-lab screenshot before clearing its diagnostic world.
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

## Committed profile-aware surface-lighting tranche (`8c00ad0`)

- WebGL reuses the existing emission texture as coloured scene light. Reconstructed contour density, diffuse relief, specular response, and the canonical material profile determine the response instead of applying one flat tint to every surface.
- Rigid and device surfaces respond more sharply, organic/field surfaces more broadly, and radioactive surfaces retain a restrained response. Gas and liquid volume response remains bounded and emissive cores avoid double-lighting.
- Canvas samples the same one-third-resolution emission field with clamp-to-edge bilinear coordinates for exposed solid/field contours. It uses a screen blend that preserves texture and alpha; an empty field or an enclosed interior remains byte-identical.
- The broad Canvas aura now renders behind opaque matter. Empty space retains the smooth falloff while matter receives contour lighting rather than a milky screen-space overlay.
- The deterministic render lab adds equal-height warm and cool source strips around the profile matrix, with a lower-light centre comparison.
- No new field, texture, scheduler stage, or persistent allocation was added.

## Committed/live phase-aware energy-core tranche (`a64dde9`)

- WebGL now gives occupied energy a dedicated luminous-volume branch before gas/liquid/generic matter. Fire and Plasma use warm flowing detail; ELEC, PHOT, NEUT, and other radioactive carriers use cooler scintillation without inheriting radioactive-solid striations.
- Exact semantic density, palette, temperature, and particle velocity remain authoritative at the core. The existing one-third-resolution emission field owns only the broader aura, so there is no new texture fetch, field, pass, scheduler stage, or persistent allocation.
- Canvas has an allocation-free matching energy style using two reusable three-channel scratch vectors and the existing sharp-plus-blurred fire plane. It derives heat from the exact packed temperature byte and GLSL smoothstep used by WebGL, including the zero/missing-temperature fallback. A deliberately pessimistic full-612×384 energy-only profile is included alongside the ordinary field profiles.
- Canvas scene light now includes exposed powder as well as solid/field matter and skips the exposure scan entirely when `EmissionField.hasLight` is false. This closes a WebGL/Canvas mismatch without adding storage.
- The deterministic atlas is now a five-column, six-row matrix covering granular, rigid, organic, radioactive-solid, device/field, and five side-by-side neutral/radioactive energy samples.
- `npm run audit:browser-input -- --<backend>-only --screenshot=<path>` captures the populated atlas and then continues through the real browser interaction gates.

## Static cross-phase role-trait tranche

- The previously unused alpha byte in the existing 256×1 style lookup now packs composable emitter, sink, channel, force-actuator, radioactive, organic, fibrous, and energy-carrier roles. The texture remains 1,024 bytes with nearest data sampling and no premultiplication.
- WebGL applies restrained role waves, portal/channel bands, force interference, cross-phase radioactive scintillation, organic fibres, and directed-carrier accents after phase shading. It changes RGB only on authoritative semantic cells, so reconstructed gas/liquid/empty-space volumes do not inherit a guessed role or wider silhouette.
- Canvas applies the same static roles allocation-free to the phase's existing semantic plane. Ordinary cells take one zero-mask branch; role cells reuse deterministic integer/hash patterns and preserve alpha exactly. Energy-phase carrier cores remain owned by the dedicated energy shader.
- The deterministic atlas now includes radioactive solid/liquid/gas/carrier samples, an emitter and paired portal channel, a force actuator, organic/fibrous variants, and neutral/radioactive energy cores while retaining its five-by-six matrix.
- No field, texture, upload, reconstruction pass, scheduler stage, or persistent allocation was added. Shared volume storage remains exactly 8,173,320 bytes.

## Canvas role-write performance checkpoint

- Canvas role accents are now applied to the renderer's existing three-channel float scratch before the one final pixel write. This removes the former second typed-pixel read, clamp, and write for every styled cell while preserving alpha ownership in the existing compositor.
- Five full-range integer clocks are updated once per frame and reused by every role cell. They add 20 persistent bytes, avoid per-cell time division, and preserve the established emitter, organic, channel, force, decay, and carrier animation cadence without the short repetition introduced by a packed-clock experiment.
- Ordinary non-emissive gas and liquid retain the direct pixel/composite fast path; only role-bearing or emissive fluids stage through the RGB scratch.
- The trait profiler now reports realistic masks, a synthetic all-bits mask, and a representative compositing path, with an observable checksum outside the timed region. On this machine a deliberately dense 612×384 semantic-role kernel still costs roughly 32–44 ms depending on the realistic mask, so mask arithmetic remains a known Canvas worst-case ceiling rather than a solved frame-budget item.
- The browser resize audit now waits for an actual size change that matches stable aspect-fitted viewport geometry instead of a fixed delay, preventing a stale WebGL resize sample from being accepted under load.

## Optical-depth gas/liquid tranche

- WebGL gas now uses density absorption rather than brightening dense interiors. The shared atmosphere mixture remains authoritative for colour, a bounded directional silver lining supplies volume, and display opacity is raised modestly without changing the reconstructed support footprint.
- WebGL liquid keeps reconstructed density as silhouette support but derives optical depth from semantic occupancy for occupied cells. Sparse droplets therefore remain translucent while dense pools gain saturated depth; reflective top/lower response comes from the already sampled local slope rather than absolute world height.
- Canvas atmosphere relief mirrors the absorption model while copying field alpha byte-for-byte. Its display opacity is normalized toward WebGL, the already-smoothed half-resolution atmosphere field is drawn without a second blur, and the exact semantic smoke plane uses only a restrained 0.2× blur.
- Canvas semantic liquids now use the same 143/209 sparse/dense source-alpha endpoints as WebGL. Filled-liquid shoreline alpha ramps continuously from zero, and the redundant nearest overlay is reduced from 0.34 to 0.18. This keeps the two-pixel backing crisp without turning reconstructed support into an opaque fringe.
- No texture, field, upload, reconstruction stage, or persistent allocation was added. The two presenters intentionally match edge/interior opacity endpoints rather than duplicating each other's implementation detail.

## Verification completed for the current local tree

- `npm run typecheck`
- `npm test -- --run`: 38 files, 156 tests passed
- `npm run build`
- Static build closure: 20 referenced resources verified (including the explicit favicon)
- Current live Pages closure: 20 resources verified, including `stillroom_core.wasm` with the correct MIME
- Real TPT save-file load/reserialize check passed for the user-provided `OPS1` save
- Earlier desktop browser audit at DPR 1 and 2 proved 612×384 CSS/logical geometry, 1224×768 backing, exact left/center/right painting, continuous drag, middle pan, touch pan/pinch, and wheel anchoring within browser-event quantization.
- Final rebuilt mobile smoke at 390×844 DPR 2 booted direct native TPT with the Canvas2D compatibility renderer and 1224×768 backing. The 378×378 viewport contained a 378×237.176 canvas at aspect 1.59375012, with no crop or horizontal overflow.
- The mobile filter row now has a constant 40 px track with a visible thin scrollbar; filter buttons remain 28 px high. One-finger painting, two-finger pinch without stray paint, and explicit Eraser restoration passed with zero console, exception, or network failures.
- Fresh render-lab browser evidence at 1280×720 and `renderScale=2` passed for both forced Canvas and SwiftShader WebGL. In the final tree, the badge visibly transitioned from `Canvas 2D · starting WebGL` to `WebGL` as promotion completed in 6.029 seconds. The viewport retained a 1224×768 backing and 827×518.902 CSS canvas with no shader, console, runtime, HTTP, or network errors.
- The automated populated-atlas capture passed for the current energy-core tree in both forced Canvas and SwiftShader WebGL. It then painted the exact three requested radius-zero cells, held wheel-anchor drift to 0.145 cell, produced exact 42×27 CSS-pixel middle-pan movement, returned to the same fitted geometry after `1024×600 → 1440×900 → 1024×600`, and reported zero browser errors. Canvas additionally retained a 378×378 mobile panel, 1.59375 field aspect, 1.431× pinch zoom, no stray pinch cells, and the exact one-touch target cell.
- The WebGL and Canvas screenshots show cohesive water/oil/acid/lava columns without black pinholes or cross-family bleeding, continuous mixed gas volumes, and preserved sparse control rows. Canvas deliberately remains softer and more internally speckled than WebGL.
- A retained real-browser interaction audit painted full 3×3 landmark grids before and after promotion. All 18 HUD-selected cells matched; footprint centroid error stayed below 1.5 CSS px, off-center wheel-anchor error was 0.035 CSS px, middle pan was within 0.013 px, and promotion produced zero canvas-rectangle or world-cell drift.
- A repeated production resize sequence `1280×720 → 1024×600 → 1440×900 → 1024×600` now refits on every transition. The 1024 viewport is 686×430.422 inside its 686.188×470 frame, aspect 1.593785, with subpixel containment and unchanged 1224×768 backing; no stale size, runtime, console, or network error remains.
- Fresh touch-emulated metrics at 390×844 and 360×640 show compact palette/toolbox sizes of 300/533 px and 230.39/463.39 px, a 132×37.78 HUD with zero touch-hint overlap, no viewport/palette/actions/footer overlap, reachable footer, exact square interaction panels, 1.59375 canvas aspect, symmetric 70.41/64.82 px letterboxing, and 1224×768 backing. With the catalog already at its 241 px inner-scroll maximum, one trusted swipe kept it at max and advanced document scrollY from 0 to 144, proving page-scroll chaining.
- Current WebGL/Canvas browser acceptance has zero shader/runtime/network errors. Dense WebGL gas is continuous without the prior raw-dot island; Canvas gas has clearer relief/species separation; liquid caps and columns show brighter rims, darker depth, and caustic variation while retaining crisp silhouettes and clean unlike-species seams.
- The current Canvas role-write checkpoint passes the same two-backend browser gate at 1224×768 backing. Both backends return exactly through `1024×600 → 1440×900 → 1024×600`; wheel-anchor drift is 0.145 cell, middle-pan is 42×27 CSS px, and the Canvas mobile gate retains a 378×378 panel, 1.431× pinch, zero stray cells, and zero browser errors.
- The optical-depth tranche passes that same real-browser gate with runtime GLSL compilation and zero browser errors. Retained WebGL/Canvas atlas captures show darker saturated gas cores with readable falloff, cohesive liquid columns with local reflective lips, preserved sparse control rows, and no unlike-species seam bleed.
- Latest warmed field profile at 612×384: atmosphere 6.71 ms median, species-aware liquid 10.81 ms, emission 5.26 ms, Canvas atmosphere relief 0.88 ms, solid reconstruction 1.26 ms, surface lighting 5.79 ms, and liquid reconstruction 1.62 ms. Shared volume storage remains 8,173,320 bytes; the presentation passes add no persistent field allocation.
- The current pessimistic Canvas energy profile shades all 235,008 cells as radioactive energy cores in 19.37 ms median / 19.58 ms p90 on the local machine. Ordinary scenes call it only for actual energy cells. It adds two reusable 3-float vectors and no field/texture allocation; shared volume storage remains exactly 8,173,320 bytes.
- Repeated surface-light stress profiles at 612×384 measured 5.76–11.20 ms median for the standalone dense-contour Canvas pass under varying local load; the latest p90/maximum were 12.08/12.44 ms. Shared field storage remains exactly 8,173,320 bytes; the diagnostic pass includes its own full-grid scan and reuses existing buffers.
- Fresh local Chrome at 1280×720 promoted the render lab to WebGL with the runtime GLSL compiled. A 1024×600 repeat retained the correct 1.59375 field aspect and backend badge; Chrome logged only Vite connect messages and no shader, WebGL, console, or runtime error.
- Forced Canvas at 1280×720 and a 390×844 DPR-2 portrait capture retained the 1224×768 backing, square mobile interaction panel with aspect-preserving letterbox, smooth empty-space aura, and crisp material seams. Warm/cool strips visibly reveal profile contours without uniformly whitening block interiors.
- Native semantic-tool coverage now proves exact scalar deltas, stable typed routing, no vector-to-particle fallthrough, no vector emission during pinch navigation, malformed ABI rejection, Wind response, `WL_BLOCKAIR` isolation, stable-water regression, and unstepped OPS Wind round-tripping.

The `Style materials by cross-phase roles` checkpoint is committed and pushed to `main_codex`. Unit, type, build, profile, desktop WebGL/Canvas visual, and interaction checks pass locally. Its manual cached deployment still needs a valid GitHub CLI login; until then the current live closure contains all 20 resources and resolves to exact revision `c967261`.

## Current blockers and risks

- WebGL runtime GLSL is not compiled by TypeScript/Vite; preserve the fresh browser audit for every shader change.
- The post-deploy verifier proves network asset closure and MIME, but not shader execution or interaction by itself.
- Cached-HTML compatibility still relies on a small fixed set of historical JS/CSS aliases, and the live verifier does not compare public content hashes to the local artifact. Harden this before treating repeated stale-asset reports as closed.
- The browser integration gate now automates `MaterialRenderer.screenToWorld`/Pixi bounds/painted footprints, but public Pages browser execution is still distinct from its post-deploy asset-closure verifier.
- Configured sources, signs, LIFE presets, and several special editing semantics remain future work.
- GitHub CLI authentication is invalid, so the next manual `build-and-deploy` cannot be dispatched until the user reauthenticates `gh`; ordinary authenticated `git push` still works.
- Newtonian FFT gravity is intentionally omitted from the headless build, so gravity-dependent tools/elements must remain disabled or limited.
- GPU partial texture upload, long-session allocation behavior, context loss, and full performance budgets need further profiling.
- Dense role-heavy Canvas scenes remain arithmetic-bound even after eliminating the duplicate pixel write; specialize common masks or move the fallback's semantic accents into a vectorized/field-level presentation path before claiming a 30 FPS worst-case budget.

## Next sequence

1. After GitHub CLI reauthentication, dispatch the manual cached `build-and-deploy` on `main_codex` and verify the live closure/revision plus a cache-busted browser runtime.
2. Return to dynamic native `ctype`/life/pressure-state projection as a separate ABI tranche; static role flags deliberately do not claim current activation/channel/growth state.
3. Continue the deeper material-surface aesthetics and Canvas performance work, then execute the queued desktop/mobile geometry cleanup recorded above.
4. Keep the persistent goal active for broader interface coverage, especially configured sources, signs, LIFE presets, forces, radioactive elements, and growing plants.
