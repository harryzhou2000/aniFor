# Rendering progress — 2026-09-26

## Delivered in this branch

The [plan](NEXT_STEP_RENDER.md) was overhauled before starting the implementation goal. It now targets switchable 2D and real 3D presentation over the existing TPT WebAssembly simulation. No native simulation source, physics rules, or WASM binary was changed.

### Existing 2D WebGL

Normal 1×/2×/4× presentation previously submitted successive Realistic/HDR frames without the GPU backpressure already present at 8×. Ordinary frames now share one completion fence and coalesce subsequent changes. Promotion waits for the first completed frame, and the existing stalled-frame recovery also covers normal scales. Explicit capture/timing sessions retain their own frame ownership.

A Chrome/SwiftShader trace measured initial submission at 9.9 seconds and completion at 14.7 seconds. Requiring real completion exposed the insufficient 10-second startup allowance; the normal path now has the same bounded 30-second allowance as 8×. Canvas remains available during startup. This fixes the reproduced queueing/startup behavior; it does not make the large legacy shader inexpensive on software rendering.

The earlier showcase script timeout came from its exact-consecutive-image capture condition. The new focused browser check inspects the selected renderer and native state and captures the actual view; it does not use identical screenshots as its completion criterion.

### Three.js studio

- Separately loaded Three.js WebGL2 scene with full azimuth orbit/zoom/pan and front/reset views. The rear panel and perimeter rails are removed. A ground plane follows the camera horizontally and extends beyond the far clip; fog blends into the background without a visible enclosing box.
- Substantial material depth: liquids use 72 units, solids 84, native walls 96. Dense powder uses opaque, closed front/back/side geometry with a rounded depth profile up to 96 units. Tiny air pores are joined only in presentation; native state, foreign materials and larger holes remain intact. Loose grains remain separate instances. Gas and energy use soft particles.
- Warm key and cool rim lighting, environment reflections, cached shadows, physical glass/water transmission and attenuation, procedural grain/wood detail and water normals. Half-resolution GTAO contact shading and restrained HDR bloom finish the scene on supported devices. Transparent bodies and the cursor are excluded from opaque occlusion.
- Changed material groups are rebuilt; unchanged groups are reused. Reconstruction is capped at 12.5 Hz, pixel ratio at 1.5, and excessive contour fragmentation falls back to bounded cell instances. Paused scenes redraw only for camera or scene changes.
- Orbit easing uses elapsed time. Camera/brush interaction uses direct rendering, and the richer finish returns when interaction settles. This prevents the extra passes from slowing camera settling on the software GPU.
- A separate responsive GUI provides material search, brush size, draw/erase, pause/step, clear, a native demo, and native `.cps` save/open.
- Drawing rays pick the actual visible mesh or grain, then resolve native cell ownership, including from behind. Empty space uses the native simulation plane. Native wall erasing, pointer capture/release, continuous strokes and touch are handled explicitly. Camera depth remains presentation-only.
- The demo includes a solid sand mound, a glass water vessel and a small hearth on a native rigid metal base. It is seeded only for a new world or by the explicit Load demo action.

### Mode switching

Both interfaces expose **2D · Field / 3D · Studio**. `?view=3d` selects Three.js; existing URLs select 2D. Switching saves the complete native world synchronously, then navigates to release the outgoing document and GPU resources. Pause is carried in the URL. An empty saved world stays empty.

Saving failures keep the current view open. Failed restoration retains the stored save and stops automatic seeding/autosaving. A failed 3D startup exposes a return to 2D. The 2D pause control now reflects a restored paused state.

## Verification

- Production build and 25-file static runtime asset closure passed.
- 53 focused mode/contour/powder-volume/resolution/world-file/field-renderer tests passed; 12 GPU-fence/coalescing/first-frame/stall checks passed. Powder tests check native input preservation, pore/foreign ownership, sparse grains, and watertight, consistently oriented geometry.
- `npm run audit:render-modes`: 14 checks passed in Chrome with ANGLE Vulkan SwiftShader. Native backend: **The Powder Toy 100.0 (direct WebAssembly)**. Both Realistic/Pixi WebGL with HDR and Three.js WebGL2 rendered.
- A separate `--live-2d` run passed eight checks: normal-scale GPU backpressure, pause UI, native stepping/autosave, 2D pointer painting, return to 3D, and no browser/shader errors.
- Browser pointer drawing and orbit worked. A paused **3D → 2D → 3D** round trip preserved the entire native save byte-for-byte. Native OPS file download and upload also restored it exactly. Native stepping, empty-world transitions, and a 390-pixel-wide layout passed without browser/shader errors.
- `npm run audit:studio`: 25 checks passed after the open-scene and material refinements. Coverage includes angled/back-side surface picking, exact native-cell erasing, separate grains, native walls, continuous draw/erase strokes, right-click erase, out-of-world edits, release outside the world, orbit/zoom/pan without edits, touch after resize, mobile layout, and a cohesive pile after 120 native steps. No browser/shader errors were reported. Desktop, moving-state and mobile captures were inspected.
- The final demo had 31,744 occupied cells across seven material groups, including 7,811 dense powder cells. The initial reported render was about 97,548 triangles / 34 calls and reconstruction took 140 ms. After 120 native steps, 7,712 dense powder cells and 13 loose grains remained; that reconstruction took 68 ms. These are individual Chrome/SwiftShader observations, not frame-rate guarantees or hardware benchmarks. Render totals include the passes used for that frame.
- The historical presenter suite is not green: an isolated original-HEAD run had 15 failures, largely assertions about shader source text. Those pre-existing failures are recorded separately from the passing checks above.

Reproduce against the production build:

```sh
npm run audit:render-modes
node scripts/render-modes-smoke.mjs --live-2d
npm run audit:studio
```

Local evidence is in `.artifacts/render-modes/`: `smoke.json`, `live-2d.json`, `three-paused.png`, `three-simulated.png`, `three-mobile.png`, `two-webgl-paused.png`, `two-webgl-live.png`, and the focused test reports. These generated files are intentionally untracked.

The final open-studio evidence is in `.artifacts/open-studio/`: `interaction.json`, `open-scene.png`, `open-simulated.png`, `back-edit.png`, `open-mobile.png`, build output and focused test logs. The mode/save audit was rerun after adding the finishing passes; the studio audit was rerun after the final powder and demo refinements.

## Current limits and next work

TPT physics remains planar and its editable domain remains finite. The background is visually unbounded. Powder bodies have rounded volume; liquid/solid bodies currently have beveled extruded thickness and are not fully volumetric fluid surfaces. Raster positions and contours can show cell stepping, and rebuilding an entire changed material group can be expensive. Gas/fire use soft particles rather than participating-media rendering, and the studio does not yet reproduce every native sign/tool/state-specific appearance from the 2D interface.

Next: review the live 3D appearance and performance on the user's GPU, improve liquid surface curvature and temporal smoothness, then introduce a read-only native subcell particle export and more local mesh updates if measurements justify them. Keep the working switchable foundation. WebGPU and independently simulated 3D physics remain later, separate decisions.

## Historical checkpoint

The August field-renderer effects inventory and optional WebGPU probe remain implementation history. They do not define the next 3D milestone. Detailed earlier experiment records remain in Git history through `3a853a5`.
