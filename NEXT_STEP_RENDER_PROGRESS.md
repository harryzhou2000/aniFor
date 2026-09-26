# Rendering progress — 2026-09-26

## Delivered in this branch

The [plan](NEXT_STEP_RENDER.md) was overhauled before starting the implementation goal. It now targets switchable 2D and real 3D presentation over the existing TPT WebAssembly simulation. No native simulation source, physics rules, or WASM binary was changed.

### Snapshot round: steam contacts and volumetric gas

- The grid at 2D steam contacts came from reusing the Canvas overlay's rectangular
  exclusion mask for WebGL's gas identity and motion. WebGL now reads the owner
  field before that mask; its material branches already protect solid/liquid
  fragments. Canvas keeps its overlay protection. This adds one reusable CPU
  byte plane, without another GPU sampler or texture.
- 2D gas has softer particle-scale curvature and a second, offset layer of
  translucent folds sampled from the existing volume texture.
- Studio gas uses one shared raymarched colored density volume instead of a
  sheet of point sprites. Native gas occupancy feeds a filtered density field;
  a periodic 3D noise texture shapes rolling depth and wisps. Beer attenuation,
  two light probes and cool interior scattering give the cloud internal shade.
  A scene-depth pass clips gas against opaque bodies; transmissive glass/water
  and the cursor stay out of this depth pass. Gas also stays out of GTAO and
  brush picking. Integration uses 32 samples during interaction, 56 when settled.
- Powder texture is subtler, with varied roughness and restrained Sand sheen.
  Lava now has an opaque molten material instead of inheriting liquid transmission.
- `scripts/capture-native-snapshot.mjs` imports native saves through the real file
  picker, captures matched 2D/3D views, records source SHA-256 and checks that
  presentation preserves the paused native world. The supplied source hash is
  `8bbf937a70bd3108327bbed0d74db1591accfd8bbbf9decdb655f15e3abaab3b`.
  Its initial state predates the water pool shown in the supplied screenshot.
  Original-save results are in `.artifacts/steam-snapshot/{before,after}/`.
  A separate, labelled contact diagnostic adds steam and droplets beside the
  saved slopes; it is not presented as the original untouched snapshot.

Reproduce (build first):

```sh
node scripts/capture-native-snapshot.mjs /path/to/save.cps .artifacts/my-snapshot
```

### Existing 2D WebGL

Normal 1×/2×/4× presentation previously submitted successive Realistic/HDR frames without the GPU backpressure already present at 8×. Ordinary frames now share one completion fence and coalesce subsequent changes. Promotion waits for the first completed frame, and the existing stalled-frame recovery also covers normal scales. Explicit capture/timing sessions retain their own frame ownership.

A Chrome/SwiftShader trace measured initial submission at 9.9 seconds and completion at 14.7 seconds. Requiring real completion exposed the insufficient 10-second startup allowance; the normal path now has the same bounded 30-second allowance as 8×. Canvas remains available during startup. This fixes the reproduced queueing/startup behavior; it does not make the large legacy shader inexpensive on software rendering.

The earlier showcase script timeout came from its exact-consecutive-image capture condition. The new focused browser check inspects the selected renderer and native state and captures the actual view; it does not use identical screenshots as its completion criterion.

### 2D material and interface refinement

