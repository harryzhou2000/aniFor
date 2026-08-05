## North star

Define the art target first: **physically-inspired stylized realism** — soft directional lighting, HDR emission, true fluid surfaces, depth through absorption and scatter. Every effect below serves that. I'd also lock in two reference presets early (e.g. "Realistic" and "Neon Lab") so aesthetic decisions stay coherent.

## Experiment ledger

The established presentation remains the `classic` control while experiments
are measured. Select a look with `?renderLook=classic|realistic|neon-lab`; this
does not alter simulation, camera, semantic ownership, or `renderScale`.

- **E01 — HDR chassis (active):** at 1×–4×, `realistic` and `neon-lab` require
  the actual Pixi WebGL2 context to prove float colour attachments, MRT limits,
  and a complete `RGBA16F` framebuffer. The semantic scene renders into one HDR
  target, bright regions feed a half-resolution threshold/blur chain, and an
  ACES-style shoulder composites without changing the established alpha plane.
  Exact temperature drives a blackbody core for Fire, Lava, Plasma, and
  incandescent ordinary matter. Unsupported devices drop to classic WebGL;
  Canvas remains the semantic fallback.
- **E02 — field-aware material volume (active):** the normal 1×–4× WebGL
  compositor reuses its already-live settled-powder surface, species-safe
  liquid depth/meniscus, and atmosphere curvature/scatter signals for a
  stronger HDR key/fill and bounded core absorption. It adds no texture read,
  field, blur, pass, target, clock, or alpha/support decision. Enablement is
  independently measurable with `?volumeVfx=0|1`; non-Classic looks default
  it on only while the HDR pipeline is active. Smooth stable dry powder,
  connected ordinary same-species liquid, and field-owned gas are eligible;
  Local/Grains, motion, authored holes, isolated particles/droplets, unlike
  seams, walls, traits, suspension, molten liquid, and foreign matter remain
  protected controls.
- **E03 — liquid readability (accepted checkpoint):** normal 1×–4× WebGL
  strengthens only the existing connected, exact-species, ordinary-liquid
  body response. It reuses the species-safe density and vertical-depth byte
  plus the already-live meniscus/Fresnel scalars for a reflected exposed lip
  and family-coloured Beer–Lambert core. It adds no field, texture read, pass,
  target, clock, alpha/support/ownership, reconstruction, or physics decision.
  Droplets, Lava, walls, traits, emissive liquid, foreign contacts, and exact
  unlike-liquid owners remain no-ops. `?liquidBodyVfx=0|1` isolates the effect;
  absent that audit override it follows the non-Classic E02 volume preset.
- **E04 — stable gas billow depth (accepted checkpoint):** normal 1×–4×
  WebGL gives field-owned gas a restrained interior key/fill rather than a
  particle or rim effect. It reuses the existing atmosphere density, four
  cardinal slope/curvature samples, and body lighting, then combines three
  long world-space analytic waves only after connected atmosphere ownership is
  proven. The waves have no clock, texture, field, upload, pass, target,
  allocation, alpha/support, silhouette, ownership, or physics effect, and
  remain identical across render scale. `?gasBodyVfx=0|1` isolates E04; absent
  that audit override it follows the non-Classic E02 volume preset.
- **E05 — settled-powder crown/facet depth (accepted checkpoint):** normal
  1×–4× WebGL gives only proven deep, dry, stable Smooth powder a restrained
  signed plane response. It combines the already-live exact-material body
  gate and macro slope with three broad, static, incommensurate triangular
  world-space planes; illuminated crowns and opposing pockets change RGB
  without damping the established cell/facet pigment. It adds no texture read,
  field, upload, pass, target, allocation, time, output-scale, alpha/support,
  ownership, silhouette, or physics decision. `?powderBodyVfx=0|1` isolates
  E05; absent that audit override it follows the non-Classic E02 volume preset.
- **E06 — dry-powder local-light transport (accepted checkpoint):** normal
  1×–4× WebGL reuses the existing centre emission sample and the exact E05
  deep/dry/stable Smooth-body proof. It preferentially lifts the weak tail of that compact
  field with an endpoint-preserving root blend, attenuates it with existing
  body depth/slope, and carries the current pigment cadence through the added
  warm/cool spectrum. Fire/ELEC-facing Sand, Clay, and Concrete therefore gain
  a shallow coloured shoulder instead of a hot contour rim or flat body wash.
  Unlit fixture cores beyond field reach, sources, gaps, holes, fine structures, isolated powder, wet
  suspension, walls, Local, and Grains remain exact no-ops. It adds no sample,
  texture, field, upload, pass, target, allocation, time, output-scale,
  alpha/support/ownership/silhouette, or physics decision.
- **E07 — coherent atmosphere-motion relief (accepted checkpoint):** normal
  1×–4× WebGL carries gas motion on the reconstructed atmosphere rather than
  shading semantic particles independently. The existing half-resolution
  atmosphere-style plane is packed as RGBA: R remains the exact propagated gas
  identity, G/B hold signed density-weighted flow, and A holds vector
  coherence. The same separable atmosphere kernel cancels counterflow before
  presentation. The normal shader reuses its one style sample and differentiates
  E04's static macro waves in the coherent flow direction, with a bounded
  slope-facing shoulder; emissive CFLM uses a reversible cyan/amber cue where
  highlight headroom is exhausted. `?gasMotionVfx=0|1` isolates E07. It adds no
  texture, sampler, upload call, field pass, render target, clock, output-scale
  resource, alpha/support/silhouette/ownership, or physics decision. Canvas
  consumes only R and is byte-identical for arbitrary G/B/A payloads.
- **E08 — HDR liquid-surface transport (accepted checkpoint):** normal 1×–4×
  WebGL reuses the completed HDR scene, blurred bloom, semantic field, native
  wall plane, and species-aware liquid field in the existing tonemap composite.
  Exact connected, air-facing Water, Oil, and Acid surfaces derive a field
  normal, bend same-owner HDR radiance inward for transmission, and combine it
  with a bounded family-coloured environment/bloom reflection. The original
  scene alpha remains the sole topology owner. `?liquidSurfaceVfx=0|1` isolates
  E08 on top of E03; Classic, E03-off, HDR failure, and true 8× resolve it off.
  It adds no render target, texture, field, pass, upload, scheduler stage,
  persistent allocation, clock, output-scale resource, or physics decision.
  Lava, isolated droplets, unlike seams, foreign contacts, reconstructed
  support, and non-liquid phases remain protected no-ops.
- **E09 — settled Powder/Solid contact grounding (accepted checkpoint):**
  normal 1×–4× WebGL gives only fully settled ordinary Smooth Powder a shallow
  body-depth cue at direct ordinary Solid support. While
  `?powderSolidContactVfx=1` is active, the existing phase-local r8 stability
  plane reserves byte `254` for a logical settled value of `255` whose source
  has exact Powder owners on both horizontal sides and an ordinary Solid owner
  immediately above or below. Source/contact traits, emission, and native
  walls reject the marker. The normal shader decodes it from its already-live
  nearest sample, restores legacy stability to `1.0`, and applies a restrained
  world-anchored RGB-only absorption to the authoritative contact cell. It adds
  no GPU sample, texture, field, upload, pass, target, allocation, clock,
  output-scale input, alpha/support/silhouette/ownership, or physics decision.
  Disabled/Classic/Canvas paths retain ordinary `255`; Local, Grains, motion,
  fine columns, isolated grains, suspension, walls, and unlike/air controls
  remain exact no-ops. True 8× neither encodes nor declares E09.
- **E10 — Glass/Ice thin-edge transmission (accepted checkpoint):** normal
  1×–4× WebGL gives exact authoritative ordinary Glass and Ice a restrained
  cool transmitted-light band inside a broad solid edge. It reuses the
  existing phase-local solid optical-depth byte, body key, relief tone, and
  Fresnel response: byte `6` is the protected first interior layer, bytes
  `12–60` form the measured shell/fade, and depth `66+` is excluded from the
  experiment. `?translucentEdgeVfx=0|1` isolates E10 from the older lens-shell
  and backdrop-transmission effects. It adds no sample, texture, field,
  upload, pass, target, allocation, clock, output-scale input, alpha/support,
  silhouette, ownership, reconstruction, or physics decision. One-cell
  structures, isolated cells, authored holes/notches, reconstructed cavities,
  unlike seams, native walls, traits, emission, opaque solids, Canvas, and
  true 8× remain exact controls.
