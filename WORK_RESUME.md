# AniforTPT Work Resume

Last reconciled: 2026-07-18 (Asia/Shanghai)

This document is the authoritative handoff for the current AniforTPT workstream. It distinguishes committed and pushed work from local experiments, records known defects and external blockers, and preserves the full target rather than redefining success around the current implementation.

## Active objective

Expand AniforTPT toward the broadest practical browser interface for the pinned The Powder Toy (TPT) engine. Priorities are force tools, particle/source emitters, radioactive and nuclear materials, and living/growing plant systems, while preserving the semantic distinction between particles, walls, signs, and simulation tools.

In parallel, replace cell-oriented presentation with an aesthetically smoothed field/chunk renderer: crisp reconstructed boundaries, cohesive liquid and solid surfaces, volumetric gases and energy, and a styled-art direction rather than TPT pixel art. Render at two output pixels per axis for every simulation cell (1224×768 for the 612×384 world) without changing world or CSS coordinate math. Add middle-button desktop pan, one-finger mobile pan, and two-finger pan/zoom. Preserve native save/load and reaction projection, bound CPU/GPU and memory cost, retain a graceful compatibility renderer, add representative semantic/render/performance tests, update documentation, commit and push `main_codex`, manually build and deploy through cached CI, and validate the live GitHub Pages result.

The objective is active and not complete.

## Repository snapshot

- Repository: `/home/harry/projects/aniFor_codex`
- Branch: `main_codex`
- Local HEAD: `0dc8244 Keep Pixi viewport sizing synchronized`
- Remote `origin/main_codex`: `c770a0c Expand TPT catalog and add semantic field rendering`
- Local branch is one commit ahead of the remote.
- Nothing after `c770a0c` has been pushed or deployed.
- The user asked to wait for GitHub CLI login before further GitHub work.

Recent relevant commits:

1. `0dc8244` — keep Pixi viewport sizing synchronized (local only)
2. `c770a0c` — expand TPT catalog and add semantic field rendering (pushed)
3. `06bb7b4` — rename Pages artifact for AniforTPT
4. `3210070` — add field HUD and smooth projected rendering
5. `4abeb3e` — rebrand app and categorize material tools
6. `2ccbff6` — expand Powder Toy material projection ABI

## Committed implementation status

### Native TPT integration

- The default browser backend is pinned The Powder Toy 100.0 at revision `bde6b44edd8b6ef7b978fbdad3fb0bcb5f8a5939`.
- The headless module is a single-threaded 612×384 Emscripten build.
- The adapter exposes particle material IDs, pressure, particle temperature, velocity, stepping, tick state, clear, particle placement, and native save/load.
- Native save/load preserves the upstream simulation state rather than reconstructing it from the projected material field.
- Representative native tests cover projection, pressure, water behavior, deterministic continuation after save/load, and seed-driven plant growth.
- Newtonian FFT gravity is intentionally omitted. Gravity-dependent particles are visible but disabled in the browser catalog.

### Material projection and interface

- The browser projection contains 170 stable material IDs with bidirectional adapter mappings.
- The current interface contains 165 particle brush entries; 160 are enabled and five gravity-dependent entries are disabled.
- The interface includes nested/searchable categories, filters, favorites, recents, hazard/limitation badges, mobile horizontal category navigation, and bounded desktop catalog scrolling.
- Pressure and particle-temperature inspection is displayed in a viewport corner HUD.
- Phase-change and reaction products within the 170-ID projection are renderable even when not selectable.
- The game is branded AniforTPT.

### Rendering

- The primary presenter is Pixi/WebGL using an RGBA semantic field containing material ID, temperature, and velocity.
- Palette and style lookup textures let projected reaction products render without per-element shader branches.
- The committed shader performs neighborhood-based density, contour lighting, liquid/gas styling, and emissive heat/energy.
- Dirty material changes are coalesced into halo-aware 32-cell chunks.
- The main render cadence is capped at 30 Hz; dynamic semantic-field repacking is capped at 12 Hz.
- Canvas 2D remains the compatibility path.
- The local viewport path uses a native 612×384 Pixi logical surface and one uniform CSS camera transform. DPR/backing density is separate from CSS/world math.
- A custom Pixi filter vertex passes sprite-local `aPosition` as 0–1 `vFieldCoord`. This fixes the upper-left-anchored visual divergence caused by sampling the independent field texture with Pixi's pooled filter `vTextureCoord`.
- The user confirmed the aspect ratio and view now look correct. An independent live `npm run dev` DPR2 audit verified exact host/canvas geometry, 10/50/90% pointer probes, and paused Diamond placement at three known cells.

