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

The real-browser audit first captures and signature-checks this deterministic
atlas, then clears it and exercises painting, wheel/pan, resizing, and mobile
touch. It navigates separately to the native backend for configured-source and
LIFE-preset smoke checks, so native `create_part` behavior cannot silently change
the canonical visual fixture:

```bash
mkdir -p .artifacts
npm run audit:browser-input -- --webgl-only --screenshot=.artifacts/render-lab-webgl.png
npm run audit:browser-input -- --canvas-only --screenshot=.artifacts/render-lab-canvas2d.png
```

The desktop audit also makes a paired 2×/1× render-backing comparison at an identical 1280×720 CSS viewport. CSS canvas dimensions must remain identical while only the backing changes from 1224×768 to 612×384; each scale must independently pass the same three semantic landmarks, cursor-anchored wheel threshold, and 42×27 CSS-pixel middle-pan assertion.

For the native wall/particle composition fixture, use:

```text
http://localhost:5173/?scene=wall-lab&renderScale=2
http://localhost:5173/?scene=wall-lab&renderScale=2&renderer=canvas2d
```

Unlike `render-lab`, `wall-lab` deliberately loads the native TPT backend. It clears only its in-memory diagnostic world, remains paused, skips restore/autosave, and lays ten native wall types behind deterministic particle density gradients and mixtures. This catches accidental wall-as-particle encoding, missing wall uploads, texture-coordinate drift, and wall/particle compositing errors.

## Atlas layout

- Upper left: five sand-density bands plus dust and salt. This shows isolated grains, packed powder relief, and whether smoothing turns grains into a flat slab.
- Upper middle: overlapping water, oil, and acid bodies, a rigid floor, and a sparse liquid row. This shows interior hole filling, liquid-to-liquid colour boundaries, specular response, and edge hardness.
- Upper right: overlapping Smoke, Oxygen, and Noble Gas density-falloff clouds, a sparse gas row, and compact FOG/CFLM volumes. This shows whether gas reads as a continuous volume, whether different gas colours mix, whether generic soot remains distinct, and whether emissive gas bloom overwhelms its species colour.
- Lower left: sand entering dense water, with a deliberately mixed patch. This reveals phase-boundary bleeding and whether sparse liquid remains coherent.
- Lower middle: adjacent wavy columns of water, oil, acid, and lava. This makes over-blur across distinct liquids immediately visible.
- Lower right: a five-column, six-row profile matrix. Its rows cover granular matter; rigid surfaces plus neutral-profile GOL; organic/growing matter; PLUT/URAN/VIBR plus sink/carrier semantics; configured/powered/sensor/channel/force devices; then five neutral/radioactive energy cores. Deliberate sparse holes expose each family's reconstruction behavior without relying on phase overrides. Equal-height warm and cool source strips flank the matrix, while its centre column remains a lower-light comparison, so contour response, role legibility, energy-core treatment, and interior wash are visible in one frame.

## Review gates

For every shader or field-reconstruction change:

1. Capture WebGL and forced Canvas2D at the same viewport size and `renderScale=2`.
2. Confirm the canvas remains a 612×384 CSS/logical world with 1224×768 backing pixels.
3. Confirm the browser console contains no shader, WebGL, runtime, or network-asset failure related to the app.
4. Compare powder granularity, liquid interior continuity and hard boundary, gas halo/volume, material mixing, energy-core legibility, aura falloff, neighboring light tint, and emissive clipping. Warm/cool light should reveal exposed rigid, organic, radioactive, and device contours without turning their interiors into flat bright slabs. Enclosed and shallow exact-material cavities and short internally bounded one-cell cracks should close; open notches, silhouettes, walls, phase boundaries, and every unlike-material seam must remain visible.
5. Keep the previous WebGL crop until the new result has been visually reviewed.
6. When wall rendering changes, repeat the same checks with `scene=wall-lab` and confirm all ten wall patterns remain distinct behind particle mixtures.

The scene itself is a visual fixture. `npm run audit:browser-input` combines it
with real-browser pointer, wheel, pan, resize, backing-size, and exact semantic-placement checks. It also decodes a composed page screenshot in-browser and samples the five dense energy tiles. The gate requires visible Fire/Plasma/ELEC/PHOT/GRVT cores, no meaningful 255-channel clipping, and stable warm/violet/cool/neutral/green-cyan channel ordering in both backends. Screenshot sampling avoids enabling WebGL `preserveDrawingBuffer`, so the diagnostic does not weaken the production performance configuration.

## Reconstruction budget

