# Render lab visual regression scene

The render lab is a deterministic, paused 612×384 material atlas for evaluating renderer changes without waiting for physics or reconstructing an ad-hoc brush scene.

## Open the scene

Start the development server and use:

```text
http://localhost:5173/?scene=render-lab&renderScale=2
http://localhost:5173/?scene=render-lab&renderScale=2&renderer=canvas2d
```

`scene=render-lab` selects an in-memory 612×384 backend only for this diagnostic route. It does not load native TPT, restore autosave, advance simulation, or write autosave. Normal URLs continue to use the native backend.

Screenshots created during local review belong in ignored `.artifacts/`, for example:

```text
.artifacts/render-lab-webgl.png
.artifacts/render-lab-canvas2d.png
```

For the native wall/particle composition fixture, use:

```text
http://localhost:5173/?scene=wall-lab&renderScale=2
http://localhost:5173/?scene=wall-lab&renderScale=2&renderer=canvas2d
```

Unlike `render-lab`, `wall-lab` deliberately loads the native TPT backend. It clears only its in-memory diagnostic world, remains paused, skips restore/autosave, and lays ten native wall types behind deterministic particle density gradients and mixtures. This catches accidental wall-as-particle encoding, missing wall uploads, texture-coordinate drift, and wall/particle compositing errors.

## Atlas layout

- Upper left: five sand-density bands plus dust and salt. This shows isolated grains, packed powder relief, and whether smoothing turns grains into a flat slab.
- Upper middle: overlapping water, oil, and acid bodies, a rigid floor, and a sparse liquid row. This shows interior hole filling, liquid-to-liquid colour boundaries, specular response, and edge hardness.
- Upper right: overlapping Smoke, Oxygen, and Noble Gas density-falloff clouds plus a sparse gas row. This shows whether gas reads as a continuous volume, whether different gas colours mix, and whether the exterior becomes either point-like or excessively opaque.
- Lower left: sand entering dense water, with a deliberately mixed patch. This reveals phase-boundary bleeding and whether sparse liquid remains coherent.
- Lower middle: adjacent wavy columns of water, oil, acid, and lava. This makes over-blur across distinct liquids immediately visible.
- Lower right: a five-column profile matrix. Its rows cover rigid surfaces; organic/growing matter; radioactive solids; then energy, devices, and force/special fields. Deliberate sparse holes expose each family's reconstruction behavior without relying on phase overrides.

## Review gates

For every shader or field-reconstruction change:

1. Capture WebGL and forced Canvas2D at the same viewport size and `renderScale=2`.
2. Confirm the canvas remains a 612×384 CSS/logical world with 1224×768 backing pixels.
3. Confirm the browser console contains no shader, WebGL, runtime, or network-asset failure related to the app.
4. Compare powder granularity, liquid interior continuity and hard boundary, gas halo/volume, material mixing, energy-core legibility, aura falloff, neighboring light tint, and emissive clipping. Enclosed solid pinholes should close, while exposed notches, silhouettes, and seams between unlike solids must remain visible.
5. Keep the previous WebGL crop until the new result has been visually reviewed.
6. When wall rendering changes, repeat the same checks with `scene=wall-lab` and confirm all ten wall patterns remain distinct behind particle mixtures.

The scene is a visual fixture, not a replacement for real-browser pointer, wheel, pan, and painted-footprint checks.

## Reconstruction budget

The exact semantic texture may update at the renderer's 30 Hz cap. The shared atmosphere, liquid, and emission reconstructions are separately capped at 12 Hz and, when several are due, are staggered so only one is rebuilt in a frame. WebGL uploads them as linearly sampled textures; Canvas2D uses the same bytes for joined liquid silhouettes, widened mixed-colour gas, and colored emission. A paused brush edit remains pending until its scheduled reconstruction is presented, so throttling cannot strand stale liquid, gas, or light volume.

At the fixed 612×384 world size, the preallocated CPU volume-field buffers are 3,055,104 bytes for atmosphere, 3,760,128 bytes for liquid, and 1,357,824 bytes for emission: 8,173,056 bytes combined. The semantic and independent native-wall RGBA staging buffers use 940,032 bytes each, so the presenter's known CPU field storage is 10,053,120 bytes. The semantic, wall, liquid, half-resolution atmosphere, one-third-resolution emission, palette, and style GPU source textures total 3,161,600 bytes; the 2× RGBA output target is another 3,760,128 bytes. Pixi-managed filter scratch targets are implementation-owned and are not included in those source-texture figures.

Run the allocation check and a local timing sample with:

```bash
npm run profile:render-fields
```

Timing output is diagnostic rather than a cross-machine pass/fail threshold. Unit tests enforce the allocation ceilings and scheduling rate; the browser render lab remains the visual and runtime-GLSL gate.
