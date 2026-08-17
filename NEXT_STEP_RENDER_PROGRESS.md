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

## 2026-08-14 — liquid optical background and cinematic powder body

Status: visually favoured at 2× and 4×; ready for checkpoint.

### What changed

- Normal WebGL/HDR now owns a capped-resolution optical background target. It
  renders a low-frequency studio environment plus non-liquid scene matter, then
  the liquid compositor samples that private layer through exact Water/Oil/Acid
  bodies with depth-varying lens warp, restrained chromatic displacement, and
  caustic carry. Foreground liquid support and alpha remain unchanged.
- The background target is capped at 2× even when the main field is 4×, keeping
  the through-liquid image naturally softer without doubling the full 4× HDR
  allocation. Canvas2D and the compact true-8× route remain independent.
- Settled Smooth powder receives a late, broad-volume grade after material
  identity and scene light are composed. Wide density/support exclude sparse
  grains, holes, narrow structures, suspension, Local, and Grains; a static
  material-volume fold adds a coherent crown, shoulder, and compacted pocket.
- The powder grade uses multiplicative colour response so Sand/Clay/Concrete
  pigment variation survives. A second, higher-frequency organic sample restores
  bounded internal variation at 4× without the regular diagonal stripes exposed
  by the rejected mesostrata-retention trial.
- Source-aware powder irradiance now uses the same broad settled-pile slope as
  the body finish instead of restarting its direction from local grain normals.
- `--loose-visual-capture` provides a deliberately non-gating review path: it
  waits for a valid prepared WebGL scene and captures one compositor-visible
  frame without requiring byte-identical consecutive PNGs.

### Visual decision

- Keep the optical background. The Water tank remains crisp at its rim and
  obstacles but gains deeper internal cyan variation and visible background
  separation instead of reading as a flat translucent fill.
- Keep the powder grade. The showcase pile now has a readable bright shoulder,
  slower broad mineral folds, and a grounded lower mass while retaining the
  grain-colour layer. Single-particle reference rendering is untouched because
  Local and Grains never enter this branch.
- Keep the organic 4× retention and reject the earlier mesostrata reapplication.
  The latter made Concrete resolve as artificial diagonal bands; the retained
  material-volume texture restores variation without a checker or stripe motif.

### Lightweight checks used

- The production bundle builds and closes all 19 runtime resources.
- Real 2× and 4× production WebGL/HDR showcase captures completed with zero
  browser errors and active HDR backings. The retained images are
  `/tmp/anifor-fluid-powder-overhaul-v3-2x.png` and
  `/tmp/anifor-fluid-powder-overhaul-v4-4x.png`.
- Focused compositor and presenter contracts pass 279/279. No exact image hash,
  historical response envelope, or consecutive-frame equality was used as an
  aesthetic acceptance gate.

### Next visual work

1. Put more authored scene structure into the optical background so liquid can
   visibly refract nearby matter and project a soft caustic onto receiving solids.
2. Give gas a dedicated low-resolution transmittance/light buffer for thicker,
   softer clouds and longer source-shaped shafts without point-like interiors.
3. Extend the broad powder treatment by appearance profile so snow, crystals,
   soot, and reactive powders retain distinct roughness and scatter character.
4. Prototype a bounded compact true-8× version of the retained material-volume
   vocabulary, with visual viability and browser responsiveness as the criteria.

## 2026-08-14 — visual-first contour, mist, and body-light pass

Status: visually favoured; visual quality is the primary development criterion.

### Direction change

- Continue the roadmap as a visual overhaul, not an evidence-framework project.
  Direct 2×/4× WebGL inspection may accept a visually stronger checkpoint even
  when historical hashes, exact-frame equality, or old numeric envelopes move.
- Keep only lightweight renderer-health checks during art iteration: the bundle
  must build, WebGL/HDR must actually activate, the scene must be visible, and
  browser shader errors must be absent. Broader gates remain optional until a
  visually substantial material pass is ready to checkpoint.

### What changed

- Liquid backdrop displacement is now contour-led. Four bounded samples of the
  existing liquid field provide a stable world-space lens direction; the broad
  noise component was reduced so a flat pool no longer translates the entire
  environment like a decal.
- Dense liquid now carries a signed, low-frequency lens fold through its whole
  supported body: the lit half catches profile-coloured caustic light and the
  opposing half receives wavelength-selective absorption. This makes a broad
  Water tank read as transparent volume at fit view rather than a cyan slab.
- Volumetric/B gas now bridges connected low-density atmosphere into one faint
  translucent veil. The same coherence proof feeds forward scatter, while the
  existing advected billow receives stronger light/pocket separation. Sparse
  isolated carriers and authored holes remain outside the mist body.
- The final Smooth-powder grade is more slope-led and less texture-led. Broad
  settled shape now owns the pile lighting; the material-volume tile supplies
  restrained mineral irregularity instead of cloud-shaped blotches. Local and
  square Grains remain unchanged.

### Visual decision

- Keep the stronger liquid lens fold. Enlarged direct comparison shows broad
  cyan caustic windows and deep pockets inside the tank while walls, obstacles,
  and the hard water boundary remain crisp.
- Keep the connected gas mist and stronger billow contrast. The effect remains
  translucent and field-shaped rather than becoming a blurred sprite halo.
- Keep the slope-led powder rebalance. It preserves the granular pigment layer
  while making the large pile read as one illuminated mass.

### Lightweight checks used

- The production bundle builds and closes all 19 runtime resources.
- Real 2× and 4× production WebGL/HDR captures complete with zero browser
  errors. The latest retained 2× visual is
  `/tmp/anifor-visual-overhaul-v4-2x.png`; the retained 4× comparison is
  `/tmp/anifor-visual-overhaul-v4-4x.png`.
- A derivative-based contour prototype was rejected immediately because the
  live Pixi WebGL shader did not compile; explicit field samples replaced it.
  No historical PNG hash or exact settle comparison participated in the visual
  decision.

### Next visual work

1. Build the gas transmittance/light stage as an actual low-resolution reusable
   buffer so clouds can cast soft internal shadow and receive longer coloured
   shafts without adding particle-like detail.
2. Let the liquid optical background include deliberately authored nearby forms
   and project a soft caustic onto receiving solids, making transparency and
   refraction obvious in ordinary play rather than only in a lab tank.
3. Add broad contact shadow and colour bounce between settled bulk materials,
   avoiding separator outlines and preserving the grain/facet layer.
4. After normal 2×/4× art direction stabilises, bring a cheaper version of the
   same visual vocabulary to true 8× with browser responsiveness as the gate.

## 2026-08-14 — participating-light gas and internal liquid caustics

Status: visually favoured checkpoint; accepted from direct 2×/4× inspection.

### What changed

- Volumetric gas now probes the existing downsampled, obstacle-aware emission
  carrier at a genuinely useful gas-scale radius. Those wider reads establish
  direction only; the local centre carrier remains the sole owner of radiance
  and support. This creates a longer source-directed response without borrowing
  light through an opaque wall.
- Connected dilute gas moves its forward-scatter lift inward to a mid-density
  shoulder. A widened field-owned participating-light lobe then gives the cloud
  a cool transmitted key and an opposing charcoal pocket. The transparent rim
  keeps its silver lining, while the middle reads as volume rather than a matte
  blurred card.
- Connected liquids reuse the filtered material-volume tile to bend two oblique
  light waves into a slow curved caustic web. The highlights and complementary
  absorption live inside the liquid body, so Water retains its deep teal
  silhouette, transparent edge, and readable submerged objects.
- The failed receiver-panel experiment was removed rather than hidden. Cyan,
  neutral, strip, and inset wall backplates all made the tank read as a frosted
  rectangle or an artificial inner frame. The retained design changes no
  showcase geometry and puts the optical variation in the material itself.

### Visual decision

- Keep the widened gas-direction probe and broad participating-light body. The
  normal showcase retains rounded, field-shaped clouds while focused cards show
  source-coloured transmission beyond a thin rim.
- Keep the internal Water caustic. It gives the pool curved highlight and depth
  variation without bleaching the lower tank or replacing transparency with a
  visible receiver plate.
- Keep WebGL as the canonical art path and Canvas2D as a permissive fallback.
  This visual choice was made from ordinary fit-view composition, not from an
  exact historical image match.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The retained production scene captured successfully through real WebGL/HDR
  at both 2× and 4× with zero browser errors:
  `/tmp/anifor-visual-overhaul-v19-2x.png` and
  `/tmp/anifor-visual-overhaul-v19-4x.png`.
- The focused source-lit gas board also completed in loose visual mode at
  `/tmp/anifor-gas-source-v4-e13-gas-light-2x-off.png`. Historical hashes,
  exact settle equality, and old response envelopes were not aesthetic gates.

### Next visual work

1. Add a distinct fire/flame/ember presentation with velocity-shaped tongues
   and blackbody-driven core-to-smoke transitions.
2. Add foam and detached spray to fast or exposed liquid while keeping the
   current hard liquid ownership boundary.
3. Extend profile-driven bulk lighting so translucent solids, metals, powders,
   and organics receive more distinct roughness, scatter, and reflection.
4. Prototype a cheaper normal-to-true-8× translation only after the remaining
   normal-path visual systems are established; browser responsiveness remains
   more important than exact cross-scale image identity.

## 2026-08-14 — flame volume and moving-Water crest detail

Status: visually favoured checkpoint; flame overhaul accepted, Water foam kept
as a restrained first layer rather than treated as a finished fluid system.

### What changed

- Fire now uses its existing temperature, velocity, and material-volume fields
  to separate a pale hot core, orange body, red absorptive pockets, and darker
  cooling folds. Upward flow stretches the body into attached tongues instead
  of leaving one flat orange slab.
- A narrow, velocity-aligned high-temperature thread flickers inside the upper
  tongue. It suggests attached sparks without drawing shader-owned dots;
  detached embers remain real simulation-owned `EMBR` matter.
- Moving Water now breaks its connected HDR crest into sparse pearly islands
  gated by native speed and shear. The ordinary shader adds irregular bright
  caps and darker troughs only to moving exact Water, while resting pools keep
  their glassy continuous shoulder.
- Fast weakly connected Water receives a small over-white spray glint on its
  existing rounded density silhouette. No particle, support, or alpha is added,
  so this cannot invent droplets in empty air.
- A Fire-alpha experiment was rejected because it exposed the underlying wall
  checker through the flame and made the body look perforated. Fire ownership
  and alpha therefore remain unchanged.

### Visual decision

- Keep the stronger flame core, cool channels, rising tongues, and attached
  thread. The retained frame reads as luminous moving volume rather than a
  uniformly coloured trapezoid.
