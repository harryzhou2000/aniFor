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
- **E24 — exact Water depth-light recomposition (accepted checkpoint):** the
  post-E23 production capture exposed broad exact Water as a cyan slab crossed
  by coherent diagonal sheen/caustic bands. Normal 1×–4× WebGL now uses
  `?waterBodyVfx=0|1`, strictly subordinate to `?liquidBodyVfx=0|1`, to
  attenuate only that inherited positive carrier after depth byte 30 and
  recombine its already-live sheen, caustic, macro-relief, reflected-
  environment, and optical-depth evidence into soft reflective crowns and
  absorptive pockets. Eligibility requires authoritative Water `2`, Aqueous
  optics, ordinary connected Liquid, exact same-species support, at least three
  of the already-computed semantic 2×2 occupancy samples (`shape.w > 2.5`),
  byte-30–78 depth handoff, and no wall, trait, emission, reconstruction,
  molten state, or foreign/unlike contact. SaltWater, DistilledWater, DEUT,
  Oil, Acid, Lava, surfaces, shallow bands, one-cell strands, droplets,
  isolated cells, authored holes/chimneys, seams, Solid/Powder/Gas contacts,
  native walls, Canvas, and compact true 8× remain controls. E24 adds no wave,
  clock, sample, sampler, texture, field, pass, target, upload, allocation,
  alpha/support/silhouette/ownership/topology, state, or physics decision.
- **E25 — exact Noble Gas pearlescent-billow depth (accepted checkpoint):**
  the media-aware post-E24 rank identified exact Noble Gas as the weakest gas
  card. Normal 1×–4× WebGL now uses `?nobleGasBillowVfx=0|1`, strictly
  subordinate to `?gasBodyVfx=0|1`, to give propagated atmosphere style `7`
  a bounded violet/cyan key and complementary absorptive pocket. It reuses only
  E04's connected-body, static billow, directional relief,
  curvature, density, crown, pocket, and cardinal-neighbour evidence. The
  production Noble core is fully dense, so E25 attenuates rather than zeros its
  deep response; it still changes RGB only and never claims field support.
  Smoke, Oxygen, Hydrogen, FOG, CFLM, sparse gas topology, Water/Metal contacts,
  walls, Canvas, and compact true 8× remain controls. Authored void/channel
  footprints and the Noble side of the Noble/FOG seam are bounded to one
  composed byte; foreign FOG remains exact. E25 adds no sample, sampler,
  texture, field, resource, pass, target, upload, allocation, clock,
  output-scale input, alpha, support, silhouette,
  ownership, topology, state, or physics decision.
- **E26 — exact Wood/PLNT mesostructure (accepted checkpoint):** normal
  1×–4× WebGL now uses `?botanicalMesostructureVfx=0|1` only as a child of
  E20's exact ordinary Wood `9` (`traits == 96`) and PLNT `10` (`traits == 32`)
  body eligibility. It reuses `botanicalDepth`, `botanicalMacro`,
  `botanicalCluster`, and existing `barkBody`/`knot`: PLNT gets smooth
  6.5-cell lobe/vein contours with near-luminance-neutral chlorophyll/young-
  growth pigment, while Wood gets irregular longitudinal bark plates/fissures
  with warm/umber pigment. Sparse/thin owners, holes/notches, walls, contacts,
  VINE/Wax/Metal, lifecycle cyan/magenta state, Canvas, and compact true 8×
  remain controls. E26 adds no noise, sample, texture, field, pass, resource,
  time, alpha/support/state/topology, or physics decision.
- **E27 — exact Smoke soft volume (accepted checkpoint):** normal 1×–4×
  WebGL uses `?smokeSoftnessVfx=0|1` only as a child of E04's connected gas
  body. Exact propagated atmosphere style `1` reuses E04's existing third
  static carrier, composite billow, directional relief, curvature, density,
  crown, and pocket evidence to form one broad warm-neutral soot fold. It adds
  no noise, new wave, clock, sample, texture, field, pass, resource, allocation,
  alpha/support/silhouette/topology/ownership/state, or physics decision.
  Sparse Smoke, foreign gas styles, Water/Metal contacts,
  native walls, Canvas, and compact true 8× remain controls. Because semantic
  gas uses `discreteShape`, ordinary semantic-contact outputs are not valid E27
  guards: the exact-Smoke side of an unlike-gas seam may retain a bounded
  composed response, while the foreign side remains raw-RGBA exact; only its
  named immediate HDR seam footprint may move one composed byte. Authored gaps keep
  exact semantic/alpha/support topology, but their already-supported atmosphere
  edge is also a bounded composed footprint.
- **E28 — exact Wood/PLNT pigment and body depth (accepted checkpoint):**
  normal 1×–4× WebGL uses `?botanicalPigmentVfx=0|1` only as a strict child
  of both E20 body recomposition and E26 mesostructure. The selector defaults
  on when both parents are active, while the shader locally ANDs E26 and E28
  before applying the response. Ordinary authoritative Wood `9`
  (`traits == 96`) and PLNT `10` (`traits == 32`) may reuse only the existing
  `botanicalDepth`, `botanicalMacro`, `botanicalCluster`, `leafPigment`, and
  `barkPlate` evidence for bounded warm/umber Wood depth and chlorophyll/young-
  growth PLNT volume. Sparse/thin bodies, holes/notches, walls, contacts,
  VINE/Wax/Metal, lifecycle colour/state, Canvas, and compact true 8× remain
  controls. E28 adds no noise, sample, sampler, texture, field, pass, resource,
  target, upload, allocation, clock, alpha/support/topology/lifecycle state, or
  physics decision. E26's focused gate explicitly pins E28 off so its accepted
  evidence remains an isolated E26 measurement.
- **E29 — exact ROCK mesostructure (accepted visual checkpoint):** normal
  1×–4× WebGL uses `?rockMesostructureVfx=0|1` only as a strict child of E17
  solid-body relief and E23 ROCK roughness. Exact authoritative ROCK `78` with
  ordinary SmoothRigid `profile == 2`, a deep stable connected body, and no
  wall, trait, emission, reconstruction, foreign contact, or unlike contact
  may reuse one 3.5-cell smooth value-noise facet and a masked, warped,
  interrupted lamina. It is RGB-only; the prior continuous-striped tune was
  rejected. E29 adds no sample, texture, field, pass, target, allocation,
  clock, alpha, support, topology, or physics decision, while Canvas and
  compact true 8× retain their established paths. Its 2× composed capture
  improves ROCK quality `45.685 → 90.2`, micro `.43 → 1.06`, and macro
  `21 → 30`, with luma SD `6.58`, range `36`, exact support/component, and
  zero dark, clipped, and browser-error counts. The focused package gate,
  `npm run audit:vfx:rock-mesostructure`, passed its frozen 1×/2×/4× matrix at
  exact 612×384, 1224×768, and 2448×1536 backings. Off→on→off restoration has
  repeat peak zero; semantic/alpha/support/walls/depth/raw state is unchanged
  across four depth targets and all 30 unique controls. Meso/cell frequency is
  `1.7989–2.1292`/`1.6378–1.8512`, downsample retention `.9605–.9654`, and
  transition/mid/deep RGB RMS `3.56–3.99` with 12–14-byte peaks and zero
  browser errors. Requested-on true 8× is exact 4896×3072 with E17/E23/E29/HDR
  inactive for `scale-8`, no bloom, and a `5397.6 ms` GPU fence inside the
  shared total deadline.
  The full composed production matrix also passed with zero errors,
  `crossScaleVerified=true`, and `fullScaleMatrix=true`: ROCK quality/micro/
  macro is `88.235`/`1.00`/`30` at 1×, `90.2`/`1.06`/`30` at 2×, and
  `90.81`/`1.08`/`30` at 4×. Support recall and dominant component are `1`,
  dark/clipped fractions are zero at every scale, and luma range is
  `35`/`36`/`36`.