- **E11 — state-aware Wax/PLNT subsurface wrap (accepted checkpoint):** normal
  1×–4× WebGL gives exact authoritative Wax and genuinely hydrated PLNT a
  restrained family-coloured transmitted-light shell inside a broad solid
  body. It reuses the existing phase-local solid optical-depth byte, main body
  normal/diffuse response, relief tone, and packed native presentation state.
  Wax requires exact owner `27` and the ordinary zero-trait lookup. PLNT
  requires exact owner `10`, its static Organic trait byte `32`, native
  owner-present bit 15, and hydration class 1–3 in bits 12–13; tree/genome and
  active-growth bits do not substitute for hydration. Byte `6` remains the
  protected first interior layer, bytes `12–66` form the shallow wrap/fade,
  and depth `72+` is excluded. `?organicSubsurfaceVfx=0|1` isolates E11. It
  adds no sample, texture, field, upload, pass, target, allocation, clock,
  output-scale input, alpha/support, silhouette, ownership, reconstruction, or
  physics decision. Dry/dormant/active-dry PLNT, hydration without presence,
  zero state, hydrated/dry SEED, Molten Wax, unlike seams, native walls,
  traits, time-invariant emissive matter, holes/notches, one-cell structures,
  isolated cells, Canvas, and true 8× remain exact controls.
- **E12 — species-safe wet-sediment mineral optics (accepted checkpoint):**
  normal 1×–4× WebGL gives dense exact Sand/Water, Clay/Water, and
  Concrete/Water suspension bodies one shared mineral key/fill, broad static
  mesostructure, and a restrained damp sheen after the established common wet
  albedo. It reuses the exact RGB owner and density in the existing
  half-resolution suspension field plus the already-live body lighting.
  Powder keeps its existing stability and bulk-depth proof; authoritative
  Water takes one guarded sample from the existing settled-powder surface
  texture so stationary Water cannot remain styled beside moving sediment.
  `?wetSedimentVfx=0|1` isolates E12. It adds no field, texture resource, pass, target,
  upload, persistent allocation, clock, output-scale input, alpha/support,
  silhouette, ownership, reconstruction, or physics decision. Its single
  additional existing-texture read occurs only for exact Water inside an
  already-proven supported suspension body. Dry or moving sediment,
  stationary Water beside moving powder, Salt, Oil, Lava, unlike aqueous
  owners, walls, traits, emission, fine columns, isolated grains, holes,
  notches, gaps, Local, Grains, Canvas, and true 8× remain controls.
- **E13 — atmosphere-owned gas-light spectral scattering (accepted checkpoint):**
  normal 1×–4× WebGL gives exact field-owned Smoke and FOG a shallow coloured
  shoulder where external emission light reaches a dense body. It reuses the
  propagated atmosphere identity/density and curvature, the unconditional
  centre emission sample, and the already-computed high-quality outward-light
  result. Smoke keeps a warm absorption order while FOG carries a cooler
  forward-scatter spectrum. `?gasLightVfx=0|1` isolates E13 and is subordinate
  to E04 gas-body ownership. E13 does not enable the identity/style fetch by
  itself, does not consume E07 coherent motion, and adds no texture fetch,
  field, texture resource, pass, target, upload, allocation, clock,
  output-scale input, alpha/support/silhouette/ownership, or physics decision.
  CFLM and other gas styles, sparse carriers/midpoints/gaps, isolated gas,
  unlit shoulders, deep cores, holes/channels, solid/liquid contacts, native
  walls, blank space, Canvas, and true 8× remain exact controls.
- **E14 — exact Liquid/Solid wet-contact meniscus (accepted checkpoint):**
  normal 1×–4× WebGL gives authoritative ordinary Water, Oil, and Acid a
  narrow family-coloured absorption/key band on the liquid side of an ordinary
  Solid contact. It reuses `occupancyShape`'s four semantic/style probes, the
  existing liquid density/depth and Fresnel basis, and the signed Hermite
  phase-contact light. The enabled selector carries its immutable normal
  output scale: 1× uses a categorical contact shadow because one sample per
  cell cannot resolve the Hermite derivative, while 2×/4× retain the signed
  subcell response. A `0.001` integer-grid snap removes the otherwise unstable
  `floor()` choice at exact 1× cell centres; the nearest real 4× subcell offset
  is `0.125`, so higher-detail sample positions remain unchanged. A second
  scalar derived from the same four probes rejects liquid/solid/foreign triple
  junctions. `?liquidSolidMeniscusVfx=0|1` isolates E14 and is subordinate to
  E03 liquid-body ownership. It adds no texture read, field, texture resource,
  pass, target, upload, allocation, clock, alpha/support/silhouette/ownership,
  reconstruction, or physics decision. Deep liquid, the Solid side, air
  surfaces, unlike-liquid seams, Lava, powder/gas contacts, strands/droplets,
  holes/channels and their liquid lips, traits, emission, native walls, blank
  space, Canvas, and true 8× remain controls.
- **E15 — atmosphere-owned gas-core optical depth (accepted checkpoint):**
  normal 1×–4× WebGL, subordinate to E04's connected atmosphere ownership,
  gives exact Smoke, Oxygen, and Noble gas a calibrated RGB-only crown/key and
  pocket-absorption response through `?gasCoreDepthVfx=0|1`. It reuses the live
  atmosphere identity, density, cardinal shape, optical depth, and static
  billow evidence and adds no resource, sample, pass, allocation, clock,
  alpha/support/silhouette, ownership, topology, or physics decision. FOG,
  CFLM, sparse gas, contacts, walls, holes, channels, Canvas, and true 8× are
  exact controls; focused off/on/off and requested-on true-8× fence gates own
  the release proof.
- **E16 — exact dense-Plasma containment (accepted checkpoint):** normal
  1×–4× WebGL gives only authoritative `Material.Plasma` inside an
  emission-supported cohesive Energy body a static signed macro key/pocket and
  a shallow absorptive semantic-edge shell through `?plasmaCoreVfx=0|1`. It
  reuses the existing centre emission sample, semantic core/edge, and cohesive
  Energy proof, adding no texture read, field, texture resource, pass, target,
  upload, persistent allocation, clock, alpha/support/silhouette/ownership,
  topology, or physics decision. Sparse and isolated Plasma, authored holes
  and channels, liquid/solid contacts, native walls, FIRE/ELEC/PHOT, Canvas,
  and true 8× remain controls. The focused gate owns calibrated off/on/off
  response, scale consistency, exact semantic/raw/support invariants, and the
  requested-on true-8× inactive fence proof.
- **E17 — exact ROCK/Metal opaque-body relief (accepted checkpoint):** normal
  1×–4× WebGL gives only authoritative native ROCK and Metal inside a proven
  broad SmoothRigid body a restrained signed key/pocket response through
  `?solidBodyVfx=0|1`. It reuses the existing exact-species optical-depth byte,
  interior proof, analytic key/fill/Fresnel, and signed macro relief. The
  response is deliberately bipolar rather than a uniform cool lift. Brick,
  Ceramic, BMTL, Gold, Iron, Platinum, and Titanium remain excluded from E17;
  Platinum instead earns its own E18 finish below. Holes, open notches, one-cell lines,
  isolated cells, unlike-solid seams, native walls, traits, emission,
  reconstructed support, powder, liquids, translucent solids, Canvas, and true
  8× are exact controls. E17 adds no texture read, field, resource, pass,
  target, upload, allocation, clock, alpha/support/silhouette/ownership,
  topology, or physics decision.
- **E18 — exact Platinum broad-body finish (accepted checkpoint):** normal
  1×–4× WebGL gives only authoritative deep ordinary PTNM `75` a broad
  cool/warm rolled-silver reflection through `?platinumBodyVfx=0|1`. It reuses
  the existing exact-species solid depth/interior, analytic key/fill/Fresnel/
  environment, signed relief, and static world position. It deliberately runs
  below and independently of PTNM's existing 19/43-cell catalytic plane/site
  grammar rather than widening E17 or the structural-metal whitelist. HEAC,
  RSSS, holes, one-cell lines, isolated cells, co-located walls, direct
  solid/Water contacts, blank space, Canvas, and true 8× are exact controls.
  E18 adds no sample, texture, field, resource, pass, target, upload,
  allocation, clock, alpha/support/silhouette/ownership/topology, or physics
  decision.