- Keep the Water crest/spray layer as a supporting effect, not the endpoint of
  the liquid overhaul. At fit view it separates the fast strand and moving
  surface from the still pool, but broader foam geometry still needs a future
  field-level treatment.
- Continue accepting visual work from direct WebGL inspection. Old calibrated
  response envelopes and historical image hashes are not aesthetic gates while
  this art direction is moving.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The retained Fire frame is
  `/tmp/anifor-fire-overhaul-v2-fire-flame-1x-movingOn.png`.
- The retained Water frame is `/tmp/anifor-water-foam-v8/b.png`; its real
  WebGL/HDR capture completed with no browser errors.

### Next visual work

1. Give thick and wall-backed Glass a denser cool transmitted interior while
   preserving a crisp grazing crown and readable refracted pattern.
2. Extend material-class lighting to metals, translucent solids, and organics
   so their bulk appearance is distinct before more individual elements are
   tuned.
3. Return to foam with a broader connected surface-distance carrier rather than
   trying to make a one-cell crest do all of the visual work.
4. Translate the established normal-path vocabulary to true 8× only after the
   remaining bulk classes have a clear art direction.

## 2026-08-14 — optically dense Glass and class-wide metallic reflections

Status: visually favoured normal-WebGL material-class checkpoint.

### What changed

- Thick Glass now carries stronger selective warm-wavelength absorption, cool
  transmission, broad oblique volume folds, and a brighter grazing crown. The
  body remains transparent and keeps its authored holes, thin panes, contacts,
  semantic support, and alpha unchanged.
- Co-located native-wall Glass no longer skips the deep optical treatment. Its
  refracted checker is tinted and attenuated by the existing Glass depth, so it
  reads behind a cool dense pane instead of pasted over a flat blue card.
- All `MetallicRigid` owners now receive one B-only reflection model after
  their material pigment and rolled structure are composed. A cool directional
  crown, environment shoulder, and opposing pigment-preserving pocket cover
  Metal, bimetal, Gold, Iron, Platinum, and Titanium without another per-ID
  texture pattern.
- The metallic crown was deliberately capped below the first experiment's
  value after direct comparison showed Platinum beginning to wash out. Gold
  keeps the strongest fit-view gain while pale metals retain grey depth.

### Visual decision

- Keep the deeper cyan Glass body and wall-backed attenuation. The production
  tank walls gain visible optical thickness and interior folds without turning
  into opaque blue plastic.
- Keep the class-wide metallic sweep with the reduced crown cap. The six-card
  board reads more like reflective mass and less like six patterned slabs;
  holes, isolated pieces, contacts, and silhouettes remain visually clean.
- Continue using the ordinary B/Volumetric view as the art target. Canvas2D
  stays a permissive fallback and old response envelopes remain non-gating.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources after both
  shader increments.
- The retained Glass production frame is
  `/tmp/anifor-glass-overhaul-v2-showcase.png`.
- The retained six-material reflection frame is
  `/tmp/anifor-metal-reflection-v3/b.png`; its WebGL/HDR capture completed with
  no browser errors.

### Next visual work

1. Add a broad, stable contact-darkening and bounced-colour layer for grounded
   heaps and rigid bodies without drawing categorical separator lines.
2. Extend the depth/transmission vocabulary from Glass to Ice and other
   translucent rigid materials that still read as flat tinted solids.
3. Add a cheaper matching crown/pocket vocabulary to true 8× once the remaining
   normal-path material families are visually settled.

## 2026-08-14 — translucent-rigid shell-to-core prism volume

Status: visually accepted normal-WebGL material-class increment.

### What changed

- The final translucent-body compositor now gives supported deep
  `TranslucentRigid` matter a broad shell-to-core optical fold. A cool
  source-facing crest, a quieter absorbing pocket, and a restrained cyan/warm
  channel split survive HDR tonemapping and make Ice read as a volume rather
  than a uniformly tinted plate.
- The treatment is class-owned rather than an Ice-only texture. Existing
  pigment, optical depth, body support, and low-frequency world-space form
  determine the result; holes, thin structures, silhouettes, contacts, alpha,
  and simulation state are untouched.
- Deep Glass receives only a small share of the new fold because its accepted
  selective absorption, wall transmission, and E21 volume grammar already own
  the stronger body response. This keeps the Glass tank coherent while the
  previously flatter translucent materials gain visible depth.

### Visual decision

- Keep the v10 cyan/warm split. Earlier profile-helper and shallow-depth
  versions were rejected because later translucent composition and a timid
  depth gate made them effectively invisible at fit view.
- The accepted placement is after the material-specific translucent lens
  grammar, where the displayed Ice/Glass body is final. At ordinary view the
  Ice card now carries a restrained iridescent depth drift; enlarged inspection
  shows a continuous curved fold rather than a repeated tile or hard band.
- The checkerboard inside the moving-Water fixture remains its authored native
  wall-coexistence control, not foam geometry. Future foam work should be judged
  from the open surface and detached Water regions instead of that control.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The retained accepted class board is
  `/tmp/anifor-translucent-prism-v10/b.png`; its ordinary 2× WebGL/HDR capture
  completed without browser errors.
- The retained before/after Ice inspection is
  `/tmp/anifor-prism-ice-v10-comparison-3x.png`.

### Next visual work

1. Add stable, broad ambient/contact grounding for heap valleys and rigid-body
   mass without drawing categorical separator lines.
2. Give organic and waxy bodies a softer transmitted-light signature distinct
   from the new crystalline prism and metallic crown.
3. Translate the established crown/pocket/volume vocabulary into a cheaper
   true-8× grammar while retaining Smooth/Local/Grains style separation.

## 2026-08-14 — wax transmission and broad material grounding

Status: visually accepted normal-WebGL material-class checkpoint.

### What changed

- Solid Wax and hydrated Plant now carry a soft shell-to-core transmitted-light
  response beyond their existing shallow subsurface rim. A warm, pigment-aware
  key and restrained opposing absorption give deep organic matter an internal
  glow distinct from crystalline Ice and reflective metal.
- Thick viscous liquids reuse the connected liquid-volume fold for a related
  warm transmission response. This covers MWAX/GEL-like optics as a class and
  does not add exact-material texture branches or alter liquid boundaries.
- Bulk Smooth powder and supported solids now share a broader deep-mass
  grounding response. Dense, optically deep, low-slope interiors darken gently,
  so heap valleys feel settled and rigid cards read as shaped slabs instead of
  bright patterned sheets.
- The grounding remains continuous and interior-only. It does not draw contact
  separators, fill holes, expand silhouettes, or change support, alpha, the
  simulation, Local powder, square Grains, or compact true 8× rendering.

### Visual decision

- Keep the wax transmission pass. At fit view both Wax panels gain a soft body
  glow while their cuts and thin structures stay crisp; the earlier board read
  more like a flat patterned sheet.
- Keep the stronger v2 powder/solid grounding. Smooth Sand and Clay retain
  internal grain colour variation but gain heavier cores and a clearer shared
  valley. The solid atlas gains deeper recesses and broad-body weight without
  muddying pigments or fine controls.
- These were accepted by direct image inspection plus independent agent visual
  passes. Historical hashes and strict response envelopes were intentionally
  not used as visual approval gates.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The retained wax frame is `/tmp/anifor-wax-transmission-v1/b.png`; its
  before/after board is `/tmp/anifor-wax-transmission-v1-comparison.png`.
- The retained Smooth powder comparison is
  `/tmp/anifor-powder-grounding-v2-smooth-comparison.png`.
- The retained solid comparison is
  `/tmp/anifor-solid-grounding-v2-comparison.png`.

### Next visual work

1. Add a restrained lower-hemisphere colour bounce to the grounded bulk so
   deep shadow gains environmental colour instead of only losing brightness.
2. Broaden connected Water foam/crest geometry and improve open-surface
   reflection while preserving its harder liquid boundary.
3. Translate the accepted material-class vocabulary to a robust compact true
   8× path without cloning the full normal shader or losing style separation.

## 2026-08-14 — connected moving-Water crest islands

Status: visually accepted normal-WebGL liquid-surface increment.

### What changed

- Moving Water now reuses the normal material pass's existing wide top-density
  probe as a short surface-distance carrier. This lets a whitecap occupy a few
  connected interior fragments instead of being limited to the old one-row
  slope lip, without expanding liquid alpha or changing its boundary.
- The wide carrier is velocity-gated, Water-owned, support-gated, and broken by
  two low-frequency live surface signals. Calm Water keeps its glassy cyan lip;
  moving surfaces gain sparse pale crest islands and a small darker trough.
- Calm reflection and moving foam were deliberately separated after an early
  experiment made the whole top edge look like a pasted white stripe. The
  retained v6 uses the local shell for continuous reflection and the wider
  carrier only for sparse moving crest islands.

### Visual decision

- Keep v6. The open moving surface gains visible broken highlights at fit view
  while the still tank and non-Water liquid controls remain quiet. Two
  independent visual passes accepted the retained balance.
- The large checkerboard inside the moving tank is the unchanged authored
  native-wall coexistence control. It is not foam and must be excluded from
  future Water aesthetic judgments.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The retained Water frame is `/tmp/anifor-water-connected-foam-v6/b.png`.
- The fit-view before/after board is
  `/tmp/anifor-water-connected-foam-v6-comparison.png`; the enlarged open-
  surface comparison is
  `/tmp/anifor-water-connected-foam-v6-crop-comparison.png`.

### Next visual work

1. Give grounded bulk a restrained environment-colour bounce so its new mass
   shadow remains chromatic rather than merely darker.
2. Port the accepted powder, liquid, gas, translucent, metallic, and organic
   visual vocabulary into a compact, stable true 8× shader grammar.
3. Continue material-family work from shared optics before returning to
   isolated element-by-element motifs.

## 2026-08-14 — participating gas light and resilient high-resolution WebGL

Status: visually accepted gas-volume checkpoint; compact 8× parity and ordinary
software-renderer resilience improved.

### What changed

- Source-lit connected gas now forms a broad, soft, source-coloured window
  through its volume. Two low-frequency material-volume channels shape the
  window, while a profile gate and the existing transported-light direction
  keep the effect tied to genuinely scattering, illuminated gas.
- The retained treatment deliberately moved away from the earlier nested-band
  experiment. A stronger broad carrier now owns most of the lift, with only
  gentle internal modulation and a restrained far-side extinction pocket.
  Atmosphere fields still own support, holes, sparse gaps, alpha, and species
  mixture.
- Compact true 8× Smooth powder and deep solid interiors now receive a small
  shared pigment-aware grounding term. Local and square Grains remain exact on
  their prior paths; exposed shells, slopes, contacts, fine structures, and
  holes do not enter the deep-interior response.