- **E30 — exact Wood interrupted bark relief (accepted visual checkpoint):**
  normal 1×–4× WebGL uses `?woodBarkReliefVfx=0|1` as a strict child of E26
  mesostructure while remaining independent of E28 pigment. Only E20's exact
  authoritative Wood `9`, ordinary `traits == 96`, deep interior/contact/wall/
  emission proof may receive it. E30 recombines the existing
  `botanicalCluster`, `botanicalMacro`, `barkWarp`, and signed `barkPlate`
  evidence to break continuous longitudinal fissures into irregular plates.
  The rejected candidate used a new five-cell y-periodic sine and could form
  horizontal scanlines; never restore that independent carrier. E30 is
  RGB-only and adds no noise call, sample, sampler, texture, field, resource,
  pass, target, upload, allocation, clock, alpha, support, silhouette,
  ownership, topology, state, or physics decision. Canvas and compact true 8×
  retain their established paths. `npm run audit:vfx:wood-bark-relief` proves
  off→on→off restoration at 1×/2×/4× over two exact Wood bodies and 34 exact
  PLNT/lifecycle/topology/contact/wall/foreign-owner controls. Target RGB/
  chroma/spatial RMS is `7.77–9.68`/`1.68–2.09`/`6.603–8.407`, peak is 32
  bytes, response microcontrast is `1.92–2.35`, meso/cell RMS is
  `3.7535–4.4430`/`3.8513–5.1776`, retention is `.9667–.9765`, and the
  longitudinal gradient ratio is `2.3334–2.5150`. Requested-on true 8× remains
  exact 4896×3072 with E20/E26/E28/E30/HDR inactive for `scale-8` and a real
  GPU fence in about `5.69 s`.
  The full composed matrix is `crossScaleVerified=true` and
  `fullScaleMatrix=true`: Wood quality/micro/chroma/macro is
  `71.833`/`1.97`/`1.29`/`26` at 1×,
  `80.251`/`2.25`/`1.42`/`26` at 2×, and
  `83.247`/`2.37`/`1.47`/`26` at 4×, with exact semantic hash/count,
  support/component `1`, zero dark/clipped fractions, and zero browser errors.
- **E31 — exact Noble Gas prismatic interior (accepted visual checkpoint):**
  normal 1×–4× WebGL uses `?nobleGasPrismVfx=0|1` as a strict child of E25
  billow depth and E04 atmosphere ownership. Only exact propagated atmosphere
  style `7` may receive it. The shader recombines the already-live broad
  `gasVfxBillow` and `gasVfxWaveC` evidence into a restrained bipolar
  pearlescent fold inside the connected Noble Gas body. It is RGB-only and
  adds no wave, sample, sampler, texture, field, upload, pass, target,
  allocation, clock, output-scale, alpha/support, silhouette, ownership,
  topology, state, or physics decision. Canvas and compact true 8× retain
  their established paths. `npm run audit:vfx:noble-gas-prism` proves
  off→on→off restoration at 1×/2×/4× with exact semantic, atmosphere,
  wall, support, geometry, and raw-control state; repeated-off peak is zero.
  Key/pocket/broad RGB RMS is about `7.04`/`.87`/`5.59`, with a broad stable
  spatial response at all three scales. Requested-on true 8× remains exact
  4896×3072 with E04/E25/E31/HDR inactive for `scale-8` and a real GPU fence.
  The full composed matrix is `crossScaleVerified=true` and
  `fullScaleMatrix=true`: Noble quality becomes
  `95.351`/`95.463`/`95.463` at 1×/2×/4×, luma deviation is
  `3.51`/`3.52`/`3.52`, support/component remain `1`, dark/clipped fractions
  remain zero, and semantic hash/count and browser-error contracts stay exact.
- **E32 — exact PLNT lamina detail (accepted visual checkpoint):** normal
  1×–4× WebGL uses `?plantLaminaVfx=0|1` as a strict child of E28 pigment,
  E26 mesostructure, and E20 body recomposition. Only authoritative PLNT `10`
  inside the inherited ordinary body proof may respond, and only when its
  packed native lifecycle word is exact zero or the presence-only `0x8000`
  marker. Hydration, growth, direction, phase, and inherited-colour payloads
  remain controls. Inside that eligible branch, the shader evaluates one
  deterministic world-anchored 2.8-cell procedural value-noise octave and
  combines it with the established leaf body, pigment, vein, and boundary
  evidence for irregular lamina grain. This is RGB-only and adds no texture or
  field sample, sampler, resource, upload, pass, target, persistent allocation,
  clock, alpha/support, silhouette, ownership, topology, lifecycle state, or
  physics decision. Canvas and compact true 8× retain their established paths.
  `npm run audit:vfx:plant-lamina` proves 1×/2×/4× off→on→off restoration,
  34 exact controls, repeated-off peak zero, and requested-on true-8× exclusion
  at exact 4896×3072 with a real `5.2–5.8 s` GPU fence and zero browser errors.
  The accepted canonical 2× composed candidate lifts PLNT quality
  `56.122 → 78.733`; microcontrast/chroma/macro become `1.93`/`1.75`/`36`,
  luma SD/range becomes `7.99`/`42`, support/component stay `1`, and clipping
  stays zero. The final full production matrix is `crossScaleVerified=true`
  and `fullScaleMatrix=true`, with HDR and E32 active at every scale, identical
  semantic hash `595518258`, and zero browser errors. At 1×/2×/4×, PLNT
  quality is `69.928`/`78.733`/`82.641`, support recall is `1`/`1`/`1`,
  coverage is `.971`/`.971`/`.971`, luma SD is `7.90`/`7.99`/`8.06`,
  microcontrast is `1.70`/`1.93`/`2.07`, chroma is
  `1.66`/`1.75`/`1.77`, and macro range is `36`/`36`/`36`; dark and clipped
  fractions remain zero.
- **E33 — exact Smoke billow depth (accepted visual checkpoint):** normal
  1×–4× WebGL uses `?smokeBillowDepthVfx=0|1` as a strict child of E27 soft
  volume and E04 atmosphere ownership. Only propagated atmosphere style `1`
  that inherits E27's connected-body, cardinal-neighbour, wall, and
  non-emissive Smoke proof may respond. It recombines only the accepted static
  fold/billow, directional relief, connected-body support, cardinal-neighbour
  density, and atmosphere alpha into a bounded RGB-only deep soot-volume
  response. It adds no wave, noise, sample, texture, field, resource, pass,
  target, upload, allocation,
  clock, alpha/support, silhouette, ownership, topology, state, or physics
  decision. Canvas and compact true 8× remain excluded. `npm run
  audit:vfx:smoke-billow-depth` proves off→on→off at 1×/2×/4×, deep/crown/
  pocket and density mid/rim response, 18 exact controls including the
  authored void/channel, and only two bounded SMKE/FOG interface footprints.
  Requested-on true 8× keeps E04/E15/E25/E27/E33/HDR inactive for `scale-8`,
  promotes exact 4896×3072, and signals a real GPU fence in about `5.2 s` with
  zero browser errors. The full production matrix is `crossScaleVerified=true`
  and `fullScaleMatrix=true`: semantic hash remains `595518258`, support recall
  is `1`, coverage `.647`, and dark/clipped fractions plus browser errors are
  zero. Smoke quality is `100` at 1×/2×/4×; luma SD is `4.12` throughout,
  microcontrast `.43`/`.46`/`.48`, chroma `.55`/`.57`/`.58`, macro range `18`,
  and luma range `20`/`21`/`21`.
- **E34 — exact PLNT lobe depth (accepted visual checkpoint):** normal
  1×–4× WebGL uses `?plantLobeDepthVfx=0|1` only as a strict child of E20 body
  recomposition, E26 mesostructure, E28 pigment/body depth, and E32 lamina.
  Only E32's authoritative ordinary zero-state or presence-only PLNT `10` body
  proof may respond. It recomposes the already-live lamina body, lobe, vein,
  boundary, pigment, and environment evidence into a bounded signed crown,
  pocket, and vein-depth response that quiets E32's unrelated closed fine-loop
  read at fit view. It adds no noise call, sample, sampler, texture, field,
  resource, pass, target, upload, allocation, clock, alpha/support, silhouette,
  ownership, lifecycle, topology, state, or physics decision. Canvas and
  compact true 8× retain E32. `npm run audit:vfx:plant-lobe-depth` freezes two
  target-specific bipolar response/frequency envelopes, 34 exact Wood,
  lifecycle, topology, contact, wall, and foreign-owner controls, and a
  byte-exact repeated-off framebuffer. Requested-on true 8× keeps
  E20/E26/E28/E32/E34/HDR inactive for `scale-8`, with no bloom, exact
  4896×3072 promotion, and a completed GPU fence. The final composed PLNT
  quality is `74.414`/`82.892`/`86.238` at 1×/2×/4×; at canonical 2× it improves
  `78.733 → 82.892`, with mesostructure `.465 → .535`, pigment `.8333 → .8600`,
  macro range `36 → 40`, luma SD/range `7.99/42 → 8.72/49`, exact support
  recall `1`, coverage `.971`, and zero dark/clipped fractions or browser
  errors.