The exact semantic texture may update at the renderer's 30 Hz cap. The shared atmosphere, liquid, and emission reconstructions are separately capped at 12 Hz and, when several are due, are staggered so only one is rebuilt in a frame. Liquid RGB stores the uniquely supported species color and alpha stores density; an exact unlike-liquid tie remains transparent instead of choosing a scan-order donor. WebGL uploads the fields as linearly sampled textures. Canvas2D uses the same bytes for joined liquid silhouettes, mixed-colour gas, and colored emission, styles authoritative semantic cells, then reconstructs small exact-solid cavities from that presentation plane and immutable semantic neighbours. Both solid paths require zero different nonempty immediate neighbours and either four-cardinal enclosure or at least five of eight exact matches with three cardinal supports. A two-cardinal thin crack additionally qualifies only when all four exact diagonals form continuous side walls and the same material closes its missing axis two cells away. Canvas averages matching styled neighbours without propagation for ordinary matter and uses canonical palette RGB for trait-bearing matter so semantic role accents remain on real cells; WebGL derives the same support gate and slope from its existing eight immediate samples, branches to only the applicable pair of distance-two crack samples, and suppresses traits on reconstructed support. Gas RGB uses density absorption plus directional edge scatter; dense occupied gas converges almost fully to the atmosphere mixture so semantic particles do not remain as coloured islands. Both presenters preserve the reconstructed support footprint and use bounded, closely matched display opacity. Liquid reconstruction uses field density for silhouette support but semantic occupancy and local field support for optical depth, so isolated droplets remain translucent while connected pool cells and reconstructed holes retain saturated depth; local field slope supplies the reflective lip instead of absolute world height. Canvas reconstructs a hole from already-styled semantic neighbours of only the uniquely supported species, mirrors the opacity endpoints without a second atmosphere blur, and ramps filled shoreline alpha continuously from zero. The palette lookup's fourth byte carries one of 12 optical-response classes. Volume paths consume aqueous, oily, corrosive, molten, and clean/sooty gas classes for RGB absorption, scatter, transmission, and gloss. Solid paths consume rough granular, smooth rigid, organic, device, and radioactive classes for bounded roughness, bevel, fibre, trace, and scintillation response; the canonical profile remains a fallback and continues to own field interference. Every optical response is RGB-only; solid cavity support is a separate presentation-only alpha decision, and the semantic grid remains unchanged. Empty reconstructed support deliberately receives the default optics class. The existing style lookup's fourth byte separately carries composable static role flags for emitters, sinks, channels, force actuators, radioactive matter, organic/fibrous matter, and energy carriers. Both presenters apply those flags only to authoritative semantic cells and change RGB without widening alpha; there is no extra texture, field, upload, or pass. The broad Canvas emission aura is composited behind opaque matter; when light exists, exposed solid, powder, and field contours sample that same low-resolution field with clamped bilinear coordinates and profile-specific response, changing RGB but never alpha or semantics. Both backends shade energy as a luminous semantic core plus the existing broader aura; Fire/Plasma use warm flowing detail while radioactive carriers use cool scintillation without inheriting solid-radioactive texture. A paused brush edit remains pending until its scheduled reconstruction is presented, so throttling cannot strand stale liquid, gas, or light volume.

Dense energy radiance passes through a hue-preserving soft knee before final composition, retaining flow detail instead of clipping into flat neon slabs. Canvas treats its twice-drawn local light plane as a restrained sparkle, gives volumetric emissive gas/liquid less local opacity than opaque surfaces, and leaves the shared EmissionField responsible for the broad aura. These changes add no field, texture, pass, scheduler work, or persistent allocation.

At the fixed 612×384 world size, the preallocated CPU volume-field buffers are 3,055,104 bytes for atmosphere, 3,760,392 bytes for liquid, and 1,357,824 bytes for emission: 8,173,320 bytes combined. The 264-byte liquid increase is the reusable species-support workspace; no per-frame donor arrays are allocated. The semantic and independent native-wall RGBA staging buffers use 940,032 bytes each, so the presenter's known CPU field storage is 10,053,384 bytes. The semantic, wall, liquid, half-resolution atmosphere, one-third-resolution emission, palette, and style GPU source textures total 3,161,600 bytes; the 2× RGBA output target is another 3,760,128 bytes. Pixi-managed filter scratch targets are implementation-owned and are not included in those source-texture figures.

Run the allocation check and a local timing sample with:

```bash
npm run profile:render-fields
```

Timing output is diagnostic rather than a cross-machine pass/fail threshold. It includes Canvas surface-lighting and deliberately pessimistic full-612×384 energy-core and trait-core passes as distinct stages. Trait profiling covers realistic masks, a synthetic all-bits mask, and a representative composite, and consumes representative output through a checksum outside the timed region so the JIT cannot discard the work without charging checksum arithmetic to production-like timings. Profiler-only storage is reported separately from runtime-known scratch and does not contribute to `combinedAllocatedBytes`.

Canvas applies semantic role accents to its existing three-float RGB scratch before the final clamp/composite instead of rereading and rewriting a typed pixel afterward. Five reusable full-range animation clocks add 20 persistent bytes and preserve the established role-pattern cadence. Ordinary non-emissive fluids keep their direct pixel fast path; scenes only pay trait arithmetic for cells whose packed role byte is nonzero. Unit tests enforce the allocation ceilings and scheduling rate; the browser render lab remains the visual and runtime-GLSL gate.
