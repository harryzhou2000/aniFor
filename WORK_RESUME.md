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
- Current checkpoint: the gas-curvature follow-up described below, based on `97f5ced Add restrained relief to dense solids`.
- The immediately preceding live baseline was built and verified by manual Actions run `29666585733` at exact SHA `97f5ced40b3f4db1f5c0a0acd477002b661e0f04` after `origin/main_codex` was independently checked with `git ls-remote`.
- Git push and GitHub CLI authentication are working.
- Current live Pages URL: `https://harryzhou2000.github.io/aniFor/`
- Previous verified live baseline: `97f5ced` from Actions run `29666585733`; accept the current checkpoint only after its own manual workflow and live revision/closure verifier pass.
- Build, deploy, and post-deployment verification all passed. The live closure contains all referenced resources with correct WASM MIME and the exact expected revision. The successful primary ccache key already existed, so the save step correctly skipped.

## Committed/live baseline through `97f5ced`

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
- That historical simulation-tool checkpoint deliberately left signs and configured-source targeting disabled and distinct; configured sources were enabled later through their dedicated semantic tranche.

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

## Stacked tool-discovery geometry follow-up

- Desktop tool filters are now a fixed 68 px two-row stack instead of one clipped over-wide row. All ten filters fit at normal toolbox widths; constrained widths retain a thin horizontal fallback without hiding a second line.
- Mobile retains the compact 40 px horizontal filter rail and bounded catalog. The square 378×378 interaction panel remains first, followed immediately by the visible Material Lab heading and search/filter controls; the document has zero horizontal overflow and remains vertically scrollable to the Brush/actions card.
- The real-browser audit now measures the filter rail, every filter button, palette/actions separation, and document overflow. It fails if a filter escapes vertically, the Brush card overlaps the palette, or the page grows wider than the viewport.
- Captured evidence at 1024×600, 1440×900, and 390×844 shows 8–12 px palette/actions separation, a compact 132 px mobile HUD, and no viewport/input regression.

## Configured-source semantic tranche (`4077b23`, committed and live)

- The source catalog now contains five separate capability-gated tools for CLNE, BCLN, PCLN, PBCN, and CONV. The last selected element is retained as the target, and the search header shows the active `source → target` pair without adding another toolbox row.
- Point dispatch gives erasure and simulation tools priority, then calls `paintConfiguredSource`; it always returns before ordinary particle paint, including when a fallback backend lacks the capability.
- The native adapter validates stable IDs and bounds, creates only in an empty matter cell or reconfigures the same source type, delegates restrictions to upstream `CtypeDraw`, and rolls a new particle back when TPT rejects the target. Exact target inspection round-trips through the stable material mapping rather than returning a guessed phase projection.
- Configured targets are ordinary native `Particle::ctype` state. Raw OPS save/load preserves all five targets without a JavaScript side map or private file extension, and a native behavior test proves CLNE emits the selected target after stepping.
- The field indicator reports the exact target when probing a configured source. Fallback backends keep source tiles disabled; signs remain disabled pending a dedicated safe text editor and overlay.
- The real-browser gate can opt the paused render lab into native TPT with `simulation=native`. Its Canvas pass selected Water, selected configured CLNE, placed exactly one source at the requested world cell, and read back emitter 126 / target 2 while retaining the established resize, wheel-anchor, middle-pan, and mobile touch checks.

## LIFE and optical-response tranche (`c3bdfd2`, committed and pushed)