- Water's established HDR reflection/refraction field now follows the presenter's visual clock. Its moving bright folds and absorption share one optical pattern; the meniscus and native liquid support remain intact.
- Dense Steam gains slowly rolling internal billows, pearly scattering and cooler shaded folds. The motion remains subordinate to native atmosphere velocity. Gas coverage still comes from the atmosphere field.
- Lava's surface crust attenuates its final incandescence, preserving dark plates under the hot mantle and narrow fissures. A warm radiance shoulder limits broad yellow clipping. Native heat and the shared illumination field remain unchanged.
- Settled Sand gains irregular broad dune shading, with fixed world-space grain and opaque pile coverage. The refinement adds no rendering pass or simulation state.
- The 2D controls now show the selected tool, Draw/Eraser and numeric brush radius together, with visible Step and Fit view. Appearance is a disclosure. A category selector and Favorites/Recent replace the independently scrolling filter rail. Desktop uses three material columns; mobile puts frequent actions before the library. The desktop shell retains two columns at larger display scales and allows scrolling when expanded settings need more height.
- Particle and thermal brushes now repeat while held, including Heat/Cool on a paused world. Release, cancellation and focus loss stop the stroke; vector tools remain driven by drag direction. The temperature audit refreshes the native shared snapshot before reading it.
- 154 element labels now use readable names, as do LIFE presets and configured sources. Original codes remain search aliases and hover details; IDs, saves and native mappings are unchanged. The 2D picker hides unavailable reaction-only brushes. Streamline was removed from the offered wall tools because neither frontend implements its promised airflow lines; imported wall state is preserved.
- Removed 164 shader-formula/source-only presenter tests and the source assertions from 29 mixed tests, retaining their runtime checks. HDR tests retain capability/resource safety without pinning lighting formulas or exact sampler counts. The presenter suite is reduced from 10,652 to about 2,650 lines.
- Fixed search temporarily expanding categories permanently, choosing a material while Eraser remained active, missing release-only stroke endpoints, and strokes remaining active after window blur. Configured-source labels no longer overlap the search heading.
- `npm run audit:field` exercises the native WASM backend, captures Water/Steam/Lava/Sand at fixed animation times, checks unchanged native cell data, operates desktop controls at 125%/150%/200% equivalent scaling, and checks brush, erasing, stepping, thermal tools and mobile touch. `FIELD_BASE_URL` runs the same checks on a published build. Evidence is written to `.artifacts/field-materials/` or `.artifacts/published-field/`.

### Tool assessment

| Tools | Result |
| --- | --- |
| Heat / Cool | Native temperature edits work; held repetition added, including while paused. |
| Air / Vacuum / Wind | Native pressure/vector tests pass, including wall blocking and saved Wind state. Wind needs a drag; the tooltip now says so. |
| Fan / Gravity walls and gravity elements | Native fan direction, connected fan configuration, Newtonian gravity and masking tests pass. |
| Clone / converter / particle-ray sources | Native configuration, rejected-target atomicity, actual emission and OPS round trips pass. Powered-source instructions now explain P-type/N-type Silicon activation. |
| LIFE / Signs | All 24 preset mappings, LIFE evolution, sign edit/removal and native save round trips pass. |
| Spark | Retained; it must be painted onto a conductor. The tooltip now explains why empty-space painting does nothing. |
| Streamline / reaction-only products | No working airflow visualization exists for Streamline, so its brush was removed. Unpaintable native products are hidden from the 2D picker. Save/render support remains. |

These results assess the implemented tool families using the 48 native backend tests and representative browser interactions; they do not claim every possible element reaction has been tested. Unit fixture concurrency is capped at four workers to avoid CPU-contention timeouts.

### Three.js studio

- Separately loaded Three.js WebGL2 scene with full azimuth orbit/zoom/pan and front/reset views. The rear panel and perimeter rails are removed. A ground plane follows the camera horizontally and extends beyond the far clip; fog blends into the background without a visible enclosing box.
- Substantial material depth: liquids use 72 units, solids 84, native walls 96. Dense powder uses opaque, closed front/back/side geometry with a rounded depth profile up to 96 units. Tiny air pores are joined only in presentation; native state, foreign materials and larger holes remain intact. Loose grains remain separate instances. Gas and energy use soft particles.
- Warm key and cool rim lighting, environment reflections, cached shadows, physical glass/water transmission and attenuation, procedural grain/wood detail and water normals. Half-resolution GTAO contact shading and restrained HDR bloom finish the scene on supported devices. Transparent bodies and the cursor are excluded from opaque occlusion.
- Changed material groups are rebuilt; unchanged groups are reused. Reconstruction is capped at 12.5 Hz, pixel ratio at 1.5, and excessive contour fragmentation falls back to bounded cell instances. Paused scenes redraw only for camera or scene changes.
- Orbit easing uses elapsed time. Camera/brush interaction uses direct rendering, and the richer finish returns when interaction settles. This prevents the extra passes from slowing camera settling on the software GPU.
- A separate responsive GUI provides material search, brush size, draw/erase, pause/step, clear, a native demo, and native `.cps` save/open.
- Drawing rays pick the actual visible mesh or grain, then resolve native cell ownership, including from behind. Empty space uses the native simulation plane. Native wall erasing, pointer capture/release, continuous strokes and touch are handled explicitly. Camera depth remains presentation-only.
- The demo includes a solid sand mound, a glass water vessel and a small hearth on a native rigid metal base. It is seeded only for a new world or by the explicit Load demo action.