- Ordinary 8× requests detected on SwiftShader/llvmpipe-style software
  rasterizers now remain on canonical WebGL at an effective 4× instead of
  timing out and dropping to Canvas. The request is retained for the UI's
  `4× (8× capped)` diagnostic. Explicit true-8× audit routes and hardware with
  adequate throughput retain the compact 8× path.

### Visual decision

- Keep gas V6. At fit view the lit side is now clearly visible in Smoke/FOG
  cards, but reads as soft participating media rather than V4's posterized
  contour bands. An independent visual pass also selected V6.
- Keep compact interior grounding. It closes the most obvious depth-vocabulary
  gap between normal Smooth rendering and the compact direct shader without
  changing powder style semantics.
- Treat the adaptive software cap as a robustness policy, not a replacement for
  true 8× rendering. True 8× remains available where it can complete reliably.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The focused WebGL capability test remains green (5 tests).
- The retained gas before/after frames are
  `/tmp/anifor-gas-participating-v6-e13-gas-light-2x-off.png` and
  `/tmp/anifor-gas-participating-v6-e13-gas-light-2x-on.png`.
- The loose visual capture reported WebGL at 2× with zero browser errors; no
  historical visual hash or calibrated response envelope was used to decide
  the aesthetic result.

### Next visual work

1. Extend the softer source-window vocabulary to moving, irregular gas plumes
   so the effect is not judged only on paused cards.
2. Give grounded powder/solid bulk a restrained lower-hemisphere colour bounce
   rather than neutral darkening alone.
3. Continue compact 8× parity for liquid and gas with cheap broad lobes, while
   keeping the full normal shader as the primary visual path.

## 2026-08-14 — chromatic lower-hemisphere bounce

Status: retained normal-WebGL powder/solid material-class increment.

### What changed

- Dense, optically deep, locally quiet Smooth powder and supported solids now
  receive a warm lower-hemisphere bounce after the shared sky/environment
  transport. The bounce remains strongly biased toward each material's live
  pigment instead of applying one beige overlay.
- The final bounce scalar is capped, so even the deepest broad body cannot turn
  into a flat emissive patch. Existing powder and solid call gates keep the
  response away from Local/Grains, moving or sparse powder, contacts, authored
  holes, fine columns, thin shells, native walls, and unsupported fragments.
- Liquid, gas, compact true 8×, Canvas, support, alpha, and simulation state are
  unchanged by this layer.

### Visual decision

- Retain the capped stronger version. Earlier strengths were effectively
  invisible at fit view; the retained pass gives large Sand/Clay masses and
  solid cards a restrained warm lower-core carry while preserving their local
  texture and identity.
- This is intentionally a supporting material layer rather than a standalone
  motif. The source-lit gas window remains the larger visible change in this
  checkpoint.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- Fresh 2× SwiftShader captures of both affected fixtures completed on WebGL
  with zero browser errors.
- Powder reference: `/tmp/anifor-powder-grounding-v2/off.png`; retained frame:
  `/tmp/anifor-powder-ground-bounce-v2/off.png`.
- Solid reference: `/tmp/anifor-solid-grounding-v2/b.png`; retained frame:
  `/tmp/anifor-solid-ground-bounce-v3/b.png`.

### Next visual work

1. Apply the accepted gas-light vocabulary to irregular, moving plumes where
   directional volume is easier to perceive than in paused cards.
2. Add cheap liquid/gas broad-lobe parity to compact true 8×.
3. Continue family-level optics and material variation before isolated exact-
   element decoration.

## 2026-08-15 — flow-aligned gas billows and full compact fluid optics

Status: retained moving-gas overhaul and true 8× liquid/gas parity checkpoint.

### What changed

- Coherent atmosphere velocity now rotates and stretches the existing seamless
  material-volume lookup into a flow-aligned internal frame. Horizontal Smoke
  and FOG form long rolling billows, vertical CFLM forms an upward volume, and
  reversed flow selects a visibly different opposing fold. The same atmosphere
  field still owns the boundary, holes, sparse gaps, support, and alpha.
- The existing leading/trailing gas cue now reaches through the connected body
  instead of living almost entirely on a thin density shoulder. Positive flow
  receives a pigment-aware soft key and the opposing fold retains a restrained
  absorptive pocket. Stationary or incoherent gas keeps the established
  isotropic volume exactly.
- The compact direct true 8× compositor now selects the shared full B
  liquid/gas material-volume profile at all four compact fluid call sites.
  This adds the canonical reflected crown, transmitted middle, and core
  absorption vocabulary without adding a sampler, texture, render target,
  field, support decision, or alpha change.

### Visual decision

- Keep the flow-aligned gas frame. Directed and reversed captures read as
  soft moving volumes rather than a static card with an edge tint; the still
  capture remains quiet. An independent visual pass also judged the retained
  result billowy rather than stripe-like at fit view.
- Keep compact B rather than compact A. In a true 4896×3072 Water/Diesel
  comparison, B gives a modest but readable top rim and surface-to-core split
  with no visible halo, banding, or contact spill. A was safe but remained too
  flat. A second visual pass independently preferred B.
- Keep the treatment visual-first. Historical calibrated RGB envelopes were
  not used to choose the moving-gas look; direct OFF/directed/reversed/still
  frames were the decision surface.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- A true 8× Distilled Water/Diesel frame completed on WebGL at 4896×3072 with
  zero browser errors. A is
  `/tmp/anifor-compact-liquid-a-distilled-diesel-liquid-8x.png`; retained B is
  `/tmp/anifor-compact-liquid-b-distilled-diesel-liquid-8x.png`.
- The retained 17-gas true 8× atlas is
  `/tmp/anifor-compact-gas-b-gas-identity-webgl-styled.png`; all 17 connected
  cloud bodies rendered and the loose visual capture reported zero browser
  errors.
- Moving-gas reference frames are
  `/tmp/anifor-gas-motion-ribbon-gas-motion-2x-directedOff.png`,
  `/tmp/anifor-gas-motion-ribbon-gas-motion-2x-directedOn.png`,
  `/tmp/anifor-gas-motion-ribbon-gas-motion-2x-reversedOn.png`, and
  `/tmp/anifor-gas-motion-ribbon-gas-motion-2x-stillOn.png`.
- No project-owned Chrome process remained after the captures.

### Next visual work

1. Carry the same flow frame into irregular source-lit plume scenes so broad
   transported-light windows and moving billows read as one effect.
2. Improve free liquid surfaces beyond block fixtures: clearer crest breakup,
   transparent shallow zones, restrained reflection, and deeper colour falloff.
3. Continue family-level translucent, metallic, organic, and granular optics
   before returning to exact element-specific decoration.

## 2026-08-15 — sparse sky reflections for connected Water

Status: retained normal-WebGL Water surface overhaul.

### What changed

- Dense exact Water now receives a shallow reflected-sky lobe immediately
  below its free surface. The existing vertical optical-depth plane confines
  the response to real Water, while the existing material-volume tile admits
  broad irregular islands and gently varies their depth.
- Reflection islands turn toward a desaturated sky colour through available
  HDR headroom. They change RGB only: liquid support, alpha, holes, contacts,
  other liquid species, Canvas, compact true 8×, and simulation state are
  unchanged.
- Several weaker or uniform-band experiments were discarded. A continuous
  depth band became a milky cyan cap when made visible; a low-strength folded
  band and a wide-surface-only lobe disappeared at fit view. None of those
  rejected variants remain in source.

### Visual decision

- Keep the sparse volume-warped islands. At fit view they establish a clear
  horizontal surface plane and glass-like reflected sky without filling the
  Water body with milk or reading as foam. The lower edge varies slowly rather
  than forming one ruler-straight stripe.
- An independent visual pass reached the same keep decision and specifically
  judged the bright regions as reflected sky confined to the free surface.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- A fresh 2× Water Visual Lab capture completed on WebGL with HDR active, zero
  browser errors, and unchanged semantic, liquid-field, and framebuffer-alpha
  support. The retained full frame is
  `/tmp/anifor-water-sky-islands-v1/b.png`; the old/new magnified comparison is
  `/tmp/anifor-water-sky-islands-v1-compare.png` (old above, retained below).
- A separate 4× showcase glance reached the built renderer but the loaded
  software GPU timed out before returning its framebuffer; it produced no
  visual rejection and left no Chrome process behind.

### Next visual work

1. Give settled bulk powder a broad shoulder-to-core depth split without
   erasing its mineral grains, thin columns, or authored holes.
2. Carry the reflected-sky vocabulary into curved moving-water crests and
   smaller droplets without creating a universal white rim.
3. Continue translucent, metallic, organic, and granular family optics before
   isolated exact-element decoration.

## 2026-08-15 — settled-powder shoulder and compacted core

Status: retained Smooth-powder bulk-depth refinement.

### What changed

- Settled Smooth powder now receives a broad upper/middle shoulder and a quiet
  compacted-core shadow derived from the already-resolved powder body depth.
  This adds a heap-scale light transition after mineral grain and shared
  material lighting have been composed.
- The established cinematic-body proof remains the owner. Local and square
  Grains references, moving or sparse powder, holes, narrow columns, walls,
  contacts, reconstructed support, alpha, and simulation state do not receive
  the new grade.
- The retained tuning is about 1.5× stronger than the first experiment. The
  first version was natural but barely legible at full-atlas scale; the final
  one separates shoulder and core without turning either into a visible band.

### Visual decision

- Keep the strengthened version. Large Sand and Clay bodies now carry a more
  credible deeper lower mass while retaining their granular colour variation,
  sharp fine features, and existing curved silhouette.
- An independent powder-focused pass confirmed that grain remains fully
  legible and the depth transition is smooth and unbanded.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- A fresh 2× Powder style atlas completed on WebGL with HDR active and zero
  browser errors. Smooth is `/tmp/anifor-powder-depth-shoulder-v2/off.png`;
  the magnified old/new comparison is
  `/tmp/anifor-powder-depth-shoulder-v2-compare.png` (old above, retained
  below).
- Local and Grains captures were unchanged while only Smooth rotated, matching
  the intended visual scope. No Chrome process remained after capture.

### Next visual work

1. Extend bulk depth to irregular settled powder scenes and check it while a
   pile is forming, without letting the grade flicker on moving fragments.
2. Improve solid and translucent family response—glass, ceramic, metal, and
   organic tissue—using broad material-scale light before exact elements.
3. Revisit moving-water crest reflection with the retained sparse-island
   vocabulary instead of a universal white or cyan edge.

## 2026-08-15 — fired Ceramic volume and Water receiver caustics

Status: retained normal-WebGL material-lighting overhaul.

### What changed

- Hot Ceramic now concentrates blackbody response in a depth-weighted fired
  core, while the existing pocket remains a cooler rim. Cool Ceramic retains
  its chalky matte body instead of inheriting a universal glossy lift.
