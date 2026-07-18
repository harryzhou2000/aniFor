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

## Atlas layout

- Upper left: five sand-density bands plus dust and salt. This shows isolated grains, packed powder relief, and whether smoothing turns grains into a flat slab.
- Upper middle: overlapping water, oil, and acid bodies, a rigid floor, and a sparse liquid row. This shows interior hole filling, liquid-to-liquid colour boundaries, specular response, and edge hardness.
- Upper right: overlapping Smoke, Oxygen, and Noble Gas density-falloff clouds plus a sparse gas row. This shows whether gas reads as a continuous volume, whether different gas colours mix, and whether the exterior becomes either point-like or excessively opaque.
- Lower left: sand entering dense water, with a deliberately mixed patch. This reveals phase-boundary bleeding and whether sparse liquid remains coherent.
- Lower middle: adjacent wavy columns of water, oil, acid, and lava. This makes over-blur across distinct liquids immediately visible.
- Lower right: rigid, glass, organic, radioactive liquid/gas, energy, powered, and emissive blocks. Deliberate sparse holes expose each material family's reconstruction behavior.

## Review gates

For every shader or field-reconstruction change:

1. Capture WebGL and forced Canvas2D at the same viewport size and `renderScale=2`.
2. Confirm the canvas remains a 612×384 CSS/logical world with 1224×768 backing pixels.
3. Confirm the browser console contains no shader, WebGL, runtime, or network-asset failure related to the app.
4. Compare powder granularity, liquid interior continuity and hard boundary, gas halo/volume, material mixing, and emissive clipping. Enclosed solid pinholes should close, while exposed notches, silhouettes, and seams between unlike solids must remain visible.
5. Keep the previous WebGL crop until the new result has been visually reviewed.

The scene is a visual fixture, not a replacement for real-browser pointer, wheel, pan, and painted-footprint checks.

## Reconstruction budget

The exact semantic texture may update at the renderer's 30 Hz cap. The full-grid atmosphere and liquid reconstructions are separately capped at 12 Hz and, when both are due, are staggered so only one is rebuilt in a frame. A paused brush edit remains pending until its scheduled reconstruction is uploaded, so throttling cannot strand stale liquid or gas volume.

At the fixed 612×384 world size, the preallocated CPU volume-field buffers are 3,055,104 bytes for atmosphere and 3,760,128 bytes for liquid: 6,815,232 bytes combined. Including the 940,032-byte semantic staging buffer, the presenter's known CPU field storage is 7,755,264 bytes. The semantic, liquid, half-resolution atmosphere, palette, and style GPU source textures total 2,117,120 bytes; the 2× RGBA output target is another 3,760,128 bytes. Pixi-managed filter scratch targets are implementation-owned and are not included in those source-texture figures.

Run the allocation check and a local timing sample with:

```bash
npm run profile:render-fields
```

Timing output is diagnostic rather than a cross-machine pass/fail threshold. Unit tests enforce the allocation ceilings and scheduling rate; the browser render lab remains the visual and runtime-GLSL gate.