- All 24 upstream built-in LIFE presets are exposed as capability-gated semantic tools in native preset order. Stable projection IDs 171–194 encode `PT_LIFE` ctypes 0–23 for rendering only; they remain excluded from the ordinary `MATERIALS` brush catalog and generic `powder_set` path.
- `powder_set_life` validates active TPT bounds and preset range, creates only in empty matter cells, and never repurposes LIFE drawing as a configured-source shortcut. Erase retains priority, unsupported backends return without ordinary-particle fallback, and switching tool families clears LIFE state.
- Native tests project all 24 preset IDs, reject invalid/occupied placement atomically, preserve every preset through raw OPS save/load, and evolve a GOL B3/S23 blinker through one upstream generation.
- The renderer lookup now uses the formerly constant palette alpha byte for 12 optical-response classes: default, aqueous, oily, corrosive, molten, sooty gas, clean gas, rough granular, smooth rigid, organic, device, and radioactive. The existing style alpha remains the independent role-trait mask.
- WebGL reuses its existing palette sample to tune liquid transmission/gloss/caustics and gas absorption/scatter. Dense occupied gas converges 98% toward the reconstructed mixture, removing semantic colour islands while retaining sparse edge identity. Canvas consumes the same optics byte through an allocation-free RGB helper and preserves the existing alpha/silhouette owner.
- No texture, field, reconstruction stage, upload, scheduler pass, or persistent volume allocation was added. The local profile still reports exactly 8,173,320 combined field bytes.
- The browser audit now signature-checks and screenshots the deterministic render-lab backend, then navigates separately to native TPT for configured-source and LIFE UI placement. Both WebGL and Canvas expose 24 LIFE tiles and project GOL as ID 171.

## Solid optical-surface follow-up

- WebGL now consumes optics classes 7–11 directly for RGB-only surface response: rough granular facets, smooth rigid bevels, organic fibres, device traces, and radioactive scintillation. Optics selection takes precedence for solid texture while the canonical profile remains the fallback and continues to own field interference.
- Canvas routes the same five classes through its allocation-free three-channel scratch. A neutral-profile solid such as a LIFE projection now receives its smooth-rigid response from optics; the helper never writes the fourth/alpha channel.
- The implementation reuses the palette sample and existing shape gradient. It adds no texture fetch, field, upload, reconstruction stage, render pass, or persistent allocation, and leaves every alpha/silhouette expression unchanged.

## Cohesive solid-interior follow-up

- The deterministic six-row material matrix now directly covers neutral-profile GOL, PCLN, DTEC, URAN, and VIBR without expanding or overlapping the fixture. Existing emitter, sink, channel, force, carrier, organic, energy, and profile coverage remains asserted.
- Canvas closes one- and two-cell exact-solid cavities from an immutable eight-neighbour semantic scan. Four-cardinal enclosure remains supported; shallow cavities otherwise require at least five of eight matching neighbours, three cardinal supports, and zero different nonempty neighbours. Ordinary matching styled RGB is averaged without a brightness bias or cascading reconstructed pixels; trait-bearing solid candidates use canonical palette RGB so radioactive/organic role accents remain confined to semantic cells.
- WebGL reuses its existing eight semantic samples to enforce the same exact-material/foreign-neighbour gate and a restrained `0.30–0.60` support transition. An explicit interior-cell mask matches Canvas border behavior, native walls take priority before nearby-solid selection, role traits remain disabled on reconstructed empty cells, and mixed solids, liquids, gases, and deep/two-cardinal notches cannot be bridged.
- The denser Canvas reconstruction raises the pessimistic full-grid solid-surface pass from roughly 1.27 ms to 2.90 ms median on this machine, while combined field storage remains exactly 8,173,320 bytes and no runtime buffer, texture, upload, or pass is added.

## Render-backing scale-invariance follow-up (`72c7801`, committed and pushed)

- The real-browser gate now performs fresh paired 2× and 1× navigations under the same explicit 1280×720 CSS viewport instead of comparing geometry captured under different Chrome device-emulation states.
- Canvas2D and WebGL both retain the 612×384 logical CSS box and identical 889×557.8 transformed display rectangles while their backing changes only from 1224×768 to 612×384.
- At 1× both backends paint exactly three requested radius-zero landmark cells, keep the off-centre wheel anchor within 0.14 cell, and translate middle-pan by 42×27 CSS pixels. The paired passes report zero browser errors.

## Material-continuity follow-up