- **E19 — exact Ceramic fired-glaze finish (accepted checkpoint):** a broad
  production 2× Brick/Ceramic fit-view capture proved Brick already legible as
  warm masonry while Ceramic remained visibly flat. Normal 1×–4× WebGL now
  gives only authoritative deep ordinary Ceramic `25` a bounded cool/warm
  fired-glaze reflection and opposing absorptive pocket through
  `?ceramicGlazeVfx=0|1`. It reuses the existing exact-species solid depth,
  interior proof, analytic key/fill/Fresnel/environment, and signed relief;
  Ceramic's sparse glaze/craze identity remains independently enabled. Brick,
  authored holes/open notches, one-cell lines, isolated cells, co-located
  native walls, Ceramic-side Water/Metal contacts, blank space, Sand, Glass,
  Metal, Canvas, and true 8× are exact controls. E19 adds no sample, texture,
  field, resource, pass, target, upload, allocation, clock, alpha/support/
  silhouette/ownership/topology, or physics decision.
- **E20 — exact Wood/PLNT body recomposition (accepted checkpoint):** the
  post-E19 production 4× fit-view showed mature canopies as inflated diagonal
  tiles and Wood as a flat banded trunk. Normal 1×–4× WebGL now replaces those
  competing legacy carriers only in deep authoritative Wood `9` and PLNT `10`
  bodies through `?botanicalBodyVfx=0|1`. One shared exact owner/trait/depth/
  interior/contact/wall/emission guard owns deterministic arithmetic leaf
  clusters and bark ridges over the existing relief, Fresnel, and environment.
  Sparse stems, isolated cells, holes/notches, walls, Water/Sand contacts,
  reciprocal same-Solid-phase Wood/PLNT seams, VINE/Wax/Metal, native PLNT
  lifecycle colour/state, Canvas, and true 8× keep their established paths.
  The lifecycle composition contract is sampled on separate inherited-cyan
  and inherited-magenta PLNT canopies while the main calibration bodies remain
  zero-state. E20 adds no sampler, texture, field, resource,
  pass, target, upload, allocation, clock, alpha/support/silhouette/ownership/
  topology/state, or physics decision.
- **E21 — exact thick-Glass body transmission (accepted checkpoint):** the
  post-E20 fit-view showed the tank's Glass frame reading as opaque blue-gray
  even though E10 already supplied a useful shallow edge. Normal 1×–4× WebGL
  now recomposes only projected Glass `24` after exact-species depth byte 30
  through `?glassBodyVfx=0|1`. The single exact owner/phase/optics/trait/
  depth/interior/contact/wall guard reuses existing analytic key, relief,
  Fresnel, and environment evidence for selective warm absorption, cool body
  transmission, crown reflection, and pocket absorption. One depth weight
  fades the established lens carrier's delta as the new body rises, avoiding
  a byte-30→36 ring while keeping the original disabled/shallow operation
  order exact. E10's byte-12–30 shallow band remains exact, and presentation alpha is unchanged because it
  owns premultiplication and native-wall visibility. Ice/QRTZ, authored holes
  and notches, reconstructed cavities, thin/isolated Glass, Glass/Ice/Metal/
  Water contacts, patterned native walls, traits, emission, powder/liquid,
  Canvas, and true 8× remain controls. E21 adds no sampler, texture read,
  field, resource, pass, target, upload, allocation, clock, output-scale
  input, alpha/support/silhouette/ownership/topology, or physics decision.
- **E22 — exact Oil volumetric body optics (accepted checkpoint):** the
  post-E21 fit-view showed Oil as a flat opaque plug. Normal 1×–4× WebGL now
  recomposes only authoritative Oil `8` with Oily optics inside E03's connected
  ordinary-liquid proof through `?oilBodyVfx=0|1`. Its exact-depth weight is
  zero at byte 30 and reaches full strength at byte 78. It reuses the existing
  connected-body weight, Fresnel contour, broad sheen, macro relief, reflected
  environment, and caustic evidence for a warm amber crown and opposing cool
  absorptive pocket. Diesel/Nitro, Water/Acid/Lava/Soap, shallow Oil, sparse
  strands/droplets, authored holes/chimneys, unlike seams, foreign contacts,
  co-located walls, Canvas, and compact true 8× remain controls. E22 adds no
  sampler, texture read, field, resource, pass, target, upload, allocation,
  clock, output-scale input, alpha/support/silhouette/ownership/topology, or
  physics decision.
- **E23 — exact ROCK matte-body correction (accepted checkpoint):** the
  post-E22 fit-view proved that native ROCK inherited too much of E17's shared
  ROCK/Metal SmoothRigid polish. Normal 1×–4× WebGL now uses
  `?rockRoughnessVfx=0|1`, strictly subordinate to `?solidBodyVfx=0|1`, to
  attenuate only the existing micro-glint, broad-specular, Fresnel/environment,
  and positive E17 cool-key carriers on authoritative deep ROCK `78`. E17's
  signed absorptive pocket and the later geological strata/vein identity remain
  intact; E23 adds no replacement tint or material motif. Eligibility repeats
  the exact ordinary ROCK phase/profile/optics, depth/interior, wall, trait,
  emission, reconstruction, and foreign/unlike-contact proof. Geometry-matched
  Metal, Coal, native-Powder Stone, Brick, Glass, Sand, Water, surface/first
  layers, holes, notches, thin/isolated ROCK, co-located walls, and ROCK/Metal/
  Water/Sand/Smoke contacts remain controls. E23 adds no sample, sampler,
  texture, field, resource, pass, target, upload, allocation, clock,
  output-scale input, alpha/support/silhouette/ownership/topology, or physics
  decision. Canvas and compact true 8× contain no E23 branch.
- **Protected 8× rung:** `renderScale=8` deliberately reports
  `hdrPipeline=inactive` / `scale-8` and retains the proven direct single-mesh
  4896×3072 path. The experiment must earn a bounded 8× design rather than
  allocating a 115 MiB full-resolution float target beside that path.