- Exact Water now projects a short, broken cyan light field onto dense matter
  immediately downstream of the pool. Three Water-owned samples define the
  receiving depth; the shared smooth volume carrier breaks the projection into
  connected optical patches. Receiver alpha and silhouette remain unchanged.
- A proposed PLNT canopy macro grade was visually rejected and removed: it
  preserved texture but read mainly as a green brightness shift, not a real
  improvement in canopy volume.

### Visual decision

- Keep the Ceramic core/rim exchange. Increasing temperature now reads as
  internal fired heat rather than a sequence of flat orange slabs.
- Keep the softened Water receiver projection. In the Water-over-Metal scene,
  the light resolves as cool refracted patches inside the Metal instead of
  foam, a hard contact outline, or a body-wide cyan wash.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The Ceramic comparison is
  `/tmp/anifor-ceramic-thermal-compare.png` (before left, retained right).
- The receiver comparison is
  `/tmp/anifor-water-receiver-caustics-v4-zoom-compare.png` (before left,
  retained right), with the full retained scene at
  `/tmp/anifor-water-receiver-caustics-after-v4.png`.
- Two independent visual passes returned KEEP. No project-owned Chrome process
  remained after capture.

### Next visual work

1. Exercise receiver caustics in irregular water-over-powder and sloped-solid
   scenes, then tune direction and reach without turning contacts into rims.
2. Give PLNT a genuinely directional broad canopy turn; do not revive the
   rejected macro-brightness grade.
3. Integrate source light and flow-aligned billows in an irregular gas plume.

## 2026-08-15 — separated gas volume lobes and advected source light

Status: retained normal-WebGL participating-gas refinement.

### What changed

- The broad participating-gas phase now has disjoint positive and negative
  lobes. Neutral areas no longer receive a simultaneous key and pocket, so a
  connected cloud turns from one lit shoulder into an opposing recessed belly
  instead of filling toward a padded midtone.
- The long-range source-light volume window now travels in the same coherent
  velocity frame as the gas billow. Still or incoherent gas remains
  world-anchored; moving gas carries its illuminated folds through the plume.
- Both changes reuse the existing atmosphere, motion, emission-transport, and
  smooth volume carriers. Gas support, alpha, holes, sparse particles, Canvas,
  and compact true 8× presentation are unchanged.

### Visual decision

- Keep the separated gas lobes. CleanGas gains a clearer broad interior roll,
  while Smoke remains soft and connected rather than breaking into blobs.
- Keep the advected source-light frame. The moving-gas scene retains soft
  cloud structure and coherent source-coloured windows without a stationary
  texture overlay.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The static gas comparison is
  `/tmp/anifor-gas-participating-compare.png` (before left, retained right).
- The moving source-lit frame is
  `/tmp/anifor-gas-source-motion-after.png`.
- An independent gas-focused visual pass returned KEEP. No project-owned
  Chrome process remained after capture.

### Next visual work

1. Replace PLNT's flat canopy read with a directional broad crown/pocket while
   preserving the existing lamina, pigment, and lifecycle detail.
2. Exercise source-lit gas in a less rectangular, naturally evolving plume.
3. Continue broader translucent and metallic family lighting before isolated
   element decoration.

## 2026-08-15 — moving-Water curved environment lens

Status: retained normal-WebGL moving-surface refraction.

### What changed

- Exact moving Water now bends the existing private environment layer along
  its proven air-facing contour. The warp combines the surface normal,
  tangent, native flow direction, and a signed travelling fold, so a crest
  behaves like a curved lens rather than receiving another cyan highlight.
- The refracted environment is applied after the established surface
  transport and only to the moving Water colour. The existing liquid shape,
  contact handling, scene alpha, and simulation remain unchanged.
- Two attempts to turn PLNT with its current local canopy fold were rejected
  before checkpointing. Both preserved detail but were too subtle at normal
  size; a future PLNT pass needs a stronger broad-form lighting construction,
  not larger coefficients on the same mottled finish.

### Visual decision

- Keep the travelling Water lens. On the curved moving-water scene, the raised
  mound has a clearer lit shoulder and deeper body read without a fixed stripe
  or universal rim. The ordinary moving-water atlas remains clean and avoids
  visible sinusoidal banding.
- An independent visual pass returned KEEP on the geometry-appropriate curved
  fixture after rejecting the quieter first implementation.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The broad moving-water comparison is
  `/tmp/anifor-water-refraction-compare-v2.png`; the curved-surface comparison
  is `/tmp/anifor-water-curved-lens-compare.png`, with the magnified body at
  `/tmp/anifor-water-curved-lens-crop-compare.png` (before above/left,
  retained after below/right).
- All captures used WebGL at 2×. No strict visual hash or historical baseline
  was used to make the aesthetic decision.

### Next visual work

1. Build a visibly directional PLNT canopy light from broad botanical form,
   while retaining the existing lamina and pigment detail.
2. Give translucent and reflective solids a clearer material-scale response,
   especially Glass and mixed Metal/Water contacts.
3. Exercise the retained gas source-light transport in a naturally irregular
   plume rather than only an atlas-shaped body.

## 2026-08-15 — signed sky/ground reflection for metallic bodies

Status: retained normal-WebGL MetallicRigid environment roll.

### What changed

- METL, BMTL, GOLD, IRON, PTNM, and TTAN now share a broad reflected-world
  turn after their existing material lighting: cool sky-facing planes advance,
  while the opposing ground-facing planes become warmer and slightly recessed.
- The response is signed rather than a general gloss/exposure lift. It follows
  the existing solid normal, relief, Fresnel, body depth, and pigment identity;
  holes, contacts, thin structures, walls, alpha, and support are untouched.
- Two quieter tunings were rejected. The retained third tuning is the first to
  read as two reflected planes at fit view, and it stops before the cool band
  becomes a painted blue decal.

### Visual decision

- Keep v3. Cool blue-silver faces and complementary warm pockets give the six
  metal bodies a clearer reflective mass, while Gold remains recognizably gold
  and the grey alloys remain distinct from one another.
- An independent visual pass returned KEEP and specifically advised against
  increasing the amplitude further.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The retained comparison is
  `/tmp/anifor-metal-environment-compare-v3.png`; the larger material crop is
  `/tmp/anifor-metal-environment-crop-compare-v3.png` (before above/left,
  retained after below/right).
- The comparison used the six-card multi-metal WebGL atlas at 2×. Aesthetic
  preference, not an exact visual hash, selected the checkpoint.

### Next visual work

1. Build the PLNT canopy turn from broad exact-species form rather than the
   existing local mottled foliage signals.
2. Explore true Glass backdrop transmission in the HDR compositor, using the
   render-optics atlas to distinguish it from Metal, Wax, and Ceramic.
3. Exercise gas lighting and absorption in a naturally irregular moving plume.

## 2026-08-15 — broad-form PLNT canopy lighting

Status: retained normal-WebGL botanical volume refinement.

### What changed

- Large PLNT bodies now use their continuous solid-distance dome and a
  low-frequency 20-cell distance-field slope for the final canopy light turn.
  A soft upper/source-facing crown opposes a recessed canopy pocket, while the
  established lamina, pigment, hierarchy, and lifecycle detail remains layered
  through the broad form.
- Smooth current-depth support prevents the effect from reaching thin stems,
  isolated particles, shallow structures, or empty space. Four filtered depth
  reads replace the rejected binary owner mask and keep the construction tied
  to the actual broad body.
- Earlier versions were discarded: local-fold modulation was invisible at fit
  view, distant binary owner taps produced hard circular/rectangular masks, and
  a local-normal version produced diagonal stripes. A temporary false-colour
  probe was removed after confirming the intended crown/pocket orientation.

### Visual decision

- Keep v5. The large botanical body finally reads as overlapping canopy mass
  with soft large-scale light and shadow rather than a flat mottled carpet.
  Detail stays legible, and adjacent Wood, contacts, holes, stems, and small
  material controls remain visually stable.
- An independent visual pass returned KEEP, identifying the retained lobes as
  canopy-scaled rather than mask-like or striped.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The retained full comparison is
  `/tmp/anifor-plnt-broad-form-compare-v5.png`; the enlarged canopy comparison
  is `/tmp/anifor-plnt-broad-form-crop-compare-v5.png` (before left, retained
  after right).
- The comparison used the large botanical-body WebGL fixture at 2×. The
  temporary diagnostic frame is `/tmp/anifor-plnt-broad-form-debug.png` and is
  not part of the retained renderer.

### Next visual work

1. Give Glass a real refracted backdrop in the HDR compositor, distinguishing
   it from the newly improved reflective Metal family.
2. Exercise participating gas light and absorption in a naturally irregular,
   moving plume rather than a rectangular atlas body.
3. Continue material-scale response for translucent crystals, Wax, and mixed
   liquid/solid contacts before returning to isolated element decoration.

## 2026-08-15 — curved backdrop lens for broad Glass

Status: retained normal-WebGL translucent-solid refinement.

### What changed

- Broad exact-Glass bodies now expose and bend the existing private optical
  backdrop. Low-frequency material volume produces an internal displacement,
  a second sample adds restrained colour dispersion, and the real Glass
  contour receives a cool Fresnel crown rather than another opaque highlight.
- The lens requires local and six-cell Glass support on both axes. Thin lines,
  isolated particles, nearby unlike-material contacts, and wall-backed Glass
  therefore retain their native presentation instead of becoming small lenses.
- The private optical layer omits only air-backed exact Glass. Co-located wall
  pixels remain available, so the wall checker survives behind the Glass while
  the composed scene keeps its original support and alpha.

### Visual decision

- Keep the contained lens. The material changes from pale cyan acrylic into a
  dark transparent pane with a displaced interior and layered cool edge, and
  remains clearly different from reflective Metal, soft Wax, and Ceramic.
- The dedicated scene retains both large panes, their hole and open notch, the
  one-cell line and isolated control, mixed-material contacts, and the visible
  wall-backed checker.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- The decisive scene is `/tmp/anifor-glass-body-lens-contained.png`; the
  before/after material crop is `/tmp/anifor-glass-lens-v2-compare.png`, and
  `/tmp/anifor-render-optics-glass-lens-v2.png` retains the full family board.
- The selection used WebGL at 2× and direct visual inspection. No historical
  image hash or exact visual baseline was used as an acceptance condition.

### Next visual work

1. Add a broad source-facing scattering shoulder to participating gas while
   retaining a deep core and rear-side extinction.
2. Exercise that light turn in a naturally irregular moving plume, not only a
   rectangular atlas body.
3. Continue material-scale response for translucent crystals, Wax, and mixed
   liquid/solid contacts.

## 2026-08-15 — broad source-facing participating-gas shoulder

Status: retained normal-WebGL volumetric-gas refinement.

### What changed