### Highlight and interaction polish

- A small procedural HDR environment supplies broad warm/cool panels and a narrow reflection strip. It is used for illumination/reflections while the background stays open. Water, glass, ice, metal and wood have distinct roughness, transmission and clearcoat settings; powder stays matte. Three-segment bevels catch smoother highlights. Bloom has a higher threshold and lower strength so the metal platform does not glow like an emitter.
- Fire/smoke use larger, softer particles with reduced per-particle opacity. Grain/wood bump strength and water normals are restrained to preserve coherent highlights.
- Brush strokes retain their original draw/erase operation through release, complete a final release position when a move event was omitted, and cancel on focus loss, pointer cancellation or mode changes. Resizing the brush updates its cursor. Holding a brush in a running simulation continuously pours or erases at the selected native cell; releasing stops the source.
- The studio audit now exercises exact circular footprints at radii 1/7/24, erasing, multiple material families, search and selection outside favorites, release-only stroke endpoints, ignored middle clicks, focus loss, pause/step/resume/clear, held brushes and cancelled touch, in addition to the original camera/surface tests. Both browser audit scripts accept a deployed base URL for fresh-incognito verification of GitHub Pages.
- Published-site verification caught an ordinary startup selecting the small compatibility core. A subsequent direct module probe confirmed the deployed TPT module was valid (612 × 384). The old seven-second loader deadline and silent alternate-solver fallback are removed: ordinary worlds wait up to 30 seconds for native TPT, then display a recoverable error while retaining saves. Explicit deterministic Visual Lab fixtures remain available. Four regression tests cover delayed success, failure, timeout/late completion, and explicit fixture selection; the browser audit supports an injected eight-second WASM delay.
- All 50 studio checks subsequently passed on GitHub Pages with that eight-second delay and native TPT active. Deployment attestation now requires the native core and checks every discovered resource, without requiring the unused compatibility core to remain referenced. Older closures that include the compatibility core are still checked; native-core omissions still fail. Eleven deployment/origin tests cover the updated contract.

### Mode switching

Both interfaces expose **2D · Field / 3D · Studio**. `?view=3d` selects Three.js; existing URLs select 2D. Switching saves the complete native world synchronously, then navigates to release the outgoing document and GPU resources. Pause is carried in the URL. An empty saved world stays empty.

Saving failures keep the current view open. Failed restoration retains the stored save and stops automatic seeding/autosaving. A failed 3D startup exposes a return to 2D. The 2D pause control now reflects a restored paused state.

## Verification

- This snapshot round: `npm test` passes all 1,493 application tests and 421
  script tests. Browser captures of the original native snapshot and the contact
  diagnostic have no shader/runtime errors and identical native digests before
  and after. All 50 Studio interaction checks pass with the new gas volume.
  The self-contained before/after viewer is `.artifacts/steam-snapshot/review.html`.