- Canvas and WebGL now close short one-cell-wide solid cracks only when two opposing immediate supports, four exact diagonal side-wall supports, and the same material two cells beyond the missing axis prove that the crack is internal. Sparse crosses, open notches, borders, foreign phases/materials, walls, semantic occupancy, and role traits remain protected.
- Accepted solid support is more opaque, reducing black perforations in the rigid/organic/device matrix without adding a field or pass. WebGL adds only two conditional distance-two samples for the ambiguous crack case; Canvas continues to read immutable semantics so fills cannot cascade.
- WebGL reuses its four existing liquid-density neighbours to promote optical depth inside locally supported pools. Isolated droplets remain sparse, while reconstructed holes and adjacent semantic cells no longer alternate as bright particle dots.
- Canvas filled-liquid holes inherit averaged RGB only from already-styled semantic neighbours of the uniquely supported species. Unlike-liquid ties remain transparent, non-liquid particles remain untouched, and alpha/silhouette ownership is unchanged.
- The full suite now contains 190 passing tests. The paired Canvas/WebGL browser gate compiles the runtime shader and reports zero browser errors with exact 1×/2× backing, painting, wheel, pan, resize, native source/LIFE, and mobile checks unchanged.
- Shared field allocation remains exactly 8,173,320 bytes. After preferring four cardinal styled-liquid donors and scanning diagonals only when no cardinal donor exists, the pessimistic full-grid Canvas profile measures solid reconstruction at 2.86 ms median and same-species liquid reconstruction at 3.18 ms median on this machine.
- CI now writes the built commit to `revision.txt` inside the Pages artifact and requires the live marker to equal `GITHUB_SHA` before checking recursive asset closure. A stale but internally complete deployment can no longer pass merely because the SHA was used as a cache-busting query.

## Energy-radiance and emissive-volume follow-up

- Dense WebGL energy cores now pass through a hue-preserving soft radiance knee blended by semantic core density. Sparse edges, alpha, velocity/temperature animation, the shared emission aura, field allocation, and scheduling remain unchanged.
- Canvas applies the same bounded soft knee before writing its nearly opaque semantic core. Its local energy glow is reduced to a sparkle because that plane is drawn once blurred and once crisp on top of the separate shared aura.
- Generic emissive gas and liquid now receive phase-bounded local accent alpha; opaque emissive surfaces keep their stronger accent. This removed CFLM's clipped white speckle without changing atmosphere support or species colour.
- The deterministic atlas now includes compact FOG and CFLM volumes beneath the mixed cloud row. Unit coverage asserts FOG, CFLM, Noble Gas, all five energy families, and allocation-free phase-specific Canvas emission gains.
- The browser audit captures the composed page and decodes it inside Chrome, avoiding `preserveDrawingBuffer`. It samples Fire, Plasma, ELEC, PHOT, and GRVT display regions and asserts visibility, at most 2% pinned-channel pixels, and stable family hue ordering in both Canvas2D and WebGL.
- The suite now contains 192 passing tests. Fresh paired browser evidence reports zero pinned pixels in all ten backend/family samples, zero browser errors, unchanged 1×/2× geometry, 0.145-cell wheel anchoring, exact 42×27 middle-pan, repeated resize recovery, and unchanged mobile/native semantic checks.

## Dense Canvas liquid-cohesion follow-up