### CI/CD

- `.github/workflows/ci.yml` has a manual `workflow_dispatch` input with `build` and `build-and-deploy` operations.
- Pushes to `main_codex` are intentionally manual rather than automatically building/deploying.
- The workflow installs project-local build tooling and builds WebAssembly, tests, and the static site.
- C++ compilation uses `ccache`; `.cache/ccache` is restored from GitHub Actions cache and saved only after a successful build.
- The Pages artifact is uploaded only for manual `build-and-deploy`, then deployed with `actions/deploy-pages`.
- A prior manual run was triggered for pushed commit `c770a0c`: run ID `29638810371`, URL `https://github.com/harryzhou2000/aniFor/actions/runs/29638810371`. Its final status and live Pages result were not verified after GitHub authentication became invalid.

## Current checkpoint awaiting commit

The following local changes are verified and ready for a progress checkpoint:

- `src/main.ts`
  - wraps the viewport in `.viewport-frame`;
  - uses JavaScript `ResizeObserver` sizing to force 612:384.
- `src/styles.css`
  - adds the `.viewport-frame` layout container.
- `src/renderer/view-transform.ts`
  - adds `fitAspect`.
- `src/renderer/view-transform.test.ts`
  - adds fixed-aspect fitting tests.
- `src/renderer/field-renderer.ts`
  - changes pointer conversion to use the viewport content box;
  - caps full dynamic temperature/velocity refreshes at 12 Hz.
- `src/renderer/pixi-field-presenter.ts`
  - adds bilinear occupancy reconstruction and analytic gradients;
  - changes dynamic-field full-refresh behavior;
  - renders in one native logical coordinate space;
  - fixes Pixi pooled-filter UV distortion with sprite-local field coordinates.
- `src/renderer/semantic-field.test.ts`
  - adds the 12 Hz refresh-budget test.
- `src/app/game.ts`
  - exposes the probed cell in HUD diagnostic metadata for browser assertions.

- `src/ui/world-input.ts` and tests
  - normalize wheel deltas;
  - keep wheel zoom cursor-anchored;
  - interpolate continuous painting strokes.
- `AGENTS.md` and `docs/viewport-rendering-contract.md`
  - preserve the coordinate contract and Pixi filter-UV lesson for future work.

The checkpoint passed:

- `npm run typecheck`
- `npm test`: 14 test files, 50 tests passed
- `npm run build`

The independent browser audit additionally proved cursor/native placement and shader geometry. Temporary Chrome and Vite processes were removed.

## Confirmed interface gaps from pinned-engine audit

The current UI is particle-only despite typed catalog scaffolding for wall, simulation, and source tools. `Game` supplies only material selection, radius, pause, share, and clear callbacks. The backend contract exposes only particle paint/erase, and the C ABI has no wall/sign/simulation-tool/configured-particle editing calls.

### Public particle gaps

The pinned engine has 174 public particle-tool semantics excluding NONE/erase. Nine are absent or misclassified:

- WTRV (Steam), SLTW (Salt Water), GAS, SNOW, and PLSM (Plasma) are public selectable elements upstream, but current metadata incorrectly calls them reaction-only and omits them from the interface.
- BCOL (Broken Coal) is collapsed into Coal and needs a distinct stable ID/mapping.
- STKM, STKM2/STK2, and FIGH are public but require native plop/configuration semantics, not generic mass brushing.

Hidden/generated native states should remain renderable through projection but should not become ordinary brush tiles without an intentional semantic design.

### True walls

- All 19 upstream wall tools are absent.
- `Material.Wall` is a legacy frontend name that maps to TPT Diamond (`PT_DMND`); it is not a true wall.
- True walls live in TPT's 153×96 `bmap` at cell size 4 and already participate in native save/load and physics.
- The safest first non-particle ABI extension is stable wall IDs, wall dimensions/data exposure, and a native wall line/brush operation using TPT editing functions.
- Walls require a separate coarse render field and must never be encoded as particle material IDs.

### Simulation tools

All 11 native simulation tools are absent from the browser interface:

- HEAT, COOL, AIR, VAC, PGRV, NGRV, MIX, CYCL, AMBM, AMBP, WIND.

Safe initial tools are HEAT, COOL, AIR, VAC, and MIX. PGRV/NGRV are ineffective with null Newtonian gravity. WIND/CYCL are neutralized by the current forced air-velocity-off mode. Ambient heat tools are inactive while ambient heat is disabled. These limitations must be represented honestly rather than exposed as apparently working controls.

