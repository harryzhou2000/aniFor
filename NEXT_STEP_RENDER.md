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
- **Protected 8× rung:** `renderScale=8` deliberately reports
  `hdrPipeline=inactive` / `scale-8` and retains the proven direct single-mesh
  4896×3072 path. The experiment must earn a bounded 8× design rather than
  allocating a 115 MiB full-resolution float target beside that path.
- **Current decision:** E01/E02/E03/E04/E05/E06/E07/E08/E09/E10/E11/E12/E13 remain opt-in through the non-Classic looks
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
  density gate, and amplitude until another fit-view review. These are not the
  final material/VFX results.
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

**Next visual experiments:** E03–E13 now provide accepted liquid body/surface,
stable-gas, coherent-gas-motion, powder-depth, and powder-local-light
checkpoints plus exact resting contact grounding, Glass/Ice transmission, and
state-aware Wax/PLNT subsurface response, composed wet-mineral optics, and
atmosphere-owned external-light spectra. The next bounded candidate is E14, an
exact Liquid/Solid wet-contact meniscus for ordinary Water, Oil, and Acid.
Reuse the four existing semantic/contact probes, liquid density and vertical
depth, Fresnel/meniscus basis, signed phase-contact light, and family colours
to form a narrow liquid-side key/absorption rim in both horizontal and vertical
contacts. Add no sample, texture, field, pass, target, upload, allocation,
clock, alpha/support/silhouette/ownership, reconstruction, or physics decision.
Air surfaces, unlike-liquid seams, Lava, powder/gas contacts, sparse strands
and droplets, holes/channels, traits, emission, walls, Canvas, and true 8× are
controls. Keep its own off/on/off selector and require the same topology,
contact, scale, resource, fallback, and true-8× isolation proof before it can
become a preset default.

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