- Source-lit participating gas now compares atmosphere density across an
  18-cell span along the measured light-transport direction. That wide slope
  turns a meaningful portion of the cloud toward the source instead of tracing
  the local one-cell contour.
- The forward-scattering shoulder shares the existing transported source
  spectrum and advected low-frequency shaft lobe. Smoke receives a warm broad
  shoulder from the Fire side, while FOG reverses the turn toward its green
  source; the opposite side retains the established rear extinction.
- The atmosphere and exact scene remain the only support and alpha owners.
  Holes, open channels, contacts, walls, protected gases, and sparse controls
  receive no new silhouette or coverage.

### Visual decision

- Keep v4. It is the first version that reads as a broad lit volume at fit
  scale rather than an outline. Both cards preserve a darker middle and rear,
  and their existing internal billow remains visible through the new turn.
- Earlier local-normal versions were rejected after a false-colour diagnostic
  showed that they could only occupy the rim. The retained wide-density probe
  produces a real interior crescent without flattening the full card.
- An independent visual pass returned KEEP and advised against increasing the
  strength further, particularly for the already-open FOG shoulder.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- `/tmp/anifor-gas-forward-scatter-b-compare-v4.png` shows the inactive
  contribution on the left and retained v4 on the right; both use the real
  Volumetric/B selector. The moving-gas context is retained at
  `/tmp/anifor-gas-forward-scatter-motion-v4.png`.
- The rejected carrier diagnostic is
  `/tmp/anifor-gas-forward-scatter-debug.png`; it is not present in source.
  No exact image hash or historical baseline decided the result.

### Next visual work

1. Give Ice, Quartz, and related translucent crystals their own broad optical
   body response rather than merely inheriting smooth-solid lighting.
2. Strengthen Wax subsurface depth and edge transmission at material scale.
3. Improve mixed liquid/solid contact light and naturally irregular gas-plume
   staging before returning to isolated element decoration.

## 2026-08-15 — source-shaped candle-wax transmission

Status: retained normal-WebGL solid-WAX subsurface refinement.

### What changed

- Exact solid WAX now samples the existing long-range emission carrier and
  transmits its source colour through a bounded middle-depth band. Near a Fire
  source, the body gains a broad amber/ivory lobe instead of only receiving an
  opaque surface tint.
- Optical depth preserves the creamy surface and deepest pigment core. The
  established crystalline blooms and cooling lamellae remain visible through
  the transmitted band, while the transition region receives a restrained
  wavelength-selective pocket.
- MWAX stays on its liquid grammar. Walls, cavities, chimneys, isolated cells,
  contacts, support, alpha, physics, and the Canvas presentation are unchanged.

### Visual decision

- Keep the source-localized treatment. With Fire placed beside WAX, the lit
  shoulder carries well into the body and fades into its native creamy mass;
  the opposite half remains deeper and the material does not read as globally
  emissive or uniformly yellow plastic.
- The existing authored review emitters are deliberately remote and produce no
  transported field at the large WAX pane, so a temporary adjacent Fire strip
  was used only for the visual comparison and removed before checkpointing.
- An independent visual pass returned KEEP. It judged the broad transmission,
  retained lamellae, unchanged MWAX, and clean controls more valuable than the
  slightly abrupt inner falloff; the current strength should not be increased.

### Lightweight checks used

- `npm run build` completes after removing the temporary scene change and
  closes all 19 production resources.
- `/tmp/anifor-wax-adjacent-source-compare.png` shows the same temporary scene
  with the new contribution disabled on the left and active on the right.
  `/tmp/anifor-wax-subsurface-debug.png` was a rejected carrier diagnostic and
  is not present in the retained renderer.
- The decision used WebGL at 2× and direct visual inspection, not exact visual
  hashes or a historical baseline.

### Next visual work

1. Add buried broad crystallographic planes for Ice, QRTZ, DRIC, NICE, and
   RIME while keeping Glass smooth and powder Quartz untouched.
2. Improve mixed liquid/solid contact light and naturally irregular gas-plume
   staging.
3. Continue source, radioactive, plant-growth, and energy-material VFX once
   these material-scale optical families are visually distinct.

## 2026-08-15 — buried translucent-crystal facets

Status: retained normal-WebGL crystalline body overhaul.

### What changed

- Thick Ice, QRTZ, DRIC, NICE, and RIME bodies now derive two broad buried
  planes from four oblique probes of their existing exact-species solid-depth
  field. The planes follow the material geometry rather than a repeating
  screen-space stripe or painted tile.
- Ice/NICE receive cold translucent shelves and blue rear depth; DRIC/RIME use
  a quieter milky treatment; solid QRTZ receives crossed cyan and restrained
  rose transmission. The older shared sinusoidal prism is faded only where the
  new deep-body response is present.
- Glass remains on its smooth lens/refraction grammar and powder Quartz remains
  outside the exact material set. The change is RGB-only: contours, alpha,
  holes, notches, seams, thin structures, isolated cells, contacts, support,
  and physics are unchanged.

### Visual decision

- Keep the third tuning. At fit scale the large crystal bodies now carry
  coherent diagonal/medial planes instead of reading solely as flat textured
  cards. The companion Ice/Glass scene clearly separates faceted frozen mass
  from the smooth dark Glass lens.
- The first tuning established the non-periodic geometry but was too quiet;
  the second increased the body turn; the retained third tuning restores a
  brighter transmitted core and adds a restrained opposing rose plane to QRTZ
  without washing out its native green/cyan identity.
- Large cavities and open notches remain black, and the one-cell/fine controls
  retain their previous shell treatment rather than acquiring a fake broad
  facet.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- `/tmp/anifor-crystalline-buried-facets-before.png` and
  `/tmp/anifor-crystalline-buried-facets-v3.png` are the direct 2x WebGL
  before/after views. `/tmp/anifor-translucent-edge-crystal-v1.png` is the
  Ice-versus-Glass companion view used to check material separation.
- The decision used direct image inspection and one independent aesthetic pass;
  no exact visual hash, baseline, profiler, or broad test gate was added.

### Next visual work

1. Recompose molten Lava after thermal/emission lighting so broad convection,
   bright fissures, and cooled pockets survive the final HDR grade.
2. Improve mixed liquid/solid contact light and naturally irregular plume
   staging.
3. Continue high-payoff source, radioactive, plant-growth, and energy-material
   VFX after the major phase families read distinctly at fit scale.

## 2026-08-15 — convecting molten Lava body

Status: retained normal-WebGL Lava visual overhaul.

### What changed

- Dense exact Lava now uses one filtered sample from the existing material-
  volume tile to form slowly advected mantle cells, sparse incandescent
  fissures, and broad burgundy cooled pockets. Native velocity orients and
  carries the pattern while the existing liquid field remains the sole owner
  of mass, silhouette, surface lip, and alpha.
- The bright zero-crossing channel is deliberately narrow and paired with a
  soft dark shoulder. Broad positive folds receive only a restrained red-orange
  lift, while negative folds remove enough radiance to keep a thick recessed
  mass visible after the later blackbody/emission grade.
- Lava ancestry colour remains underneath the common convection. Authored
  holes/notches, thin lines, isolated particles, Water/Sand/cooled controls,
  walls, contacts, and physics are unchanged. The sampler-free compact 8x path
  remains independent and was not made heavier by this normal-scale pass.

### Visual decision

- Keep v4. The original fixture rendered six almost uniform orange slabs; the
  retained view reads as molten bodies with sparse hot channels embedded in a
  deeper red/brown mantle. It no longer has v2's broad mustard camouflage.
- v3 narrowed the hot carrier and added cooled shoulders; v4 further removed
  broad yellow lift, made the fissures hotter but less common, and deepened the
  complementary pockets. An independent visual pass returned KEEP and advised
  against increasing either the fissures or crust darkness further.
- The first post-emission experiment referenced liquid-local shader values
  outside their scope and produced a blank frame. It was discarded completely;
  the retained implementation lives inside the established Lava branch and
  compiled/rendered successfully at both 2x and 4x.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- `/tmp/anifor-lava-body-before.png` and `/tmp/anifor-lava-body-v4.png` are the
  direct 2x WebGL before/after views; `/tmp/anifor-lava-body-v4-4x.png` confirms
  the same retained look on the normal 4x WebGL path.
- The 4x screenshot completed before a bounded headless teardown query timed
  out; a process scan immediately afterward found no remaining Chrome process.
  No profiler, exact image hash, historical baseline, or broad test gate was
  added.

### Next visual work

1. Improve mixed liquid/solid contact light and meniscus depth without making
   boundaries flicker as particles move.
2. Give source/radioactive/energy families equally broad material-scale VFX
   where their current presentation remains icon-like or flat.
3. Revisit compact 8x style parity only through its existing lightweight path,
   without importing the normal shader's volume sampler.

## 2026-08-15 — capillary contacts, magnetic Plasma, and configured-source apertures

Status: retained normal-WebGL visual-overhaul checkpoint.

### What changed

- Liquid/solid contacts now share one continuous Hermite-derived capillary
  carrier through the base meniscus and nested Water/Metal response. The old
  2x/4x categorical floors, including the unconditional E78 floor, no longer
  repaint a smooth contact as a rigid cyan strip. Density separates a quiet
  outer lip, inset reflective shoulder, and submerged absorption apron.
- Dense Plasma now samples the existing material-volume tile to bend two slow
  magnetic sheets through broad indigo pockets. Cyan and magenta folds meet in
  sparse white-hot crossings, while the authored hole and sparse carriers keep
  their established topology and generic Energy appearance.
- Volumetric/B configured sources now render a recessed target-coloured
  aperture fed by a dark segmented conduit. Powered sources add warm bus rails
  and CRAY gains a short output rail, so CLNE/BCLN/PCLN/PBCN/CONV/CRAY read as
  target-configured devices rather than flat bodies with a tiny badge.

### Visual decision

- Keep the narrowed Plasma v2. The original was an almost uniform lavender
  slab; the retained body has visible depth and magnetic structure at fit view.
  A broader first tuning was rejected because its pale network read as marble
  or painted lightning rather than contained luminous matter.
- Keep source-aperture v2. Target colour is now legible across the complete
  source/target board, and the dark well gives the ring physical depth without
  changing the source silhouette. Dark brown owners remain deliberately more
  subdued than yellow and green bodies.
- Keep the capillary-carrier cleanup as a restrained contact refinement. It is
  not intended to create a glowing separator; its main visible benefit is a
  less cyan, less categorical high-resolution seam.
- A common radiogenic lobe for PLUT/POLO/SING/URAN/WARP was visually rejected
  and removed. It looked like the same spotlight stamped onto unrelated
  materials, especially over SING. Radioactive owners need distinct structures
  rather than another shared family wash.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- Plasma: `/tmp/anifor-plasma-before.png`,
  `/tmp/anifor-plasma-folds-v2.png`, and
  `/tmp/anifor-plasma-folds-v2-4x.png`.
