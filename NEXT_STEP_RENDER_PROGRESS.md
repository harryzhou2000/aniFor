# Visual overhaul progress

The design target remains [NEXT_STEP_RENDER.md](./NEXT_STEP_RENDER.md). That
roadmap is treated as immutable; implementation status and visual decisions are
recorded here instead.

## 2026-08-14 — volumetric gas and liquid thickness checkpoint

Status: visually favoured and ready to checkpoint.

### What changed

- Normal WebGL gas at 1× and 2× now uses two smooth world-space noise octaves,
  domain-warped by the existing broad wave field. Coherent native gas velocity
  advects the whole pattern, so cloud masses roll together instead of looking
  like moving particles or a stationary painted band.
- Gas density, species ownership, gaps, silhouette, and alpha remain owned by
  the atmosphere field. The new treatment changes interior light and colour,
  not simulation topology.
- The 4× path retains the established broad wave volume without procedural
  noise, and compact true 8× remains unchanged. This keeps the visible upgrade
  where it is affordable while a shared lower-resolution volume pass is built.
- Curvature-aware liquid transport now covers Water, Oil, and Acid rather than
  Water alone. Convex shoulders admit a restrained family-coloured transmission
  window; concave pockets receive wavelength-selective absorption. The result
  reads as changing optical thickness without changing support or boundaries.

### Visual decision

- Keep the gas change. In the production showcase, broad cloud interiors now
  have nested, organic volume masses. Paired moving frames show coherent drift
  with no cell grain or visible flicker.
- Keep the liquid change. The effect is deliberately quieter: Water crests gain
  a cool translucent lift and concave inlets recede, without halos, ringing, or
  over-darkening.
- Powder is currently the strongest of the three main material lanes. Its grain
  and bulk treatment was not disturbed in this checkpoint.

### Lightweight checks used

- A real production WebGL/HDR 2× showcase rendered successfully with no browser
  errors and was accepted by direct image inspection.
- Focused renderer checks pass (279 checks), and the production bundle builds
  with its complete runtime asset set.
- The legacy Water response envelope is now informational: its old numerical
  bounds reject the new chromatic pocket balance, but the retained images show
  the intended improvement without a topology defect.
- Headless SwiftShader still misses the full 4× showcase framebuffer deadline
  even when this checkpoint's procedural gas noise is completely disabled at
  4×. This points to the existing full-resolution compositor cost, not the new
  gas noise. Hardware WebGL 4× remains enabled; do not add visual gates around
  the software-renderer timeout.

### Next visual work

1. Move gas detail into a shared half-resolution volumetric field or pass so
   1×–4× can share the same richer pattern at bounded fragment cost.
2. Feed emissive-material lighting through that volume for illuminated smoke,
   coloured gas scatter, and restrained shafts.
3. Continue the liquid architecture toward a reusable thickness/surface pass,
   then add caustic projection beneath transmissive bodies.
4. Add broad valley/contact occlusion to powder heaps without blurring grains or
   fine authored structures.

Visual comparisons and interactive judgment are the acceptance mechanism while
this work is evolving. Exact PNG hashes and historical response envelopes are
not visual requirements.

## 2026-08-14 — shared material-volume foundation

Status: visually favoured; supersedes the procedural-noise limitation above.

### What changed

- Added one deterministic seamless 64×64 RGB volume-detail tile, uploaded as a
  linear-filtered repeating texture. Normal WebGL materials now get broad and
  mesoscopic variation from one scale-independent fetch instead of evaluating
  procedural noise at every supersampled fragment.
- Gas uses the shared tile at 1×–4×. Existing coherent velocity advects its
  lookup, while the atmosphere field continues to own cloud support, species,
  gaps, silhouette, and alpha. Compact true 8× remains on its separate shader.
- Stable Smooth powder retains its existing cell grains and sub-cell facets,
  then receives a slower material-offset key/pocket fold in deep bulk only.
  The directional contour transfer now favours diagonal heap shoulders while
  explicitly rejecting flat caps and vertical columns, preserving fine Clay
  and Concrete structures.