- **E35 — exact Wood tannin/cambium volume (accepted visual checkpoint):**
  normal 1×–4× WebGL uses `?woodTanninVfx=0|1` only as a strict child of both
  E28 pigment/body depth and E30 interrupted bark relief. Only their shared
  authoritative ordinary Wood `9` body proof may respond. E35 recombines the
  already-live signed heartwood pigment, segment evidence, bark plate/fissure,
  optical depth, and environment into absorptive tannin pockets and restrained
  warm cambium/crown exposure. It adds no position carrier, noise call, sample,
  sampler, texture, field, resource, pass, target, upload, allocation, clock,
  alpha/support, silhouette, ownership, lifecycle, topology, state, or physics
  decision. Canvas and compact true 8× retain E28+E30. `npm run
  audit:vfx:wood-tannin` freezes two target-specific response/frequency
  envelopes, the same 34 PLNT/lifecycle/topology/contact/wall/foreign-owner
  controls, and a byte-exact repeated-off framebuffer. Target RGB/chroma RMS
  is `3.35–4.07`/`3.22–3.90`, peak is 16–17 bytes, meso/cell RMS is
  `1.8667–2.0323`/`.6623–.7006`, downsample retention is `.9791–.9826`, and
  gradient ratio is `1.6188–1.7980`. Requested-on true 8× keeps
  E20/E26/E28/E30/E35/HDR inactive for `scale-8`, with no bloom, exact
  4896×3072 promotion, and a completed GPU fence. The final composed Wood
  quality improves `71.833/80.251/83.247 → 79.215/86.709/89.610` at
  1×/2×/4×. Pigment rises `.5267/.6133/.6467 → .7200/.8067/.8467`, macro
  range rises `26 → 28`, support recall remains `1`, coverage remains `.933`,
  and dark/clipped fractions plus browser errors remain zero.
- **E36 — exact PLNT canopy-mass recomposition (accepted visual checkpoint):**
  normal 1×–4× WebGL uses `?plantCanopyMassVfx=0|1` only as a strict child of
  E34 lobe depth. Only E34's authoritative ordinary zero-state or
  presence-only PLNT `10` body proof may respond. It reuses E20 body
  depth/macro/cluster, E26 lobe/boundary/vein, E28 pigment, E32 lamina, and
  E34 lobe-depth evidence for bounded broad front/rear/overlap canopy mass
  shading. Only while active, E36 suppresses the thresholded E26/E32/E34
  vein-loop carriers that produce repeated enclosed outlines; it does not
  change their owners or selector-off operation order. It adds no sample, noise
  call, sampler, texture, field, resource, pass, target, upload, allocation,
  clock, state, topology, alpha/support, silhouette, ownership, or physics
  decision. Canvas and compact true 8× retain E34. `npm run
  audit:vfx:plant-canopy-mass` owns direct focused seam metrics plus frozen
  1×/2×/4× off→on→off semantic/alpha/support, lifecycle, wall, topology,
  contact, and foreign-owner proof with byte-exact repeated-off frames.
  Requested-on true 8× keeps E20/E26/E28/E32/E34/E36/HDR inactive for
  `scale-8`, with no bloom, exact 4896×3072 promotion, and a completed GPU
  fence. A composed-rank drop after E36 is a scorer blind spot and must not be
  gamed: preserve the direct seam evidence and visible hierarchy/overlap. The
  frozen 1×/2×/4× matrix reduces left-body dark seams
  `.0573/.0775/.0861 → .0360/.0476/.0496` and right-body seams
  `.0643/.0805/.0924 → .0401/.0502/.0514`; enabled strong seams remain at most
  `.0046`, all `4416`/`4048` target cells map uniquely, and 15-cell macro range
  rises from about `14.1 → 17.3` / `16.4 → 22.1`. The true-8× fence signalled
  in `5268.1 ms` with zero browser errors.
- **E37 — exact Metal-side Water-contact polish (accepted checkpoint):** normal
  1×–4× WebGL uses `?metalWaterContactVfx=0|1` only as a strict child of both
  E14 liquid/Solid meniscus optics and E17 opaque-Solid body relief. Only
  authoritative Metal `23` on the Solid side of a clean exact-Water contact may
  respond. At 1×, E37 reuses the already-unconditional species-aware liquid
  field sample because a cell-centred fragment cannot resolve E14's Hermite
  derivative. At 2×/4×, it reuses the same four `contactSample` probes and packs
  exact Water above the established categorical foreign bit, leaving existing
  `0.5` consumers unchanged while E37 decodes the tag above `1.5`. It changes
  RGB only and adds no sample, sampler, texture, field, resource, pass, target,
  upload, allocation, clock, alpha/support, silhouette, ownership, topology,
  state, or physics decision. Oil/Metal, mixed Water/Metal/Smoke, unlike owners,
  deep cores, air, walls, traits, emission, reconstructed support, Canvas, and
  compact true 8× remain controls. `npm run audit:vfx:metal-water-contact` owns
  the 1×/2×/4× off→on→off, per-scale/per-orientation response, exact-owner,
  parent-dependency, and byte-exact repeated-off proof. Its normalized
  horizontal/vertical RGB RMS is `0.95/0.89`, `1.06/0.81`, and `0.56/1.02` at
  1×/2×/4×; the frozen cross-scale/orientation ratio remains below `2.2`.
  Keep those per-target numeric envelopes in the gate rather than replacing
  them with one permissive family-wide bound.
  Requested-on true 8× must keep E03/E14/E17/E37/HDR inactive for `scale-8`,
  with no bloom, exact 4896×3072 promotion, and a completed GPU fence.
- **E38 — exact Oil volume finish (accepted visual checkpoint):** normal
  1×–4× WebGL uses `?oilVolumeFinishVfx=0|1` only as a strict child of E22 and
  therefore E03. Only authoritative Oil `8` with Oily optics in an
  already-proven connected, deep, ordinary interior may respond. It recombines
  the existing broad-sheen, caustic-wave, macro-relief,
  reflected-environment, and liquid-depth evidence into broad amber crowns and
  cooler absorption pockets. Walls, contacts, traits, emission, sparse
  support, unlike owners, and reconstructed space remain controls. It changes
  RGB only and adds no sample, sampler, texture, field, resource, pass, target,
  upload, allocation, clock, wave, alpha/support, silhouette, ownership,
  topology, state, or physics decision. Canvas retains E22 and compact true 8×
  has no E38 uniform or shader branch. `npm run audit:vfx:oil-body` first
  preserves the frozen E22 parent with E38 disabled, then owns the E38
  1×/2×/4× off→on→off whole-body, transition/mid/deep, invariant, control, and
  cross-scale proof. Requested-on true 8× must report E38 inactive for
  `scale-8`, promote exact 4896×3072 WebGL, and complete its GPU fence. The
  corrected exact-Acid liquid-volume branch uses material `13`; material `16`
  is SaltWater.
- **E39 — exact Acid reactive body (accepted visual checkpoint):** normal
  1×–4× WebGL exposes `?acidBodyVfx=0|1` as a strict child of E03. Only
  authoritative Acid `13` with Corrosive optics in an already-proven
  connected, deep, ordinary interior may respond. It recombines the existing
  broad-sheen, caustic-wave, macro-relief, reflected-environment,
  liquid-depth, and species-slope evidence into broad reactive green crowns
  and violet absorptive pockets. SaltWater `16`, BASE, other liquids, walls,
  contacts, traits, emission, sparse/shallow support, unlike owners, and
  reconstructed space remain controls. The response is RGB-only and adds no
  texture read, sampler, field, resource, pass, target, upload, allocation,
  output-scale resource, clock, wave, alpha/support, silhouette, ownership,
  topology, state, or physics decision. Canvas retains E03 and compact true
  8× has no E39 uniform or branch. `npm run audit:vfx:acid-body` owns the
  two-pane 1×/2×/4× whole-body, transition/mid/deep, invariant, explicit
  control, repeated-off, and cross-scale proof. Requested-on true 8× must
  report E39 inactive for `scale-8`, promote exact 4896×3072 WebGL, and
  complete its GPU fence.
- **E40 — exact sooty-powder body (accepted visual checkpoint):** normal
  1×–4× WebGL exposes `?sootyPowderBodyVfx=0|1` as a strict child of E05.
  Only authoritative GUNP `14` and BCOL `217` with SootyGranular optics inside
  E05's settled, dry Smooth body proof may respond. It reuses the existing
  depth, stability, slope, macro/facet balance, and body gate for a porous
  warm/cool crown, opposing absorptive pocket, and restrained core while the
  later explosive and BCOL fracture identities remain authoritative. Coal
  `19`, other granular/explosive/radioactive owners, genuine wet GUNP/BCOL,
  moving targets, holes, chimneys, fine topology, walls, contacts, Local,
  Grains, Canvas, and compact true 8× remain controls. The response changes RGB
  only and adds no sample, texture, field, pass, target, upload, allocation,
  clock, alpha/support, silhouette, owner, topology, state, or physics
  decision. `npm run audit:vfx:sooty-powder-body` owns the frozen
  1×/2×/4× off→on→off response, invariant, microchroma, style-reference,
  control-footprint, repeated-off, and cross-scale proof. Requested-on true 8×
  reports E40 inactive for `scale-8`, promotes exact 4896×3072 WebGL, and
  completes its GPU fence.