- **Current decision:** E01/E02/E03/E04/E05/E06/E07/E08/E09/E10/E11/E12/E13/E14/E15/E16/E17/E18/E19/E20/E21/E22/E23 remain opt-in through the non-Classic looks
  until representative hardware timing and mobile thermal behavior are
  measured. E02 remains the safe family-wide baseline. E03 is accepted as the
  liquid-depth checkpoint: its fit-view crop is visibly more cohesive, retains
  Water/Oil/Acid hue order, and shows no objectionable striping, seam bleed, or
  silhouette change. E04 is accepted as the first gas-depth checkpoint: its
  fit-view result is intentionally subtle, but broad cloud cores now have
  stable bipolar billow relief while compact FOG/CFLM shoulders remain smooth.
  E05 is accepted as the first powder-only depth checkpoint: broad Clay,
  Concrete, and Sand bodies gain a visible crown/pocket separation while their
  local pigment cadence, smooth contour, holes, thin tips, wet suspension,
  Local, and Grains remain unchanged. The triangular construction is visible
  only in amplified differences at its current strength; do not raise it into
  an overt repeating surface pattern. E06 is accepted as the first local-light
  checkpoint: warm/cool powder shoulders enter several cells farther than the
  original rim-only candidate while remaining subordinate to grain pigment;
  the fixture's unlit cores outside field reach and protected controls do not respond. Freeze this shoulder until
  a new normal-view review. E07 is accepted as the first velocity-aware gas
  checkpoint: the atmosphere field carries exact coherent direction, a 2×2
  checkerboard counterflow cancels to an exact framebuffer no-op, and amplified
  captures show body-scale curved lobes rather than particle speckles. Its
  normal-view strength is deliberately restrained; keep the current amplitude
  until another fit-view review. E08 is accepted as the first real
  HDR-composite liquid-surface checkpoint: fit-view changes remain restrained,
  while enlarged and amplified captures show coherent curved lips rather than
  a flat whole-body grade. Water, Oil, and Acid remain optically distinct and
  all protected topology/contact controls stay exact. Freeze this response
  until another normal-view review. E09 is accepted as the first exact
  material-pair contact checkpoint: it grounds broad resting Sand/Brick,
  Clay/Metal, and Concrete/Glass beds without becoming an outline or touching
  fine structure. Its normal-view response is intentionally shallow; freeze it
  until a new fit-view review. E10 is accepted as the first narrow
  solid-thickness transmission checkpoint: the Glass/Ice response is a cool
  inner shell with a measured depth falloff, not a body-wide colour grade, and
  every categorical/topology control remains exact. Freeze its amplitude and
  depth window until another normal-view review. E11 is accepted as the first
  native-state-aware organic thickness checkpoint: Wax receives a warm amber
  wrap while hydrated tree and non-tree PLNT retain lifecycle colour under a
  cool organic fill. Dry/activity-only and presence-free hydration states stay
  exact. Freeze its amplitude and depth window until another normal-view
  review. E12 is accepted as the first composed wet-mineral optics checkpoint:
  all three exact powder families retain a shared aqueous body while gaining a
  scale-stable family key/fill and damp sheen. Its split moving-powder /
  stationary-Water control is exact, so the effect cannot hide a cross-phase
  stability mismatch. Freeze its owner classifiers, settled-Water proof, and
  amplitude until another fit-view review. E13 is accepted as the first
  atmosphere-owned external-light checkpoint: warm Smoke and cool FOG gain
  separate shallow spectral shoulders only where the existing emission field
  reaches dense, identity-proven gas. Unlit shoulders, deep cores, sparse
  chains, other species, contacts, walls, holes, and channels remain exact.
  The normal screenshot is intentionally delicate while an amplified
  difference exposes only the two intended shoulder bands; freeze its spectra,
  density gate, and amplitude until another fit-view review. E14 is accepted as
  the first liquid-side exact Solid-contact optics checkpoint. It gives Water,
  Oil, and Acid distinct continuous contact bands at both fixture orientations,
  while the shared 1× stencil snap removes position-dependent half-lines rather
  than hiding them with a weaker gate. Deep cores, Solid interiors, air and
  unlike-liquid boundaries, foreign phases, native walls, fine topology, and
  authored voids remain exact; freeze its classifier, snap epsilon, family
  spectra, and amplitude until another fit-view review. E15 is accepted as the
  first atmosphere-owned gas-core optical-depth checkpoint: Smoke, Oxygen, and
  Noble gas receive distinct restrained crown/key and pocket absorption while
  FOG, CFLM, sparse carriers, contacts, walls, holes, and channels remain
  exact. Freeze its per-species spectra and billow/optical-depth gates until
  another fit-view review. E16 is accepted as the first exact dense-Plasma
  containment checkpoint: its broad body receives a scale-stable bipolar
  magnetic volume rather than another cell motif, the violet chroma and
  authored topology remain intact, and sparse Plasma plus all foreign Energy
  owners remain exact. Freeze its two static macro frequencies, cohesive gate,
  shell amplitude, and RGB-only ownership until another fit-view review. E17 is
  accepted as the first exact opaque rigid-body relief checkpoint: ROCK and
  Metal gain scale-stable signed body modulation without a new motif, uniform
  grade, or change to their existing family texture. Freeze its two-owner
  whitelist, centred analytic-light basis, signed relief weight, and four-to-six
  byte accepted peak envelope (the canonical survey observes five to six) until
  more SmoothRigid owners receive explicit cards. E18 and E19 remain exact
  Platinum and Ceramic finishes rather than new family-wide rigid layers. E20
  is accepted as the first body-carrier replacement: it removes competing
  Wood/PLNT bands only after one strict owner/trait/depth/contact proof, then
  substitutes clustered leaf volume or restrained bark rather than stacking a
  second identity pattern. Freeze that shared eligibility gate, arithmetic
  noise hash, lifecycle separation, and protected-control paths until another
  production fit-view review. E21 is accepted as the exact deep-Glass
  transmission checkpoint: it hands off continuously from E10's shallow shell
  while preserving alpha, cavities, contacts, and native-wall visibility. E22
  is accepted as the first exact broad Oil-body checkpoint: it replaces the
  flat plug with a spatial amber-crown/cool-pocket response while remaining
  subordinate to E03 and preserving exact Oil ownership, connected support,
  and every sparse/contact control. Freeze E22's exact owner, byte-30–78
  handoff, spectra, and existing-evidence-only construction until another
  production fit-view review. E23 is accepted as the exact ROCK matte-body
  correction: it removes the demonstrated coherent polished lobe without
  flattening ROCK's signed mineral relief, weakening E17's absorptive pocket,
  changing Metal, or replacing the established geological identity. Freeze its
  E17 dependency, exact-owner/depth/contact proof, three gloss attenuation
  factors, and positive-key attenuation until another production fit-view
  review.
  These are not the final material/VFX results.
  Sub-1.0 material colour stays on the established response; tonemapping owns
  only real HDR highlights so powder texture and liquid body contrast are not
  washed out.

Run the two review presets with `npm run audit:vfx:realistic` and
`npm run audit:vfx:neon`. `npm run audit:vfx:hdr` is the objective 2× WebGL
gate: it reloads a paused fixture as classic → realistic → classic and checks
the hot-material RGB response, repeatability, semantic/staging topology, exact
geometry, active float pipeline, and browser errors. The browser gate also
accepts `--render-scale=1|2|4|8` for capability/degradation checks.

Run `npm run audit:vfx:volume` for E02. It reloads the paused composed material
lab as `volumeVfx=0 → 1 → 0` at 1×, 2×, and 4×, requires the real HDR pipeline,
and proves exact semantic/staging state plus raw presented alpha/support hashes.
Its paused powder probes drive seven separately observed presentation refreshes
and require exact auxiliary byte `255` before capture; an inert first PNG is not
settled-body evidence. E10, E11, E12, and E13 are explicitly pinned off in this baseline.
The accepted response is spatial rather than a uniform grade: the current
fixture reaches 6 framebuffer bytes in settled Clay, 13 in connected liquids,
and 3 in gas while isolated Sand/Water, authored holes, Metal, and repeat
captures remain exact. The sub-cell Water/Oil page probe permits four bytes of
filtered neighbouring-body RGB; E03 separately proves both exact raw seam
owners and whole-frame alpha/support unchanged. Pass `--render-scale=1`, `2`,
or `4` to the underlying focused command when tuning one scale.

Run `npm run audit:vfx:liquid-body` for E03. It holds E02 powder/gas styling
off, reloads `liquidBodyVfx=0 → 1 → 0` at 1×/2×/4×, requires the real HDR
pipeline, and proves exact semantic state, raw alpha/support, exact raw seam,
wall, isolated-droplet and Lava controls, deterministic spatial response, and
zero browser errors. Across the three scales, Water, Oil, and Acid expose a
positive surface response and a darker core with `5.8–8.5` signed display-byte
separation; target peaks remain at or below 14 bytes. Native walls now also
reset the vertical optical-depth byte and redirty that scan at the bounded
liquid cadence.

Run `npm run audit:vfx:gas-body` for E04. It holds E02 powder and E03 liquid
styling off, reloads `gasBodyVfx=0 → 1 → 0` at 1×/2×/4×, and requires WebGL,
the real HDR pipeline, exact geometry/semantics, exact full-frame raw
alpha/support, exact sparse carrier/midpoint/gap alpha, deterministic RGB, and
zero browser errors. Across all three scales, broad Smoke/Oxygen/Noble cores
hold `0.91–1.03` RGB RMS with positive and negative billow lobes; compact FOG
and CFLM shoulders peak at four and five display bytes. Raw authored-gap alpha
remains zero and every repeat response is byte-exact. Pass `--render-scale=1`,
`2`, or `4` to the underlying focused command when tuning one scale; true 8×
rejects E04 and retains its protected direct shader.

Run `npm run audit:vfx:powder-body` for E05. It holds E02/E03/E04 styling off,
reloads `powderBodyVfx=0 → 1 → 0` at 1×/2×/4×, and requires WebGL, the real HDR
pipeline, exact geometry/semantics, exact full-frame raw alpha/support, and
byte-exact holes, a one-cell slope tip, isolated Sand, wet suspension, Local,
and square Grains. Clay/Concrete crowns remain positive while their cores and
the sampled Sand body provide the opposing fill; target peaks stay within
`3–8` display bytes. The retained local microchroma is `99.1–100.5%` of the
disabled body at every scale, and every repeated-off comparison is byte-exact.
The paused fixture explicitly drives seven observed presentation refreshes and
requires exact settled byte `255`; identical screenshots alone are not a
settling condition.
Pass `--render-scale=1`, `2`, or `4` to tune one scale; true 8× rejects E05 and
retains its protected direct shader.

The 4× powder warm-up regression is protected separately: a newly authored,
supported powder owner may begin with stability byte `0`, so it must schedule
bounded follow-up boundary passes even if its first byte remains `0`. A
static/paused showcase waits for a deep auxiliary stability probe of at least
`224` before capture; that does not replace the focused gate's exact `255`
proof. Keep the boundary alpha continuous—per-cell rounded alpha produces a
4× lattice/checker artifact.

At true 8×, do not present every intermediate stability byte as a separate
15-million-fragment frame. The presenter delivers the real semantic/wall/state
mutation, coalesces only auxiliary follow-up passes, and submits the final
settled texture latest-wins; a later external mutation always interrupts the
deferral. `npm run audit:powder-mesostrata:4x` and
`npm run audit:powder-mesostrata:8x` own the corresponding exact hole, thin,
unstable, wet/wall, Local, square-Grains, RGB-only, and off→on→off proofs.