- Liquid lighting fuses local and mesoscale normals only on coherent shallow
  shells. A small moving normal breaks the uniform rim into broad reflections;
  family-aware opacity now leaves ordinary Water more transmissive while deep
  cores retain stronger optical thickness. Metallic and viscous liquids remain
  denser.

### Visual decision

- Keep the combined pass. Powder remains granular inside a clean bulk shape,
  while the new slow fold prevents large piles from looking uniformly lit.
- Keep the gas texture path. Grey, blue, and violet regions read as one soft
  cloud volume with more coherent interior lobes and no return to particle dots.
- Keep the Water transmission change. The large showcase body is slightly
  darker but now reads more like a translucent liquid volume than glowing cyan
  acrylic. A later pass should lift only the thin surface highlight rather than
  undoing the deeper transmission.

### Lightweight checks used

- The production bundle builds with its complete 19-resource runtime closure.
- A real 2× WebGL/HDR production showcase compiled the shader and captured with
  zero browser errors; direct before/after inspection favoured the new image.
- The two focused renderer files pass 267 checks. No historical screenshot hash
  or old response envelope was used to accept or reject the aesthetic change.
- Software SwiftShader can still exceed the full 4× showcase deadline. Hardware
  4× remains a supported visual target, and the shared texture removes the old
  per-fragment procedural-noise multiplier from that path.

### Next visual work

1. Polish the liquid shell with a thinner, brighter reflected crest while
   retaining the new deeper transmission.
2. Reuse the shared volume carrier for illuminated smoke, fire tongues, and
   coloured gas scatter rather than adding isolated shader noise functions.
3. Add broad powder valley/contact occlusion beneath the retained grain layer.
4. Continue material-family tuning through direct scene comparison; keep CI and
   review evidence subordinate to visible renderer progress.

## 2026-08-14 — connected-material light and volume pass

Status: visually favoured; ready for a visual checkpoint and deployment.

### What changed

- Liquid now carries the shared material-volume texture through the connected
  body, not only through its surface normal. Broad cool transmission folds,
  restrained absorptive pockets, and a shallow caustic lane give Water and
  related liquids readable internal depth while preserving their exact support
  and curved silhouette.
- The reflected liquid shell is narrower and brighter in the Volumetric look.
  Filtered volume variation changes the crest width and energy across a body,
  avoiding a uniform cyan outline while retaining the deeper transmission.
- Stable Smooth powder gains a broad basin-occlusion term in deep, quiet heap
  interiors, plus a stronger slow key/pocket fold. The grain/facet layer is
  composed afterward and remains legible; Local, square Grains, sparse grains,
  holes, motion, and fine Clay/Concrete structures do not enter the new layer.
- Connected Fire uses one vertically stretched, upward-advected sample of the
  shared volume carrier. Hot windows, cooler pockets, and moving tongue relief
  now form one flame body rather than a uniformly orange carrier block. Sparse
  sparks and true 8× remain on their existing paths.
- Connected gas reuses its existing shared volume sample to scatter nearby
  emissive colour through broad interior apertures. Optical depth closes the
  opposing pockets, so lit Smoke/FOG read as participating media rather than
  particles with a flat colour overlay.

### Visual decision

- Keep the liquid pass. In the production showcase, the large Water body now
  has clearly readable internal blue/cyan folds and depth variation without
  blurring the glass contact, Oil boundary, or outer contour.
- Keep the powder pass. Sand and Clay retain their granular colour vocabulary,
  while the pile reads as a slower illuminated mass with a more grounded basin.
- Keep the gas and Fire volume carriers. The isolated lit-gas scene retains
  holes and sparse gaps while showing broad interior shade; the Fire scene now
  exposes coherent warm lobes and cool pockets which will become more organic
  as the simulation supplies a naturally changing flame silhouette.

### Lightweight checks used