- **E41 — exact DEUT concentration body (accepted visual checkpoint):** normal
  1×–4× WebGL exposes `?deutBodyVfx=0|1` as a trait-aware sibling of E03,
  not a widening of E03's trait-free liquid gate. Only authoritative DEUT
  `100` with Aqueous optics, Radioactive trait, ordinary connected Liquid,
  dense semantic/field/depth support, no wall/emission/molten/reconstruction,
  and no foreign/unlike/species contact may respond. It decodes the full
  existing B/A native concentration word, keeps zero exact-flat, increases a
  restrained ordinary response through `240`, and saturates compressed optics
  at `6000` so reaction-yield `17000` and maximum `65535` remain equivalent.
  A static parabolic 24×16 carrier plus 48-cell diagonal gives matched atlas
  cards broad cobalt/cyan crowns, opposing pockets, and core absorption without
  inheriting the ordinary liquid clock. The response is RGB-only and adds no
  sampler, texture read, field, resource, pass, target, upload, allocation,
  alpha/support, silhouette, owner, topology, native state, or physics
  decision. `npm run audit:vfx:deut-body` owns the frozen 1×/2×/4× off→on→off
  state/body/role/control/cross-scale matrix plus true-8× exclusion. Requested-
  on true 8× reports E41 inactive for `scale-8`, promotes exact 4896×3072
  WebGL, and completes its shared-deadline GPU fence.
- **Protected 8× rung:** `renderScale=8` deliberately reports
  `hdrPipeline=inactive` / `scale-8` and retains the proven direct single-mesh
  4896×3072 path. The experiment must earn a bounded 8× design rather than
  allocating a 115 MiB full-resolution float target beside that path.
- **Current decision:** E01/E02/E03/E04/E05/E06/E07/E08/E09/E10/E11/E12/E13/E14/E15/E16/E17/E18/E19/E20/E21/E22/E23/E24/E25/E26/E27/E28/E29/E30/E31/E32/E33/E34/E35/E36/E37/E38/E39/E40/E41 remain opt-in through the non-Classic looks
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
  review. E24 is accepted as the exact deep-Water carrier recomposition: it
  replaces the two dominant diagonal bands with a lower-anisotropy broad crown/
  pocket response while leaving shallow Water and sparse/foreign topology on
  their established path. Freeze its E03 dependency, exact Water owner,
  byte-30–78 handoff, semantic `shape.w > 2.5` support proof, carrier factor,
  crown/pocket spectra, and compact-8× exclusion until another production
  fit-view review. E28 is accepted as the exact botanical pigment/body-depth
  refinement over E20+E26: it lifts Wood and PLNT fit-view volume without a new
  carrier, sample, state plane, or lifecycle decision. Freeze its two-parent
  dependency, exact-owner/trait/body proof, reused pigment carriers, and true-
  8× exclusion until another production fit-view review.
  E29 is the accepted visual exact-ROCK mesostructure checkpoint: freeze its
  E17/E23 dependencies, exact owner/profile/deep-stable-connected/no-contact
  proof, 3.5-cell facet, and masked interrupted lamina. Its continuous-striped
  predecessor remains rejected. Its package gate passed the frozen cross-scale
  matrix and true-8× exclusion/fence proof.
  E30 is the accepted exact-Wood interrupted-bark checkpoint: freeze its E26
  dependency, E28 independence, E20 exact-owner/body proof, existing-evidence-
  only irregular segment mask, 32-byte focused peak, longitudinal direction
  bound, and compact-8× exclusion. Its rejected y-periodic predecessor must
  remain rejected.
  E31 is the accepted exact-Noble Gas prismatic-interior checkpoint: freeze its
  E04/E25 dependencies, exact propagated-style-7 body proof, broad existing-
  evidence-only bipolar fold, accepted cross-scale envelope, and compact-8×
  exclusion. Do not replace its broad `gasVfxWaveC` carrier with a cell-scale
  motif or stack it onto foreign atmosphere species.
  E32 is the accepted exact-PLNT lamina checkpoint: freeze its E20/E26/E28
  dependency chain, exact zero-or-presence-only lifecycle gate, one branch-
  gated world-anchored 2.8-cell value-noise octave, and compact-8× exclusion.
  Do not widen it to stateful PLNT, add another octave, or turn its RGB grain
  into silhouette or topology.
  E33 is the accepted exact-Smoke billow-depth checkpoint: freeze its E27/E04
  dependency chain, propagated-style-1 connected Smoke proof, and reuse of the
  accepted static fold/billow, directional relief, connected-body support,
  cardinal-neighbour density, and atmosphere alpha. Do not add a
  wave/noise/resource or widen its RGB response
  into support, topology, state, or the compact 8× path.
  E34 is the accepted exact-PLNT lobe-depth checkpoint: freeze its E20/E26/E28/
  E32 dependency chain, exact zero-or-presence-only lifecycle gate, reused
  lobe/vein/boundary evidence, two target-specific bipolar response and
  frequency envelopes, 34 exact controls, and compact-8× exclusion. Do not
  add another PLNT noise octave, widen it to stateful PLNT, or let its RGB
  contour alter alpha, support, lifecycle, topology, or Canvas.
  E35 is the accepted exact-Wood tannin/cambium volume checkpoint: freeze its
  joint E28+E30 dependency, exact ordinary-Wood proof, reused pigment/segment/
  plate/fissure/depth/environment evidence, two target-specific response and
  frequency envelopes, 34 exact controls, and compact-8× exclusion. Do not add
  another Wood noise carrier, widen it to sparse/contact/stateful Wood, or let
  its RGB absorption/exposure alter alpha, support, topology, state, or Canvas.
  E36 is the accepted exact-PLNT canopy-mass recomposition checkpoint: freeze
  its strict E34 child gate, exact zero-or-presence-only lifecycle proof,
  existing E20/E26/E28/E32/E34 scalar reuse, direct focused seam metrics,
  thresholded vein-loop suppression only while active, 34 exact controls, and
  compact-8× exclusion. A composed-rank drop is a scorer blind spot, not a
  mandate to game the scorer or weaken the hierarchy/overlap proof. Its final
  composed PLNT score is `62.215`/`67.661`/`69.253`; that score fell because
  the current organic scorer rewards cell-scale contrast, while E36's direct
  seam gate proves that the repeated enclosed mesh was actually removed.
  E37 is the accepted exact Metal-side Water-contact checkpoint: freeze its
  joint E14+E17 dependency, exact Water/Metal ownership, scale-specific reuse
  of the existing liquid/contact evidence, Oil/Metal and mixed-contact controls,
  RGB/topology invariants, and Canvas/compact-8× exclusion. Its response
  envelopes and cross-scale strength ceiling remain frozen in the dedicated
  gate; do not replace them with one permissive family-wide bound.
  The failed extra-output/local-carrier prototypes blanked normal WebGL, so the
  compact packed-tag implementation and its real-browser gate are part of the
  checkpoint.
  E38 is accepted as the exact-Oil broad volume-finish checkpoint: freeze its
  strict E22/E03 dependency, exact Oil `8`/Oily/deep-connected-interior proof,
  reuse of the existing sheen/caustic/macro/environment/depth carriers, two
  whole-body plus transition/mid/deep response envelopes, exact raw invariants,
  named bounded HDR-neighbour controls, and Canvas/compact-8× exclusion. The
  frozen E22 parent must run first with E38 disabled; do not replace its prior
  Oil acceptance with the child result or stack another Oil layer over E38.
  E39 is accepted as the exact-Acid broad reactive-body checkpoint: freeze its
  strict E03 dependency, exact Acid `13`/Corrosive/deep-connected-interior
  proof, reuse of the existing sheen/caustic/macro/environment/depth/species
  carriers, broad whole-body bipolar response, transition/mid/deep envelopes,
  raw and topology invariants, named bounded compositor-neighbour controls,
  narrow 1×–4× stability, and Canvas/compact-8× exclusion. SaltWater `16`
  and BASE remain explicit controls. Do not widen this into generic Corrosive
  styling or stack another Acid-only layer over E39.
  E40 is accepted as the exact GUNP/BCOL sooty-powder body checkpoint: freeze
  its strict E05 dependency, exact SootyGranular owner proof, settled dry
  Smooth body gate, reuse of the existing depth/stability/slope/facet carriers,
  warm-GUNP/cool-BCOL crown spectra, opposing pockets, distinct cores, genuine
  wet-target and authored-motion exclusions, Local/Grains no-ops, internal
  microchroma retention, narrow 1×–4× response spread, and Canvas/compact-8×
  exclusion. Coal and the other granular/explosive/radioactive controls must
  remain exact; do not turn E40 into a family-wide carbon or explosive grade.
  E41 is accepted as the exact DEUT radioactive-liquid body checkpoint: freeze
  its separate trait-aware eligibility, full native `Uint16` concentration
  decode, zero-state no-op, connected/deep owner proof, matched static
  24×16/48-cell carrier, cobalt/cyan crown and absorptive pocket grammar,
  `6000` visual saturation, exact raw controls, narrow 1×–4× response spread,
  and Canvas/compact-8× exclusion. Do not make DEUT eligible for E03, copy E41
  onto other radioactive liquids, or reintroduce a time-varying carrier.
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