### Sources and emitters

- CLNE/BCLN/PCLN/PBCN and ray elements exist as raw particles, but no target-selection workflow exists.
- Unconfigured clones can learn from adjacent particles natively; a configured-source UI would provide deterministic target selection by setting `ctype`.
- Source presets should be a distinct catalog/tool kind while retaining raw particle tiles.

### Life and plants

- Botanical PLNT, VINE, SEED, YEST, and WOOD are exposed, and a native regression test verifies seed-driven growth.
- All 24 built-in LIFE/GOL presets are absent. They are configured PT_LIFE particles with rule `ctype`, not botanical plants, and must not be conflated with the existing life category.

### Signs

- Signs are preserved by native save/load but have no ABI, renderer, or edit UI.
- They require separate CRUD/list semantics and buffered UTF-8 handling; they must not be represented as particles.

## Rendering and performance gaps

- The committed shader still derives its surface from nearest material IDs; smoothing is limited and can remain visibly cell-oriented.
- The uncommitted bilinear occupancy shader is intended to provide continuous sub-cell density and analytic normals, but has not passed a completed browser/shader runtime check and must not be assumed correct.
- The style LUT distinguishes only solid, gas, liquid, and energy. Powders, rigid solids, plants, crystals, electronics, and radioactive materials mostly differ only by color.
- Dirty chunks bound CPU packing, but `BufferImageSource.update()` may still upload the full 612×384 texture; partial GPU transfer is not proven.
- Canvas fallback buffers are allocated even when WebGL succeeds, wasting several MiB.
- The Canvas fallback still performs full-field work at the dynamic render cadence.
- The WebGL startup timeout can orphan a late Pixi initialization; teardown and context-loss recovery are absent.
- DPR is capped, but there is no absolute framebuffer-pixel ceiling for very large displays.
- Tests cover packing, chunk invalidation, view-transform math, neighborhood helpers, and refresh scheduling, but not actual shader execution, rendered-image output, WebGL/fallback selection, context loss, upload bytes, frame time, or allocation ceilings.

## Current blocker

### GitHub authentication and deployment

GitHub CLI authentication was invalid, and the user asked the agent to wait for login. Do not push, trigger Actions, or claim Pages validation until the user confirms authentication is ready.

## Recommended restart sequence

1. Commit the verified viewport/UV checkpoint.
2. Add middle-button desktop pan, one-finger touch pan, and continuous two-finger pan/zoom with focused pointer-state tests.
3. Allocate a 1224×768 WebGL backing surface while retaining a 612×384 logical/CSS world; add an equivalent high-resolution Canvas fallback presentation.
4. Refine reconstruction into crisp styled material families without broad blur, then profile framebuffer, upload, and frame costs.
5. Differentiate powders, plants, sources, electronics, radioactive materials, energy, liquids, gases, and rigid solids.
6. Correct immediate public-particle catalog drift, then implement true walls and configured source workflows.
7. Update README and integration docs whenever counts or capabilities change.
8. After GitHub login is confirmed: inspect `gh auth status`, push reviewed commits to `main_codex`, trigger manual `build-and-deploy`, verify ccache restore/save behavior, inspect Actions logs, and validate the deployed Pages assets and runtime interaction.

## Local verification commands

From the repository root:

```bash
npm install
npm run typecheck
npm test -- --run
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

For a full native rebuild using project-local tooling:

```bash
npm run setup:build-tools
npm run build:all
```

Emscripten lives under ignored `.toolchains/emsdk`, Meson under ignored `.venv`, and pinned upstream/build state under ignored `.cache`.

## Completion criteria still outstanding

The goal must remain active until all of the following are evidenced:

- desktop and mobile cursor/brush alignment, zoom anchoring, and aspect behavior work in a real browser;
- broad practical element coverage is corrected against the pinned public catalog;
- force/simulation tools, configured sources, nuclear/radioactive materials, botanical growth, and configured LIFE systems are represented honestly and work where advertised;
- particles, walls, signs, sources, and simulation tools remain distinct through ABI, catalog, input, rendering, and save/load;
- the visual primitive is demonstrably a smooth styled material field/chunk rather than enlarged cells;
- liquid, solid, gas, and energy styling is materially differentiated;
- CPU/GPU/memory budgets and compatibility behavior have representative evidence;
- native save/load and reaction projection remain intact;
- documentation matches actual counts and limitations;
- reviewed changes are committed and pushed to `main_codex`;
- cached manual CI builds successfully;
- `build-and-deploy` publishes the intended artifact;
- the live GitHub Pages result is tested and working.