Run `npm run audit:vfx:powder-light` for E06. It keeps E02 and E05 enabled as
the fixed body baseline, pins E10 and E11 off, then reloads
`powderLightVfx=0 → 1 → 0` at 1×/2×/4×.
The dedicated paused fixture contains Fire/ELEC-facing Sand, Clay, and Concrete
cards plus exact sources, two-cell gaps, authored holes, fine columns, isolated
Sand, wet Sand/Water suspension, a native wall, and a wall-free blank. The gate
drives seven separately observed presentation refreshes per state and requires
exact auxiliary byte `255` at every warm/cool/core body probe before capture.
It requires real WebGL/HDR, exact geometry/semantics/raw alpha/support, warm/cool
spectral direction, a non-uniform shallow shoulder, byte-exact protected
controls and repeated-off captures, 97–103% retained local microchroma, exact
Local/Grains references, and zero browser errors. The normal shader retains its
seven established emission samples. The accepted 1×/2×/4× matrix measures
`0.66–3.27` RGB RMS with `3–5`-byte peaks and `97.47–102.60%` retained local
microchroma; every excluded control remains exact. Pass `--render-scale=1`, `2`, or `4` when
tuning one scale; true 8× rejects E06 and retains its protected direct shader.

Run `npm run audit:vfx:gas-motion` for E07. It fixes E04 on as the accepted gas
body baseline and reloads directed, reversed, and still paused fixtures with
E07 off/on/off at 1×/2×/4×. Smoke, FOG, and CFLM cards carry exact native
velocity into the packed atmosphere field; the gate independently proves
semantic staging, `[±48,0,255]` / `[0,±48,255]` coherent field readback,
direction reversal, byte-exact still and checker-counterflow no-ops, unchanged
full-frame/raw alpha and atmosphere support, preserved sparse carriers and
true gaps, contacts/walls/blanks, exact repetition, and zero browser errors.
The accepted body response is broad (`~0.4–2.2` RGB RMS across family probes)
with target peaks at or below six display bytes; already reconstructed small
holes/channels may receive a bounded stronger edge response but never gain
alpha. Pass `--render-scale=1`, `2`, or `4` when tuning one scale. The existing
single-navigation `audit:spng:8x` fence explicitly requests E07 and proves the
4896×3072 direct shader reports it inactive with HDR/bloom absent.

Run `npm run audit:vfx:liquid-surface` for E08. It holds E03 on as the accepted
liquid-body baseline, then reloads `liquidSurfaceVfx=0 → 1 → 0` at
1×/2×/4×. The gate requires the real HDR pipeline, exact CSS/backing geometry,
semantic state, raw alpha/support, and byte-exact repeated-off framebuffer.
Water/Oil/Acid exposed lips and native-wall-backed lips must gain shaped,
family-distinct transport while Lava, an isolated Water cell, the exact
Water/Oil seam, Water/Metal, and Oil/Glass remain exact controls. Across the
accepted matrix, exposed surfaces measure `1.42–3.14` RGB RMS with `5–11` byte
peaks; wall-backed lips measure `2.30–6.34` RMS with `6–16` byte peaks. The
same command finishes by requesting E08 on the true 4896×3072 SPNG route,
which must report E08/HDR inactive with reason `scale-8`, no bloom backing, and
a completed GPU fence.

Run `npm run audit:vfx:powder-solid-contact` for E09. It pins every other VFX
selector off and reloads paused Sand/Brick, Clay/Metal, and Concrete/Glass beds
as `powderSolidContactVfx=0 → 1 → 0` at 1×/2×/4×. The gate requires real
WebGL/HDR, exact CSS/backing geometry, semantics, auxiliary ownership, raw
alpha/support, and repeated-off framebuffer output. Moving Sand, a one-cell
Clay column, isolated Sand, wet Sand/Water, co-located native walls, an unlike
Sand/Clay seam, an air gap, every Solid-side probe, Local, and square Grains
remain byte-exact. The accepted contact band holds `0.93–1.30` RGB RMS,
`0.90–1.21` spatial RMS, `4–5`-byte peaks, and `14.1–14.3%` response coverage
across the sampled five-cell band at all normal scales. The closing true-8×
navigation explicitly requests E09 and proves it inactive with reason
`scale-8`, no bloom backing, exact 4896×3072 WebGL, and a completed GPU fence.

Run `npm run audit:vfx:translucent-edge` for E10. It pins every other VFX
selector, including E11 and E12, off; disables the established translucent lens/field
effects; and reloads four broad exact Glass/Ice panes as
`translucentEdgeVfx=0 → 1 → 0` at 1×/2×/4×. The gate proves exact depth bands
(`6`, `12–30`, `36–60`, and
`120–234`), semantics, raw alpha/support, protected framebuffer centres, and
repeated-off output. Across the accepted matrix the two target bands hold
`1.83–2.63` RGB RMS, `3–6`-byte peaks, `55.4–71.9%` response coverage, and
positive `1.59–2.27` signed means. In every pane the near-edge RMS remains at
least 5% above the deeper fade. Holes, notches, one-cell lines, isolated cells,
reconstructed cavities, unlike seams, Metal, CLNE, Fire, native walls, and
blank space remain exact; one broad Ice deep-core page crop may expose one
compositor byte with zero response coverage while its authoritative centre is
byte-exact. The closing true-8× navigation proves E10/HDR inactive with reason
`scale-8`, no bloom, exact 4896×3072 WebGL, and a completed GPU fence.

Run `npm run audit:vfx:e11` for E11. It pins E01–E10 off and reloads exact Wax,
hydrated tree PLNT, and hydrated non-tree PLNT as
`organicSubsurfaceVfx=0 → 1 → 0` at 1×/2×/4×. The accepted matrix holds Wax at
`2.59–2.62` RGB RMS with `5–6`-byte peaks and `68.9–69.3%` coverage, hydrated
tree PLNT at `1.97–2.02` RGB RMS with four-byte peaks and `65.9–71.5%`
coverage, and the native-state discriminator at `2.71` RGB RMS with a
three-byte fully covered response. The exact 36–66 fade aggregates remain
scale-stable (`2.86–2.88` Wax and `1.96–2.02` tree PLNT RGB RMS), while their
exact byte-66 tips retain a positive `1–2`-byte response; thresholded coverage
may quantize at that single cell, but the body-to-tip RMS ratio remains at
least 1.5. Dry/activity-only PLNT, presence-free hydration, dormant/zero-state
PLNT, SEED, Molten Wax, wrong owners, traits,
emission, walls, seams, holes, notches, one-cell structures, isolated cells,
deep cores, and blank space remain exact semantic and raw controls. Chrome may
quantize one blue display byte in the 2× broad MWAX page crop while its raw
authoritative centre and response coverage remain exact. Repeated-off captures
are byte-identical. The closing true-8× navigation proves E11/HDR inactive,
has no bloom allocation, presents exact 4896×3072 WebGL, and completes a GPU
fence.

Run `npm run audit:vfx:wet-sediment` for E12. It pins E01–E11 off and reloads
exact Sand/Water, Clay/Water, and Concrete/Water bodies as
`wetSedimentVfx=0 → 1 → 0` at 1×/2×/4×. The accepted checkpoint run measured the three
families at `1.39–1.90` RGB RMS, `4–7`-byte peaks, `22.8–43.9%` response
coverage, and positive `0.58–1.29` signed means. Normalized powder/Water
chroma distance remains at or below `1.15` while raw distance is reported
separately and remains below `35` bytes. The exact suspension digest and RGB
owner probes are identical across selector states. Dry bodies, moving powder
beside stationary Water, Salt, Oil, Lava, unlike aqueous owners, a co-located
native wall, fine columns, isolated grains, holes, notches, authored gaps,
blank space, Local, and square Grains remain exact semantic/raw controls;
only a broad antialiased hole fringe may quantize at most two composed RGB
bytes while its authoritative Empty centre remains exact. Repeated-off frames
are byte-identical. The closing requested-on true-8× navigation proves E12/HDR
inactive with reason `scale-8`, no bloom allocation, exact 4896×3072 WebGL,
and a completed GPU fence.

The gate deliberately leaves narrow cross-browser headroom around those
observations: family-specific bounds span `1.35–2.00` RGB RMS, `4–7`-byte
peaks, `22–46%` coverage, and `0.55–1.40` signed means. These are acceptance
limits, not the measured checkpoint values above.