Run `npm run audit:vfx:oil-body` for the frozen E22 parent and the E38 child. It
first reloads a dedicated paired
exact-Oil fixture as `oilBodyVfx=0 → 1 → 0` at 1×/2×/4× while E03, E08, and E14
remain on as the accepted composed liquid stack and every unrelated selector
is pinned off, including E38. Both panes expose exact depth bytes 0, 6, 12–30,
36–66, 72–126,
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

The same command then holds E22 on and reloads E38 as
`oilVolumeFinishVfx=0 → 1 → 0` at 1×/2×/4×. In addition to the six frozen depth
bands, it measures both complete Oil bodies so a narrow phase-locked highlight
cannot pass as volume. The accepted open-body response is scale-stable at RGB
RMS `3.44`, chroma RMS `1.38`, coverage `.411–.412`, signed mean `.53`,
positive/negative means `1.39/.86`, a `14`-byte peak, and spatial RGB RMS
`3.396–3.397`. The wall-backed body remains bipolar at RGB RMS `2.82`, chroma
RMS `1.15`, coverage `.294–.295`, positive/negative means `.96–.97/.66`, and
the same `14`-byte peak. The production composed Oil card rises from roughly
`91.033` at canonical 2× to `100.000`; luma deviation rises `4.01 → 5.02`,
macro range `16 → 20`, and microcontrast `.24 → .29`, while coverage remains
`.953`, the dominant component remains `1`, and clipping remains zero.
Semantic ownership, raw alpha/support, walls, auxiliary depth, liquid-field
alpha, and repeated-off framebuffers stay exact. Every filtered neighbour
footprint is named and bounded: the 1× Oil/Water Oil-side probe may reach eight
bytes while the Water owner remains exact, the 1× Oil/Glass Oil-side probe may
reach four, and the smaller scale-dependent pinhole/contact footprints retain
their dedicated limits. These are CSS/compositor footprints, not permission to
mutate raw owners. Requested-on true 8× keeps E38 inactive for `scale-8`, with
no E38 shader branch, exact 4896×3072 WebGL, and a completed GPU fence.

Run `npm run audit:vfx:acid-body` for E39. It reloads a dedicated two-pane
exact-Acid fixture as `acidBodyVfx=0 → 1 → 0` at 1×/2×/4× with E03
active and unrelated experiments pinned off. Both 264×176 bodies expose exact
liquid-depth bytes `0`, `6`, `12–30`, `36–66`, `72–126`, and `192–255`; the
second carries a deterministic 3,072-cell native-wall checker. Authored holes,
open chimneys, a reconstructable pinhole, a strand, droplet, isolated Acid,
SaltWater/Water/Oil/Lava/BASE/DistilledWater, five unlike-liquid seams, four
foreign-phase contacts, walls, and blank space are explicit controls.
Semantic ownership, raw alpha/support, wall/depth/field state, exact raw
control RGBA, and the repeated-off framebuffer must remain invariant.

The accepted open whole-body response is scale-stable at RGB RMS
`5.28–5.29`, chroma RMS `3.92–3.93`, coverage `.625–.628`, signed mean
`2.55–2.56`, a `20`-byte peak, and spatial RGB RMS `4.757–4.766`; it retains
both a positive green crown (`3.16–3.17`) and opposing violet pocket
(`.61`). The checker-backed whole body remains bipolar at RGB RMS
`4.69–4.70`, chroma RMS `3.49–3.50`, coverage `.516–.518`, signed mean
`2.24`, positive/negative means `2.68–2.69/.44`, the same `20`-byte peak,
and spatial RGB RMS `4.263–4.274`. Transition/mid/deep bands have separate
frozen RGB/chroma/coverage/signed/spatial envelopes so the response cannot
collapse into a narrow highlight or flat tint. Normal-scale RGB and spatial
RMS spread is capped at `.08`, chroma at `.10`, coverage at `.04`, signed
mean at `.06`, and peak must be identical. All composed controls are exact
except individually named one-byte filtered Acid-side/wall-neighbour samples
and the wall-backed pinhole at three bytes; every opposite owner and every raw
owner remains byte-identical. Requested-on true 8× keeps E39 inactive for
`scale-8`, has no E39 uniform or shader branch, promotes exact 4896×3072
WebGL, and must complete its GPU fence with zero browser errors. The final
frozen production-WebGL matrix completed that fence in `5.25 s`.

Run `npm run audit:vfx:sooty-powder-body` for E40. It reloads a paused exact
GUNP `14` / BCOL `217` fixture as `sootyPowderBodyVfx=0 → 1 → 0` at
1×/2×/4× with E05 active and unrelated experiments pinned off. Both broad
bodies expose named crown, pocket, and core probes, holes, open chimneys, thin
columns, isolated grains, and full 24×30 authored-velocity rectangles. BCOL
also carries an exact 3,072-cell native-wall checker. Coal, Sand, Salt,
Thermite, C4, BREC, BRMT, SING, Sand/Water, GUNP/Metal, BCOL/Fire, guarded
blank space, and genuine 2:1 aqueous Sand/GUNP/BCOL weaves are explicit
controls. The gate scans the complete velocity and stability regions, requires
exact semantic/alpha/support/wall/suspension state, and proves Local and Grains
are exact no-ops.

The frozen normal-WebGL matrix holds GUNP whole-body RGB RMS at `2.27–2.28`,
BCOL at `.86–.87`, with spatial RGB RMS `1.488–1.503` and `.745–.751`.
GUNP's warm crown has RGB RMS `1.51–1.53` and signed mean `.03–.10`; its
cooler pocket reaches `4.00–4.02` and `−3.64…−3.62`. BCOL's cool crown is
`.95–.99` with signed mean `.03–.09`; its warmer absorptive pocket is
`2.03–2.08` and `−1.92…−1.87`. Each core has a distinct frozen response.
Incremental internal microchroma retention stays within `.9738–1.0174`, while
repeated-off frames are byte-exact. Cross-scale RGB/chroma/spatial spread is
capped at `.06/.06/.04`, coverage at `.045`, signed mean at `.08`, and peak
spread at one byte. Every composed control is exact except named one-byte
filtered BCOL-chimney/native-clear/contact-side footprints; raw owners and
support remain exact. Requested-on true 8× has no E40 uniform or branch,
reports `scale-8`, promotes exact 4896×3072 WebGL, and completed its GPU fence
in `5.209 s` with zero browser errors.

Run `npm run audit:vfx:deut-body` for E41. It reuses the complete seven-card
DEUT native-state fixture, adds matched deep body/crown/pocket/core calibration
regions, and expands the two high-word probes to wall-free 24×40 connected
bodies. The gate reloads `deutBodyVfx=0 → 1 → 0` at 1×/2×/4× with every other
HDR experiment pinned off, waits for a completed WebGL frame before copying the
backing, and hashes semantic matter, exact DEUT state, liquid field, phase-local
depth, native walls, alpha, and support. Zero-state DEUT, shallow bands, holes,
open notches, one-cell structure, isolated particles, wrong-owner Sand, Water,
Metal, EXOT, ISOZ, wall coexistence, liquid/solid contacts, and guarded blanks
remain controls; every raw control pixel is byte-exact.

The accepted production matrix holds default/low/medium/pre-glow/glow/
compressed whole-body RGB RMS at `1.82–1.85`, `2.21–2.22`, `.33–.45`,
`2.40–2.47`, `2.42–2.46`, and `5.62–5.68`. The `239/240` E41 response ratio
is `.992–1.025`, while the stronger compressed body remains at least 1.5× the
ordinary peak. Reaction-yield `17000` and maximum `65535` matched deep probes
visually saturate at `5.99–6.03` and `5.65–5.75` RGB RMS with the same 13-byte
peak. Named crowns stay positive and pockets negative except the deliberately
near-neutral medium native albedo; cores retain non-uniform spatial response.
In the accepted run, the largest target RGB-RMS spread across output scales was
`.37`; non-contact compositor controls stayed within two bytes and direct
contact shoulders within 11. The frozen gate permits at most `.50` cross-scale
target RMS and 12-byte contact shoulders, while raw controls and repeated-off
frames remain exact. Requested-on true 8× has no E41 uniform or shader branch,
reports `scale-8`, promotes exact
4896×3072 WebGL, preserves every state/topology digest, and completed its
shared-deadline GPU fence in `5.2105 s` with zero browser errors.

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