- Canvas now applies a non-cascading RGB-only cross kernel after liquid pinhole reconstruction. It requires field alpha at least 224, liquid-plane alpha at least 176, four exact smooth-eligible species cardinals, and at least one matching diagonal. Dense canonical-species reconstructed pinholes may satisfy a cardinal, but shorelines, world borders, narrow streams, hard inclusions, and unlike-liquid boundaries cannot.
- Trait-bearing and emissive liquids bypass the cohesion pass. Every target alpha byte, semantic material byte, liquid-density byte, and separate glow plane remains unchanged; only strongly supported interior RGB is blended. Donors come from a persistent three-row pre-smoothing ring, so results are mirror-symmetric and cannot propagate with scan order.
- The ring costs 7,344 persistent bytes at width 612 and uses one persistent typed-array source view per world row, avoiding per-frame subarray allocation while retaining native row copies. Shared atmosphere/liquid/emission allocation remains exactly 8,173,320 bytes; the profiler's runtime-known Canvas presentation byte storage is 1,887,464 bytes, excluding JavaScript view-object bookkeeping.
- The profiler now includes a fully dense 612×384 Water pass and a full-height Water/Oil split. Latest isolated timings are 4.71 ms median / 5.12 ms p90 for the mixed fixture, 7.72 / 7.75 ms for dense Water, and 7.72 / 7.77 ms for the species boundary.
- The suite now contains 198 passing tests. Coverage proves reduced dense-interior variance, exact shoreline/narrow-stream/boundary preservation, dense-pinhole continuity, low-alpha and trait bypass, alpha/material/density immutability, and mirror symmetry.
- A fresh forced-Canvas browser capture retains 1224×768 backing, 1.59375 world aspect, exact landmark painting, 0.145-cell wheel anchoring, 42×27 CSS-pixel middle-pan, repeated resize recovery, 1.431× mobile pinch with zero stray cells, and zero browser errors. Visual review confirms calmer liquid interiors without widening sparse droplets or cross-family silhouettes.

## Verification completed for the LIFE/optics checkpoint