Run `npm run audit:vfx:gas-light` for E13. It pins unrelated VFX off, keeps E04
gas-body ownership on, and reloads the exact Smoke/FOG external-light fixture
as `gasLightVfx=0 → 1 → 0` at 1×/2×/4×. The accepted checkpoint measured Smoke
at `1.08–1.13` RGB RMS, `0.58–0.61` chroma RMS, a `2`-byte peak, and
`0.84–0.88` signed mean; FOG measured `1.65–1.67` RGB RMS, `0.48–0.52` chroma
RMS, a `3`-byte peak, `1.49–1.54` signed mean, and `56.3–62.5%` response
coverage. Smoke retains red > green > blue response while FOG retains green
and blue > red. The calibrated gate permits Smoke `0.95–1.30` RGB RMS,
`0.45–0.72` chroma RMS, `2–3`-byte peaks, and `0.70–1.05` signed mean; FOG
permits `1.45–1.90`, `0.35–0.68`, `2–4`, and `1.25–1.80` respectively, with
`45–72%` coverage. Cross-scale RMS/chroma/signed/channel spreads are bounded
independently. Unlit shoulders and deep cores are exact zero response, as are
CFLM/other gas species, sparse chains, isolated gas, holes/channels, contacts,
native walls, and blank space. Semantic topology, raw controls, support,
geometry, and repeated-off framebuffers are exact. The closing requested-on
true-8× navigation proves E13/HDR inactive with reason `scale-8`, no bloom
allocation, exact 4896×3072 WebGL, and a completed GPU fence.

Run `npm run audit:vfx:liquid-solid-meniscus` for E14. It pins unrelated VFX
off, keeps E03 liquid-body ownership on, and reloads the exact Water/Metal,
Oil/Glass, and Acid/Brick horizontal/vertical fixture as
`liquidSolidMeniscusVfx=0 → 1 → 0` at 1×/2×/4×. The accepted checkpoint
measured Water at `0.82–3.76` RGB RMS, `0.49–1.85` chroma RMS, and `3–12`-byte
peaks; Oil at `1.10–1.39`, `0.89–1.11`, and `4–5`; and Acid at
`1.75–3.63`, `1.50–2.80`, and `6–11`. Water retains stronger red/green than
blue absorption, Oil retains blue-dominant absorption, and Acid retains
red/blue absorption with a nonnegative green key. The script holds separate
family/orientation/scale bounds rather than accepting an arbitrary nonzero rim.
Every liquid-field contact/core probe is fully hydrated (`255`), semantic and
backing alpha/support are invariant, and repeated-off screenshots are byte
identical. Deep liquid, two-cell Solid interiors, air surfaces, both sides of
the Water/Oil seam, Lava, powder/gas contacts, sparse strands/droplets,
authored holes/channels plus adjacent liquid lips, trait/emissive owners,
native walls, and blank space have zero composed response. The exact triple
corner is semantically unchanged and permits only one byte at 1× in the
CSS-scaled page capture; it is exact at 2×/4×. The closing requested-on true-8×
navigation proves E14/E03/HDR inactive with reason `scale-8`, no bloom target,
exact 4896×3072 WebGL, zero browser errors, and a completed GPU fence (about
`5.2 s` in the final SwiftShader gate).

Run `npm run audit:vfx:gas-core-depth` for E15. It reloads
`gasCoreDepthVfx=0 → 1 → 0` at 1×/2×/4× while retaining E04 atmosphere
ownership, and proves the calibrated species-aware Smoke/Oxygen/Noble
crown/key and pocket response is RGB-only. FOG, CFLM, sparse gas, foreign
contacts, native walls, holes, channels, semantics, raw alpha, and support are
exact controls; repeated-off frames are byte exact. The requested-on true-8×
navigation reports E15 inactive with reason `scale-8`, retains the direct
4896×3072 WebGL path without bloom backing, and completes its GPU fence.

Run `npm run audit:vfx:plasma-core` for E16. It reloads
`plasmaCoreVfx=0 → 1 → 0` at 1×/2×/4× with all unrelated VFX pinned off. The
accepted checkpoint is tightly scale-stable: the broad body measures
`3.32–3.33` RGB RMS with `9`-byte peaks and a balanced bipolar response; the
core key measures `3.87–3.88` RGB RMS with `+2.20` signed mean, the shoulder
pocket `4.60–4.62` with `-3.15–-3.14`, and the quieter edge-body reference
`2.32` with `+0.69–+0.70`. Chroma remains violet, no target clips, semantic and
raw alpha/support/topology are invariant, and repeated-off frames are byte
identical. Holes, channels, sparse/isolated Plasma, co-located walls,
liquid/solid contact rails, FIRE/ELEC/PHOT, and blank space are protected; only
the measured 4× radius-zero HDR seam quantization may reach two mixed-sign
framebuffer bytes while its raw/semantic state remains exact. The closing
requested-on true-8× navigation reports E16/HDR inactive with reason `scale-8`,
keeps no bloom target, presents exact 4896×3072 WebGL, and completes its GPU
fence.

Run `npm run audit:vfx:solid-body` for E17. It reloads an exact paused
ROCK/Metal fixture as `solidBodyVfx=0 → 1 → 0` at 1×/2×/4× with every unrelated
VFX selector pinned off. The accepted response is tightly scale-stable and
bipolar: ROCK core/surface measure about `2.74/3.06` RGB RMS, Metal about
`2.65/2.81`, target peaks stay at `5–6` bytes, and every measured region
contains both positive and negative pixels rather than accepting a uniform
body lift. Semantic material, raw alpha/support, CSS/backing geometry, authored
holes/notches, one-cell structures, isolated cells, wall coexistence,
unlike-solid seams, Sand, Water, Glass, and repeated-off captures remain exact.
SwiftShader may need the gate's bounded 60-second window to establish three
identical full-page PNGs at 4×; that is compositor-settling evidence, not an
expanded renderer resource. The closing requested-on true-8× navigation keeps
E17/HDR inactive with reason `scale-8`, retains exact 4896×3072 WebGL without
bloom backing, and completes a GPU fence.

Run `npm run audit:vfx:platinum-body` for E18. It reuses the paused
thermal/catalytic atlas and reloads `platinumBodyVfx=0 → 1 → 0` at
1×/2×/4× while every E01–E17 selector is pinned and PTNM's established
catalytic identity remains enabled in every frame. The accepted response is
nearly scale-invariant: the balanced transition core is `2.14–2.15` RGB RMS
with a `5`-byte peak, the silver crown is `3.99–4.02` with signed mean
`+4.03…+4.09`, and the absorptive pocket is `4.23–4.25` with signed mean
`−2.05…−2.07` and an `8`-byte peak. The crown/pocket separation remains over
six framebuffer bytes at every normal scale. Semantic material, raw alpha and
support, backing/CSS geometry, HEAC/RSSS cores, authored holes, thin and
isolated matter, native-wall coexistence, solid/Water contacts, blank space,
and every repeated-off capture are exact; every protected framebuffer peak is
zero. The closing requested-on true-8× navigation reports E18/HDR inactive
with reason `scale-8`, retains exact 4896×3072 WebGL without a bloom backing,
reports the promotion fence signalled, and completes its GPU sample inside the
same 30-second deadline (about `5.68 s` on the final SwiftShader run).

Run `npm run audit:vfx:ceramic-glaze` for E19. It reloads a dedicated paused
two-card Brick/Ceramic RenderLab fixture as `ceramicGlazeVfx=0 → 1 → 0` at
1×/2×/4× while every E01–E18 selector is pinned off. The named Ceramic core
and crown isolate the positive signed solid-relief lobe, while the pocket
isolates the negative lobe; Brick mirrors those exact regions as a no-op
reference. The accepted result is nearly scale-invariant: core is
`5.24–5.26` RGB RMS with signed mean `+5.02…+5.04`, crown is `5.65–5.67`
with `+5.46…+5.50`, and pocket is `5.32–5.37` with `−5.12…−5.16`; all have
full measured coverage and a seven-byte peak. Semantic material, raw alpha and
support, CSS/backing geometry, 1,568 native-wall cells and their hash, authored
holes/notches, thin and isolated matter, Ceramic-side Water and unlike-Metal
contacts, Sand/Glass/Metal controls, and repeated-off captures remain exact;
every protected framebuffer peak is zero. SwiftShader may need the bounded
60-second stable-frame allowance for each accumulated 4× capture, matching the
existing opaque-solid compositor contract. The closing requested-on true-8×
navigation reports E19/HDR inactive with reason `scale-8`, retains exact
4896×3072 direct WebGL without bloom, reports the promotion fence signalled,
and completes its GPU fence inside the same original 30-second startup
deadline (about `4.02 s` on the final run).