Run `npm run audit:vfx:water-body` for E24. It reloads a dedicated paired Water
fixture as `waterBodyVfx=0 → 1 → 0` at 1×/2×/4× with E03, E08, and E14 active
and every unrelated experiment pinned off. Both panes prove liquid-depth bytes
`0`, `6`, `12–30`, `36–66`, `72–126`, and `192–255`; the second pane adds
3,072 co-located native-wall cells. The fixture protects SaltWater, Distilled
Water, DEUT, Oil, Acid, Lava, exact Water/unlike-liquid seams, Glass/Metal/Sand/
Smoke contacts, surface and shallow bands, one-cell strands, droplets,
isolated cells, holes, chimneys, reconstructed pinholes, and blank space.
Semantic ownership, full-frame alpha/support, native-wall count/hash, liquid-
depth and field support, exact integer-cell raw controls, and repeated-off
framebuffers remain invariant. The one-cell strand initially exposed a real
4× subpixel eligibility leak; the accepted shader closes it with the already-
live `shape.w > 2.5` semantic-support proof rather than an output-scale test.

Across the frozen matrix, open-pool transition/mid/deep RGB RMS is
`1.33…1.35`, `1.94…1.95`, and `5.64…5.65`; RGB peaks are exactly `4`, `5`, and
`13`. Transition and mid are visibly bipolar (`+0.13 / −0.93…−0.96` and
`+0.24…+0.26 / −1.44…−1.49` luminance), while the core stays primarily
absorptive at signed mean `−4.51…−4.50`. Most importantly, open-pool
directional anisotropy falls from `0.192…0.202` to `0.160…0.180` in the
transition, `0.484…0.509` to `0.428…0.438` in the mid body, and
`0.125…0.144` to `0.061…0.090` in the deep core. The wall-backed pane retains
the same checker ownership with RGB RMS `0.75…0.77`, `1.46…1.47`, and
`2.07…2.08`. Named HDR-filtered neighbour footprints are bounded individually:
all foreign owners remain exact, while the largest Water-side/pinhole/contact
display response is five bytes. Requested-on true 8× reports E03/E08/E14/E22/
E24 and HDR inactive with reason `scale-8`, no bloom, exact `4896×3072`, and a
completed GPU fence. The final frozen full-matrix fence completed in `5.56 s`
with zero browser errors.

Run `npm run audit:vfx:noble-gas-billow` for E25. It reloads a dedicated
propagated-Noble atmosphere fixture as `nobleGasBillowVfx=0 → 1 → 0` at
1×/2×/4× with E04 active and every unrelated experiment pinned off. The fixture
contains a broad rounded Noble body with deterministic crown and pocket lobes,
a dense core, authored void and open channel, two sparse carriers plus midpoint,
gap, and isolated probes, a Noble/FOG seam, Smoke/Oxygen/Hydrogen/FOG/CFLM
controls, Water and Metal contacts, a native wall, and guarded blank. Semantic
ownership, sampled atmosphere style/density, full-frame alpha/support,
native-wall state, raw controls, and repeated-off framebuffers remain invariant.
Only the authored void, open channel, and Noble side of the unlike-gas seam may
receive the audited one-byte HDR-neighbour footprint; all other composed
controls are exact.

Across the accepted matrix, dense-core RGB RMS is `2.43…2.44` with signed mean
about `+2.54`, peak `4`, and coverage about `0.87`; crown RGB RMS is `3.00`
with signed mean `+3.27…+3.29`, peak `4`, and full coverage; pocket RGB RMS is
`0.81…0.83` with signed mean `−0.76…−0.74` and peak `1`. Cross-scale drift is
negligible, the response remains spectrally broad, and every protected sibling,
sparse, contact, wall, and blank probe is byte-stable. Requested-on true 8×
proves actual WebGL promotion at exact `4896×3072`, then reports E04/E15/E25/
HDR inactive with reason `scale-8`; a separate post-promotion GPU fence
completed in about `5.26 s` in the final accepted full matrix, with zero browser
errors.

Run `npm run audit:vfx:botanical-mesostructure` for E26. It verifies
`botanicalMesostructureVfx=0 → 1 → 0` at 1×/2×/4× under E20's existing body
proof, with sparse/thin owners, authored holes/notches, walls, contacts,
VINE/Wax/Metal, Canvas, and compact true 8× protected. Lifecycle inherited
cyan/magenta PLNT state remains exact. The final canonical 2× result is Wood
micro/chroma/macro `1.50`/`.69`/`21` and Plant `1.51`/`.93`/`28`; support recall
and component count are `1`, with dark/clipped fractions `0`. Organic quality
is `33.569` (from `2.463`), with family-average micro/chroma/macro
`1.505`/`.81`/`24.5`. The accepted full 1×/2×/4× matrix keeps all 30 named
controls exact, repeats the disabled framebuffer byte-for-byte, preserves the
1,568-cell wall and 3,840-cell lifecycle planes, and retains bipolar,
downsample-stable, material-distinct body spectra. Requested-on true 8× excludes
E26 after observed exact 4896×3072 WebGL promotion and a `5607.1 ms` GPU fence,
with zero browser errors.

Run `npm run audit:vfx:smoke-softness` for E27. It owns the 1×/2×/4×
`smokeSoftnessVfx=0 → 1 → 0` sequence under E04 while pinning every other
optional visual selector off. It must preserve exact semantic,
atmosphere-style/alpha/support, native-wall, and raw-alpha state; repeat the
disabled framebuffer byte-for-byte; show a broad positive crown and negative
pocket; keep adjacent-pixel Smoke contrast at or below `0.55`; and leave
Oxygen/Hydrogen/Noble/FOG/CFLM, sparse, Water/Metal, wall, and blank controls
exact. The already-supported authored-void/channel edges and the Smoke side
of the Smoke/FOG seam are bounded composed controls; foreign FOG is raw exact,
with its named immediate HDR seam footprint bounded to one composed byte.
Requested-on true 8× must
observe actual 4896×3072 WebGL promotion and a completed GPU fence while
E04/E15/E25/E27/HDR report inactive for reason `scale-8`. The accepted run
passes the full 1×/2×/4× off→on→off matrix with zero browser errors, then
completes the exact 4896×3072 true-8× tail through a `3444.1 ms` GPU fence.

Run `npm run audit:vfx:botanical-pigment` for E28. It owns the normal-WebGL
1×/2×/4× `botanicalPigmentVfx=0 → 1 → 0` sequence under E20 and E26,
while E26's independent focused gate pins E28 off. The E28 shader path locally
ANDs both selectors, and the default resolver enables E28 only when its parents
are active. The accepted matrix preserves exact semantic, alpha/support,
auxiliary, native-wall, and lifecycle state; all 30 named controls are exact,
and the disabled framebuffer repeats byte-for-byte. Its spatial response and
frequency retention remain bounded across scales. Requested-on true 8× must
promote actual WebGL at exact 4896×3072 while E20/E26/E28/HDR report inactive
for reason `scale-8`. The accepted tail signals a real GPU fence in `3113.6 ms`
with zero browser errors.

Run `npm run audit:vfx:wood-bark-relief` for E30. It isolates E20+E26 with E28
off and runs `woodBarkReliefVfx=0 → 1 → 0` at 1×/2×/4×. Two deep Wood targets
respond while both broad PLNT bodies, both inherited-colour lifecycle canopies,
and all 30 earlier topology/contact/wall/foreign-owner controls remain exact.
The frozen gate requires the existing-evidence-only irregular segment mask,
32-byte peak, bipolar response, `.9667–.9765` downsample retention, and
`2.3334–2.5150` longitudinal gradient ratio; repeated-off peak is zero.
Requested-on true 8× must promote exact 4896×3072 WebGL while E20/E26/E28/E30/
HDR remain inactive for `scale-8`; the accepted tail signals a `5692.4 ms` GPU
fence with zero browser errors.

Run `npm run audit:vfx:noble-gas-prism` for E31. It isolates E04+E25 and runs
`nobleGasPrismVfx=0 → 1 → 0` at 1×/2×/4× while pinning the other optional
visual selectors off. The exact Noble Gas key, pocket, and broad inner-body
targets respond; semantics, atmosphere bytes, alpha/support, native walls,
CSS/backing geometry, authored voids/channels, Noble and FOG seams, sparse
carriers, foreign species, liquid/solid contacts, and blank controls remain
frozen. The disabled framebuffer repeats byte-for-byte. The accepted
cross-scale response is broad and bipolar: key/pocket/broad RGB RMS is about
`7.04`/`.87`/`5.59`, target peak remains `9` bytes, and control peak remains
at most `3`. Requested-on true 8× must promote exact 4896×3072 WebGL while
E04/E25/E31/HDR remain inactive for `scale-8`; the accepted tail signals a
real GPU fence with zero browser errors.

