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