Run `npm run audit:vfx:botanical-body` for E20. It reloads a dedicated paused
two-card Wood/PLNT RenderLab fixture as `botanicalBodyVfx=0 → 1 → 0` at
1×/2×/4× while every E01–E19 selector is pinned off. The fixture proves broad
body/core/crown/pocket response alongside authored cavities/open notches,
one-cell stems, isolated owners, native-wall coexistence, direct Water/Sand
contacts, reciprocal Wood↔PLNT same-phase seams, guarded blanks, VINE/Wax/Metal
controls, zero-state main calibration bodies, and two isolated stateful PLNT
canopies. Those canopies differ only in inherited-colour bits: all 3,840 state
cells and their hash repeat exactly across off/on/off, while normalized
inherited red share shifts by `0.084…0.086`, green share reverses by
`0.056…0.058`, and chroma distance remains `0.105…0.108` after E20 composition.
The accepted body response is strongly spatial rather than a uniform grade.
Across 1×/2×/4×, Wood core/crown/pocket RGB RMS spans
`12.18…12.39 / 10.38…10.62 / 7.36…7.58`; PLNT spans
`12.67…12.83 / 11.15…11.20 / 11.68…11.89`. Every probe now owns a frozen
per-target RGB/chroma/coverage/peak/signed/spatial envelope; the largest
observed normal-scale spread is only `0.24` RGB RMS, `0.16` chroma RMS, `0.22`
signed mean, `0.225` spatial RGB RMS, `0.028` coverage, and one peak byte.
Semantic material, raw alpha/support, CSS/backing geometry, all 1,568
native-wall cells, exact integer-cell control RGBA, and repeated-off
framebuffers remain stable. Protected composed controls are bounded to one
byte except the named HDR-filtered `WOODSandContactOwner` edge at three bytes.
The closing requested-on true-8× navigation
reports E20/HDR inactive with reason `scale-8`, no bloom, exact 4896×3072
direct WebGL, a signalled promotion fence, and zero browser errors; the final
full-matrix SwiftShader fence completed in about `5.13 s`.

Run `npm run audit:vfx:glass-body` for E21. It reloads a dedicated two-pane
exact-Glass fixture as `glassBodyVfx=0 → 1 → 0` at 1×/2×/4× while E10 stays
on as the accepted shallow-edge baseline and every unrelated E01–E20 selector
is pinned off and runtime-asserted inactive. Both panes expose exact depth
bytes 0, 6, 12–30, 36–66, and
192–255 plus authored holes/open notches and reconstructable cavities; the
last byte-30 cell is an explicit raw and composed control. The second pane
also carries a deterministic 3,072-cell checker of co-located native walls.
That checker is deliberately disjoint from the wall-free transition/core
calibration bands: native walls force depth zero and adjacent clear 4×4 blocks
remain shallow, so the checker is a protected no-op guard rather than a
through-wall E21 transmission target. Thin and isolated Glass, Glass/Ice,
Glass/Metal, and Glass/Water
contacts, Ice/QRTZ/Metal/CLNE/Lava/Sand/Water, and blank space are protected.
Across the accepted 1×/2×/4× calibration, transition RGB RMS is
`1.71…1.92` with a restrained `−1.18…−1.04` signed absorption, while the saturated
core is `4.99…5.23` RGB RMS with `−4.57…−4.49` signed absorption. The
ordered red/green/blue response proves selective transmission rather than a
uniform tint. The final 2× off/on capture shows a quieter continuous shoulder
into a cooler/deeper broad body, with no byte-30→36 ring or loss of the authored
holes, notch, cavity, thin line, contacts, or checker. All non-wall composed
controls and every repeated-off frame are
exact; occupied/clear native-wall probes are bounded to one composed byte.
Semantic material, raw alpha/support, CSS/backing geometry, wall hash, and
solid-depth hashes repeat exactly. Normal-scale captures use two identical
compositor reads per state plus an independent repeated-off navigation, so 4×
PNG encoding cannot consume the renderer-health deadline. Requested-on true 8× reports E21/HDR
inactive with reason `scale-8`, no bloom, exact 4896×3072, and completed
GPU-fence timing (`5.16 s` in the final package-matrix run).

Run `npm run audit:vfx:oil-body` for E22. It reloads a dedicated paired
exact-Oil fixture as `oilBodyVfx=0 → 1 → 0` at 1×/2×/4× while E03, E08, and E14
remain on as the accepted composed liquid stack and every unrelated selector
is pinned off. Both panes expose exact depth bytes 0, 6, 12–30, 36–66, 72–126,
and 192–255; the second also contains a deterministic 3,072-cell native-wall
checker whose occupied/clear runs remain depth 0–18. The fixture protects
authored holes, open chimneys, a reconstructable pinhole, thin/isolated Oil,
Diesel/Nitro Oily siblings, Water/Acid/Lava/Soap, Oil/Diesel and Oil/Water
seams, Oil/Glass/Metal/Sand/Smoke contacts, walls, and blank space. Semantic
ownership, full-frame alpha/support, wall/depth hashes, six liquid-field alpha
probes, integer-cell control RGBA, and repeated-off framebuffers remain
invariant.
Across the accepted matrix, open transition/mid/core RGB RMS is respectively
`0.89…0.91`, `1.40…1.41`, and `0.80`; the first two retain an ordered positive
amber spectrum while the deep core retains ordered blue-selective absorption
at signed mean `−0.53…−0.52`. The second pane's transition/mid/core is
`0.32…0.34`, `0.48…0.49`, and `3.31…3.32` RGB RMS; its deep amber crown is
`+2.60…+2.62` signed mean with spatial RGB RMS `2.024…2.031`. The largest
normal-scale RGB-RMS drift is `0.02`. All composed controls are bounded to one
byte except the explicitly named HDR-filtered `WALL_CONTROLPinhole` at three
and `oilGlassOil` at four; their exact integer-cell RGBA remains byte-identical.
Freeze the six probes to these per-target RGB, chroma, coverage, peak, signed,
spatial, and spectral envelopes; any permitted HDR neighbour footprint must be
named individually rather than allowed by a broad suffix rule. Requested-on
true 8× must report E03/E08/E14/E22 and HDR inactive with reason `scale-8`, no
bloom, exact 4896×3072, and completed GPU timing.
The final frozen full-matrix SwiftShader fence completed in `11.05 s`, inside
the original one-total 30-second promotion deadline, with zero browser errors.

Run `npm run audit:vfx:rock-roughness` for E23. It reloads a dedicated
geometry-matched ROCK/Metal fixture as `rockRoughnessVfx=0 → 1 → 0` at
1×/2×/4× with E17 and geological styling active and every unrelated experiment
pinned off. Both cards expose exact solid-depth bytes `0`, `6`, `12–30`,
`36–66`, `72–126`, and `192–255`. The fixture additionally protects Coal,
native-Powder Stone, Brick, Glass, Sand, Water, authored holes/open notches,
thin and isolated ROCK, a co-located native-wall region, blank space, and exact
ROCK/Metal/Water/Sand/Smoke contacts. Semantic ownership, full-frame alpha/
support, native-wall count/hash, solid-depth hashes, integer-cell raw controls,
and repeated-off framebuffers remain invariant.
Across the accepted matrix, shallow/transition/mid/deep RGB RMS is respectively
`0.82…0.87`, `2.39…2.40`, `1.84…1.85`, and `4.33…4.35`; chroma RMS remains
`0.39…0.41`, `0.47…0.49`, `0.46…0.47`, and `0.70…0.71`. Coverage is
`0.061…0.073`, `0.682…0.720`, `0.639…0.668`, and exactly `1.0`, with RGB peaks
of `2…3`, `5`, `4`, and `7`. Every band is a bounded negative gloss reduction:
signed means remain `−0.53…−0.52`, `−2.12…−2.09`, `−1.71…−1.69`, and
`−4.08…−4.07`, with blue-selective absorption ordered above green and red.
Spatial RGB RMS remains `0.621…0.675`, `1.015…1.033`, `0.554…0.575`, and
`1.048…1.076`, proving a shaped response rather than a uniform dark grade. The
largest normal-scale RGB-RMS drift is `0.05`; every Metal, material, topology,
contact, wall, and blank control is exact zero and every repeated-off framebuffer
is byte-identical. Freeze these per-target RGB, chroma, coverage, peak, signed,
spatial, and spectral envelopes. Requested-on true 8× reports E17/E23/HDR
inactive with reason `scale-8`, no bloom, exact `4896×3072`, and a completed
GPU fence. The final calibration fence completed in `8.60 s` with zero browser
errors.