- Configured sources: `/tmp/anifor-source-target-before.png`,
  `/tmp/anifor-source-target-device-v2.png`, and
  `/tmp/anifor-source-target-device-v2-4x.png`.
- Liquid contact: `/tmp/anifor-meniscus-before.png` and
  `/tmp/anifor-meniscus-capillary-v2.png`.
- Selection used direct WebGL inspection and independent aesthetic passes; no
  profiler, exact visual hash, baseline promotion, or broad unit-test gate was
  used.

### Next visual work

1. Give radioactive owners distinct material grammar: ore plates and veins for
   PLUT/POLO/URAN, inward distortion and a cold rim for SING, and phase shear
   for WARP. Do not reuse one common bright lobe.
2. Extend the energy overhaul from Plasma to NEUT/PHOT/ELEC/PROT/BRAY with
   translucent cores, coherent rails, and motion-aligned filaments.
3. Deepen meniscus geometry through a real curvature/depth treatment instead
   of increasing contact-line brightness.

## 2026-08-15 — radioactive matter, carrier tracks, and liquid-metal reflection

Status: retained normal-WebGL cross-phase visual-overhaul checkpoint.

### What changed

- PLUT, POLO, and URAN no longer share one generic radioactive spotlight.
  Settled Smooth PLUT uses broad olive plates with irregular cleavage, POLO
  uses rounded toxic nodules and decay pits, and URAN uses warped interrupted
  metallic laminae. The treatment stays inside dense material bodies, leaving
  sparse particles and the powder contour intact.
- Enhanced-look SING drops the repeating blue target-ring grid. Compact bodies
  become an absorptive charcoal void crossed by one bent cold-glass caustic;
  isolated grains remain plain. WARP keeps its soft gas silhouette but gains a
  slow cyan/violet phase split and dark seam through exact carriers and the
  propagated atmosphere body.
- ELEC, NEUT, PHOT, PROT, and BRAY now use motion-aware periodic carrier lanes
  instead of only small cell badges. Their signatures are respectively a
  forked ion filament, cold scattering track, prismatic photon sheet, warm
  charged rail, and gold-magenta reaction beam. Each has a restrained broad
  shoulder so the line belongs to a luminous volume rather than looking drawn
  over it. Native photon-map composition also receives a spectrum-driven
  caustic inside its existing alpha.
- Metallic RenderOptics liquids now read as heavy liquid metal: a desaturated
  graphite core carries a coherent cool-to-warm environment ribbon and an
  opposing dark pocket. It uses the existing liquid normal, optical depth,
  volume noise, and reflection state; liquid support and alpha are unchanged.

### Visual decision

- Keep the distinct ore structures. POLO's decay clusters and URAN's laminae
  are immediately legible at fit view, while PLUT remains intentionally denser
  and quieter. The rejected common radiogenic lobe has not returned.
- Keep the simplified SING and the stronger WARP. SING now reads as a dark
  optical sink with one internal curve instead of an icon grid; WARP remains
  dark gas but carries a visible violet/cyan body turn at both 2x and 4x.
- Keep the carrier family. The no-HUD atlas makes the five different actions
  visible without turning the full energy body into a repeated neon texture.
  PHOT uses the most restrained semantic-body split because its native photon
  plane supplies the stronger spectral caustic in real scenes.
- Keep the metallic-liquid experiment. Mercury changes from translucent grey
  gel/striping into a weightier reflective pool with irregular studio-light
  response, while Water, Oil, Acid, Lava, LN2, and MWAX retain their separate
  optical languages.

### Lightweight checks used

- `npm run build` completes and closes all 19 production resources.
- `/tmp/anifor-energy-radioactive-current.png` is the original reference;
  `/tmp/anifor-energy-overhaul-final-2x.png` is the retained 2x WebGL atlas and
  `/tmp/anifor-energy-overhaul-final-4x.png` confirms the combined normal 4x
  path. `/tmp/anifor-render-optics-metal-liquid-v1.png` is the direct 2x
  metallic-liquid view.
- The 4x screenshot completed successfully. Its bounded host teardown query
  timed out afterward; an immediate process scan found no Chrome residue.
  Selection used direct image inspection, not exact hashes, baselines,
  profiling, or broad unit-test gates.

### Next visual work

1. Give GRVT/AMTR and native LIGH/THDR equally coherent field-scale visuals,
   including local illumination of nearby matter where the current emission
   field already provides a usable source carrier.
2. Deepen screen-space liquid curvature/refraction and underwater caustics so
   Water and Oil affect the scene behind and beneath them, not only their own
   surface colour.
3. Add cheap contact/AO depth under powder heaps and at solid/wall creases,
   then return to growing plants and other organic material bodies.

## 2026-08-15 — field anomalies, discharge volumes, and focused liquid lenses

Status: retained visual-first normal-WebGL checkpoint.

### What changed

- GRVT's enhanced look no longer repeats the legacy target-ring decal. A broad
  moving cyan/lime shear, asymmetric compression key, and dark inward throat
  now read across its existing energy body. Its ordinary role bullseye is also
  suppressed in this look so one field-scale lens owns the material.
- AMTR now has a dark-violet annihilation body with opposed cyan and magenta
  pressure faces. The treatment runs through both propagated gas support and
  exact carriers, making a compact AMTR cloud visibly distinct from neutral
  Smoke without changing gas opacity or support.
- Dense LIGH and settled Smooth THDR now carry continuous curved discharge
  lanes instead of a grid of per-cell identity marks. LIGH uses a cooler blue
  body with a white braided spine; THDR uses a warmer amber body with a blue
  pressure flank. Thin stems, branches, gaps, contacts, and isolated sparks
  keep their sharp native presentation.
- The shared material finish gains phase-local buried-mass shading. Quiet deep
  powder, solid, and liquid interiors settle into a restrained cool ambient
  pocket without deriving a dark outline from material-contact flags.
- Water/Oil and their Distilled/Diesel siblings now focus a co-located native
  wall through restrained spectral displacement, a curved caustic ridge, and
  opposing depth absorption. The operation modifies only the analytic backdrop
  colour; liquid alpha and boundary ownership remain unchanged.

### Visual decision

- Keep the GRVT/AMTR split. The energy/radioactive board now shows GRVT as a
  cleaner green field lens and AMTR as a visibly folded cyan/magenta dark gas,
  rather than two more tiled badges.
- Keep the discharge-volume treatment. Several early tunings were rejected as
  effectively flat because the source material was already near white and the
  negative range was capped too tightly. The retained look lowers the dense
  body, preserves luminous spines, and is readable at fit view without painting
  over the protected thin controls.
- Keep the strengthened liquid lens. In the direct wall-coexistence comparison,
  the enabled Water-like control develops a larger cyan focus network and the
  Oil-like control gains broader warm folds; the disabled view remains a flat
  checker. This is deliberately conditional on a visible backdrop rather than
  adding fake refraction to an empty black scene.
- Keep the ambient pocket as a quiet scene-depth layer. It does not replace
  material texture, highlights, or contact treatments and therefore avoids the
  uniform muddy wash rejected in earlier visual experiments.

### Lightweight visual checks used

- `npm run build` completes and closes all 19 production resources.
- `/tmp/anifor-anomalous-carriers-kept.png` is the retained GRVT/AMTR board;
  its final tuning deepens GRVT's throat and removes AMTR's milky centre.
- `/tmp/anifor-electric-discharge-volume-kept.png` is the retained LIGH/THDR
  body-and-topology board.
- `/tmp/anifor-liquid-wall-lens-off.png` and
  `/tmp/anifor-liquid-wall-lens-v2.png` are the direct disabled/enabled liquid
  backdrop comparison.
- `/tmp/anifor-render-optics-depth-lens-v1.png` is the shared material-depth
  matrix. Selection was made from screenshots and aesthetic inspection; no
  exact visual hash, promotion gate, profiler, or broad unit-test run was used.

### Next visual work

1. Push the common scene-light layer: stronger source-shaped illumination,
   soft cast shadows, and coloured bounce on nearby powder, liquid, and solid
   bodies using the already-live emission field.
2. Extend liquid refraction beyond native-wall coexistence with an inexpensive
   optical scene layer, then add broader underwater caustic motion without
   blurring the liquid boundary.
3. Deepen gas volume separation with self-shadowed cores, brighter forward
   scatter, and larger light shafts; then return to growing plants and organic
   material morphology.

## 2026-08-15 — scene light, multi-scale bloom, liquid lensing, and gas depth

Status: retained visual-overhaul checkpoint for canonical normal WebGL.

### What changed

- The HDR compositor now carries two bloom scales. The established half-scale
  lobe keeps a sharp luminous core, while a second wider lobe produces a soft
  outer glow with a logical-cell footprint that stays consistent from 1x to
  4x. Fire, Plasma, LIGH, and THDR receive a stronger semantic extraction, and
  bright energy can illuminate nearby empty air without changing simulation
  material support.
- Shared material lighting now retains the dominant transported source hue.
  Powder, liquid, solid, and gas receivers gain localized coloured bounce on
  source-facing shells and cavities plus a deeper far-side penumbra; broad
  interiors remain textured instead of receiving a uniform brightness wash.
- Participating gas now pairs its source-facing shoulder with a source-shaped
  interior self-shadow. Warm/cool shafts turn through a cloud body rather than
  reading as a flat colour decal, with no change to gas silhouette or alpha.
- Deep Water, Oil, and Acid use the existing private non-liquid backdrop as a
  stronger scene lens. Connected full bodies bend and split the scene farther,
  admit more focused refracted colour, and concentrate the existing caustic;
  shallow shores retain the restrained earlier response and sharp boundary.
- Moving Water receives a cool crest glint on the existing velocity-gated foam
  islands. Calm pools, submerged body, side walls, and disconnected static
  droplets do not gain a generic white outline.

### Visual decision

- Keep the two-scale bloom and current radius. Energy/radioactive carriers read
  as luminous at fit view, Plasma retains its internal folds, and ordinary
  powder/liquid texture remains crisp. The outer lobe was deliberately stopped
  before tiny sparks dissolved into haze.
- Keep the deep liquid lens. The RenderOptics matrix shows a clearer glassy
  depth and chromatic scene displacement in Water, Oil, Acid, and pale optical
  bodies without softening their silhouettes or powder controls.
- Keep the gas depth and localized receiver-light direction as shared scene
  vocabulary. Their fit-view contribution is quieter than the bloom/lens but
  adds coherent warm/cool turning and avoids the rejected airbrushed interior.
- Keep the Water crest refinement. The regular checker visible through one
  authored motion fixture is its deliberate non-liquid refraction backdrop,
  not foam topology manufactured by the new crest light.