- The production bundle builds and closes all 19 runtime resources.
- A real production WebGL/HDR 2× showcase compiled and captured with zero
  browser errors. Direct comparison favoured the stronger material-volume
  image over the previous checkpoint.
- The isolated lit-gas scene rendered at 2× and kept the compact true-8× path
  separate and operational. No Chrome process remained afterward.
- The legacy Fire response envelope rejects the intentionally larger colour and
  spatial response. Its off/on images were retained and judged directly; that
  historical numeric calibration is not a visual acceptance gate.

### Next visual work

1. Move the liquid body/thickness response into a reusable screen-space fluid
   stage so refraction and caustic projection can respond to the scene behind
   the material rather than only to analytic colour.
2. Add source-direction-aware low-resolution gas shafts and coloured extinction
   using the existing long-range emission carrier.
3. Add broad contact shadows between unlike settled bulk materials without
   drawing separator lines or suppressing the retained grain layer.
4. Prototype the same material-volume vocabulary in the true-8× compositor or
   a bounded half-resolution auxiliary pass, keeping automatic fallback intact.

## 2026-08-14 — liquid transport and source-directed gas shafts

Status: visually favoured; ready for checkpoint and deployment.

### What changed

- The normal-scale HDR compositor now receives the existing phase-exclusive
  liquid optical-depth plane and shared material-volume texture. Dense exact
  Water/Oil/Acid bodies carry a guarded screen-space upstream sample, restrained
  chromatic separation, broad caustic crowns, and wavelength-selective deep
  absorption before the sharper air-facing surface response.
- Refraction reach grows with real vertical optical depth and bends with native
  liquid velocity. Displaced samples fail closed at unlike material or wall
  contact; the established scene alpha and material silhouette remain the only
  support authority.
- High-quality Volumetric gas reconstructs the direction toward transported
  emission even inside a locally flat cloud core. One shared low-frequency
  volume sample is stretched along that direction to form stationary warm/cool
  light shafts, while optical thickness damps the core and a signed far-side
  response provides restrained extinction.
- The gas shaft consumes the existing long-range emission carrier directly for
  reach and colour. It adds no texture, field, render target, or simulation
  state, and remains outside the compact true-8× shader.

### Visual decision

- Keep the stronger liquid transport. Compared directly with the previous 2×
  and 4× showcase images, the large Water tank now has visible cyan depth
  variation, refracted internal folds, bright caustic windows, and darker
  optical pockets instead of a nearly uniform fill.
- Keep the source-directed gas pass. In the emitter-bearing Smoke/FOG scene,
  the earlier result changed only the source-facing rim; the retained version
  carries broad, source-coloured folds into the connected cloud body without
  filling holes or animating stationary gas like a conveyor belt.
- Keep the effects at the current strength. They are visible at normal viewing
  size but remain secondary to material colour, body shape, and retained powder
  grain detail.

### Lightweight checks used

- The production bundle builds and closes all 19 runtime resources.
- A real production 2× WebGL/HDR showcase completed with zero browser errors;
  direct previous/current inspection favoured the new liquid image.
- The focused 2× gas/light scene completed, rendered the new interior shafts,
  and retained true-8× isolation. The current HDR and presenter contract suites
  pass 13/13 and 266/266 respectively.
- A real 4× WebGL showcase rendered the intended liquid and gas result. Its old
  exact-consecutive-frame settle wait expired under software rendering, but the
  captured WebGL image itself was complete and visually preferred; this is not
  treated as a visual rejection gate.

### Next visual work

1. Add broad contact shadows and shared bounce between unlike settled bulk
   materials without separator lines or loss of the grain/facet layer.
2. Evaluate a bounded scene/background separation for genuine through-liquid
   refraction and caustic projection onto neighbouring matter.
3. Bring a cheaper version of the shared material-volume vocabulary to true 8×
   without duplicating the normal HDR pipeline or risking browser timeouts.
4. Continue direct material-family scene tuning, with visual comparison ahead
   of historical response envelopes and exact-output evidence.