The earlier post-E16 survey was invalid for Solid: it sampled native Stone `21`,
which is Powder, while labelling that region Solid. The corrected post-E17
showcase uses native ROCK `78`, asserts exactly `2769` matching Solid cells, and
is clean at 1×/2×/4× with identical `3702907786` semantic hashes, `104027`
occupied cells, stable CSS geometry, and zero browser errors. Its weakest-first
signal is Gas `1.944`, Solid `5.975`, Energy `7.817`, Powder `10.553`, Liquid
`11.233`, and Contact `15.849`. Never compare the new Solid score with the old
`5.923` value as though they measured the same material family.
The paired corrected native-ROCK run with E17 explicitly off retains the same
hash/occupancy and measures Solid `4.182`; enabling E17 raises only that sampled
family to `5.975` (`+42.9%`), with luma standard deviation `4.930 → 7.280` and
macro range `18 → 25` while every other family score is unchanged.

Interpret this as a survey, not an instruction to stack a fifth generic gas
layer: E04/E07/E13/E15 already own gas cohesion, motion, external light, and
core depth, and a smooth coherent cloud is expected to score low on local
contrast. E18 closes the demonstrated PTNM gap without changing this composed
ranking because the showcase contains no Platinum. The follow-up production
capture proved Gold/Iron/Titanium already own rolled-metal optics, Brick is
legible as warm masonry, and only Ceramic lacked a convincing surface finish.
E19 closes that exact gap without applying PTNM's roll or altering Brick. The
next production 4× survey then selected Wood/PLNT as the largest remaining
  fit-view defect, and E20 replaces their band-forming body carriers without
  changing sparse botanical topology or lifecycle state. E21 closes the deep-
  Glass defect while retaining E10's shallow edge. E22 closes the flat Oil-plug
  defect with an exact liquid-body card rather than widening Oily optics to
  Diesel or Nitro. E23 closes ROCK's demonstrated overly polished macro response
  by reducing its inherited gloss carriers rather than widening or replacing
  E17. Re-run the composed fit-view ranking before selecting E24; the previous
  ordering has now served its final demonstrated defect. Do not widen E17–E23
  owner sets by resemblance alone. Preserve their owner, exposure, topology,
  scale, and true-8× contracts independently.

**Next visual experiments:** E03–E23 now provide accepted liquid body/surface,
stable-gas, coherent-gas-motion, powder-depth, and powder-local-light
checkpoints plus exact resting contact grounding, Glass/Ice transmission, and
state-aware Wax/PLNT subsurface response, composed wet-mineral optics,
atmosphere-owned external-light spectra, exact liquid-side wet contacts, and
species-aware gas-core optical depth, dense-Plasma containment, exact
ROCK/Metal opaque-body relief, a distinct broad Platinum finish, an exact
Ceramic fired-glaze response, recomposed clustered Wood/PLNT bodies, and deep
Glass selective transmission, exact Oil amber-crown/cool-pocket body optics,
and an exact ROCK matte-body correction over E17. Re-rank the production
fit-view before selecting another material card. The radioactive-solid review
found no current identity bug, but also
proved that the existing
phase-permissive identity guard is not suitable for a future broad ISZS/VIBR
finish; such work needs its own exact solid-only fixture and gate. Continue
with topology-preserving, material-
specific cards that reuse already-live evidence. Prefer the smallest
arithmetic-only candidate that fixes a visible fit-view deficiency; do not add
an isolated tint merely to continue the experiment number. Preserve the E14
1× stencil snap and all E01–E23 selectors/controls while surveying.

## Phase 1 — HDR pipeline & lighting core (biggest visual payoff)

**Goal:** everything downstream needs light and dynamic range; build the chassis first.

- **Move from single-pass to a small multi-pass pipeline.** Semantic field → material reconstruction pass (albedo + normals + thickness + emissive into an MRT or packed RGBA16F target) → lighting pass → bloom chain → tonemap composite. You're currently proudly single-target; this is the architectural pivot that unlocks everything else.
- **WebGL 2 baseline** (or Pixi v8's WebGPU renderer — see Phase 4). You need float render targets and MRT; WebGL1 will fight you.
- **Blackbody emission model:** replace ad-hoc heat tint with a proper temperature→blackbody ramp (Tanner Helland approximation) driving both color *and* HDR intensity. Lava, fire, heated metal become genuinely luminous rather than "warm-tinted."
- **Screen-space bloom:** threshold at HDR >1.0, downsampled mip chain (à la Call of Duty / Unity bloom), additive combine before ACES tonemapping. This alone transforms fire/plasma/ELEC.
- **2D deferred-ish lighting:** you already reconstruct contour normals — light them. Global key light + per-pixel normals → diffuse/specular. Then **local dynamic lights**: fire, plasma, explosions, LIGH emit point lights. Cap at ~16–32 active lights via a light grid/texture, fallback to emissive-only beyond that.

## Phase 2 — Fluid & gas realism

**Goal:** liquids read as one continuous body with a surface; gases read as volumetric media.

- **Screen-space fluid rendering** (Müller-style, the classic 2007 technique): liquid coverage → depth/thickness buffer → **curvature flow smoothing** for a real meniscus → reconstruct normals → **Fresnel reflection + refraction of the background/wall pattern behind** → specular glints. Your current per-species depth gradient is the seed of the thickness buffer.
- **Foam & spray:** whitecap tint where velocity divergence or surface agitation is high; tiny detached particles get spray sprites.
- **Gases as participating media:** extend your density/colour field with a **noise-animated volume** — FBM curl noise advected by the velocity field, modulated by density, lit by the dynamic lights (light shafts through smoke are extremely high-impact). Approximate with 2–3 octave noise at half res, upsampled.
- **Fire:** blackbody core + procedural licking edges (domain-warped FBM along the temperature gradient), ember streaks from velocity.

## Phase 3 — Material delicacy

**Goal:** each optical class gets a signature response instead of a shared treatment.

- **Per-class PBR-ish parameters** in your palette LUT: roughness, metallic, translucency, IOR. You already have the 13-class alpha byte — promote it to index a proper material parameter texture.
- **Subsurface approximation** for organic/ice/wax/translucent rigid: thickness map (you have solid depth scans!) → wrap lighting + transmitted color, so ice glows at thin edges.
- **Ambient occlusion:** cheap SSAO-analog from the occupancy field — darken creases and contact points between heaps, walls, and solids. Huge depth cue at trivial cost.
- **Powders:** grain sparkle at high zoom (per-cell hash jitter on albedo, already partially there), heap-scale slope shading with AO in valleys.
- **Caustics-lite** under water/oil bodies: animated light patterns on the floor beneath translucent liquid, driven by the same noise field as the surface.
- **Velocity-aware effects:** short motion-smear along velocity for fast powders/liquids, streak rendering for PHOT/ELEC/LIGH.

## Phase 4 — Tech-direction decisions

- **WebGPU via Pixi v8** is worth prototyping on a branch: compute shaders would let you do fluid smoothing, light accumulation, and noise advection in compute, with WebGL2 as the fallback path. Pixi 8's architecture supports both. If that's too much churn, WebGL2 + MRT + float targets gets you 90% there.
- **Half-res and temporal tricks:** bloom, AO, and volumetrics at half or quarter res; temporal accumulation/jitter for the volumetric noise to hide the low res.
- **LOD by zoom:** your 1×–8× renderScale tiers are natural LOD gates — enable expensive effects (per-grain detail, refraction) only at 4×+, keep 2× clean.
- **Keep the Canvas2D fallback honest:** define the "minimum viable look" (albedo + contour + simple tint) and gate everything else behind WebGL capability. You already have the degradation machinery — the new pipeline just adds more rungs.
- **Budget discipline:** you cap at 30 Hz with dirty-chunk uploads — good. Add a GPU-time governor: measure frame cost, shed bloom octaves → volumetric octaves → AO as needed. Mobile-first means thermal throttling is the real enemy.

## Suggested sequencing

1. HDR + bloom + tonemap (week 1–2) — immediate wow.
2. Normal lighting + blackbody emission — materials start feeling physical.
3. Screen-space liquid surface (curvature flow + Fresnel/refraction).
4. Dynamic local lights from emissive elements.
5. Volumetric gas/fire noise.
6. AO + SSS + per-class PBR polish.
7. WebGPU compute prototype in parallel once the effect set stabilizes.

Each phase ships independently and degrades gracefully, so you're never holding an unreleasable branch.