- Current 2D browser check: all 33 checks pass against native TPT/Pixi HDR, including material motion, 125%/150%/200% desktop scaling, brush/eraser, pause/step, Heat/Cool/held Heat, readable-code search, configured Clone target and mobile touch. No browser/shader errors. Evidence: `.artifacts/field-materials/report.json` and PNGs.
- Current 2D cleanup: full `npm test` passes (14 prechecks, 1,491 application tests, 421 script tests), including all 48 native backend tests. Logs: `.artifacts/2d-suite-final.log`.
- Production build and 25-file static runtime asset closure passed.
- 53 focused mode/contour/powder-volume/resolution/world-file/field-renderer tests passed; 12 GPU-fence/coalescing/first-frame/stall checks passed. Powder tests check native input preservation, pore/foreign ownership, sparse grains, and watertight, consistently oriented geometry.
- `npm run audit:render-modes`: 14 checks passed in Chrome with ANGLE Vulkan SwiftShader. Native backend: **The Powder Toy 100.0 (direct WebAssembly)**. Both Realistic/Pixi WebGL with HDR and Three.js WebGL2 rendered.
- A separate `--live-2d` run passed eight checks: normal-scale GPU backpressure, pause UI, native stepping/autosave, 2D pointer painting, return to 3D, and no browser/shader errors.
- Browser pointer drawing and orbit worked. A paused **3D → 2D → 3D** round trip preserved the entire native save byte-for-byte. Native OPS file download and upload also restored it exactly. Native stepping, empty-world transitions, and a 390-pixel-wide layout passed without browser/shader errors.
- The initial `npm run audit:studio` passed 25 checks after the open-scene refinements. The expanded brush/highlight audit passes 50 checks, recorded in `.artifacts/open-studio/interaction.json` and `polish-audit.log`. The mode/native-file audit passed all 14 checks again after the material changes; the 16 geometry/mode/world-file unit tests were also rerun successfully. No browser/shader errors were reported.
- An earlier open-studio checkpoint had 31,744 occupied cells across seven material groups, including 7,811 dense powder cells. The initial reported render was about 97,548 triangles / 34 calls and reconstruction took 140 ms. After 120 native steps, 7,712 dense powder cells and 13 loose grains remained; that reconstruction took 68 ms. These are individual Chrome/SwiftShader observations, not frame-rate guarantees or hardware benchmarks. Render totals include the passes used for that frame; the later bevel refinement changes triangle totals.
- The earlier original-HEAD presenter run had 15 failures. The current cleanup removes the obsolete shader-text assertions and repairs stale GPU test harnesses (snapshot polling state, the shared presentation fence and the 30-second deadline); the remaining 108 presenter behavior checks pass.

Reproduce against the production build:

```sh
npm run audit:render-modes
node scripts/render-modes-smoke.mjs --live-2d
npm run audit:studio
# Run the same input and save checks against the published site:
STUDIO_BASE_URL=https://harryzhou2000.github.io/aniFor/ node scripts/studio-interaction-smoke.mjs
RENDER_BASE_URL=https://harryzhou2000.github.io/aniFor/ node scripts/render-modes-smoke.mjs
# Optional cold-start regression, locally or together with STUDIO_BASE_URL:
STUDIO_WASM_DELAY_MS=8000 node scripts/studio-interaction-smoke.mjs
```

Local evidence is in `.artifacts/render-modes/`: `smoke.json`, `live-2d.json`, `three-paused.png`, `three-simulated.png`, `three-mobile.png`, `two-webgl-paused.png`, `two-webgl-live.png`, and the focused test reports. These generated files are intentionally untracked.

The final open-studio evidence is in `.artifacts/open-studio/`: `interaction.json`, `open-scene.png`, `open-simulated.png`, `back-edit.png`, `open-mobile.png`, build output and focused test logs. The mode/save audit was rerun after adding the finishing passes; the studio audit was rerun after the final powder and demo refinements.

Published-site runs write to `.artifacts/published-studio/` and `.artifacts/published-render-modes/`. The deployment workflow verifies the exact commit in `revision.txt` and the live runtime asset closure.

## Current limits and next work

TPT physics remains planar and its editable domain remains finite. The background is visually unbounded. Powder bodies have rounded volume; liquid/solid bodies currently have beveled extruded thickness and are not fully volumetric fluid surfaces. Raster positions and contours can show cell stepping, and rebuilding an entire changed material group can be expensive. Gas has reconstructed volumetric depth; energy/fire retain emissive particles. The volume's light probes approximate internal scattering, and glass does not yet refract the separately composited gas. The studio does not yet reproduce every native sign/tool/state-specific appearance from the 2D interface.

Next: review the live 3D appearance and performance on the user's GPU, improve liquid surface curvature and temporal smoothness, then introduce a read-only native subcell particle export and more local mesh updates if measurements justify them. Keep the working switchable foundation. WebGPU and independently simulated 3D physics remain later, separate decisions.

## Historical checkpoint

The August field-renderer effects inventory and optional WebGPU probe remain implementation history. They do not define the next 3D milestone. Detailed earlier experiment records remain in Git history through `3a853a5`.