- `npm run typecheck`
- `npm test`: 40 files, 185 tests passed
- `npm run build`
- Static build closure: 20 referenced resources verified (including the explicit favicon)
- Current live Pages closure: 20 resources verified, including `stillroom_core.wasm` with the correct MIME
- Real TPT save-file load/reserialize check passed for the user-provided `OPS1` save
- Earlier desktop browser audit at DPR 1 and 2 proved 612×384 CSS/logical geometry, 1224×768 backing, exact left/center/right painting, continuous drag, middle pan, touch pan/pinch, and wheel anchoring within browser-event quantization.
- Final rebuilt mobile smoke at 390×844 DPR 2 booted direct native TPT with the Canvas2D compatibility renderer and 1224×768 backing. The 378×378 viewport contained a 378×237.176 canvas at aspect 1.59375012, with no crop or horizontal overflow.
- The mobile filter row now has a constant 40 px track with a visible thin scrollbar; filter buttons remain 28 px high. One-finger painting, two-finger pinch without stray paint, and explicit Eraser restoration passed with zero console, exception, or network failures.
- Fresh render-lab browser evidence at 1280×720 and `renderScale=2` passed for both forced Canvas and SwiftShader WebGL. In the final tree, the badge visibly transitioned from `Canvas 2D · starting WebGL` to `WebGL` as promotion completed in 6.029 seconds. The viewport retained a 1224×768 backing and 827×518.902 CSS canvas with no shader, console, runtime, HTTP, or network errors.
- The automated populated-atlas capture now asserts the deterministic fallback status, more than 40,000 fixture cells, and two fixed wall samples before screenshots. It then tests mapping separately and navigates to native TPT for semantic tools. Both forced Canvas and SwiftShader WebGL place configured CLNE as emitter 126 / target 2, reject `PCLN → PSCN`, expose all 24 LIFE presets, and place GOL as projection 171. The transform gate paints the exact three requested radius-zero cells, holds wheel-anchor drift to 0.145 cell, produces exact 42×27 CSS-pixel middle-pan movement, returns through `1024×600 → 1440×900 → 1024×600`, and reports zero browser errors. Canvas additionally retains a 378×378 mobile panel, 1.59375 field aspect, 1.431× pinch zoom, no stray pinch cells, and the exact one-touch target cell.
- The WebGL and Canvas screenshots show cohesive water/oil/acid/lava columns without black pinholes or cross-family bleeding, continuous mixed gas volumes, and preserved sparse control rows. Canvas deliberately remains softer and more internally speckled than WebGL.
- A retained real-browser interaction audit painted full 3×3 landmark grids before and after promotion. All 18 HUD-selected cells matched; footprint centroid error stayed below 1.5 CSS px, off-center wheel-anchor error was 0.035 CSS px, middle pan was within 0.013 px, and promotion produced zero canvas-rectangle or world-cell drift.
- A repeated production resize sequence `1280×720 → 1024×600 → 1440×900 → 1024×600` now refits on every transition. The 1024 viewport is 686×430.422 inside its 686.188×470 frame, aspect 1.593785, with subpixel containment and unchanged 1224×768 backing; no stale size, runtime, console, or network error remains.
- Fresh touch-emulated metrics at 390×844 and 360×640 show compact palette/toolbox sizes of 300/533 px and 230.39/463.39 px, a 132×37.78 HUD with zero touch-hint overlap, no viewport/palette/actions/footer overlap, reachable footer, exact square interaction panels, 1.59375 canvas aspect, symmetric 70.41/64.82 px letterboxing, and 1224×768 backing. With the catalog already at its 241 px inner-scroll maximum, one trusted swipe kept it at max and advanced document scrollY from 0 to 144, proving page-scroll chaining.
- Current WebGL/Canvas browser acceptance has zero shader/runtime/network errors. Dense WebGL gas is continuous without the prior raw-dot island; Canvas gas has clearer relief/species separation; liquid caps and columns show brighter rims, darker depth, and caustic variation while retaining crisp silhouettes and clean unlike-species seams.
- The current Canvas role-write checkpoint passes the same two-backend browser gate at 1224×768 backing. Both backends return exactly through `1024×600 → 1440×900 → 1024×600`; wheel-anchor drift is 0.145 cell, middle-pan is 42×27 CSS px, and the Canvas mobile gate retains a 378×378 panel, 1.431× pinch, zero stray cells, and zero browser errors.
- The optical-depth tranche passes that same real-browser gate with runtime GLSL compilation and zero browser errors. Retained WebGL/Canvas atlas captures show darker saturated gas cores with readable falloff, cohesive liquid columns with local reflective lips, preserved sparse control rows, and no unlike-species seam bleed.
- The solid-optics follow-up passes the full two-backend browser gate with runtime GLSL compilation and zero browser errors. Canvas and WebGL retain the 1224×768 backing, 1.59375 field aspect, exact landmark painting, 0.145-cell wheel anchoring, 42×27 CSS-pixel middle-pan, repeated resize geometry, 24 LIFE tools, and the mobile one-/two-touch checks. Retained atlases show differentiated solid families without widening their silhouettes.
- The cohesive-solid follow-up passes the same full browser gate with the six-row GOL/device/radioactive fixture, zero shader/runtime/network errors, and unchanged transform metrics. Retained WebGL and Canvas captures show dense solid blocks with fewer black perforations while mixed-material seams and the sparse powder controls remain open.
- The stacked tool-discovery gate reports exactly two desktop filter rows at 68 px, a 40 px mobile filter rail, 8/12/8 px palette-to-actions gaps through the repeated desktop resize sequence, and zero mobile horizontal overflow. The optional browser screenshot path now also retains a DPR-2 portrait capture for direct layout review.
- Latest warmed field profile at 612×384: atmosphere 7.21 ms median, species-aware liquid 11.40 ms, emission 3.18 ms, Canvas atmosphere relief 0.87 ms, solid reconstruction 1.27 ms, surface lighting 6.00 ms, and liquid reconstruction 1.67 ms. Shared volume storage remains 8,173,320 bytes; optical classes add no field or texture allocation.
- The current pessimistic Canvas energy profile shades all 235,008 cells as radioactive energy cores in 25.20 ms median / 26.47 ms p90 on the local machine with the three-channel soft radiance knee enabled. Ordinary scenes call it only for actual energy cells. It adds two reusable 3-float vectors and no field/texture allocation; shared volume storage remains exactly 8,173,320 bytes.
- Repeated surface-light stress profiles at 612×384 measured 5.76–11.20 ms median for the standalone dense-contour Canvas pass under varying local load; the latest p90/maximum were 12.08/12.44 ms. Shared field storage remains exactly 8,173,320 bytes; the diagnostic pass includes its own full-grid scan and reuses existing buffers.
- Fresh local Chrome at 1280×720 promoted the render lab to WebGL with the runtime GLSL compiled. A 1024×600 repeat retained the correct 1.59375 field aspect and backend badge; Chrome logged only Vite connect messages and no shader, WebGL, console, or runtime error.
- Forced Canvas at 1280×720 and a 390×844 DPR-2 portrait capture retained the 1224×768 backing, square mobile interaction panel with aspect-preserving letterbox, smooth empty-space aura, and crisp material seams. Warm/cool strips visibly reveal profile contours without uniformly whitening block interiors.
- Native semantic-tool coverage now proves exact scalar deltas, stable typed routing, no vector-to-particle fallthrough, no vector emission during pinch navigation, malformed ABI rejection, Wind response, `WL_BLOCKAIR` isolation, stable-water regression, and unstepped OPS Wind round-tripping.