### Lightweight visual checks used

- `npm run build` completes and closes all 19 production resources.
- `/tmp/anifor-energy-radioactive-multiscale-bloom-v1.png` and
  `/tmp/anifor-plasma-multiscale-bloom-v3.png` are the retained 2x bloom views;
  `/tmp/anifor-material-lighting-multiscale-bloom-v1.png` is the non-emissive
  sharpness control.
- `/tmp/anifor-render-optics-deep-lens-v2.png`,
  `/tmp/anifor-water-motion-crest-v1.png`,
  `/tmp/anifor-gas-self-shadow-v2.png`, and
  `/tmp/anifor-powder-light-localized-bounce-v2.png` are the retained direct
  WebGL material views. Selection used fit-view inspection and one independent
  aesthetic pass, not hashes, accepted baselines, profiling, or broad tests.

### Next visual work

1. Add scene-wide source light to more emissive/radioactive families and give
   receiver bodies clearer contact shadows without flattening their pigment.
2. Extend liquid optics into broader underwater caustic projection and improve
   moving foam/spray breakup in ordinary simulation scenes.
3. Continue gas volume work with larger density-owned shafts, then return to
   plant growth silhouettes and organic translucency.

## 2026-08-17 — denser gas billow separation

Status: retained normal-WebGL B-only refinement.

### What changed

- The established dense-atmosphere billow uses a stronger, still bounded
  positive/negative lobe split. Its broad source-shaped windows now carry a
  clearer cool transmission and its opposed pockets a deeper absorption,
  instead of raising the entire cloud body.
- The response remains inside the existing `uGasBodyVfx` and material-lighting
  B window. It reuses the live density, optical depth, billow, curvature, and
  material-volume inputs; gas support, alpha, geometry, texture ownership,
  Canvas2D, OFF/A, and compact true-8x are unchanged.

### Visual decision

- Keep the stronger separation. In the direct fit-scale gas board, the large
  neutral cloud controls gain recognizable lit windows and recessed pockets,
  while the coloured Oxygen/Noble controls preserve their hue and small
  controls remain crisp. The rejected intermediate tuning was visibly too
  quiet to overcome the panel-like read.

### Lightweight visual checks used

- `npm run build` completes and closes all 19 production resources.
- `/tmp/anifor-gas-current.png`, `/tmp/anifor-gas-volume-separation-v1.png`,
  and the retained `/tmp/anifor-gas-volume-separation-v2.png` are direct 2x
  normal-WebGL captures. The decision is fit-view inspection, not a visual
  hash, baseline, profiler result, or broad unit-test gate.

### Next visual work

1. Add larger density-owned shafts to source-lit gas without expanding the
   cloud silhouette or producing a uniform dark veil.
2. Extend the existing liquid scene lens into broader underwater caustic
   projection, then improve moving foam/spray breakup.
3. Return to material presentation for organic translucency and plant-growth
   silhouettes after those common fluid-volume layers are established.

## 2026-08-17 — localized transported-source illumination

Status: retained normal-WebGL B-only material-lighting refinement.

### What changed

- The common profile irradiance helper now concentrates chromatic bounce on a
  genuinely source-facing receiver shoulder and reduces its lateral cavity
  share. Positive external incidence carries a stronger bounded transport
  lobe, including the established profile-admitted transmissive solid path.
- This remains shared phase/profile arithmetic over the existing emission,
  body, depth, slope, and incidence proofs. It adds no light source, sampler,
  field, pass, allocation, alpha, support, topology, or contact behavior;
  Canvas2D, OFF/A, and compact true-8x remain outside this B-only response.

### Visual decision

- Keep the localized tuning. The source-opposed powder board now presents a
  coherent warm-left/cool-right cue across broad granular bodies and preserves
  the water-backed inset, rather than lifting the whole slab. The ordinary
  receiver board remains restrained, which is intentional for scenes without
  strong source incidence.

### Lightweight visual checks used

- `npm run build` completes and closes all 19 production resources.
- `/tmp/anifor-receiver-current.png`,
  `/tmp/anifor-receiver-localized-light-v1.png`, and the retained
  `/tmp/anifor-powder-light-localized-v1.png` are direct 2x normal-WebGL
  captures. Selection is visual inspection, not a hash, baseline, profiler,
  or broad unit-test gate.

### Next visual work

1. Add larger density-owned source shafts within gas bodies without expanding
   their silhouette or lifting neutral clouds uniformly.
2. Refine organic translucency and plant-growth silhouettes after the common
   lighting vocabulary is sufficiently stable.
3. Revisit a WebGPU compute prototype only after the WebGL visual stack is
   stable enough to preserve as a quality fallback.

## 2026-08-17 — visual-roadmap coverage audit

Status: phases 1–3 are materially implemented in the canonical WebGL/HDR
renderer; Phase 4 remains an engineering exploration rather than a release
requirement.

### Confirmed current coverage

- Phase 1: the normal renderer uses an HDR compositor with bloom/tonemap,
  semantic emission transport, temperature-driven blackbody radiance, material
  normals/depth lighting, and source-local receiver transport. The Ceramic and
  electric-discharge boards visibly exercise the thermal/HDR response.
- Phase 2: connected liquid bodies carry depth, meniscus, reflection,
  refraction, internal caustic filaments, foam/spray cues, and backdrop lensing;
  connected gas carries density-owned billows, transmitted middles, self-shadow,
  motion-shaped noise, and long-range source shafts. The Water-motion, Gas,
  Botanical, and Electric-discharge WebGL boards show these effects without
  changing their simulation silhouettes.
- Phase 3: class profiles supply key/fill/pigment/transmission/roughness/
  interior-scatter responses; transmissive solid, powder bulk, organic/wax,
  botanical lifecycle, and material-volume paths already use that vocabulary.
  The botanical board confirms hydrated plant canopy variation and shallow
  subsurface response while preserving thin stems, holes, and growing topology.

### Remaining deliberate work

- A Pixi WebGPU/compute prototype and an adaptive GPU-time quality governor
  remain Phase 4 experiments. WebGL/HDR stays the canonical look and Canvas2D
  remains the permissive fallback until a prototype can preserve that visual
  vocabulary and robustly fall back on unsupported devices.
- Future aesthetic work should favour scene-specific composition and material
  tuning over another generic body layer; the common lighting, liquid, gas,
  blackbody, and organic seams are now populated and visually inspected.

### Lightweight visual checks used

- `/tmp/anifor-water-motion-current.png`, `/tmp/anifor-gas-volume-separation-v2.png`,
  `/tmp/anifor-ceramic-current.png`, `/tmp/anifor-electric-discharge-current.png`,
  and `/tmp/anifor-botanical-current.png` are direct 2x normal-WebGL review
  captures. They are current visual review artifacts, not baselines or gates.
- Manual Pages run `32015045574` built, deployed, and completed live
  verification successfully for `9cf36f2`.

## 2026-08-17 — Phase 4 WebGPU capability experiment

Status: isolated experiment at `experiment/webgpu-presentation-probe` commit
`5c1ee04`; the canonical production renderer remains WebGL/HDR.

- The experiment verifies adapter/device/offscreen-canvas presentation with one
  submitted WebGPU clear pass only when `?webgpuProbe=1` is requested. It never
  changes the live WebGL canvas or shader selection.
- Local SwiftShader reaches the probe but reports `adapter-unavailable`, so
  WebGPU cannot be a CI or fallback requirement in this environment. A real
  hardware browser is required before a WGSL/compute migration can be judged.
- The proposed adaptive quality governor remains intentionally pending. It
  should shed actual post-processing passes only from a measured GPU budget and
  must remain opt-in/observable; a CPU submission heuristic would be a hidden
  visual downgrade rather than reliable GPU adaptation.

## 2026-08-17 — Phase 4 adaptive HDR presentation governor

Status: implemented locally as an explicit normal-WebGL/HDR experiment; it is
not enabled for ordinary pages unless `?adaptiveQuality=1` is present.

- The governor reuses the existing `EXT_disjoint_timer_query_webgl2` elapsed-GPU
  path at a bounded 750 ms cadence. It refuses Canvas2D, HDR fallback, compact
  true-8x, fence latency, and CPU submission timing, so an unsupported driver
  remains at the complete established presentation rather than receiving a
  guessed downgrade.
- Its only possible response is presentation quality: `full` retains the
  established two-scale bloom, `reduced` keeps the crisp bloom core while
  dropping the wide halo, and `minimal` preserves the HDR material/tonemap
  composite while skipping bloom. Simulation, field construction, material
  shaders, alpha, support, topology, contacts, camera state, and Canvas2D are
  outside the governor.
- The canvas publishes the opted-in tier, timing source, and rolling GPU sample
  as `data-adaptive-presentation-*`. A static scene receives a nonblocking
  animation-frame query poll; unlike audit timing, the governor never calls
  `gl.finish()` to force a late result.
- Local production build completes with the exact 19-resource closure. The
  SwiftShader WebGL/HDR probe reports `quality=full`, `timing=gpu-query`, and a
  real returned sample (`15219.85 ms` for its software-rendered fixture). The
  conservative hysteresis therefore waits for sustained samples before
  reducing bloom; no ordinary screenshot changes merely because the feature
  was compiled.

### Delivery checkpoint

- Commit `597964f1090b612498ca4056472c9c2bc8f17a5e` was pushed to `main_codex`
  and manually deployed by GitHub Actions run `32016871717`. Its build restored
  the compiler cache and completed successfully; Pages deployment and the
  deployed revision/19-resource closure verification both passed. The optional
  hosted visual smoke was intentionally not selected for this delivery because
  the governor is inactive without its explicit query opt-in.

## 2026-08-17 — scene-local emission-light audit

Status: no duplicate active-light list was added because normal WebGL already
has a stronger scene-local transport implementation than a capped screen-space
light list would provide here.

- The normal 1x-4x presenter owns an opt-in long-range emission carrier that
  transports color and intensity through the existing low-resolution emission
  field, blocks it at native walls, and reconstructs a source direction from
  the transported gradient. It supplies material, liquid, wax, gas, and
  atmospheric receivers while leaving semantic emission cores, support, alpha,
  topology, and Canvas2D unchanged.
- That is the renderer's practical dynamic-light grid: it combines all nearby
  sources into a bounded, wall-aware field rather than maintaining an arbitrary
  16–32 source list that can pop as a source crosses a selection threshold.
  The current next visual opportunities are therefore composition tuning
  (gas shafts/broad organic forms) and hardware validation of the isolated
  WebGPU prototype, not a second local-light architecture.

## 2026-08-17 — occlusion and receiver-bounce review

Status: the safe AO portion of the roadmap is already present; a follow-up
coefficient experiment for receiver bounce was rejected after direct viewing.