Run `npm run audit:vfx:plant-lamina` for E32. It isolates E20+E26+E28 and runs
`plantLaminaVfx=0 → 1 → 0` at normal WebGL 1×/2×/4× while pinning unrelated
optional visual selectors off. The two exact zero-state/presence-only PLNT
bodies respond; both stateful lifecycle canopies and all earlier topology,
contact, wall, and foreign-owner probes remain among 34 exact controls.
Semantics, alpha/support, auxiliary depth, native walls, lifecycle state, and
the disabled framebuffer remain exact, with repeated-off peak zero. The one
2.8-cell procedural octave is evaluated only inside the exact eligible PLNT
branch; no texture sample or GPU resource is added. Requested-on true 8× must
promote exact 4896×3072 WebGL while E20/E26/E28/E32/HDR remain inactive for
`scale-8`; accepted runs signal real GPU fences in roughly `5.2–5.8 s` with
zero browser errors. The final production rerun keeps HDR and E32 active at
1×/2×/4× and reports `crossScaleVerified=true`, `fullScaleMatrix=true`, exact
semantic hash `595518258`, and zero browser errors. PLNT quality is
`69.928`/`78.733`/`82.641`; support recall is exact `1`, coverage is exact
`.971`, macro range is exact `36`, and dark/clipped fractions are zero at all
three scales. Luma SD is `7.90`/`7.99`/`8.06`, microcontrast is
`1.70`/`1.93`/`2.07`, and chroma is `1.66`/`1.75`/`1.77`.

Run `npm run audit:vfx:smoke-billow-depth` for E33. It isolates E04+E27 and
runs `smokeBillowDepthVfx=0 → 1 → 0` at normal WebGL 1×/2×/4× while pinning
unrelated optional selectors off. Exact Smoke deep/crown/pocket and density
mid/rim targets respond; 18 controls, including the authored void/channel,
remain exact apart from the two named bounded SMKE/FOG interface footprints.
Semantic and atmosphere state, alpha/support, native walls, CSS/backing
geometry, and the disabled framebuffer remain exact, with repeated-off peak
zero. The effect only recombines E27's accepted static signals; it adds no
wave, noise, texture, field, GPU resource, or state/topology decision.
Requested-on true 8× promotes exact 4896×3072 WebGL while E04/E15/E25/E27/E33/
HDR remain inactive for `scale-8`; the accepted tail signals a real GPU fence
in about `5.2 s` with zero browser errors. The final production rerun keeps HDR
and E33 active at 1×/2×/4× with `crossScaleVerified=true`,
`fullScaleMatrix=true`, and exact semantic hash `595518258`. Smoke quality is
`100` at every scale; support recall is `1`, coverage `.647`, luma SD `4.12`,
microcontrast `.43`/`.46`/`.48`, chroma `.55`/`.57`/`.58`, macro range `18`,
and luma range `20`/`21`/`21`; dark/clipped fractions and browser errors are
zero.

Run `npm run audit:vfx:plant-lobe-depth` for E34. It isolates E20+E26+E28+E32
and runs `plantLobeDepthVfx=0 → 1 → 0` at normal WebGL 1×/2×/4× while pinning
unrelated optional selectors off. The two exact zero-state/presence-only PLNT
bodies must retain their target semantic/depth state; the 34 Wood, lifecycle,
topology, contact, wall, and foreign-owner controls plus raw control points
remain exact, and the disabled framebuffer repeats byte-for-byte. The frozen
gate requires bounded bipolar target response and frequency evidence: PLNTLeft
is constrained to `1.10–1.21` RGB RMS with a 7-byte peak, while PLNTRight is
`1.47–1.62` with a 9-byte peak; both retain their target-specific coverage,
signed, meso/cell, and cross-scale envelopes. Requested-on true 8× promotes
exact 4896×3072 WebGL while E20/E26/E28/E32/E34/HDR remain inactive for
`scale-8`, with no bloom and a completed GPU fence. The final production rerun
keeps HDR and E34 active at 1×/2×/4× with exact semantic hash `595518258` and
zero browser errors. PLNT quality is `74.414`/`82.892`/`86.238`; support recall
is `1`, coverage `.971`, macro range `40`, and dark/clipped fractions are zero
at every scale. At canonical 2× E34 improves PLNT `78.733 → 82.892`, with
mesostructure `.465 → .535`, pigment `.8333 → .8600`, and luma SD/range
`7.99/42 → 8.72/49`.

Run `npm run audit:vfx:wood-tannin` for E35. It isolates E20+E26+E28+E30 and
runs `woodTanninVfx=0 → 1 → 0` at normal WebGL 1×/2×/4× while pinning both
PLNT-only children and unrelated optional selectors off. The two exact Wood
bodies retain their frozen material/depth digests; 34 PLNT, lifecycle,
topology, contact, wall, and foreign-owner controls plus raw control points
remain exact, and the disabled framebuffer repeats byte-for-byte. The frozen
per-target gate requires RGB/chroma RMS `3.30–3.42`/`3.17–3.29` for WOODLeft
and `3.98–4.14`/`3.81–3.97` for WOODRight, with their separate coverage,
peak, meso/cell, retention, gradient, bipolar, and cross-scale envelopes.
Requested-on true 8× promotes exact 4896×3072 WebGL while
E20/E26/E28/E30/E35/HDR remain inactive for `scale-8`, with no bloom and a
completed GPU fence (about `5.26 s` on the final frozen run). The parent E28
and E30 package gates independently pass with E35 pinned off. The final
production matrix keeps exact semantic hash `595518258`, `104027` occupied
cells, and `952/952` Wood support at every scale with zero browser errors.
Wood quality is `79.215`/`86.709`/`89.610`, mesostructure is
`.520`/`.655`/`.715`, pigment is `.7200`/`.8067`/`.8467`, luma SD is
`7.64`/`7.90`/`8.02`, microcontrast is `2.04`/`2.31`/`2.43`, chroma is
`1.58`/`1.71`/`1.77`, macro range is `28`, support recall is `1`, coverage is
`.933`, and dark/clipped fractions are zero.

Run `npm run audit:vfx:plant-canopy-mass` for E36. It isolates the strict
E20+E26+E28+E32+E34 parent chain and runs `plantCanopyMassVfx=0 → 1 → 0` at
normal WebGL 1×/2×/4× while pinning unrelated optional selectors off. Its
direct focused seam metrics must prove the broad front/rear/overlap canopy
result while the thresholded E26/E32/E34 vein loops are suppressed only for
the enabled E36 frame. Semantic, alpha, support, lifecycle, native walls,
topology/contact/foreign-owner controls, and repeated-off framebuffer remain
exact. Requested-on true 8× promotes exact 4896×3072 WebGL while
E20/E26/E28/E32/E34/E36/HDR remain inactive for `scale-8`, with no bloom and a
completed GPU fence. Do not use a composed-rank drop to game the scorer; the
direct seam metrics and visible hierarchy are the acceptance evidence.