The layout checkpoint `60b033b` and dense-solid relief checkpoint `97f5ced` are committed, pushed, and deployed. Run `29666585733` restored the compatible ccache, built the exact branch SHA, deployed it, and passed the live revision plus runtime-asset-closure verifier. The gas-curvature follow-up below is the current checkpoint; its verification evidence is recorded independently of deployment state so the next handoff can reconcile the exact workflow run.

## Current gas-curvature follow-up

- Canvas and WebGL reuse the four atmosphere alpha samples already required for density slope to derive signed local curvature. Convex cloud crowns receive bounded broad light and concave overlap pockets self-shadow; RGB changes uniformly, while every field alpha/support byte and species hue ordering remains unchanged.
- The change adds no field, texture, texture fetch, upload, pass, or persistent allocation. On the local 612×384 profile, Canvas atmosphere relief measured `0.95 ms` median / `1.33 ms` p90 after simplifying the signed response, versus the prior roughly `0.86 ms` median.
- The browser screenshot gate now samples Water, Oil, Smoke, Oxygen, and Noble Gas in addition to energy and solid families. Fresh WebGL and Canvas captures retained full dense-core coverage, bounded non-flat luma, zero pinned fluid channels, exact `1224×768` backing, stable repeated resize geometry, `0.06`-cell 2× wheel anchoring, exact `42×27` middle-pan, and zero browser errors. Canvas mobile retained its `378×378` viewport, `1.431×` pinch, and zero stray cells.

## Current blockers and risks

- WebGL runtime GLSL is not compiled by TypeScript/Vite; preserve the fresh browser audit for every shader change.
- The post-deploy verifier proves network asset closure and MIME, but not shader execution or interaction by itself.
- Cached-HTML compatibility still relies on a small fixed set of historical JS/CSS aliases. The live revision marker now proves which artifact reached Pages, but the verifier does not compare every public content hash to the local artifact.
- The browser integration gate now automates transform/semantic placement and samples composed render-lab pixels through a decoded page screenshot, but public Pages browser execution remains distinct from the post-deploy asset-closure verifier.
- Signs and several special editing semantics remain future work; configured sources and all 24 built-in LIFE presets are implemented through distinct semantic boundaries.
- Pushes to `main_codex` intentionally do not build or deploy. Dispatch `ci.yml` manually with `operation=build-and-deploy`; the workflow restores the latest compatible ccache/Emscripten cache and saves a new primary ccache key only after a successful build.
- Newtonian FFT gravity is intentionally omitted from the headless build, so gravity-dependent tools/elements must remain disabled or limited.
- GPU partial texture upload, long-session allocation behavior, context loss, and full performance budgets need further profiling.
- Dense role-heavy Canvas scenes remain arithmetic-bound even after eliminating the duplicate pixel write; specialize common masks or move the fallback's semantic accents into a vectorized/field-level presentation path before claiming a 30 FPS worst-case budget.

## Next sequence

1. Continue deeper material-surface aesthetics and dense Canvas performance work, then revisit the queued desktop/mobile geometry polish.
2. Keep each checkpoint on `main_codex`, dispatch the manual cached `build-and-deploy`, and verify the live revision/closure plus a cache-busted browser runtime.
3. Keep the persistent goal active for remaining TPT interface coverage, especially signs and special editing semantics, while preserving existing forces, sources, radioactive elements, plants, and LIFE behavior.