- `applyMaterialAmbientGrounding` supplies phase/profile-governed RGB-only
  cavity, broad-mass, buried-body, and settled-Smooth-powder basin occlusion
  from existing owner depth/density/slope proofs. It excludes holes, thin and
  moving structures, contacts, Canvas2D, and compact true-8x. That fulfils the
  safe occupancy-field AO intent without manufacturing an unstable seam.
- Cross-owner contact AO remains deliberately deferred: current categorical
  seam bits cannot determine a stable owner or distinguish a rest contact from
  a moving/touching edge. Adding it now would violate the renderer's topology
  and contact guarantees.
- A tighter source-facing Powder bounce candidate was built and compared on
  the opposed-source 2x WebGL board (`/tmp/anifor-powder-light-localized-v2.png`)
  against the retained localized-light view. At normal fit scale it was
  indistinguishable, so the source was restored rather than retaining a hidden
  coefficient change. This remains a visual decision, not an image-hash gate.

## 2026-08-17 — submerged Water/native-wall optical treatment

Status: retained after direct normal-WebGL/HDR viewing. The Water fixture's
co-located native-wall control now reads as a submerged, low-contrast cyan
texture instead of a bright diagnostic checker, while remaining visibly native
wall-backed and leaving the open-water crest/body treatment unchanged.

- `liquidInteriorTransport` uses only already-bound wall, material-volume,
  semantic, and HDR inputs for this treatment. Before the continuous-liquid
  field deliberately excludes a co-located wall cell, exact Water attenuates
  that wall's source RGB with a broad material-volume variation. This is a
  colour-only presentation change: no field, support, alpha, topology, wall,
  contact, allocation, or target is changed.
- Production build passed with the exact 19-resource closure. A fresh 2x
  SwiftShader WebGL/HDR Water-motion capture was reviewed directly: the prior
  bright white/cyan lower-right checker became a dimmer, water-coloured
  submerged grid, while its outer geometry and the pale upper water crest
  remained readable. The capture is current visual evidence only, not a PNG
  baseline or a future gate.

### Delivery checkpoint

- Commit `fa22122` was pushed to `main_codex` and manually deployed by Actions
  run `32018498643`. Its cached build, Pages deployment, exact deployed
  revision, and 19-resource runtime-closure verification all passed. Optional
  hosted Visual Lab capture was deliberately not selected for this small
  direct-review checkpoint.

## 2026-08-17 — dense-gas lobe probe

Status: rejected after direct WebGL comparison; no renderer source is retained.

- The probe used the already-live, owner-safe atmosphere/material-mesoscale
  coherence and curvature values only for normal-B, dense connected gas. Sparse
  chains, support, alpha, contacts, Canvas2D, and other variants stayed on the
  established path. Its intention was to make the broad cloud light/shadow
  response more volumetric without adding a macro carrier or texture read.
- On the real 2x WebGL gas material-lighting scene, the broader curvature
  exposed rectangular dark panels in the cloud interiors. That is visually
  worse than the retained local billow response, so the exact source was
  restored. Future gas work needs a genuinely continuous dense-cloud signal,
  not another reinterpretation of the compact mesoscale field.

## 2026-08-17 — continuous dense-gas billow preservation

Status: retained after normal-WebGL/HDR comparison. Broad Smoke/Clean-gas
bodies now preserve their existing positive/negative billow relief deeper into
a truly coherent density core, giving the large clouds a clearer volumetric
lobe read without repeating the rejected rectangular response.

- The signal is not a new texture, macro carrier, or procedural tile. It is
  the existing half-resolution Gaussian atmosphere density: B admits the
  stronger interior billow only when both the centre and its existing cardinal
  mean prove dense coherent gas. Sparse chains, thin fringes, contacts,
  support, alpha, topology, Canvas2D, compact true-8x, and OFF/A retain their
  established paths.
- Three bounded direct 2x SwiftShader WebGL comparisons were inspected. The
  initial admission was too quiet; the selected strength retains the soft
  cloud silhouette while separating broad light and shadow lobes. It does not
  expose the compact-field rectangles seen in the rejected predecessor. The
  result is visual review evidence only, not an image-hash gate.
- Production build passed with the exact 19-resource closure.

### Delivery checkpoint

- Commit `53e7744` was pushed to `main_codex` and manually deployed in Actions
  run `32019715388`. Its cached build, Pages deployment, deployed revision, and
  exact 19-resource runtime-closure verification all passed. The optional
  hosted visual batch was intentionally not selected for this direct-review
  visual increment.

## 2026-08-17 — WebGPU compute-readiness scaffold

Status: implemented as an opt-in architectural probe; it does not select or
replace the canonical WebGL renderer.

- `?webgpuProbe=1` requests an adapter and device through the browser WebGPU
  API, immediately releases the transient device, and publishes one of
  `unavailable`, `no-adapter`, `ready`, or `device-error` through the existing
  renderer backend audit. It allocates no presentation surface and has no
  effect unless explicitly requested.
- A real isolated browser pass reported `webgpu=no-adapter` while preserving
  `semantic-field-webgl` with HDR active. This establishes the actual hardware
  readiness boundary for a future compute branch without making current visual
  quality depend on a browser capability that the fallback cannot provide.
- Production build passed with the exact 19-resource closure. The scaffold is
  deliberately not a claimed WebGPU renderer; its next step is a separate
  adapter-ready compute prototype for one field operation.

### Delivery checkpoint

- Commit `b067ae1` was pushed to `main_codex` and manually deployed in Actions
  run `32020319757`. The cached build, Pages deployment, deployed revision, and
  exact 19-resource runtime-closure verification all passed. The optional
  hosted visual review remains intentionally independent of this capability
  scaffold.

## 2026-08-17 — WebGPU density-smoothing compute prototype

Status: implemented as a second explicit, non-rendering probe. It is executable
on adapter-ready hardware but could not run in the local SwiftShader browser,
which correctly returned the inherited `no-adapter` result while WebGL/HDR
remained active.

- `?webgpuComputeProbe=1` now requests an adapter/device and dispatches an
  actual WGSL five-tap, 32-sample density smoothing operation into a separate
  storage buffer. It copies that result to a mapped readback buffer and checks
  the returned density before reporting `compute-ready`; all transient buffers
  and the device are released afterward.
- The probe consumes no live simulation field, texture, canvas, or presenter
  target. It therefore establishes a safe executable compute seam for a future
  half-resolution volume-field pass without changing current WebGL, Canvas2D,
  support, alpha, topology, allocation, or fallback behaviour.
- Production build passed with the exact 19-resource closure. The local browser
  exercise proves the no-adapter fallback only; adapter-backed compute execution
  remains an explicit future hardware verification item.
- A second isolated headless Chrome run with the default `auto` GPU policy also
  reached the real renderer host and reported `webgpu=no-adapter`; this is not
  a SwiftShader-only limitation. The current CI/container environment therefore
  cannot execute WebGPU compute and must not be used to promote or reject that
  optional path.

### Delivery checkpoint

- Commit `e1c9ffa` was pushed to `main_codex` and manually deployed in Actions
  run `32020878160`. Its cached build, Pages deployment, deployed revision, and
  exact 19-resource runtime-closure verification all passed. The compute probe
  remains opt-in and non-rendering; hosted visual review was intentionally not
  selected for this architectural checkpoint.

## 2026-08-17 — dense-gas crown separation

Status: retained normal-WebGL B-only material-volume refinement.

- The existing atmosphere-owned curvature field now gives only a fully
  connected, mid-density gas interior a stronger crown lift than pocket
  attenuation. It consumes no additional texture, field, carrier, support,
  alpha, topology, contact, Canvas2D, or compact true-8x path.
- The adjustment is deliberately one-sided: it separates broad lit lobes
  without restoring the previously rejected rectangular dense-gas treatment or
  laying a uniform dark veil over neutral Smoke/FOG.
- Direct 2x WebGL comparison favoured the retained `v2` strength: the upper
  neutral clouds gain wider light-facing shoulders and clearer large-scale
  volume turns, while coloured gas, sparse controls, and the existing source
  shafts remain legible. `npm run build` passed with the exact 19-resource
  production closure. These captures are current visual review only, not
  image-hash gates.

### Delivery checkpoint

- Commit `865dc96` was pushed to `main_codex` and manually deployed in Actions
  run `32022602418`. Its cached build, Pages deployment, deployed revision, and
  exact 19-resource runtime-closure verification all passed. The optional
  hosted visual batch remains independent of this direct-review visual change.

## 2026-08-17 — visual-overhaul roadmap closure audit

Status: implementation scope complete in the canonical WebGL/HDR renderer.

- **HDR and lighting core:** `HDRVfxPipeline` owns the HDR material composition,
  extract/blur bloom passes, and tonemap; the semantic emission field uses the
  shared blackbody ramp, while the established long-range emission transport
  supplies bounded, wall-aware source direction. The current 2x WebGL electric
  board (`/tmp/anifor-electric-roadmap-audit.png`) visibly retains emissive
  bloom, hot material rolloff, and locally illuminated receiver forms.
- **Fluid and gas realism:** connected liquids have depth/refraction/Fresnel,
  curvature/meniscus transport, moving crest/foam/spray cues, and receiver
  caustics. Gas uses the field-owned connected density, advected volume billows,
  source shafts, self-shadow, and the retained dense-crown separation. Current
  2x WebGL Water and Gas boards (`/tmp/anifor-water-motion-current-v2.png` and
  `/tmp/anifor-gas-crown-turn-v2.png`) show continuous bodies and cloud lobes
  rather than discrete particles.
- **Material delicacy:** the shared appearance/composition profiles supply
  roughness, transmission, scatter, contrast, and environment response;
  material grounding supplies safe broad-body ambient occlusion; normal-WebGL
  powder, liquid, gas, and solid paths consume that vocabulary without moving
  their simulation support. The botanical board
  (`/tmp/anifor-plant-roadmap-audit.png`) retains material variation, shallow
  subsurface response, holes, thin stems, and growth silhouettes.
- **Technology and scale direction:** normal 1x–4x WebGL/HDR and the compact
  true-8x path remain separately bounded, while Canvas2D retains its compatible
  minimum presentation. The opt-in WebGPU adapter/device and density-compute
  prototype is implemented and safely falls back. Both available headless GPU
  policies report `no-adapter`, so hardware compute execution is explicitly an
  external-device validation task rather than a release requirement.

`npm run build` passed with the exact 19-resource closure after the final
retained visual change, and Actions run `32022602418` deployed it successfully.
The road map is now complete as an implementation and visual-review objective;
future work is open-ended material/art tuning or hardware-specific WebGPU
validation, not an unfulfilled phase of this document. Current captures are
direct visual evidence only, never cross-revision image gates.