Run `npm run audit:vfx:metal-water-contact` for E37. It keeps E14 and E17 live,
runs `metalWaterContactVfx=0 → 1 → 0` at normal WebGL 1×/2×/4×, and samples the
exact Metal side of horizontal and vertical Water/Metal contacts. The same
fixture supplies a clean Oil/Metal exact-owner control plus mixed contact,
deep-body, air, wall, trait, emissive, and topology controls. Semantic, alpha,
support, auxiliary/wall state, CSS/backing geometry, raw protected pixels, and
the repeated-off framebuffer must remain exact. Separate dependency probes
prove that an explicit child request cannot resurrect disabled E14, E17, or
E03 liquid-body ownership. Requested-on true 8× promotes exact 4896×3072 WebGL
while E03/E14/E17/E37/HDR remain inactive for `scale-8`, with no bloom and a
completed GPU fence. The numeric response bounds and cross-scale strength
ceiling are intentionally frozen in the gate rather than duplicated here.

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
  E17. The historical post-E23 composed rerun recovered only an authoritative
  1× frame and used an invalid cross-media local-contrast scalar; retain it only
  as the evidence that led to E24, never as the current ranking. The post-E24
  showcase now draws the Water pool before its radius-8 Metal capsule and owns
  its audit manifest in the app. The final scene has semantic hash `595518258`,
  104,027 occupied cells, exactly 880 Metal cells in a symmetric 18-row mask,
  intact surrounding Water controls, the exact 19-material histogram, and 14
  named media probes over identical half-open world rectangles. A clean
  production WebGL 1×/2×/4× matrix reproduces those semantics, rendered-cell
  parity, CSS geometry, and field-support masks at every scale.

  The pre-E25 ranking used separate granular-body, cohesive-liquid, diffuse-gas,
  rigid-body, organic-body, emissive-volume, and phase-contact cue envelopes.
  Required cues combine through a weighted harmonic mean, and each family is
  represented by its weakest required probe rather than an average that can
  hide a failed material. At canonical 2× the weakest-first quality indices are
  Gas `2.454` (`gasNoble`, billow depth), Organic `2.463` (`organicWood`,
  mesostructure), Solid `45.685`, Contact `88.235`, Liquid `91.033`, Emission
  `98.475`, and Powder `100.000`.
  The same order and exact semantics held at 1×/2×/4× within the audit's raw and
  normalized drift bounds. The PNG sampler subtracts a same-page canvas-hidden
  backdrop and admits pixels only through the owning semantic,
  propagated-atmosphere-style, or shared-emission support mask. All ordinary
  and gas probes have full presentation recall; Plasma remains at least
  `0.984`. E25 closes that exact target: a fresh canonical 2× rerank raises
  `gasNoble` from `2.454` to `4.609`, shifts Gas to `4.546` with `gasSmoke`
  softness now its weakest probe, and leaves Organic `2.463` as the global
  weakest family. E26 then raises Organic to `33.569` (Wood `33.569`, Plant
  `48.031`) in the final canonical 2× run. That apparent Smoke-softness
  diagnosis exposed a scorer error: v3 required a minimum adjacent-pixel gas
  contrast and therefore rewarded stipple. Version 4 changes softness to the
  one-sided ceiling `fall(microContrast, 0.50, 1.25)`; the unchanged pre-E27
  Smoke frame scores `45.542`, not the obsolete v3 `4.546`. E27 raises exact
  Smoke to `66.914` at canonical 2× while keeping microcontrast `0.39`; Gas is
  now represented by Noble Gas at `52.710`, and Organic remains globally
  weakest at `33.569`. E28 then completes a full
  `crossScaleVerified=true` 1×/2×/4× matrix with the unchanged semantic hash
  `595518258`, 104,027 occupied cells, and zero browser errors. At canonical
  2×, Wood quality is `50.781` with micro/chroma/macro
  `1.52`/`1.00`/`21`; PLNT is `56.122` with `1.55`/`1.16`/`33`; both have zero
  dark and clipped fractions. PLNT quality remains `46.355` at 1× and `59.540`
  at 4×. Organic is therefore represented by Wood at `50.781`, and Solid/ROCK
  surface detail becomes the weakest canonical family at `45.685`. E29's 2×
  composed ROCK capture raises that target to `90.2`, and its focused audit
  passed. E30 then completes another exact full 1×/2×/4× production matrix
  with the same semantic hash/count and zero browser errors. Wood quality/
  micro/chroma/macro becomes `71.833`/`1.97`/`1.29`/`26` at 1×,
  `80.251`/`2.25`/`1.42`/`26` at 2×, and
  `83.247`/`2.37`/`1.47`/`26` at 4×. Support/component remain `1`, dark/clipped
  remain zero, and luma range is `37`/`42`/`41`. E31 then raises Noble Gas from
  `52.710` to `95.351`/`95.463`/`95.463` at 1×/2×/4×, with full support recall
  and zero clipping. E32 then raises canonical 2× PLNT from `56.122` to
  `78.733`, with microcontrast/chroma/macro `1.93`/`1.75`/`36`, luma SD/range
  `7.99`/`42`, support/component `1`, and zero clipping. E33 then raises
  canonical Smoke from E27's `66.914` to `100.000` while retaining exact
  semantic support and topology. E34 then raises PLNT from `78.733` to
  `82.892` at canonical 2× and to `74.414`/`82.892`/`86.238` at 1×/2×/4×,
  retaining exact support, coverage, and zero clipping. Wood `80.251` is now
  the organic family floor, followed by Contact `88.235`, Solid `90.2`, Liquid
  `91.033`, Gas `95.463`, Emission `98.475`, and Powder `100.000`. Do not
  widen E17–E34
  owner sets by resemblance alone or stack
  another generic gas layer over E04/E07/E13/E15; preserve their independent
  owner, exposure, topology, scale, and true-8× contracts. E35 then raises
  Wood to `79.215`/`86.709`/`89.610`; the fresh post-E35 canonical survey made
  PLNT `82.892` the organic floor and visibly exposed its repeated enclosed
  mesh. E36 deliberately removes that mesh. Its final composed PLNT score is
  `62.215`/`67.661`/`69.253`, while Contact `88.235`, Solid `90.2`, Liquid
  `91.033`, Gas `95.463`, Emission `98.475`, and Powder `100.000` remain
  unchanged. This numeric decrease is a known scorer blind spot: the scorer
  rewards cell-scale contrast, while E36's exact focused appearance gate proves
  lower seam density, lower local contrast, stronger macro hierarchy, unchanged
  semantic support, and byte-exact selector-off recovery.

**Next visual experiments:** E03–E41 now provide accepted liquid body/surface,
stable-gas, coherent-gas-motion, powder-depth, and powder-local-light
checkpoints plus exact resting contact grounding, Glass/Ice transmission, and
state-aware Wax/PLNT subsurface response, composed wet-mineral optics,
atmosphere-owned external-light spectra, exact liquid-side wet contacts, and
species-aware gas-core optical depth, dense-Plasma containment, exact
ROCK/Metal opaque-body relief, a distinct broad Platinum finish, an exact
Ceramic fired-glaze response, recomposed clustered Wood/PLNT bodies, and deep
Glass selective transmission, exact Oil amber-crown/cool-pocket body optics,
an exact ROCK matte-body correction over E17, lower-anisotropy exact-Water
depth-light recomposition, exact Noble Gas pearlescent billow depth, exact
Wood/PLNT mesostructure, exact Smoke soft soot volume, and exact Smoke
billow-depth. E27's final
canonical 2× Smoke result is luma deviation `2.22`, microcontrast `.39`, macro
range `10`, luma range `14`, full support recall, and no clipping. E28 adds
exact Wood/PLNT pigment/body depth without disturbing E20/E26 topology or
lifecycle state. E29's 2× composed capture adds exact ROCK mesostructure with
the rejected continuous stripe replaced by an interrupted lamina; its focused
audit passed. E30 adds exact Wood interrupted bark relief without changing
PLNT, lifecycle state, or topology. E31 adds an exact Noble Gas prismatic
inner-volume fold without changing atmosphere ownership, topology, or compact
8×. E32 adds exact zero-state/presence-only PLNT lamina grain without changing
lifecycle state, topology, or compact 8×. E33 adds exact Smoke billow depth
without changing atmosphere ownership, topology, Canvas, or compact 8×. E34
recomposes exact zero-state/presence-only PLNT lobe depth without widening the
E32 lifecycle gate or compact 8×. E35 adds exact Wood tannin/cambium volume
over E20/E26/E28/E30. E36 adds exact PLNT broad front/rear/overlap canopy mass
recomposition over E34 while suppressing thresholded vein loops only when
active; its composed-rank drop is a scorer blind spot and must not be gamed.
E37 adds exact Metal-side Water-contact spectral separation over the joint E14+
E17 proof without changing either body's topology. E38 turns the previously
flat, opaque-looking exact-Oil pool into a broad bipolar amber/cool volume by
recombining already-live E22/E03 evidence; it deliberately ends the current
Oil stack. E39 turns the formerly one-sided exact-Acid absorption into a broad
reactive green crown with opposing violet pockets by recombining existing E03
evidence; it deliberately ends the current Acid stack. E40 gives exact GUNP
`14` and BCOL `217` stable dry Smooth bodies a porous warm/cool crown,
absorptive pocket, and restrained core without flattening their sparse identity
marks or internal grain cadence; Coal `19`, other owners, wet/moving powder,
fine topology, walls, contacts, Local, Grains, Canvas, and compact 8× remain
controls. The next survey should compare exact Hydrogen `40` as an E04-owned
gas-body candidate against a separate exact ISZS/VIBR solid-only eligibility
proof. DEUT `100` is no longer a survey candidate: E41 now gives it an accepted
trait-aware connected radioactive-liquid body without widening E03. Do not
widen E04, E03, or E41; either next direction needs its own exact-owner fixture
and browser gate.
Improve distinctive depth, transmission, reflection, lighting, and
mesostructure without stacking another narrow Oil/Acid/contact tint or generic
PLNT/gas layer.
The
radioactive-solid review
found no current identity bug, but also
proved that the existing
phase-permissive identity guard is not suitable for a future broad ISZS/VIBR
finish; such work needs its own exact solid-only fixture and gate. Continue
with topology-preserving, material-
specific cards that reuse already-live evidence. Prefer the smallest
arithmetic-only candidate that fixes a visible fit-view deficiency; do not add
an isolated tint merely to continue the experiment number. Preserve the E14
1× stencil snap and all E01–E41 selectors and controls while designing the
next bounded card.

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
