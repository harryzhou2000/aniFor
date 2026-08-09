## Current execution objective — framework leverage

Prioritize an effective rendering-experiment framework over further isolated
visual-detail work. The modular typed Visual Lab facade, executable capability
profiles, named capture recipes, content-addressed result records, deterministic
batch runner, and static contact-sheet index are deployed. Frozen renderer and
capture descriptors share exact domain, target, Detail/fallback, evidence, URL,
backend/pipeline, and resource-budget semantics, and the generic runner consumes
them without domain branches. The opt-in CI review/deploy gate and versioned
accepted-baseline/result layer are complete. Portable recipe-set reuse is
deployed: local and hosted experiment cohorts are named, self-describing,
content-addressed, catalog-drift detecting, and reproducible without widening
the frozen result, batch, baseline, or comparison v1 records. The active
checkpoint is the portable consumer boundary: one read-only verifier must prove
a downloaded batch, its optional recipe-set sidecar, and its accepted-baseline
comparison from bytes alone, and CI must run that verifier against the exact
same-run artifact it uploaded rather than the mutable workspace. A normal-scale
A/B experiment should touch one domain module and one catalog
entry—not presenter setup, app lifecycle, package/workflow duplication, or CDP
branching.

The fixed `domain/variant/target/gain` state, promotion-safe same-page switching,
declarative fixture startup, and production-bundle off/A/B route already form
the base. E62 Oxygen, E69 Oil motion, and E65 Water motion have been folded into
their accepted parent baselines and their one-off selector/telemetry/verifier
plumbing removed. The batch/index, CI review, promotion, and recipe-set framework
checkpoints are complete and deployed. `main_codex` and Pages serve recipe-set
revision `294f8e09226c39fc09b56c8270c9b8a6a3edfc59` after gated workflow run
`31290360459`: the named four-recipe release set, comparison, deploy, live
revision, and 19-resource closure all passed, and the downloaded artifact's 36
PNG copies were independently validated. The accepted visual manifest remains
`sha256:b95e09ecb1df93c2b9ae718d205159b17dc56379723f2d1ad904458e16c5653c`.

That deployed checkpoint adds a separate
`anifor.visual-lab.recipe-set/v1` schema, not another effect and not a batch/v1
field. A set contains a bounded safe name plus a nonempty canonical-order subset
of complete built-in recipe descriptors; its identity hashes the reconstructed
`{schema,name,recipes}` record. Unknown, duplicated, reordered, stale, extended,
oversized, or ambiguous JSON fails before output mutation. The batch accepts
either its legacy candidate list or one real recipe-set file, never both,
publishes the normalized set as `recipe-set.json`, and still writes `index.json`
last. Consumers must revalidate the sidecar and cross-check every full
`{name,...result.request}` descriptor against the complete batch. Checked-in
release, atmosphere, and liquid-motion cohorts shorten local and CI review while
the frozen result/batch/baseline/comparison identities remain unchanged.
Canvas remains the
resilient semantic fallback and true 8× stays on its compact direct path unless
a separately budgeted design proves otherwise.

### Recipe-set framework acceptance

Create canonical JSON on stdout, or validate a checked-in set, with:

```sh
npm run audit:visual-lab:recipe-set -- create \
  --name=liquid-review --candidates=oil-motion,water-motion
npm run audit:visual-lab:recipe-set -- verify \
  --input=visual-lab/recipe-sets/liquid-motion.json
```

Run one existing production bundle from that exact cohort with:

```sh
npm run audit:visual-lab:batch:capture -- \
  --recipe-set=visual-lab/recipe-sets/liquid-motion.json
```

`release.json`, `atmosphere.json`, and `liquid-motion.json` are ordinary tracked
v1 data, not executable custom recipes. Every full descriptor must still equal
the in-code catalog entry resolved by its name, so the set cannot bypass domain,
fixture, target, Detail, or resource constraints. The loader reads one bounded
regular file, rejects noncanonical dot-segment paths, leaf and ancestor
symlinks, or replacement, and publishes only its normalized identified
snapshot. Default and legacy `--candidates`
runs synthesize deterministic `full-catalog` or `ad-hoc` sets so every new batch
is self-describing; older batches without the sidecar remain valid. The sidecar
is deliberately outside result/batch/baseline/comparison identity and is
authoritative only after its full descriptors are cross-checked with the batch.

### Portable-package verification acceptance

Verify an existing batch in place without rebuilding, launching Chrome, or
rewriting its index with:

```sh
npm run audit:visual-lab:verify -- \
  --batch-root=/path/to/downloaded-review \
  --require-complete=1 --require-recipe-set=1
```

For the release artifact, bind both the checked cohort and the accepted-baseline
comparison:

```sh
npm run audit:visual-lab:verify -- \
  --batch-root=/path/to/downloaded-review \
  --baseline-root=visual-baselines/accepted-v1 \
  --recipe-set-source=visual-lab/recipe-sets/release.json \
  --require-complete=1 --require-recipe-set=1
```

The comparison defaults to `<batch-root>/comparison`. The verifier performs only
stable, non-following reads: it reconstructs every result identity and invariant,
re-hashes and structurally validates every PNG, reproduces the exact batch sheet,
cross-checks the optional recipe-set descriptors, then reuses the
promotion-grade comparison validator for the accepted/current copies, JSON, and
deterministic HTML. It emits a compact content-identity summary and changes no
artifact byte or metadata. A legacy complete package may omit `recipe-set.json`
unless it is explicitly required. An incomplete diagnostic package is readable
only with `--require-complete=0`; it is never deployable evidence.

### Batch framework acceptance

`npm run audit:visual-lab:batch` performs exactly one production build, then
runs every frozen recipe in catalog order. To reuse the current bundle, run:

`npm run audit:visual-lab:batch:capture -- --candidates=gas-showcase,water-motion`

The equivalent reusable checked cohort is selected with
`--recipe-set=visual-lab/recipe-sets/<name>.json`; the two selection flags are
mutually exclusive. Every run publishes the normalized selection as
`recipe-set.json` before the contact sheet and final batch marker.

Each candidate gets a fresh browser and an isolated
`candidates/<name>/` directory containing off/A/B PNGs, `report.json`, and
stdout/stderr logs. The default five-minute candidate deadline first requests
the audit's bounded Chrome cleanup, then escalates if the child cannot exit. An
atomic lifecycle handoff lets the parent terminate and verify the exact detached
Chrome group even if the audit child must be killed; it is bound to canonical
batch-root/candidate ownership plus the process start token and exact browser
profile. Successful cleanup removes the profile and handoff, while an unverifiable
live process retains both for manual recovery. One output-root lock serializes
capture and index-only writers. Output ancestors, roots, candidate roots, and
candidate directories must be real contained directories, diagnostics are
published atomically without following a leaf symlink, and a rerun clears only
named tool-owned files. Before aggregation, require consecutive stable semantic,
field-alpha, and framebuffer-alpha snapshots; re-hash the three local PNGs;
bind their decoded dimensions to the scale-1 CSS canvas clips; validate PNG
signature, complete chunks, CRCs, bounded dimensions, zlib consumption,
decompressed length, and row filters; then recompute the
`anifor.visual-lab.result/v1` identity from the frozen recipe, and require all
current WebGL/HDR/startup/dataset evidence, semantic/field/framebuffer support
invariants, and zero browser errors. Never trust absolute artifact paths copied
from a child report. A `failure.log` is a durable tombstone for index-only mode;
only a fresh capture clears it, so cleanup failures cannot later become passes.

The root `index.json` uses `anifor.visual-lab.batch/v1`, canonical catalog
ordering, only relative artifact paths, and an explicit `complete` bit meaning
that every selected candidate passed. Its
portable `index.html` shows off/A/B cards and labels incomplete batches clearly;
it remains useful for failure navigation but cannot be mistaken for a complete
result. An interrupted rerun invalidates the old root index/sheet before it
touches candidate artifacts, so stale success cannot survive. Publish the sheet
first and the machine-readable index last, so `complete: true` can never precede
its required comparison page. Reuse `dist` with
`npm run audit:visual-lab:batch:capture -- --index-only=1`; this regenerates both
files from existing candidate artifacts without launching Chrome or rebuilding.
The sheet is local evidence,
not a Pages asset or an automated aesthetic score. Once this checkpoint is
deployed, extend the framework only where it shortens candidate authoring,
comparison, or CI artifact review; then use one catalog entry to choose the next
high-value material treatment.

### CI review acceptance

Manual dispatch exposes `visual_lab_review`, optional `visual_lab_candidates`,
and optional `visual_lab_recipe_set`. The latter must name a tracked file under
`visual-lab/recipe-sets/` and is mutually exclusive with candidates. Empty
selection inputs mean the complete frozen catalog; explicit comma-separated
names remain catalog-validated and are emitted in canonical order. The review
job depends on `build`, downloads that run's
`anifortpt-static-site` into `dist`, and invokes `visual-lab-batch.mjs` directly
with `--gpu=swiftshader`. It performs no second WASM or Vite build. Its evidence
artifact is named by the exact commit and uploads under `always()`, including an
incomplete index, contact sheet, PNGs, reports, stdout/stderr, and failure
tombstones. The same job then downloads that exact named artifact into a fresh
runner-temporary directory and invokes the shared read-only package verifier,
not an inline workspace-only approximation. It requires the v1 schema and
`complete: true`, reloads an explicitly requested source set, verifies every
result/PNG/sheet byte, requires exact identity with the published sidecar, and
revalidates the accepted-baseline comparison. This adds no browser or build.

Hosted software readback retains the exact two-consecutive semantic, field, and
framebuffer-alpha snapshot proof but has a 30-second per-variant settle window;
native GPU keeps ten seconds. The selected proof run `31284382855` received
`water-motion,gas-showcase`, published canonical gas-then-water order, passed
both candidates, and produced a downloaded sheet whose eight relative links
all resolve. Full release run `31284862276` then passed gas, Oxygen, Oil, and
Water in canonical order, gated deployment, and verified the exact live
revision plus 19-resource closure. Successful review permits Pages deployment
and failed review blocks it while preserving diagnostics.

### Accepted-baseline comparison acceptance

`npm run audit:visual-lab:baseline:accept -- --batch-root=<complete-batch> --output-dir=<new-package>`
creates a new portable accepted package only from a
complete v1 batch. Its `anifor.visual-lab.accepted-baseline/v1` manifest is
content-only and hashes the catalog-ordered candidate/result records; the
package carries exact pinned off/A/B images, but provenance remains outside the
manifest identity. Both input and accepted bytes are re-hashed before use.

`npm run audit:visual-lab:baseline:compare -- --baseline-root=<accepted> --result-root=<complete-batch> --output-dir=<new-comparison>`
produces
`anifor.visual-lab.comparison/v1`, copying verified accepted and current images
under fixed relative paths. It publishes the static sheet first and the
complete JSON marker last. Exact request mismatch, incomplete indexes, missing
or changed source bytes, symlink redirection, and unsafe paths fail. Different
valid capture hashes instead produce a successful `review` status: v1 is a
human comparison framework, not an aesthetic threshold. The checked accepted
package is `visual-baselines/accepted-v1`, seeded from run `31284862276` with
manifest ID
`sha256:b95e09ecb1df93c2b9ae718d205159b17dc56379723f2d1ad904458e16c5653c`.
CI adds this portable comparison beneath the ordinary downloadable review
artifact without rebuilding or launching another browser. RGB pixel metrics
remain a possible v2 only after the hash/thumbnail workflow proves useful.

### Candidate-scoped promotion acceptance

`npm run audit:visual-lab:baseline:promote -- --baseline-root=<accepted> --result-root=<complete-selected-batch> --comparison-root=<complete-comparison> --candidates=<name[,name...]> --output-dir=<new-proposal>`
closes the selected-review loop without another full-catalog browser run. It
revalidates the complete accepted and current source packages, independently
recomputes the comparison, requires its exact JSON, deterministic sheet, and
accepted/current PNG copies, then normalizes the explicit selection into frozen
catalog order. Selected current records replace their accepted counterparts;
unselected accepted records and bytes remain untouched, and a newly selected
catalog candidate may be inserted in canonical order.

The proposal retains `anifor.visual-lab.accepted-baseline/v1` as its content-only
manifest. A separate `anifor.visual-lab.baseline-promotion/v1` decision record
binds the previous baseline ID, exact comparison ID, each selected previous and
current result ID, comparison status, and proposed baseline ID. The decision is
independently content-addressed but deliberately excluded from baseline visual
identity. Write `promotion.json` first and `index.json` last. A no-op promotion
keeps the baseline ID and reports that fact. Output must be a new disjoint empty
real directory; the command never edits the accepted input or performs Git, CI,
Pages, or automatic aesthetic decisions.

## Visual north star

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
  That focused gate pins `plantCanopyTissueVfx=0`; E53 is measured only as
  E36's strict child and cannot revive E36 or any botanical ancestor.
  Requested-on true 8× keeps E20/E26/E28/E32/E34/E36/E53/HDR inactive for
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
- **E42 accepted:** exact Hydrogen `40` gains a normal-WebGL-only body fold as
  a strict child of E04 (`?hydrogenBodyVfx=0|1`). Propagated style `5`, dense
  connected wall-free non-emissive atmosphere support, and E04's existing
  density/relief/static carriers are the complete owner/input set. The result
  is an RGB-only blue-white transmission crown with an opposing cool pocket;
  it adds no wave, sample, texture, field, resource, pass, target, upload,
  allocation, clock, alpha/support, silhouette, ownership, topology, or physics
  decision. `npm run audit:vfx:hydrogen-body` freezes the 1×/2×/4×
  off→on→off response, seven foreign gas identities, sparse topology, authored
  void/channel, unlike-gas seam, Water/Metal contacts, native wall, exact raw
  controls, and byte-exact repeated-off frames. Target RMS is `5.04–5.05`
  (core), `6.03–6.06` (crown), and `2.03–2.05` (pocket), with cross-scale
  spread at most `0.03`. Requested-on true 8× reports E42 inactive for
  `scale-8`, promotes exact 4896×3072 WebGL, preserves semantics, and completed
  the accepted GPU fence in `5114.9 ms`; Canvas retains its established H2
  identity fallback.
- **E43 accepted:** exact radioactive Solids ISZS `105` and VIBR `113` gain a
  normal-WebGL-only crystalline/conductive body fold as a strict child of E17
  (`?radioactiveSolidBodyVfx=0|1`). Exact Solid/profile/Radioactive-optics/trait
  ownership, deep exact-species thickness, connected interior support, and the
  existing contact/wall/emission exclusions are the complete eligibility
  proof. Two static broad value-noise scales replace a rejected tune that
  amplified E17's diagonal relief into repeated bright bands. The accepted
  path is RGB-only, state-independent, and composed before VIBR's native
  charge/countdown/alternate overlay; it adds no sample, texture, field,
  resource, pass, target, upload, allocation, clock, alpha/support, silhouette,
  ownership, topology, native-state, or physics decision. `npm run
  audit:vfx:radioactive-solid-body` freezes the 1×/2×/4× off→on→off matrix with
  per-probe envelopes, exact raw/framebuffer controls, byte-identical repeated
  off, and VIBR state separation measured both disabled and enabled. ISZS
  core/crown/pocket RGB RMS is `4.21–4.22`/`10.82–10.84`/`2.26–2.27`; VIBR is
  `5.91–5.93`/`9.98`/`1.10–1.11`, and both pockets are negative. Requested-on
  true 8× prepares and verifies the full same fixture, reports E17/E43/HDR
  inactive for `scale-8`, preserves exact semantic/rendered/depth/wall/native-
  state hashes, promotes exact 4896×3072 WebGL, and completed a `5200.3 ms` GPU
  fence with zero browser errors. The parent gate pins E54 off; its latest full
  1×/2×/4×/8× rerun stayed exact and completed the 8× fence in `5295.8 ms`.
  Canvas retains its established identity path.
- **E44 accepted:** exact Carbon Dioxide `41` gains a normal-WebGL-only broad
  connected-volume fold as a strict child of E04
  (`?carbonDioxideBodyVfx=0|1`). Exact propagated atmosphere style `6`, E04's
  connected-density proof, static three-wave billow, cardinal relief,
  curvature, and optical depth are the complete inputs. The deep body and crown
  receive a cool grey-blue transmission key while the opposing pocket remains
  absorptive. The path is RGB-only and adds no wave, sample, texture, field,
  resource, pass, target, upload, allocation, clock, alpha/support, silhouette,
  ownership, topology, state, or physics decision. `npm run
  audit:vfx:carbon-dioxide-body` freezes exact off→on→off semantics and
  1×/2×/4× RMS at `6.40–6.41` (deep body), `7.79–7.80` (crown), and
  `1.51–1.53` (pocket), with signed means `+5.83…+5.85`, `+7.57…+7.59`, and
  `−1.46…−1.49`. Seven sibling gases, sparse topology, authored void/channel,
  Water/Metal contacts, wall, blank, alpha/support/field bytes, and raw controls
  remain exact; only the eligible CO2 side of the FOG seam may move by at most
  two composed bytes. Requested-on true 8× reports E04/E42/E44/HDR inactive,
  retains no bloom resource, preserves semantics, presents exact 4896×3072
  WebGL, and completed a `5358.6 ms` GPU fence with zero browser errors.
- **E45 accepted:** exact Thermite `30` gains a normal-WebGL-only reactive-
  metal body fold as a strict child of E05 (`?thermiteBodyVfx=0|1`). Exact
  MetallicGranular ownership plus E05's stable, dry Smooth body proof, facet
  balance, directed slope, volume depth, and body gate are the complete inputs.
  The broad body receives a restrained iron/copper crown and cooler compacted
  pocket before the existing cell-scale reactive-metal marks, preserving their
  pigment cadence. The path is RGB-only and adds no sample, texture, field,
  resource, pass, target, upload, allocation, clock, alpha/support, silhouette,
  ownership, topology, state, or physics decision. `npm run
  audit:vfx:thermite-body` freezes exact off→on→off semantics and 1×/2×/4× RGB
  RMS at `3.44–3.50` (whole body), `5.53–5.63` (crown), `4.09–4.10` (pocket),
  and `3.76–3.79` (core); signed crown/pocket/core means remain
  `+2.44…+2.50`/`−2.89…−2.91`/`−1.23…−1.24`, while sampled microchroma
  retention remains `0.9765–1.0260`. Fifteen sibling owners, moving/wet and
  fine-topology controls, contacts, the wall-occupied half, blank, raw fields,
  Local, Grains, and repeated-off frames remain exact; the wall-free Thermite
  half remains eligible with a bounded six-byte peak. Requested-on true 8×
  reports E05/E40/E45/HDR inactive, retains no bloom resource, preserves
  semantics, presents exact 4896×3072 WebGL, and completed a `4943.1 ms` GPU
  fence with zero browser errors.
- **E46 accepted:** exact SOAP `38` gains a normal-WebGL-only pearlescent body
  fold as a strict child of E03 (`?soapBodyVfx=0|1`). Exact authoritative
  Liquid ownership, ViscousLiquid optics, deep connected same-species support,
  and E03's existing wall/contact/emission/reconstruction exclusions are the
  complete eligibility proof. It recombines only the already-live broad sheen,
  caustic, macro relief, reflected environment, and exact vertical depth into a
  translucent mint/rose crown, opposing compacted pocket, and balanced core;
  the established crossed thin-film identity remains layered later. Native
  SOAP `ctype` bubble/link state and its particle-index links are not projected,
  so E46 is deliberately state-agnostic and must not interpret the zero
  presentation word as an unlinked native particle. The response is RGB-only
  and adds no sample, texture, field, resource, pass, target, upload,
  allocation, clock, alpha/support, silhouette, ownership, topology, state, or
  physics decision. `npm run audit:vfx:soap-body` freezes deterministic exact
  off→on→off output and the 1×/2×/4× whole-body response at RGB RMS
  `4.37–4.39`, chroma RMS `1.78–1.79`, signed mean `+0.65`, coverage
  `.337–.338`, and peak `24`; the opposing pocket remains negative at
  `−2.77…−2.79` signed mean and the core stays balanced. Crossed-film chroma
  retention is `.9887–1.0118` and microcontrast retention is
  `.9726–1.0143`. Semantics, support, alpha, walls, exact depth, and the zero
  presentation-state/velocity planes remain unchanged; foreign owners remain
  exact, with only the named bounded CSS-footprint display spill on the eligible
  Soap side at 1×. Requested-on compact true 8× excludes the E46 selector and
  resources, presents exact 4896×3072 WebGL, and completed its GPU fence in
  `5.107 s` in the final frozen rerun. Canvas retains its established fallback; E46 has no Canvas parity
  requirement. Production showcase v6 adds a disjoint 1,220-cell SOAP body and
  a 384-cell `liquidSoap` probe while freezing semantic hash `3610338776`,
  114,015 occupied cells, 23 material counts, and 18 scored regions.
- **E47 accepted:** exact ISZS `105` gains a normal-WebGL-only crystalline-
  depth finish as a strict child of E43 and E17
  (`?iszsCrystallineVfx=0|1`). Only E43's already-authoritative deep,
  connected, wall-free, contact-free ISZS body may respond. The shader
  recombines E43's existing static macro/facet carriers with exact depth,
  interior, and contact evidence for broad cyan/violet crystal planes, a cool
  raised crown, and an opposing decay pocket. The path is RGB-only and adds no
  sample, noise call, texture, field, resource, pass, target, upload,
  allocation, clock, alpha/support, silhouette, ownership, native state,
  topology, or physics decision. VIBR `113` and every E43 topology, wall,
  seam, contact, state, and foreign-owner control remain exact no-ops. `npm run
  audit:vfx:iszs-crystalline` freezes the 1×/2×/4× off→on→off matrix: core RGB
  RMS is `2.30–2.31` with signed mean about `+0.58`, crown is `17.31–17.40`
  with signed mean `+10.63…+10.70`, and pocket is `2.94–2.95` with signed mean
  `−1.03…−1.06`. All 51 protected controls peak at zero, repeated-off output
  is byte-exact, semantic/rendered/depth/wall/native-state digests are stable,
  and browser errors remain zero. Requested-on compact true 8× has no E47
  selector or branch, presents exact 4896×3072 WebGL, and completed the
  final frozen full-matrix GPU fence in `5161.0 ms`; repeated calibration tails
  ranged `4169.7–5248.3 ms`. The parent gate pins E54 off; its latest full
  1×/2×/4×/8× rerun preserved every control and completed the 8× fence in
  `5214.9 ms`. Composed v6 explicit-selector telemetry
  raises `solidISZS` quality `70.694→93.047`, luma standard deviation
  `2.52→7.68`, microcontrast `.80→1.16`, chromatic contrast to `2.19`, and
  macro range `10→28`, with full support and zero dark/clipped fraction.
- **E48 accepted:** exact Snow `18` gains a normal-WebGL-only cohesive snowpack
  finish as a strict child of E05 (`?snowpackBodyVfx=0|1`). Only an
  authoritative, trait-free, non-emissive, dry, contact-free Snow cell inside
  E05's already-settled Smooth body may respond. The shader recombines the
  existing broad facet balance, directional slope, volume depth, and pre-grain
  lit body into a blue-white crown, cool compacted pocket, and dense-only
  pigment calm. Sparse flakes, authored holes/channels, one-cell structures,
  moving Snow, Snow/Water suspension, direct foreign contacts, native walls,
  Local, Grains, foreign owners, Canvas, and compact true 8× remain controls.
  The path is RGB-only and adds no sample, texture, field, pass, target, upload,
  allocation, clock, alpha/support, silhouette, ownership, topology, state, or
  physics decision. `npm run audit:vfx:snowpack-body` freezes byte-stable
  off→on→off output at 1×/2×/4×: support recall is `1`, clipping is zero,
  dense-body microcontrast retention is `.2405–.2443` at 1×/2× and
  `.3313–.3325` at 4×, and broad macro-range retention is `.3333–.7241`; all
  named raw/topology controls plus Local and Grains have zero response.
  Requested-on compact true 8× excludes E48,
  presents exact 4896×3072 WebGL without an HDR target, and completed its GPU
  fence in `5303.2 ms` with zero browser errors. The isolated candidate-survey
  v1 route freezes semantic hash `2255453673`, 115,368 occupied cells, all six
  candidate counts, and six 2,880-cell regions. At canonical 2× it selected
  Snow from a visible baseline deficiency (quality `4.808`, microcontrast
  `23.702`); explicit E48 raises Snow to quality `92.916` and microcontrast
  `5.702` with full support and no dark or clipped fraction. That evidence
  selected Quartz for bounded E49; E48 itself must not widen to it.
- **E49 accepted:** exact powder Quartz/PQRT `29` gains a normal-WebGL-only
  cohesive crystal-plate finish as a strict child of E05
  (`?quartzMesostructureVfx=0|1`). Only authoritative, trait-free,
  non-emissive, dry, contact-free PQRT inside E05's settled Smooth body may
  respond. The shader reuses only the existing three facet planes, directed
  slope, volume depth, body gate, and pre-grain lit body to form lilac/cool
  plate crown, pocket, core, and cleavage responses, then calms dense PQRT
  cell grain. Native `tmp2` brightness remains a later independent layer.
  QRTZ `76`, holes/channels, one-cell structures, moving PQRT, 2:1 PQRT/Water
  suspension, direct Metal/Water contacts, native walls, Local, Grains,
  foreign owners, Canvas, and compact true 8× remain controls. The path is
  RGB-only and adds no sample/noise carrier, texture, field, pass, target,
  upload, allocation, clock, alpha/support, silhouette, ownership, topology,
  state, or physics decision. `npm run audit:vfx:quartz-mesostructure` freezes
  byte-stable off→on→off output at 1×/2×/4×: support recall is `1`, clipping
  is zero, dense microcontrast retention is `.4327–.4431`, broad macro-range
  retention is `.6078–1.2143`, and native-state span retention is
  `.9998–1.0097`; Local/Grains and named raw controls are exact, with only one
  bounded one-byte 2× composed footprint at an eligible wall-free PQRT probe.
  Requested-on compact true 8× excludes E49, presents exact 4896×3072 WebGL
  without an HDR target, preserves the five-state PQRT/QRTZ atlas, and signals
  startup/final state fences in `3608.0–5433.1 ms` with zero browser errors.
  The post-E49 survey raises canonical Quartz quality `75.98→100` and
  microcontrast `18.900→8.313`, with full support and no dark/clipped pixels;
  that evidence selected visibly over-busy C4 `31` for bounded E50.
- **E50 accepted:** exact C4/PLEX `31` gains a normal-WebGL-only pressed
  plastic-explosive body as a strict child of E05 (`?c4BodyVfx=0|1`). Only an
  authoritative optics-7, trait-free, non-emissive, dry, contact-free C4 cell
  inside E05's settled Smooth body may respond. The shader reuses only the
  existing three facet planes, directed slope, volume depth, body gate, and
  pre-grain lit body to form a matte moulded crown, cool plasticizer pocket,
  compact core, and restrained compression fold, then calms dense common and
  exact-explosive grain together while retaining the later exact identity at
  bounded strength. Holes/channels, one-cell structures, moving C4, genuine
  2:1 C4/Water suspension, direct Metal/Water contacts, native walls, Local,
  Grains, foreign owners, Canvas, and compact true 8× remain controls. The
  path is RGB-only and adds no sample/noise carrier, texture, field, pass,
  target, upload, allocation, clock, alpha/support, silhouette, ownership,
  topology, state, or physics decision. `npm run audit:vfx:c4-body` freezes
  byte-stable off→on→off output at 1×/2×/4×: support recall is `1`, clipping
  is zero, dense microcontrast retention is `.4260–.4357`, broad macro-range
  retention is `.4516–1.1538`, and whole-body RGB RMS is `7.99–11.56`;
  Local/Grains and every named raw/material/contact control are exact.
  Requested-on compact true 8× excludes E50, preserves the exact 4896×3072
  direct WebGL path and completed GPU fence, and explicitly keeps E48/E49
  inactive without uploading E50's dense fixture.
- **E51 accepted:** exact BASE `53` / native `PT_BASE` gains a
  concentration-and-spark identity backed by real native state. Bits `0..6` of
  the existing owner-multiplexed presentation word carry native `life` clamped
  to `0..100`; bit 7 carries exact `tmp == 1`, zero is valid, and default BASE
  remains `76`. The exact ladder is `0/25/50/76/100` plus `76|spark`; zero is
  a real BASE owner, not empty matter. Canvas and normal WebGL share four
  bounded concentration bands and a static world-anchored RGB spark cue after
  exact owner and native-wall guards. Normal realistic WebGL additionally
  recomposes only the existing E03
  connected-liquid sheen, caustic, and optical-depth evidence for concentrated
  `76/100` bodies. Direct true 8× folds BASE into the existing single SPNG/GEL
  compact state helper: `0/25/50` retain bounded state response, canonical
  `76/100` remain exact body no-ops, and spark remains visible; that richer body
  response stays off. Alpha, support, species ownership,
  holes/notches/thin structures, and physics remain unchanged; native state is
  read but never mutated, and no resource class is added. `npm run audit:vfx:base-state`
  proves native default/dilution/corrosion/OPS behavior, Canvas 2×, realistic
  WebGL 1×/2×/4×, and fence-completed 4896×3072 WebGL with exact off repetition,
  foreign-material/wall controls, stable topology, and zero browser errors.
- **E52 accepted:** exact BGLA `44` gains a normal-WebGL-only cohesive shard
  pack as a strict E05 child (`?bglaBodyVfx=0|1`). It reuses only settled,
  dry, Smooth powder-body evidence and retains the existing fine splinter
  identity. Moving or wet BGLA, holes, thin structures, walls, contacts,
  foreign owners, Local, Grains, Canvas, and compact true 8× remain controls.
  `npm run audit:vfx:bgla-body` freezes the all-scale response, exact repeated
  off frame, and true-8× exclusion without adding a sample, resource, or
  topology decision.
- **E53 accepted:** exact ordinary PLNT `10` gains continuous canopy-tissue
  relief as a strict normal-WebGL-only E36 child
  (`?plantCanopyTissueVfx=0|1`). It reuses E36's already-live signed lamina and
  front/rear/overlap evidence to strengthen broad tissue without reviving the
  enclosed E26/E32/E34 rib-and-vein mesh. Stateful PLNT, lifecycle data,
  walls, contacts, foreign owners, Canvas, and compact true 8× remain exact
  controls. `npm run audit:vfx:plant-canopy-tissue` freezes asymmetric target
  envelopes, 34 controls, exact off repetition, all-scale frequency retention,
  and requested-on true-8× exclusion without a new carrier, sample, resource,
  state, support, or topology decision.
- **E54 accepted:** exact zero-state VIBR `113` gains a normal-WebGL-only
  continuous conductive macro relief as a strict E43/E17 child
  (`?vibrMacroReliefVfx=0|1`). It reuses E43's already-live macro, facet, fold,
  depth, core, and environment evidence for a teal/cyan crown, absorptive
  pocket, and restrained conductive shoulder. Nonzero charge/countdown/
  alternate VIBR and every BVBR state remain exact controls; the later native
  state grammar stays authoritative. Canvas and compact true 8× retain their
  established paths. `npm run audit:vfx:vibr-macro-relief` freezes the
  1×/2×/4× off→on→off matrix, 41 named controls, byte-exact repeated-off
  output, cross-scale appearance, and requested-on true-8× exclusion without a
  new sample, noise call, texture, field, resource, state, support, topology, or
  physics decision.
- **E55 accepted:** exact zero-state/presence-only PLNT `10` gains a
  normal-WebGL-only canopy-interlock fold as a strict E53/E36 child
  (`?plantCanopyInterlockVfx=0|1`). It recombines the already-live signed
  fold/rank/front/rear/overlap evidence, with lobe contour limited to five
  percent, and blends restrainedly toward the existing pre-detail `leafKey`.
  The RGB-only response restores broad middle-scale canopy hierarchy while
  reducing local/seam contrast, without reviving fine tissue or changing
  lifecycle, support, topology, alpha, physics, Canvas, or compact true 8×.
  `npm run audit:vfx:plant-canopy-interlock` freezes the independent focused
  1×/2×/4× matrix, exact semantic/raw evidence for 34 controls, a direct exact
  owned-PLNT repeated-off framebuffer, the named bounded 2× full-page
  compositor diagnostic allowance, and requested-on true-8× exclusion. It
  finishes the seven canonical paused-field stability refreshes once per scale,
  then toggles only the E55 uniform in one hydrated page per scale, so
  flat→styled→flat evidence is causal and every 4× protected/repeated page
  footprint is exact.
- **E56 accepted Water/Metal transmission:** exact Water `2` gains a normal-WebGL-only transmitted
  contact response on the Water side of exact Metal `23`, as a strict
  E03/E14/E17/E37 child (`?waterMetalTransmissionVfx=0|1`). Only ordinary,
  connected, trait-free, non-emissive Water inside E14's clean proven
  Liquid/Solid contact may respond. It reuses E14's live band/crown/pocket for
  an RGB-only transmitted key, opposing absorption, and directional
  low-saturation rear-pocket attenuation; the Metal side remains E37-owned.
  It adds no sample, texture, field, resource, pass, target, upload, allocation,
  clock, alpha, support, silhouette, ownership, topology, state, or physics
  decision. Oil, Acid, air/deep non-contact Water, foreign or triple contacts,
  walls, traits, emission, holes, fine topology, Canvas, and compact true 8×
  remain controls. The frozen 1×/2×/4× off→on→off response measures horizontal
  Water-side RGB RMS `7.69/7.07/6.42` (peaks `18/19/16`) and vertical RGB RMS
  `7.05/3.36/2.02` (peaks `14/8/5`), with worst cross-scale ratio `3.4901`
  inside the fixed `4.0` ceiling. Requested-on true 8× excludes
  E03/E14/E17/E37/E56/HDR at exact 4896×3072; its GPU fence completed in
  `5186.3 ms` with zero browser errors.
- **E57 accepted FOG volume:** exact propagated atmosphere style `10` gains a
  normal-WebGL-only connected-core treatment as a strict E04 child
  (`?fogCoreDiffuseVfx=0|1`). It reuses only E04's existing billow/wave-C,
  directional relief, crown/pocket, optical-depth, neighbour-density,
  body-support, and gas-base evidence for a broad pearly crown, opposing
  blue-grey pocket, and restrained core attenuation. It adds no wave, sample,
  texture, field, resource, pass, target, upload, allocation, clock, alpha,
  support, silhouette, ownership, topology, state, or physics decision. The
  frozen 1×/2×/4× response is scale-stable: broad-body RGB RMS `2.10–2.11`,
  deep core `3.92`, crown `5.03–5.04`, pocket `2.77–2.79`, and microcontrast
  `.13–.23`. Semantics, atmosphere alpha/style, holes/channels, sparse FOG,
  sibling gases, contacts, walls, raw pixels, and repeated-off frames stay
  exact. The eligible named FOG-side seam shoulder has a seven-byte composed
  cap while remaining in the raw-alpha proof; the foreign CO2 pixel stays raw
  exact with a two-byte composed cap. Requested-on true 8× excludes E04/E57/HDR
  at exact 4896×3072 and the frozen full-matrix fence completed in `5268.9 ms`
  with zero browser errors.
- **E58 accepted PLNT canopy hierarchy:** exact zero-state/presence-only PLNT
  `10` gains one smooth deterministic 11-cell hierarchy octave as a strict
  normal-WebGL child of E55 and its full botanical ancestry
  (`?plantCanopyHierarchyVfx=0|1`). The octave is organized by the existing
  interlock fold, rank, front/rear, overlap, mass, and environment; it adds no
  thresholded seam, sample, texture, field, pass, target, allocation, clock,
  alpha/support, lifecycle, ownership, topology, or physics decision. The
  frozen 1×/2×/4× response holds left/right RGB RMS at `2.37`/`2.28–2.29`,
  peaks at `12`/`14`, meso RMS at `.8846–.8867`/`.7447–.7479`, and
  downsample retention at `.9869–.9872`/`.9856–.9860`. Macro-range gain is
  `3.745–3.803`/`2.964–3.071`, while fine contrast and seam response remain
  bounded. Requested-on true 8× excludes the complete botanical chain plus
  HDR at exact 4896×3072; the frozen fence completed in `5334.8 ms` with zero
  browser errors. The canonical 2× composed survey improves Organic quality
  `77.129 → 79.044`, PLNT mesostructure `.405 → .430`, and Organic macro range
  `40 → 45.5` without changing scene semantics or continuity. The final
  production-bundle 1×/2×/4× composed run reports
  `fullScaleMatrix=true`, `crossScaleVerified=true`, all three E58 selectors
  active, and zero browser errors.
- **E59 accepted ROCK weathered facets:** exact native ROCK `78` gains a
  restrained normal-WebGL-only facet hierarchy as a strict E29/E23/E17 child
  (`?rockWeatheredFacetVfx=0|1`). It recombines only E29's live 3.5-cell facet,
  interrupted lamina/mask, E17 relief, roughness, and mesostructure weight into
  a cool crown, opposing mineral pocket, and near-neutral signed colour cue.
  It adds no noise, sample, texture, field, resource, pass, target, upload,
  allocation, clock, alpha, support, ownership, topology, state, or physics
  decision. The frozen 1×/2×/4× off→on→off response holds transition RGB RMS
  at `1.79–1.82`, mid-body at `1.60–1.63`, and deep-core at `1.72–1.77`, with
  peaks `5–6`; left/right meso RMS remains `.9754–.9844`/`.8474–.8687` and
  downsample retention `.9643–.9654`/`.9606–.9619`. All 30 controls, semantics,
  alpha/support, walls, exact depth bytes, and repeated-off frames remain
  exact. Classic and every parent-removal case collapse the child. Requested-
  on true 8× excludes E17/E23/E29/E59/HDR at exact 4896×3072 and completes a
  GPU fence; the frozen run was `3276.7 ms` with zero browser errors. The
  canonical 2× composed survey raises ROCK quality `90.2 → 98.651` and
  microcontrast `1.06 → 1.42`, with unchanged `.967` coverage and no clipping.
- **E60 accepted ISZS crystal hierarchy:** exact native ISZS `105` gains a
  normal-WebGL-only hierarchy as a strict E47/E43/E17 child
  (`?iszsCrystalHierarchyVfx=0|1`). It defaults on in non-Classic looks but is
  input-audit-off unless explicit; Canvas and compact true 8× retain E47. It
  recombines only the existing 30-cell `radioactiveSolidMacro` and 11-cell
  facet/fold/core evidence into an aperiodic broad cyan near face, negative-
  luma indigo far/recess face, and purple absorptive interstice. It is RGB-only:
  add no carrier/noise, sample, texture, field, pass, target, upload,
  allocation, clock, state, alpha, support, topology, or physics decision. The
  facet-owned single-lens retint was too subtle; the slow rigid directional
  triangle looked compactly good but formed repeating diagonal bands on broad
  slabs and remains rejected. `npm run audit:vfx:iszs-crystal-hierarchy`
  freezes off→on→off at 1×/2×/4× with E47's 51 exact controls and exact raw
  alpha/state/depth/walls. E17/E43/E47/Classic each collapse E60. Requested-on
  true 8× excludes E17/E43/E47/E60/HDR at exact 4896×3072 and completes a GPU
  fence in `5.4102 s`. Frozen Core RGB/chroma/spatial/signed values are
  `10.57–10.60`/`6.59–6.61`/`6.363–6.409`/`6.48–6.51`; Crown RGB/chroma/signed
  is `12.15–12.20`/`7.18–7.21`/`10.25–10.30`; Pocket is
  `9.39–9.40`/`9.65–9.67`/`−3.62…−3.60`. Canonical composed 2× ISZS quality
  rises `93.047 → 98.291`, luma SD `7.68 → 12.29`, micro `1.16 → 1.40`, chroma
  `2.19 → 2.38`, and macro range `28 → 43`, while support `1`, coverage `.961`,
  and clipped fraction `0` remain exact. The final composed matrix is exact and
  cross-scale verified with zero browser errors; ISZS quality is
  `95.463/98.291/99.174` at 1×/2×/4×.
- **E61 accepted Water volume recession:** exact Water `2` gains a restrained
  normal-WebGL-only deep-body correction as a strict E24/E03 child
  (`?waterVolumeRecessionVfx=0|1`). Depth bytes through the exact byte-192
  hand-off remain unchanged. Beyond that boundary, E61 reuses only E24's
  crown, pocket, caustic-filament, and `waterBodyRecompose` evidence to
  attenuate the inherited broad reflection and apply a spatially varying,
  bounded blue-green rear-pocket absorption. It is RGB-only
  arithmetic with no new wave/noise, sample, texture, field, pass, target,
  upload, allocation, clock, alpha, support, ownership, topology, state, or
  physics decision. Salt/Distilled/DEUT/Oil/Acid/Lava, shallow and sparse
  Water, seams, Water/Glass/Metal/Sand/Smoke contacts, holes/chimneys, walls,
  Canvas, and compact true 8× retain their established paths.

  `npm run audit:vfx:water-volume-recession` holds E24, E37, and E56 active
  while toggling only E61 off→on→off at 1×/2×/4×. The exact byte-192 open-pool
  entry is a no-op control. The first post-boundary byte-198–216 ramp measures
  `.56–.58` RGB RMS in the open pool and `.49–.50` in the checker-backed pane;
  saturated byte-255 cores rise monotonically to `1.42–1.43` and `2.17`
  RGB RMS, with ramp/core peaks `2/4` and `2/5`. Semantics, alpha/support,
  liquid-depth bytes, walls, raw controls, contacts, and repeated-off frames
  remain exact. Five named post-HDR neighbour/hand-off probes alone have
  bounded `1/1/1/1/3`-byte peaks.
  Requested-on true 8× keeps E03/E14/E17/E24/E37/E56/E61/HDR inactive for
  `scale-8`, preserves exact 4896×3072 WebGL, and completes a GPU fence in
  `5.2559 s` with zero browser errors. The canonical composed audit now
  explicitly enables E37/E56/E61 under `inputAudit=1`; this fixes the prior
  evidence omission in
  which accepted E56 silently stayed off. Its full matrix is exact and
  cross-scale verified: Contact quality is `87.058/91.216/91.667` at
  1×/2×/4×, and canonical Water/Metal support recall `1`, coverage `.947`,
  dark/clipped fraction `0`, and Liquid quality `100` remain protected.
- **E62 accepted Oxygen volume fold:** exact Oxygen `39` gains a restrained
  normal-WebGL-only limpid-body fold as a strict always-present E04/E15 child.
  It runs only inside E15's exact propagated
  atmosphere style `4`, connected-body, wall-free, non-emissive proof and
  recombines already-live static billow/third-carrier, cardinal directional
  relief/curvature, cloud-neighbour density, atmosphere alpha, crown/pocket,
  and optical-depth evidence. The result is a broad cyan-white transmission
  fold with an opposing cool-blue absorptive pocket and a deliberately quiet
  neutral core. It is RGB-only arithmetic with no new wave/noise, sample,
  texture, field, resource, pass, target, upload, allocation, clock, alpha,
  support, silhouette, ownership, topology, state, or physics decision. Canvas
  and compact true 8× retain the established style-4 presentation.

  E62 no longer owns a query, runtime selector, dataset field, or bespoke
  reload verifier. The E15 gate now calibrates the combined accepted Oxygen
  baseline beside Smoke and Noble. `npm run audit:visual-lab:oxygen` runs one
  narrow structural-baseline assertion and then the shared target-4 off/A/B
  capture; `audit:vfx:oxygen-volume-fold` remains only a compatibility alias.
  Semantics, atmosphere/framebuffer alpha/support, walls, contacts, and foreign
  gases remain exact. True 8× retains its established compact style-4 path with
  E04/E15/HDR inactive. The refreshed
  composed matrix keeps the canonical family rank unchanged; exact Oxygen is
  quality `100/100/99.73` at 1×/2×/4×, coverage `.929`, luma SD
  `5.32–5.33`, microcontrast `.48–.51`, chroma `.45–.49`, and macro range `24`.
- **E63 accepted Nitro body recomposition:** exact NITR/Nitro `32` gains a
  normal-WebGL-only energetic amber crown, opposing olive absorptive pocket,
  and restrained transmitted-green fill as a strict E03 child
  (`?nitroBodyVfx=0|1`). It runs only after exact Oily/liquid/profile-1,
  trait-free, non-emissive dense-body proof with no surface, wall,
  unlike-material, or foreign-phase contact. It reuses E03's optical depth,
  connected-body weight, species slope/neighbour mean, broad sheen, caustic
  carrier, macro relief, Fresnel contour, and reflected environment. It adds
  no sample, texture, field, resource, pass, target, upload, allocation, clock,
  alpha, support, silhouette, ownership, topology, state, or physics decision.
  Canvas and compact true 8× retain the established Oily presentation.

  `npm run audit:vfx:nitro-body` holds the accepted candidate stack active
  while toggling only E63 off→on→off at 1×/2×/4×. The broad-body RGB
  RMS/spatial RMS/coverage bounds are `2.8–3.5`/`2.7–3.4`/`.48–.55`, with
  signed mean `.60–1.20` and peak `12–16`. Crown/pocket/core RGB RMS is
  `6–13`/`3–9`/`1.5–6`, signed mean `6–14`/`−7…−2`/`1–6`, and peaks
  `8–22`/`6–18`/`6–16`. The accepted 1×/2×/4× run measured broad-body RMS
  `3.13/3.12/3.12`, crown `8.72/8.74/8.74`, pocket `5.39/5.40/5.40`, and core
  `3.47/3.43/3.42`, with fixed peaks `14/14/11/10`. Semantics, alpha/support,
  backing, all five sibling candidate bodies, Oil and Diesel exact-owner
  controls, the shared ROCK stage,
  and repeated-off frames remain invariant. The authored hole is limited to a
  one-byte composed HDR fringe and the final NITR contact row to three bytes
  over `.04` coverage, with support unchanged. Requested-on true 8× reports
  E03/E63/HDR inactive for `scale-8`, presents exact 4896×3072 WebGL, and
  completes a GPU fence (accepted run `5.1513 s`) with zero browser errors.
- **E64 accepted BGLA fit-view consolidation:** exact BGLA `44` gains a
  normal-WebGL-only late pigment/splinter consolidation layer as a strict
  E52/E05 child (`?bglaClusterVfx=0|1`). E52's broad shard-pack response stays
  frozen. E64 carries one bounded scalar from the existing settled, dry,
  trait-free, non-emissive, wall/contact-free Smooth body proof to the later
  generic mineral and exact BGLA splinter RGB sites. Broad facets therefore
  read as coherent clusters while visible crystalline granulation remains.
  It adds no carrier, wave, sample, texture, field, resource, pass, target,
  upload, allocation, clock, alpha, support, silhouette, ownership, topology,
  state, or physics decision; moving/wet/fine/contacted BGLA, walls, holes,
  sibling materials, Local, Grains, Canvas, and compact true 8× remain exact.

  `npm run audit:vfx:bgla-cluster` holds E52 active while toggling only E64
  off→on→off at 1×/2×/4×. Enabled micro/chroma/macro ranges are
  `4.82–7.22`/`2.24–3.13`/`7–28`; relative retention is
  `.5721–.5946`/`.5415–.5761`/`.6190–.9583`. Target RGB RMS is `3.76–5.36`
  with peaks `12–20` and coverage `.683–.787`. Every named control, Local,
  Grains, raw alpha/support, semantics, and repeated-off output remains exact.
  Requested-on true 8× reports E05/E52/E64/HDR inactive for `scale-8`, keeps
  the dense fixture absent, presents exact 4896×3072 WebGL, and completes a
  GPU fence in `5.3813 s` with zero browser errors.
- **Protected 8× rung:** `renderScale=8` deliberately reports
  `hdrPipeline=inactive` / `scale-8` and retains the proven direct single-mesh
  4896×3072 path. The experiment must earn a bounded 8× design rather than
  allocating a 115 MiB full-resolution float target beside that path.
- **Current decision:** E01/E02/E03/E04/E05/E06/E07/E08/E09/E10/E11/E12/E13/E14/E15/E16/E17/E18/E19/E20/E21/E22/E23/E24/E25/E26/E27/E28/E29/E30/E31/E32/E33/E34/E35/E36/E37/E38/E39/E40/E41/E42/E43/E44/E45/E46/E47/E48/E49/E50/E51/E52/E53/E54/E55/E56/E57/E58/E59/E60/E61/E63/E64 remain opt-in through the non-Classic looks
  until representative hardware timing and mobile thermal behavior are
  measured. E62 is inherited as the accepted Oxygen baseline whenever E15 is
  enabled; it has no independent opt-in selector. E02 remains the safe
  family-wide baseline. E03 is accepted as the
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
  E59 is the accepted exact-ROCK weathered-facet checkpoint: freeze its strict
  E29/E23/E17 dependency, deep stable connected exact-owner proof, reuse of the
  existing facet/lamina/relief carriers, restrained crown/pocket spectra, and
  compact-8× exclusion. It is a bounded hierarchy refinement, not permission
  to restore E29's rejected continuous stripes, introduce a hard ridge or
  threshold, add cell-scale stipple, or widen the response to reconstructed,
  contacted, trait-bearing, emissive, wall, fine-topology, or non-ROCK matter.
  E60 is the accepted exact-ISZS crystal-hierarchy checkpoint: freeze its
  strict E47/E43/E17 dependency, existing 30-cell macro and 11-cell
  facet/fold/core evidence, cyan/indigo/purple RGB hierarchy, 51 exact
  controls, and compact-8× exclusion. Its rejected single-lens retint and slow
  directional triangle remain rejected. The canonical 2× result closes the
  ISZS surface-detail diagnosis; the final exact ISZS quality is
  `95.463/98.291/99.174` at 1×/2×/4×, and ISZS is no longer the Solid floor.
  Queue no additional Solid layer without a fresh visible diagnosis.
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
  E53-off composed PLNT baseline is `62.215`/`67.661`/`69.253`; that score fell because
  the current organic scorer rewards cell-scale contrast, while E36's direct
  seam gate proves that the repeated enclosed mesh was actually removed.
  E53 is the accepted exact-PLNT continuous-tissue checkpoint: freeze its
  strict E36 dependency, exact zero-or-presence-only lifecycle proof, reuse of
  the already-live signed lamina/front/rear/overlap scalars, asymmetric
  target-specific response/frequency/appearance envelopes, 34 exact controls,
  and Canvas/compact-8× exclusion. Never revive the thresholded rib/vein mesh,
  add another carrier, or widen the owner to stateful/contact PLNT.
  E54 is the accepted exact zero-state VIBR conductive-macro checkpoint: freeze
  its strict E43/E17 dependency, exact owner and packed-zero-state proof, reuse
  of the already-live macro/facet/fold/depth/core/environment evidence, three
  target-specific response/frequency/appearance envelopes, 41 controls, and
  Canvas/compact-8× exclusion. Never widen it to BVBR or nonzero VIBR state,
  displace the later native-state grammar, add another carrier, or turn its RGB
  relief into support, topology, state, or physics.
  E55 is the accepted exact zero-state/presence-only PLNT canopy-interlock
  checkpoint: freeze its strict E53/E36 dependency, broad signed fold/rank/
  front/rear/overlap reuse, five-percent lobe contribution, and restrained
  existing-`leafKey` blend. Its focused evidence must show more middle-scale
  meso share and broad macro hierarchy with lower local/seam contrast, never a
  revived fine rib/vein mesh, stateful/contact owner, Canvas change, or compact-
  8× branch. It is RGB-only and may add no resource, carrier, alpha, support,
  lifecycle, topology, or physics decision.
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
  E46 is accepted as the exact SOAP pearlescent-body checkpoint: freeze its
  strict E03 dependency, exact `38`/ViscousLiquid/deep-connected owner proof,
  reuse of the existing sheen/caustic/macro/environment/depth carriers, broad
  bipolar response, balanced core, crossed-film retention envelopes, exact
  raw/topology/state/velocity controls, narrow 1×–4× response spread, and
  compact-8× exclusion. The adapter does not project native SOAP bubble/link
  state, so do not add a false zero-state eligibility rule or claim state-aware
  bubble rendering. Foreign owners remain exact; retain only the audited 1×
  Soap-side CSS-footprint allowance. Canvas remains a fallback control without
  an E46 parity requirement.
  E47 is accepted as the exact-ISZS crystalline-depth checkpoint: freeze its
  strict E43/E17 dependency, exact ISZS `105` ownership, reuse of E43's static
  macro/facet and exact depth/interior/contact evidence, broad cyan/violet
  planes, positive crown, restrained negative pocket, 51 exact controls,
  byte-identical repeated-off output, stable raw digests, narrow 1×–4×
  response spread, and compact-8× exclusion. VIBR `113` and its native-state
  overlay remain exact controls; do not widen E47 back to E43's two-owner set,
  add another procedural carrier, or claim Canvas parity.
  E48 is accepted as the exact-Snow cohesive snowpack checkpoint: freeze its
  strict E05 dependency, exact Snow `18` ownership, settled/dry/Smooth/body/
  depth/contact proof, reuse of the established powder facet/slope/volume and
  pre-grain body evidence, broad blue-white crown, cool compacted pocket,
  dense-only pigment calm, exact raw/topology/foreign-owner controls, Local and
  Grains no-ops, frozen relational 1×–4× response and texture-retention
  envelope, and Canvas/compact-8×
  exclusion. Same-phase powder boundaries keep exact ownership on both sides;
  do not widen E48 to Salt, Quartz, BGLA, moving Snow, or wet suspension, add a
  new procedural carrier, or claim Canvas parity.
  E49 is accepted as the exact-PQRT crystal-plate checkpoint: freeze its strict
  E05 dependency, exact powder Quartz `29` ownership, settled/dry/Smooth/body/
  depth/contact proof, reuse of E05's three facet planes, directed slope,
  volume depth, and pre-grain lit body, broad lilac/cool plate relief,
  dense-only pigment calm, exact raw/topology/foreign-owner controls, native
  `tmp2` state independence, Local and Grains no-ops, narrow 1×–4× texture and
  state-retention envelope, and Canvas/compact-8× exclusion. Solid QRTZ `76`
  remains a non-owner state control; do not widen E49 to Salt, Snow, BGLA,
  moving/wet PQRT, or C4, add another procedural carrier, or claim Canvas
  parity. The normal five-state PQRT gate must explicitly hydrate boundary
  stability before state toggles; compact 8× keeps its direct atlas/fence path
  and must not pay seven extra 15-million-fragment refreshes.
  E50 is accepted as the exact-C4 pressed-body checkpoint: freeze its strict
  E05 dependency, exact C4/PLEX `31` plus optics-7 ownership, settled/dry/
  Smooth/body/depth/contact proof, reuse of E05's three facet planes, directed
  slope, volume depth, body gate, and pre-grain lit body, matte moulded relief,
  restrained grain calm, exact raw/topology/foreign-owner controls, Local and
  Grains no-ops, narrow 1×–4× texture/response envelopes, and Canvas/compact-8×
  exclusion. Do not widen E50 to Nitro, BGLA, Gunpowder, Thermite, moving/wet
  C4, or contacted C4, add another procedural carrier, or claim Canvas parity.
  Keep the established cross-backend explosive identity later in composition;
  the fixture-free 8× tail proves selector/resource exclusion only.
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

Run `npm run audit:vfx:candidate-rank` for the isolated app-owned material
survey. It drives
`?scene=candidate-survey&renderScale=2&inputAudit=1` through the deterministic
612×384 RenderLab backend, freezes the semantic hash/material counts/region
support, and compares the same six candidate cards at 1×/2×/4× production
WebGL. Keep candidate selectors explicit when evaluating an accepted child;
the package command retains the six accepted E48/E49/E50/E52/E63/E64 selectors. E51
has no candidate-survey selector and is proved by its separate authentic-state
fixture, so this route cannot establish a pre/post-E51 rank. Pass
`--candidate-snowpack-body-vfx=0` to the underlying
driver only when reproducing the frozen pre-E48 Snow baseline, and pass
`--candidate-quartz-mesostructure-vfx=0` only for the frozen pre-E49 Quartz
baseline. Pass `--candidate-c4-body-vfx=0` only for the frozen pre-E50 C4
baseline, and pass `--candidate-bgla-body-vfx=0` only when reproducing the
pre-E52 BGLA card.
Pass `--candidate-bgla-cluster-vfx=0` only when reproducing the post-E52,
pre-E64 BGLA card.
Pass `--candidate-nitro-body-vfx=0` only when reproducing the frozen pre-E63
flat-Nitro baseline.

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
normal WebGL 1×/2×/4× while pinning unrelated optional selectors and
`plantCanopyTissueVfx` off. Its
direct focused seam metrics must prove the broad front/rear/overlap canopy
result while the thresholded E26/E32/E34 vein loops are suppressed only for
the enabled E36 frame. Semantic, alpha, support, lifecycle, native walls,
topology/contact/foreign-owner controls, and repeated-off framebuffer remain
exact. Requested-on true 8× promotes exact 4896×3072 WebGL while
E20/E26/E28/E32/E34/E36/E53/HDR remain inactive for `scale-8`, with no bloom and a
completed GPU fence. Do not use a composed-rank drop to game the scorer; the
direct seam metrics and visible hierarchy are the acceptance evidence.

Run `npm run audit:vfx:plant-canopy-tissue` for E53. It keeps E36 and its
botanical ancestry active while running `plantCanopyTissueVfx=0 → 1 → 0` at
normal WebGL 1×/2×/4×. The reused E36 fixture freezes two asymmetric PLNT
targets, 34 lifecycle/topology/contact/wall/foreign-owner controls, exact
semantic/alpha/support/auxiliary state, byte-exact repeated-off frames,
continuous local-contrast gain without a cellular seam, cross-scale frequency
retention, and requested-on true-8× exclusion at exact 4896×3072.

Run `npm run audit:vfx:plant-canopy-interlock` for E55. It keeps the full
E53/E36 botanical chain active while running `plantCanopyInterlockVfx=0 → 1 →
0` at normal WebGL 1×/2×/4×. The two exact zero-state/presence-only PLNT
targets prove a broad signed middle-scale fold, higher meso share than E53,
positive 15-cell macro gain, and reduced local/seam contrast. All 34 controls
remain exact in semantic/raw WebGL evidence; only the two named 2× Sand-contact
full-page compositor diagnostics retain a bounded one-byte allowance. The gate
finishes seven canonical paused-field stability refreshes once per scale, then
toggles only the E55 uniform in one hydrated page; semantic/alpha/support/
auxiliary state, direct owned-PLNT restoration, and every 4× protected/repeated
page footprint remain exact. At 4×, use
completed-frame capture, direct WebGL alpha readback, and one evidence PNG
with a bounded 60-second compositor transfer. Requested-on true 8× promotes
exact 4896×3072 WebGL while E20/E26/E28/E32/E34/E36/E53/E55/HDR/bloom are
inactive for `scale-8`, with a completed GPU fence.

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

Run the focused E56 Water/Metal transmission gate with E03/E14/E17/E37 live,
then toggle only `waterMetalTransmissionVfx=0 → 1 → 0` at normal WebGL
1×/2×/4×. It must prove the exact Water side of horizontal and vertical
WATR/METL contacts changes only through the inherited clean-contact proof,
while Metal/E37, Oil/Metal, Acid/Metal, air/deep non-contact Water, foreign and
triple contacts, walls, traits, emission, holes, fine topology, Canvas, and raw
protected pixels remain exact. Semantic, alpha, support, auxiliary/wall state,
CSS/backing geometry, and repeated-off framebuffer recovery are invariants.
Requested-on true 8× must exclude E03/E14/E17/E37/E56/HDR for `scale-8`, retain
the direct 4896×3072 path, and complete the recovery/fence evidence. A prior
branch-local GLSL scope error blanked normal WebGL despite TypeScript and
shader-string tests passing, so this gate must include successful production
browser shader compilation; source/unit checks alone are insufficient.

The accepted E56 run measures horizontal Water-side RGB RMS
`7.69/7.07/6.42` and vertical RGB RMS `7.05/3.36/2.02` at 1×/2×/4×,
respectively. Its worst target-strength ratio is `3.4901`, all dependency
probes collapse E56 when any required parent is disabled, and requested-on true
8× remains selector/resource-excluded at exact 4896×3072 with a signalled
`5186.3 ms` GPU fence and zero browser errors.

Run `npm run audit:vfx:fog-core-diffuse` for E57. It holds only E04 live while
toggling `fogCoreDiffuseVfx=0 → 1 → 0` at normal WebGL 1×/2×/4×, then proves
the selector and HDR resources remain excluded at true 8×. The fixture owns a
broad style-10 FOG superellipse with opposite crown/pocket probes, deep core,
authored void/open channel, sparse carriers, seven sibling gases, unlike-gas
seam, Water/Metal contacts, native wall, and blank controls. The FOG side of
the FOG/CO2 seam is a named bounded composed control, not an RGB-exact control;
it remains in the raw-alpha invariant, while the CO2 integer-cell pixel remains
raw exact. The frozen full matrix completes exact 4896×3072 with a signalled
`5268.9 ms` GPU fence and zero browser errors.

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
  mesh. E36 deliberately removes that mesh. Its E53-off composed baseline is
  `62.215`/`67.661`/`69.253`, while Contact `88.235`, Solid `90.2`, Liquid
  `91.033`, Gas `95.463`, Emission `98.475`, and Powder `100.000` remain
  unchanged. This numeric decrease is a known scorer blind spot: the scorer
  rewards cell-scale contrast, while E36's exact focused appearance gate proves
  lower seam density, lower local contrast, stronger macro hierarchy, unchanged
  semantic support, and byte-exact selector-off recovery. E53 then restores
  continuous signed lamina articulation without restoring that mesh. Its exact
  PLNT result is `72.165`/`77.290`/`78.704` at 1×/2×/4×, with support `1`,
  coverage `.971`, macro range `50`, zero dark/clipped fraction, and exact
  semantics across the full composed matrix.

**Next visual experiments:** E03–E76 provide accepted liquid body/surface,
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
billow-depth, plus exact temperature- and velocity-driven Fire identity, an
atmosphere-owned coherent CFLM cold-flame fold, and an exact-Oil
velocity-oriented reflective slick with a cool absorptive wake, plus an exact-
Steam pearly condensate crown/cool pocket over the established connected gas
body, and exact-PLNT foliage consolidation that turns fine canopy mottling into
broader overlapping leaf masses, plus exact-Oil depth transmission that carries
an amber crown continuously into a deep blue absorptive pocket. E27's final
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
E53 adds exact PLNT continuous canopy tissue over E36 by reusing only the
already-live signed lamina/front/rear/overlap evidence; it improves broad
fit-view articulation without reviving the rejected enclosed cellular mesh.
E55 closes the diagnosed PLNT middle-scale gap as a strict E53/E36 child:
its focused evidence increases broad macro hierarchy and reduces local/seam
contrast without claiming an aggregate composed-score improvement.
E58 adds broad cluster placement inside that interlock as a strict E55 child:
one continuous 11-cell octave raises visible canopy hierarchy and the composed
Organic score without reviving fine veins or changing topology.
E59 closes the fresh broad ROCK surface-detail diagnosis as a strict E29 child:
it strengthens only the existing interrupted facet vocabulary, materially
raising the composed ROCK score while retaining exact topology and a quiet
fit-view response. Do not treat Water/Metal as an automatic queued tint after
this checkpoint; select the next owner from a fresh full-scene fit-view review.
E60 closes the exact ISZS surface-detail diagnosis as a strict E47/E43/E17
child: its broad aperiodic crystal-face hierarchy raises the canonical fit-view
without reviving E47's rejected lens or a repeated directional band. ISZS is no
longer the Solid floor; its final exact quality is `95.463/98.291/99.174` at
1×/2×/4×. Do not immediately queue another Solid layer.
E61 closes the diagnosed deep-Water luminous-curtain excess as a strict
E24/E03 child. It begins only beyond the exact byte-192 hand-off and applies a
measured spatially varying absorptive recession without adding a carrier,
sample, resource, alpha, support, topology, Canvas path, or compact-8× branch.
E62 gives exact Oxygen `39` a limpid-volume fold as a strict E04/E15 child. It
recombines the existing static connected-cloud evidence into a broad
cyan-white transmission shoulder and cool absorptive pocket while keeping the
neutral core quiet; foreign gases, sparse topology, Canvas, and compact true
8× remain controls. Do not immediately stack another Oxygen or generic-gas
layer after this checkpoint.
E63 closes the visibly flat exact-Nitro candidate diagnosis as a strict E03
child. It recombines only established dense-liquid evidence into a broad warm
crown, opposing olive pocket, and quiet transmitted fill, while exact Oil and
Diesel prove that shared Oily optics do not broaden ownership. The canonical
2× candidate card keeps full support/coverage and zero clipping while luma SD,
microcontrast, chromatic contrast, and macro range move from
`6.287/.202/.271/24.365` to `7.129/.321/.332/27.918`. Do not immediately stack
another Nitro or generic-Oily layer; select the next target from a new visible
fit-view diagnosis rather than the already-saturated aggregate score.
E37 adds exact Metal-side Water-contact spectral separation over the joint E14+
E17 proof without changing either body's topology. E56 completes only the
exact WATR side beside exact METL through E03/E14/E17/E37's inherited clean
contact proof; its focused browser gate freezes the measured response and
true-8× exclusion above. E57 gives exact FOG a broad, diffuse connected
core over E04 without altering atmosphere support, authored gaps, sibling gases,
Canvas, or compact true 8×. E38 turns the previously
flat, opaque-looking exact-Oil pool into a broad bipolar amber/cool volume by
recombining already-live E22/E03 evidence; it deliberately ends the current
Oil stack. E39 turns the formerly one-sided exact-Acid absorption into a broad
reactive green crown with opposing violet pockets by recombining existing E03
evidence; it deliberately ends the current Acid stack. E40 gives exact GUNP
`14` and BCOL `217` stable dry Smooth bodies a porous warm/cool crown,
absorptive pocket, and restrained core without flattening their sparse identity
marks or internal grain cadence; Coal `19`, other owners, wet/moving powder,
fine topology, walls, contacts, Local, Grains, Canvas, and compact 8× remain
controls. E42 now gives exact Hydrogen `40` a strict E04-owned connected-body
transmission fold without touching foreign gas identities, sparse topology,
liquid/solid contacts, Canvas, or compact 8×. E43 gives exact ISZS `105` and
VIBR `113` a separate Solid-only crystalline/conductive body fold, closing the
unreachable old phase-permissive deep-radioactive branch while preserving
VIBR's later native state grammar, every fine/contact/wall control, Canvas, and
compact 8×. DEUT `100` is no longer a survey candidate: E41 already gives it
an accepted trait-aware connected radioactive-liquid body without widening
E03. E44 gives exact Carbon Dioxide `41` a distinct cool-grey connected-volume
crown/pocket response without touching foreign gas identities, sparse
topology, contacts, Canvas, or compact 8×. Its frozen all-scale browser matrix
and v5 composed cloud close CO2 as the immediate gas candidate. E45 gives exact
Thermite `30` a restrained reactive-metal crown/pocket/core fold without
flattening its existing internal marks or touching wet/moving/fine powder,
sibling owners, Local, Grains, Canvas, or compact 8×; its frozen all-scale gate
closes Thermite as the immediate powder candidate. E46 gives exact SOAP `38` a
strict E03-owned pearlescent crown/pocket/core fold beneath its retained crossed
thin-film identity. It remains state-agnostic because native SOAP bubble/link
state is unprojected, preserves every foreign owner and raw plane, requires no
Canvas parity, and remains excluded from compact 8×; its frozen all-scale gate
closes Soap as the immediate liquid candidate.
E47 gives exact ISZS `105` a strict E43/E17-owned crystalline-depth finish by
recombining the already-live static macro/facet and exact body evidence. Its
cyan/violet crystal planes close the demonstrated ISZS surface-detail gap while
VIBR `113`, native state, topology, contacts, Canvas, and compact 8× remain
unchanged. Its 1× composed-survey floor remains contextual ranking evidence;
the frozen focused matrix remains the E47 acceptance gate.
E54 gives exact zero-state VIBR `113` a strict E43/E17-owned continuous
conductive macro relief by recombining only E43's existing macro, facet, fold,
depth, core, and environment evidence. It closes the broad, flat conductive-body
read without reopening E43 or changing nonzero VIBR charge/countdown/alternate
state, any BVBR state, topology, contacts, Canvas, or compact 8×. The later
native-state grammar remains authoritative, and this closes the current VIBR
stack.
E48 gives exact Snow `18` a strict E05-owned cohesive snowpack body by
recombining the already-live settled-body facet, slope, volume, and pre-grain
lighting evidence. It calms only dense Snow pigment beneath a broad blue-white
crown/cool pocket while sparse flakes, fine topology, motion, wet suspension,
foreign contacts and owners, Local, Grains, Canvas, and compact 8× remain
unchanged.
E49 gives exact powder Quartz/PQRT `29` a strict E05-owned crystalline
mesostructure over the same settled, dry, Smooth proof. It recombines existing
facet, directed-slope, body-depth, and pre-grain evidence into lilac/cool plate
crown, pocket, core, and cleavage relief, then calms dense common grain without
obscuring native PQRT `tmp2` state. QRTZ, authored holes and channels, moving or
wet Quartz, fine topology, material/contact controls, Local, Grains, Canvas,
and compact true 8× remain exact controls.
E50 gives exact C4/PLEX `31` a strict E05-owned pressed matte body over that
same settled, dry, Smooth proof. It recombines the existing facet, directed
slope, body-depth, and pre-grain evidence into a moulded crown, cool pocket,
compact core, and restrained compression fold, then calms dense C4 grain while
preserving its established later explosive identity at bounded strength.
Authored holes/channels, moving or wet C4, fine topology, material/contact
controls, Local, Grains, Canvas, and compact true 8× remain exact controls.
E51 gives exact BASE `53` / native `PT_BASE` a state-authentic corrosive-liquid
identity. Native `life` concentration and `tmp == 1` spark state now cross the
owner-multiplexed presentation plane and OPS boundary. The exact ladder is
`0/25/50/76/100` plus `76|spark`, with zero remaining real BASE rather than
empty matter. Canvas and normal WebGL render the four bounded concentration
bands plus a static spark cue. Normal realistic WebGL also gives concentrated
connected bodies a restrained E03-owned sheen/depth recomposition; compact true
8× retains bounded `0/25/50` state response, exact `76/100` body no-op, and the
spark cue.
Native dilution, neutralisation, Oil→SOAP, phase products, corrosion, pressure
reactions, holes, thin structures, foreign materials, walls, topology, and
resources remain controls.
E52 is the accepted exact-BGLA `44` / native `PT_BGLA` shard-pack checkpoint, a
normal-WebGL-only strict E05 child (`?bglaBodyVfx=0|1`). It uses only E05's
settled Smooth `powderBodyGate`, derived facet balance, body-volume depth, and
contour-retention scalar, and only for authoritative trait-free, non-emissive,
dry, wall-free, contact-free BGLA. It preserves the existing fine splinter
identity and leaves moving BGLA,
genuine BGLA/Water suspension, holes/channels, one-cell structures, walls,
BGLA/ROCK/Metal/Water contacts, sibling/material controls, Local, Grains,
Canvas, and compact true 8× unchanged. It adds no sample, texture, field,
resource, pass, target, upload, allocation, clock, alpha, support, silhouette,
ownership, topology, state, or physics decision. Its frozen 1×/2×/4× matrix
holds core/crown/pocket RGB RMS at `4.64–4.67`, `8.35–8.49`, and `2.38–2.43`,
respectively; crown signed mean stays `5.76–5.83`, the pocket stays absorptive
at `-0.42–-0.35`, Local and Grains are exact no-ops, off repetition is exact,
and every named control is byte-exact except the eligible wall-clear BGLA probe
at a two-byte peak. Splinter microdetail retention is `0.9953–1.0703`, support
recall is one, and clipping remains zero. Requested-on true 8× proves
E52/HDR/bloom exclusion, a blank material plane, exact 4896×3072 WebGL, and a
completed `gpu-fence` in `5172.5 ms`, with stable semantics and zero browser errors. The focused release
gate is `npm run audit:vfx:bgla-body`.
E64 is the accepted exact-BGLA `44` fit-view consolidation checkpoint, a
normal-WebGL-only strict E52/E05 child (`?bglaClusterVfx=0|1`). It leaves E52
unchanged and carries one derived calm scalar from the existing exact settled
Smooth body gate and body-volume depth to the later generic mineral and native
BGLA splinter RGB sites. This corrects the fit-view pepper field at the sites
that actually own it while retaining the established broad facets and visible
crystalline texture. Moving or wet BGLA, authored holes/channels, fine
structures, walls, contacts, sibling owners, Local, Grains, Canvas, and compact
true 8× are exact controls. E64 adds no carrier, noise, wave, sample, texture,
field, resource, pass, target, upload, allocation, clock, alpha, support,
silhouette, ownership, topology, state, or physics decision. Its frozen
1×/2×/4× matrix holds enabled microcontrast at `4.82–7.22`, chromatic contrast
at `2.24–3.13`, macro range at `7–28`, and E52-relative micro/chroma/macro
retention at `.5721–.5946`/`.5415–.5761`/`.6190–.9583`. Target RGB RMS is
`3.76–5.36`, peaks are `12–20`, and coverage is `.683–.787`; all named
controls, semantic/alpha/support state, Local, Grains, and repeated-off output
are exact. Requested-on true 8× proves E05/E52/E64/HDR exclusion, a blank
material plane, exact 4896×3072 WebGL, and a `gpu-fence` completed in
`5.3813 s`, with zero browser errors. The focused gate is
`npm run audit:vfx:bgla-cluster`.
E53 is the accepted exact-PLNT `10` continuous-canopy-tissue checkpoint, a
normal-WebGL-only strict E36 child (`?plantCanopyTissueVfx=0|1`). It reuses
only E36's already-live signed lamina, front/rear, overlap, and canopy-mass
proof to add bounded continuous RGB tissue relief. It never revives E34's
zero-crossing rib/vein network. Stateful PLNT, lifecycle and auxiliary state,
holes, fine topology, walls, contacts, foreign owners, Canvas, and compact true
8× remain exact controls. It adds no carrier, noise, sample, texture, field,
resource, pass, target, upload, allocation, clock, alpha, support, silhouette,
ownership, lifecycle, topology, or physics decision. Its frozen 1×/2×/4×
focused matrix holds target RGB/chroma/spatial RMS at `.84–.96`/`.79–.91`/
`.829–.950`, coverage at `.061–.096`, signed mean at `.16–.17`, response
microcontrast at `.40–.46`, meso/cell frequency at `.3957–.4654`/
`.6012–.6483`, and downsample retention at `.9527–.9542`. All 34 named
controls and the repeated-off framebuffer are exact. Requested-on true 8×
proves E20/E26/E28/E32/E34/E36/E53/HDR/bloom exclusion, exact 4896×3072
WebGL, stable semantics, zero browser errors, and a signalled `gpu-fence` in
`5373.1 ms`. The focused release gate is
`npm run audit:vfx:plant-canopy-tissue`.
E54 is the accepted exact zero-state VIBR `113` conductive-macro checkpoint, a
normal-WebGL-only strict E43/E17 child (`?vibrMacroReliefVfx=0|1`). It reuses
only E43's existing static macro/facet/fold, exact-species thickness/core, and
solid-environment evidence for broad teal/cyan conductive crown, absorptive
pocket, shoulder, and signed chroma. Nonzero charge/countdown/alternate state,
every BVBR state, holes, thin structures, walls, contacts, foreign owners,
Canvas, and compact true 8× remain controls; the later native VIBR state grammar
is unchanged. The path is RGB-only and adds no sample, noise call, texture,
field, resource, pass, target, upload, allocation, clock, alpha, support,
silhouette, ownership, topology, native-state, or physics decision. Its frozen
1×/2×/4× focused matrix observes core/crown/pocket RGB RMS at
`15.29–15.32`/`22.38–22.40`/`4.46–4.52`, with calibrated headroom in the
executable envelopes; core and crown stay positive while the pocket stays
negative. All 41 controls remain exact except a named 1×
post-compositor `VIBRThin` blue-channel allowance of one byte; its semantic,
raw framebuffer, exact depth, and repeated-off evidence remain exact, and every
2×/4× control is byte-exact. Requested-on true 8× proves
E17/E43/E47/E54/HDR/bloom exclusion, exact 4896×3072 WebGL, stable semantics,
zero browser errors, and a signalled `gpu-fence` in `5226.8 ms`. The focused
release gate is `npm run audit:vfx:vibr-macro-relief`.
E55 is the accepted exact zero-state/presence-only PLNT `10` canopy-interlock
checkpoint, a normal-WebGL-only strict E53/E36 child
(`?plantCanopyInterlockVfx=0|1`). It reuses only the already-live signed canopy
fold, rank, front/rear, and overlap evidence, with lobe contour at five percent,
to make a broad signed middle-scale fold. A restrained blend toward the
existing pre-detail `leafKey` organizes broad canopy volume instead of adding
another fine tissue carrier. It is RGB-only and adds no noise, sample, texture,
field, resource, pass, target, allocation, clock, alpha, support, lifecycle,
topology, or physics decision. Stateful PLNT, ineligible lifecycle payloads,
holes, fine topology, walls, contacts, foreign owners, Canvas, and compact
true 8× remain exact controls.

Its focused 1×/2×/4× production matrices hold independent left/right target
RGB RMS at `.50–.53`/`1.01–1.06`, meso share at `.4372–.4720`/`.4762–.5162`,
and downsample retention at `.9620–.9648`. The 15-cell macro P90–P10 gain is
`.1729–.2149`/`.4355–.5151`, while local contrast falls
`.0409–.0483`/`.0229–.0273` and dark/strong seam fractions do not increase.
All 34 controls remain exact in semantic/raw WebGL evidence; the two named 2×
Sand-contact full-page compositor diagnostics alone have a bounded one-byte
allowance after seven canonical paused-field stability refreshes per scale. The
gate then toggles only the E55 uniform in one hydrated page per scale.
Semantics, state, support, walls, auxiliary data, direct owned-PLNT
repeated-off frames, and every 4× protected/repeated page footprint are exact.
The 4× robustness capture is a completed frame with direct WebGL alpha readback
and one evidence PNG under a bounded 60-second compositor transfer.
Requested-on true 8× proves E20/E26/E28/E32/E34/E36/E53/E55/HDR/bloom inactive
for `scale-8`, exact 4896×3072 WebGL, and a GPU fence;
the accepted full-matrix tail was `5110.9 ms`. The focused release gate is
`npm run audit:vfx:plant-canopy-interlock`. A fresh 2× E53 parent run with E55
inactive also passes through a `5135.8 ms` true-8× fence, while the full composed
1×/2×/4× material rank passes its exact-scene and cross-scale gates. Treat that
as regression evidence rather than a new aggregate-score claim.
E58 is the accepted exact zero-state/presence-only PLNT `10` canopy-hierarchy
checkpoint, a normal-WebGL-only strict E55 child
(`?plantCanopyHierarchyVfx=0|1`). It evaluates one deterministic smooth
`botanicalBodyNoise(fieldPosition / 11.0 + vec2(31.7, -19.1))` octave and
combines it continuously with E55's already-live interlock fold, rank,
front/rear, overlap, mass, and environment. It introduces no ridge or
zero-crossing threshold and changes RGB only, with no new sample, texture,
field, pass, target, upload, allocation, clock, alpha/support, lifecycle,
ownership, topology, or physics decision. Canvas and compact true 8× retain
E55 unchanged.

The frozen focused matrix measures scale-stable left/right target RGB RMS
`2.37`/`2.28–2.29`, peaks `12`/`14`, coverage `.466–.469`/`.469–.473`, meso
RMS `.8846–.8867`/`.7447–.7479`, meso share `.8064–.8107`/`.7533–.7557`, and
downsample retention `.9869–.9872`/`.9856–.9860`. Left/right macro P90–P10
gain is `3.745–3.803`/`2.964–3.071`; luma-deviation gain is
`.923–.946`/`1.288–1.310`; and local-contrast retention remains
`1.0053–1.0060`/`.9978–.9984`. All semantics, state, support, walls, auxiliary
data, raw controls, and repeated-off framebuffers are exact. Three named 2×
filtered page-capture controls alone allow one byte while their raw evidence
stays exact. Requested-on true 8× excludes
E20/E26/E28/E32/E34/E36/E53/E55/E58/HDR, promotes exact 4896×3072 WebGL, and
signals its GPU fence in `5334.8 ms` with zero browser errors. Run
`npm run audit:vfx:plant-canopy-hierarchy` for the release evidence.
The production-bundle composed rank independently passes its full 1×/2×/4×
matrix and cross-scale assertions with E58 active at every scale and zero
browser errors; its Organic quality spread is `6.464`.
E59 is the accepted normal-WebGL-only exact native ROCK `78` weathered-facet
checkpoint, independently measurable with `?rockWeatheredFacetVfx=0|1` and a
strict child of E29/E23/E17. It runs only inside E29's existing exact-owner,
SmoothRigid-profile, deep stable connected interior proof. It recombines the
already-live `rockFacet`, `rockLamina`, `rockLaminaMask`, `rockFacetBody`,
`solidBodyRelief`, `rockRoughness`, and `rockMesostructure` values into a
restrained key/pocket hierarchy. It adds no noise or sine, sample, texture,
field, resource, pass, target, upload, persistent allocation, clock, alpha,
support, ownership, topology, state, or physics decision. Canvas and compact
true 8× retain the established E29 presentation.

`npm run audit:vfx:rock-weathered-facet` freezes a production-WebGL
1×/2×/4× off→on→off matrix. The shallow shoulder remains bounded at RGB RMS
`.52–.54`; transition, mid-body, and deep-core respond independently at
`1.79–1.82`, `1.60–1.63`, and `1.72–1.77`, with peaks `5–6`. Left/right
meso RMS is `.9754–.9844`/`.8474–.8687`, meso share
`.5592–.5773`/`.4894–.5128`, gradient ratio `1.0270–1.0395`/
`1.0127–1.0352`, and downsample retention `.9643–.9654`/`.9606–.9619`.
Semantics, alpha/support, walls, solid-depth bytes, 30 exact controls, and the
repeated-off framebuffer remain exact. E17-off, E23-off, E29-off, and Classic
each collapse E59. Requested-on true 8× keeps E17/E23/E29/E59/HDR inactive for
`scale-8`, promotes exact 4896×3072 WebGL, and completes a GPU fence; the
frozen run was `3276.7 ms` with zero browser errors. Canonical 2× ROCK quality
rises `90.2 → 98.651`, microcontrast `1.06 → 1.42`, chromatic contrast
`.43 → .47`, and macro range `30 → 35`, while coverage `.967`, support,
continuity, cavity control, and zero clipping stay unchanged.
E60 is the accepted normal-WebGL-only exact ISZS `105` crystal-hierarchy
checkpoint, independently measurable with `?iszsCrystalHierarchyVfx=0|1` and a
strict E47/E43/E17 child. Non-Classic defaults it on, while `inputAudit=1`
requires the explicit selector; Canvas and compact true 8× retain E47. It
recombines only the 30-cell `radioactiveSolidMacro` with the 11-cell existing
facet/fold/core evidence into an aperiodic broad cyan near face, negative-luma
indigo far/recess face, and purple absorptive interstice. It is RGB-only and
adds no carrier/noise, sample, texture, field, pass, target, upload, allocation,
clock, state, alpha, support, topology, or physics decision. The facet-owned
single-lens retint was too subtle; the slow rigid directional triangle created
repeated diagonal bands across broad slabs and remains rejected.

`npm run audit:vfx:iszs-crystal-hierarchy` freezes production-WebGL 1×/2×/4×
off→on→off evidence with E47's 51 exact controls and exact raw alpha/state/
depth/walls. Core RGB RMS/chroma/spatial RMS/signed mean is
`10.57–10.60`/`6.59–6.61`/`6.363–6.409`/`6.48–6.51`; Crown RGB RMS/chroma/
signed mean is `12.15–12.20`/`7.18–7.21`/`10.25–10.30`; Pocket is
`9.39–9.40`/`9.65–9.67`/`−3.62…−3.60`. E17/E43/E47/Classic each collapse E60.
Requested-on true 8× keeps E17/E43/E47/E60/HDR inactive for `scale-8`, promotes
exact 4896×3072 WebGL, and completes a GPU fence in `5.4102 s`.
Improve distinctive depth, transmission, reflection, lighting, and
mesostructure without stacking another narrow Oil/Acid/contact tint or another
generic PLNT/gas layer. E62 closes the exact-Oxygen diagnosis and E63 closes
the visibly flat exact-Nitro diagnosis; choose the next owner only from fresh
visible fit-view evidence.
The fresh composed-family/material survey now uses
E17/E37/E43/E44/E45/E46/E47/E53/E54/E55/E56/E58/E59/E60/E61 under
`inputAudit=1`, with the E62 Oxygen baseline inherited through E15. Fixture v6
freezes 23 material counts, 18 scored regions,
semantic hash `3610338776`, and 114,015 occupied cells at 1×/2×/4×; its exact
SOAP body owns 1,220 cells and the deep `liquidSoap` region owns 384. The
accepted v6 WebGL matrix scores that Soap probe `100` at every scale with support recall
`1`, coverage `.910`, luma standard deviation `7.37–7.42`, microcontrast
`.54–.56`, chromatic contrast `.65–.68`, and macro range `20`. The Liquid
family remains `99.866/100/100` across 1×/2×/4× with a `.134` spread; the full
matrix and exact-scene checks pass with zero browser errors. The earlier v5
Solid floor `70.694` was the exact ISZS surface-detail gap that fresh fit-view
evidence selected for E47, not a reason to reopen E43's broad two-owner
checkpoint. With explicit E47 telemetry, canonical v6 `solidISZS` quality
reaches `93.047`: luma standard deviation is `7.68`, microcontrast `1.16`,
chromatic contrast `2.19`, and macro range `28`, with full support and zero
dark/clipped fraction. E52 is explicitly inactive in this matrix because
showcase v6 has no authoritative BGLA evidence. With E53 active, exact PLNT
quality becomes `72.165`/`77.290`/`78.704` at 1×/2×/4×. Its
microcontrast/chroma are `1.70`/`1.90`, `1.81`/`2.00`, and `1.85`/`2.03`;
macro range stays `50`, support stays `1`, coverage stays `.971`, and dark and
clipped fractions remain zero. With E54 active, `solidVIBR` quality is
`97.731/100/100` at 1×/2×/4×, raising the canonical 2× result from `86.207`
to `100`. Its canonical luma deviation is `4.37`, microcontrast `1.65`,
chromatic contrast `3.15`, and macro range `20`, while support `1`, coverage
`.959`, and zero dark/clipped fractions are unchanged. With E58 active, the
canonical 2× Organic floor rises from the fresh `77.129` baseline to `79.044`;
PLNT mesostructure rises `.405 → .430` and aggregate Organic macro range rises
`40 → 45.5`, with continuity still `1`. Isolated production captures score
exact PLNT `73.893/79.044/80.357` at 1×/2×/4×. With E59 active, exact ROCK
quality becomes `97.345/98.651/99.174`; canonical microcontrast rises
`1.06 → 1.42`, chromatic contrast `.43 → .47`, and macro range `30 → 35`,
with support `1`, coverage `.967`, continuity/cavity control `1`, and zero
clipping. E60 exact ISZS quality is `95.463/98.291/99.174` at 1×/2×/4×; the
full composed matrix is exact and cross-scale verified with zero browser
errors. With the E62 baseline, exact Oxygen quality is `100/100/99.73`, coverage is
`.929`, luma SD is `5.32–5.33`, microcontrast is `.48–.51`, chroma is
`.45–.49`, and macro range is `24` at 1×/2×/4×. Smoke and Noble controls
remain stable, and Noble remains the Gas-family floor. The current canonical
2× family rank is Organic `79.044`, Contact
`91.216` (Water/Metal chromatic separation), Gas `95.463`, Solid `98.291`
(E60 exact ISZS crystal hierarchy), Emission `98.475`, and Powder/Liquid `100`.
ISZS is no longer the Solid floor. Do not
immediately stack another PLNT, contact, ROCK, VIBR, ISZS, Oxygen, or generic-
gas layer. Because E36 already
proved that
the PLNT aggregate scorer can penalize accepted broad canopy recomposition,
select the next experiment from a new fit-view diagnosis rather than tuning
only to the rank.

The separate app-owned candidate-survey v1 fixture uses
the deterministic 612×384 RenderLab backend unless `simulation=native` is
explicit. It freezes semantic hash `2255453673`, 115,368 occupied cells, all
six candidate counts, and six 2,880-cell scored regions at 1×/2×/4×. The
pre-E48 canonical 2× survey selected Snow from quality `4.808`, microcontrast
`23.702`, and visibly granular fit-view evidence. With E48 explicitly enabled,
Snow reaches quality `92.916`, microcontrast `5.702`, full support, and zero
dark/clipped fraction. That accepted result selected Quartz next: E49 raises
canonical 2× Quartz quality from `75.98` to `100`, lowers microcontrast from
`18.900` to `8.313`, and retains luma deviation `10.159`, chromatic contrast
`2.833`, macro range `30.375`, full support, and zero dark/clipped fraction.
That post-E49 evidence selected visibly over-busy C4 `31` (quality `90.186`,
microcontrast `16.819`) for E50. With E48/E49/E50 explicitly enabled, the
post-E50 canonical survey raises C4 to quality `100`, microcontrast `7.204`,
luma deviation `8.691`, chromatic contrast `2.095`, and macro range `26.172`,
with full support and no dark/clipped pixels. That result selected BASE `53`,
the only persistent measured deficit at quality `96.226` and optical-variation
component `.8361`, stable within `.015` quality across 1×–4×. E51 now closes
the deficit with an exact native-state/OPS contract: public BASE maps exactly
to native `PT_BASE`; `life` concentration `0..100` and `tmp == 1` spark state
are projected without inference; and real dilution, Acid/CAUS neutralisation,
Oil→SOAP, freezing/evaporation products, corrosion, and pressure reactions stay
authoritative. The focused matrix proves Canvas and realistic WebGL 1×/2×/4×,
then true 4896×3072 compact WebGL with a completed fence, byte-exact off
repetition, stable support/topology, protected walls and foreign owners, and
zero browser errors. Nitro's saturated quality-`100` score masked a visibly
flat olive body: canonical 2× luma SD/microcontrast/chroma/macro range was
`6.287/.202/.271/24.365`. E63 was selected from that fit-view deficit, and the
explicit selector raises those measures to `7.129/.321/.332/27.918` with full
support/coverage and zero clipping while adding coherent crown/pocket volume.
BGLA's historical quality-`100` candidate card selected E52; it is not its
acceptance evidence. A later visible fit-view diagnosis showed that E52's fine
splinters still read as uniform pepper, selecting E64 without retuning E52.
With both explicit selectors active, BGLA remains quality `100` at every scale;
luma deviation is `7.808/7.822/6.699`, microcontrast
`5.397/6.348/5.004`, chromatic contrast `3.170/3.076/2.363`, and macro range
`27.043/24.229/22.665`, with full support and zero dark/clipped fraction. The
explicit-selector candidate matrix closes Snow's former 4×
fit-view loss: quality is `93.614/92.916/93.274`, microcontrast is
`4.815/5.702/5.424`, chromatic contrast is `1.307/1.224/1.235`, and macro range
is `24.657/23.679/22.240` at 1×/2×/4×, with full support and zero dark/clipped
fraction. Do not alter E48 from candidate-rank evidence; its focused exact-owner
fixture remains the acceptance contract. Choose any later experiment only from
a new visible fit-view diagnosis. Preserve the E14 1× stencil snap and all
E01–E67 selectors and controls.

E65 is the first accepted Phase-2 velocity-reactive liquid checkpoint. It is now
part of the selectorless normal-WebGL E08/E03 baseline. Exact authoritative
Water reuses the semantic texture's
already-packed signed velocity `.ba` and E08's existing centre/four-cardinal
semantic reads. Coherent motion bends the established same-owner transmission
lookup and adds a world-anchored cyan-white crest only where E08 has already
proved a connected air-facing liquid-field slope. This is RGB whitecap light,
not detached spray support: it adds no texture, sampler, field, pass, target,
upload, allocation, scheduler stage, clock, alpha, silhouette, ownership,
topology, or physics decision. Stationary Water, deep Water, moving Oil/Acid,
one-cell Water, isolated Water, authored holes/chimneys, Water/Metal and
Water/Oil contacts, co-located native walls, Canvas, and compact true 8× are
exact controls.

`npm run audit:vfx:liquid-motion` now aliases
`npm run audit:visual-lab:water-motion`. The generic production-bundle harness
prepares the retained paused moving fixture during temporary Canvas startup,
then captures same-page off/A/B at exact liquid target `2` after WebGL promotion.
Preserve its 53,121 Water, 7,232 Oil, 4,992 Acid, 2,240 Metal, 1,232 native-wall,
and 34,013 moving-velocity-cell topology. The canonical 2× migration proof kept
semantic, liquid-field, framebuffer-alpha, and support hashes exact, produced
distinct A/B captures, and reported zero browser errors. The former bespoke
selector matrix and its 1×/2×/4× response bounds remain historical acceptance
evidence. E08 now owns the ordinary baseline and compact true-8× exclusion.
This closes the first whitecap/flow-refraction slice only; detached spray,
geometric-alpha curvature-flow smoothing, and advected gas/fire volumes remain
open Phase-2 work.

E66 is the accepted exact-Water curvature-flow-inspired optical-meniscus
checkpoint, independently selectable with `?waterCurvatureVfx=0|1`. It is a
strict normal-WebGL HDR child of E08/E03. Its curvature arithmetic remains
velocity-independent, so a resting curved shoreline may respond while accepted
E65 motion stays present for moving Water. At true 1×/2×/4× it
reuses `uLiquidTexture` and takes exactly two guarded tangent samples at ±12
world cells around an already-proven ordinary connected Water surface. Their
signed curvature residual gives a bounded cyan lift to convex crests and blue
absorption to concave inlets. This is optical curvature styling, not geometric
alpha smoothing: scene alpha, support, silhouette, topology, ownership, and
physics remain unchanged. It adds no texture, sampler, field, pass, target,
upload, allocation, scheduler stage, or clock. Flat shore, deep core, other
liquid species, strands/droplets, holes/channels, contacts, native walls, blank
space, Canvas, and compact true 8× are exact controls.

`npm run audit:vfx:water-curvature` runs paused topology-identical moving and
still off→on→off fixtures at 1×/2×/4×. Both must retain exact semantic,
material, wall, velocity, alpha, and support state, byte-identical repeated-off
frames, positive convex response, negative concave response, and exact flat-
shore/protected controls. Requested-on true 8× must report E03/E08/E66/
HDR inactive for `scale-8`, keep the dense fixture absent, present exact
4896×3072 WebGL, and complete the canonical GPU-fence proof while preserving
the recovery contract. With accepted E65 composed underneath, moving/still
target differences stay bounded to RGB RMS `.25`, spatial RMS `.20`, signed
mean `.15`, coverage `.08`, and peak `2`; cross-scale coverage span is at most
`.20`. The selectorless full-matrix fence completed in `5.2426 s` with zero
browser errors. Detached spray remains deferred until a real air-side state/support
source exists.

E67 is the accepted exact-Fire temperature/velocity identity checkpoint,
independently selectable with `?fireFlameVfx=0|1`. Normal 1×–4× WebGL HDR
reuses the existing quantized semantic temperature, cohesive Energy/emission
support, packed native velocity, flow/pulse carrier, analytic normal, and the
four-sample same-owner count already returned by `occupancyShape`. Requiring a
full 2×2 exact-Fire neighbourhood preserves one-cell strands and isolated Fire
while broad bodies gain a hot yellow-white core, cool orange-red absorption,
and an additional warm lifted tongue only under genuine upward velocity. The
effect changes RGB only and adds one uniform but no sample, sampler, texture,
field, pass, target, upload, allocation, scheduler stage, new clock/noise,
alpha, support, silhouette, ownership, topology, or physics decision. Canvas
and compact true 8× remain E67-inactive.

`npm run audit:vfx:fire-flame` owns topology-identical paused still/moving
fixtures with 48,833 Fire cells and exactly 4,484 moving Fire velocity cells.
At 1×/2×/4× the hot-core RGB RMS is `9.80/9.78/9.77`, the cool-pocket response
is `1.80/1.80/1.80`, the moving tongue is `4.98/5.03/5.05`, and the matched
still tongue is `1.51/1.52/1.51`; maximum cross-scale RGB/spatial drift is
`.07/.109`. Every per-mode off→on→off proof preserves exact semantic,
material, temperature, wall, velocity, alpha, and support state and a
byte-identical repeated-off framebuffer. Sparse and disjoint non-Fire controls
are RGB-exact. The post-HDR composite separately bounds Fire/contact and wall
spill to eight bytes (accepted peak `6`) and empty hole/channel bloom to three
bytes (accepted probe peak `0`) while their alpha/support remain exact. Requested-on
true 8× reports E67/HDR inactive with `scale-8`, no bloom or dense fixture,
exact 4896×3072 WebGL, and a real GPU fence (accepted full-matrix run
`3.1667 s`, zero browser errors). Choose a later owner/effect from a fresh
composed fit-view diagnosis rather than widening E67 by resemblance.

E68 is the accepted propagated-CFLM cold-flame volume checkpoint,
independently selectable with `?cflmColdFlameVfx=0|1`. A fresh production 4×
survey found the established composed families intact but showed CFLM as a
flat pale slab whose E07-only directed/reversed captures were nearly
indistinguishable. Normal 1×–4× WebGL now treats exact atmosphere style `12`
as a strict E04/E07 child: it reuses coherent native-flow derivatives,
atmosphere density/cardinals, field-owned body support, centre emission, and
optical depth for a broad cyan leading key and green-absorbing violet recess.
Still or incoherent CFLM is an exact no-op. The fold is RGB only and adds one
uniform but no sample, sampler, texture, field, pass, target, upload,
allocation, scheduler stage, wave, clock/noise, alpha, support, silhouette,
ownership, topology, or physics decision. Canvas and compact true 8× remain
E68-inactive.

`npm run audit:vfx:cflm-cold-flame` runs topology-identical directed,
reversed, and still off→on→off fixtures at 1×/2×/4×. It hashes the full
semantic, material, native-wall, raw/staged velocity, propagated atmosphere
style/motion, emission, alpha, and support planes, and it adds exact moving
CFLM/Metal, CFLM/Water, and CFLM/native-wall contacts. Acceptance requires a
broad core-plus-shoulder response, both cyan and violet projections, at least
two same-zone spectral reversals, bounded cross-scale magnitude, byte-exact
disabled restoration, exact still/sparse/foreign/wall controls, and at most a
one-byte final-composite spill on the Metal/Water side. The authored CFLM hole
and channel retain byte-exact alpha/support; only their pre-existing
atmosphere-owned RGB may respond, capped at 48 peak and 16 RMS bytes.
Requested-on true 8× must report E04/E07/E68/HDR inactive for `scale-8`, omit
the dense fixture and bloom resources, present exact 4896×3072 WebGL, and
complete a real GPU fence before the checkpoint is accepted.
The accepted full matrix records primary-body RGB RMS
`1.748/1.751/1.758`, cyan–violet spectral span `8.36/8.77/8.76`, directed
core chroma `1.97/1.99/2.01`, and reversed core chroma
`-1.04/-1.04/-1.05` at 1×/2×/4×. The authored hole remains low-alpha with
RGB RMS `9.40/9.78/10.11` and peaks `24/25/26`; the open channel stays at or
below `.34` RMS and one peak byte. Contact-side spill occurs only at 1×
(`.02/.10` RMS, one peak byte) and is exact at 2×/4×; the co-located wall is
exact throughout. The true-8× exclusion fence completed in `5.2063 s` with
zero browser errors.

E69 is now the accepted always-present normal-WebGL HDR exact-Oil motion-surface
baseline inside E08. A fresh composed fit-view diagnosis selected moving Oil
because its established E22/E38 amber body and volume finish lacked directional
surface transport. Only authoritative ordinary Oil `8` on an already-proved
same-owner air-facing surface with authentic packed native velocity may respond.
The baseline reuses the semantic centre/cardinals, species-valid liquid samples,
packed velocity, surface normal/depth, HDR reflection, native-wall sample, and
already-live Oil sheen/caustic carriers. It is RGB only and adds no selector,
sample, sampler, texture, field, pass, target, upload, allocation, scheduler
stage, wave, clock/noise, alpha, support, silhouette, ownership, topology, or
physics decision. Canvas and compact true 8× remain outside the HDR/E69 path.

`npm run audit:visual-lab:oil-motion` combines a narrow structural assertion with
the generic production-bundle Visual Lab command using the app-owned
`oil-motion` fixture, liquid target `8`, and canonical 2× presentation. The
moving fixture is staged during Canvas `webgl-starting`, and the selected variant
must survive promotion before same-page off/A/B capture. Variants reuse existing
motion, normal, reflection, and flow-facing values while semantic state,
liquid-field alpha, framebuffer alpha/support, holes, walls, and foreign owners
remain exact. `audit:vfx:oil-motion` is retained only as a compatibility alias.
The parent E08 gate owns baseline correctness and uses completed renderer frames
for WebGL capture; compact true 8× still presents exact 4896×3072, keeps HDR
inactive, and completes a real GPU fence. The former moving/reversed selector
matrix and its measurements remain historical acceptance evidence, not a live
toggle contract.

E70 is the accepted normal-WebGL HDR-only exact-Steam condensate-volume
checkpoint, independently selectable with `?steamCondensateVfx=0|1`. A fresh
gas-identity capture showed propagated WTRV style `2` as a smooth but flat pale
slab. E70 remains a strict child of E04 and admits only exact style `2` inside
an already-connected, non-wall, non-emissive atmosphere body. It recombines
the existing body support, atmosphere/cardinal density, static billow carriers,
directional relief, curvature, forward scatter, and optical depth into broad
pearly warm crowns and red-absorptive cool pockets. The effect changes RGB
only, adds one selector uniform, and adds no sample, sampler, texture, field,
pass, target, upload, allocation, clock/noise, alpha, support, silhouette,
ownership, topology, or physics decision. Canvas and compact true 8× retain
their established style-2 presentation.

`npm run audit:vfx:steam-condensate` runs a deterministic paused off→on→off
matrix at 1×/2×/4×. Its exact fixture includes a broad WTRV body with strong
positive/negative macro probes, authored void/channel, sparse
carrier/midpoint/gap/thin/isolated controls, Steam/FOG seam, Water/Metal
contacts, native wall, blank, and every one of the 16 non-Steam propagated gas
identities. Semantic/material/style/atmosphere, native wall, alpha, support,
and repeated-off framebuffer state remain exact. Accepted RGB RMS is
`2.72/2.72/2.73` broad, `9.28/9.27/9.26` core,
`11.36/11.34/11.33` crown, and `2.62/2.65/2.66` pocket at 1×/2×/4×; sibling
identity probes are exact, the one-cell strand stays within two RGB bytes, and
the open-channel HDR footprint stays within one while the eligible Steam/FOG
edge stays within four/two. Requested-on true 8× keeps
E04/E70/HDR inactive, omits the dense fixture and bloom resources, presents
exact 4896×3072 WebGL, and completed its final frozen GPU fence in `5.0554 s` with zero
browser errors. Select the next experiment from a fresh composed/material
capture; do not immediately broaden E70 to generic CleanGas or another gas
identity by visual resemblance.

E71 is the accepted normal-WebGL exact-PLNT foliage-consolidation checkpoint,
independently selectable with `?plantCanopyFoliageVfx=0|1`. A fresh pre-E71
production capture kept Organic as the weakest scored family (`79.044`) and showed that
PLNT already had abundant fine mottling but still read as one rounded cushion.
E71 is therefore a strict child of the complete
E20/E26/E28/E32/E34/E36/E53/E55/E58 chain. It reuses E58 hierarchy, E55
interlock, canopy rank/overlap, E20 leaf albedo, and the existing environment
term to organize that grain into broader overlapping green crowns and
olive/purple pockets. It changes RGB only and adds one selector uniform but no
new noise call, sample, sampler, texture, field, pass, target, upload,
allocation, clock, alpha, support, silhouette, lifecycle, topology, ownership,
state, or physics decision. Canvas and compact true 8× retain E58 unchanged.

`npm run audit:vfx:plant-canopy-foliage` runs a hydrated off→on→off matrix at
1×/2×/4× over the existing asymmetric Wood/PLNT fixture. Semantic,
alpha/support, lifecycle, native-wall, auxiliary, target, and raw-control
state stay exact; repeated-off frames are byte-identical and all composed
controls stay within one RGB byte. Accepted left/right target RGB RMS is
`4.22/4.24/4.25` and `4.76/4.77/4.77`, with spatial RMS
`3.786/3.808/3.817` and `4.410/4.422/4.425`. Meso share is
`.7733–.7870`; fitted local contrast retains `.9315–.9499` while macro range
grows by `4.41–5.18` bytes. Independent image review found clearer overlapping
midscale lobes, retained fine grain, unchanged channel extrema, and no seam,
halo, clip, or silhouette artifact. Requested-on true 8× keeps the full
botanical ancestry, E71, HDR, and bloom inactive, retains exact 4896×3072
WebGL and stable semantics, and completed its frozen full-matrix GPU fence in
`5.1245 s` with zero browser errors. Select the next experiment from a fresh
capture; do not add another PLNT octave by default—the remaining visual issue
is branch-coupled shape/depth, not missing high-frequency texture.

The corrected post-E71 canonical 2× survey explicitly requests the child under
`inputAudit=1`, proves `plantCanopyFoliageVfx=active`, exact 1224×768 backing,
and zero browser errors. Its Organic heuristic falls to `71.608` because the
ranker rewards precisely the fine mesostructure E71 deliberately consolidates;
that score is therefore diagnostic of a ranker blind spot, not a reason to
restore noisy foliage. Screenshot review selected the nearly uniform static
exact-Oil body for E72.

E72 is the accepted normal-WebGL exact-Oil depth-transmission checkpoint,
independently selectable with `?oilDepthTransmissionVfx=0|1`. It is a strict
child of E38/E22 and therefore E03, and can style only E38's already-proven
authoritative, deep, connected Oil `8` body. It reuses `oilBodyWeight`,
`liquidOpticalDepth`, `oilBodyCrown`, `oilBodyPocket`,
`liquidFresnelContour`, and `reflectedEnvironment` to carry a shallow amber
crown continuously into a deep blue-weighted absorption pocket. It adds no
sample, sampler, texture, field, resource, pass, target, upload, allocation,
noise, clock, motion, alpha, support, silhouette, ownership, topology, state,
or physics decision. Canvas and compact true 8× contain no E72 branch and
retain the accepted E38 presentation.

`npm run audit:vfx:oil-depth-transmission` runs deterministic off→on→off
captures at 1×/2×/4× over the established exact-Oil fixture while E03/E22/E38
remain active. Raw RGBA, semantics, liquid depth, liquid-field ownership,
native walls, alpha/support, and repeated-off framebuffers stay exact. The
accepted E65 baseline is exact-Water-only and this static fixture authors no Oil
velocity, so both E65 and the accepted E69 baseline are naturally inert. Accepted
transition RGB channel means are roughly
`+2.18…+2.25`, `+1.36…+1.42`, and `+0.40…+0.41`; deep means are roughly
`−1.45`, `−2.00…−2.01`, and `−2.77…−2.79`. The open and wall-backed complete
bodies measure respectively `2.44–2.45` and `2.16` RGB RMS. Surface, first,
shallow, authored holes/chimneys, sparse owners, foreign materials, walls, and
blank stay exact. Composed filtering is capped at one byte for
`WALL_CONTROLPinhole` and `oilSandOil`, two for `oilGlassOil`, and three for
`oilDieselOil`, `oilWaterOil`, `oilMetalOil`, and `oilSmokeOil`; every other
composed control, every foreign-side probe, and every raw probe remains exact.

Independent fit-view review accepts a continuous crown-to-pocket hierarchy
with no neutral shelf or stripe. E38's high-frequency residual changes by only
`+2.4%`, and E72 introduces no clipping, halo, silhouette, meniscus, or
authored-hole change. Requested-on true 8× retains the exact 4896×3072 blank
plane with E03/E22/E38/E72 and HDR selectors/resources inactive and completes a
real GPU fence; the final frozen run measured `5.5271 s` with zero browser errors.
Canonical `inputAudit=1` evidence must request E72 explicitly. Select the next
experiment from a fresh composed/material survey rather than adding another
Oil layer. The final canonical composed 1×/2×/4× matrix reports E72 active,
full Oil support, zero dark/clipped fraction, luma standard deviation
`6.05/6.07/6.10`, microcontrast `.45/.46/.48`, and a stable `28`-byte macro
range / `33`-byte total luma range.

### Accepted E73 — exact Carbon Dioxide core fold

E73 is a normal-WebGL-only, independently selectable
`?carbonDioxideCoreFoldVfx=0|1` child of E44 and therefore E04. It is limited
to E44's authoritative dense propagated style-6 Carbon Dioxide and reuses only
the established body support, optical depth, connected-neighbour density,
curvature, directional relief, billow, and third-carrier arithmetic. Their
broader opposing fold adds cool transmission crowns and blue-grey absorptive
pockets without any new sample, sampler, texture, field, resource, pass,
target, upload, allocation, noise, clock, alpha, support, silhouette,
ownership, topology, state, or physics decision. Canvas and compact true 8×
retain E44; generic `inputAudit=1` keeps E73 off unless it is explicit.

`npm run audit:vfx:carbon-dioxide-core-fold` freezes deterministic
off→on→off evidence over E44's exact fixture at 1×/2×/4×. Whole-body RGB RMS
is `3.17`, coverage `.556/.559/.558`, peak `8`, and bipolar balance
`.832/.836/.836`; the positive anchor has RGB RMS `5.23`, signed mean
`4.99/4.99/5.02`, and peak `7`, while the negative anchor has RGB RMS
`5.62/5.61/5.63`, signed mean `−5.06/−5.07/−5.08`, and peak `8`. Response
channels drift by at most `.08` byte across scales. Every authored opening,
foreign gas, sparse probe, contact owner, wall, blank, semantic, atmosphere,
alpha/support, and repeated-off control is exact except one named soft-rim RGB
allowance (`<=5` composed, `<=12` raw) whose alpha remains exact. Requested-on
true 8× stays blank at 4896×3072 with E73/HDR inactive, no fixture upload, and
a real `gpu-fence`; the frozen run measured `5.2481 s` with zero errors.

The canonical composed matrix explicitly enables E73. Carbon Dioxide now
measures luma deviation `5.06/5.07/5.07` versus the pre-E73 `3.88`,
microcontrast `.38/.39/.39`, chromatic contrast `.43/.45/.47`, macro range
`18/19/19`, total range `27/27/28`, coverage `.955`, full support, one
dominant component, and zero dark/clipped fraction at 1×/2×/4×. The fit-view
acceptance rail prevents the isolated fixture from hiding a return to the old
flat grey lozenge.

### Accepted E74 — exact Concrete 4× mesostrata/detail retention

E74 is normal-WebGL-only and independently selectable with
`?concreteMesostrataRetentionVfx=0|1`. The presenter activates it only at 4×;
1×/2×, Canvas, Local, Grains, and compact true 8× are exact exclusions. It is
a strict child of E05 and the settled mesostrata selector. Exact Concrete 26
reuses only the existing 4× mineral/facet attenuation and established
slope-directed mesostrata delta after the live wall and raw suspension-alpha
guards pass. The effect is RGB-only and adds no sample, sampler, texture,
field, resource, pass, target, upload, allocation, clock, alpha, support,
silhouette, ownership, topology, state, or physics decision.

`npm run audit:vfx:concrete-mesostrata-retention` freezes off→on→off evidence
for the inactive/inactive/active 1×/2×/4× selector matrix. At 4× the accepted
core and settled near-surface responses have RGB RMS `3.9539/3.857`, peaks
`10/11`, and coverage `.9918/.9797`. The two detail regions have RGB RMS
`3.8189/3.8118`, mesostrata RMS `.9313/.9215`, cell RMS `3.2689/3.2632`,
microchroma retention `1.2249/1.2216`, downsample retention `.9889/.9887`,
and lattice ratio `6.1521/6.0849`. Full non-Concrete cards plus Concrete
hole, thin/single/unstable structure, the complete wet-contact strip and Water
side, native wall, guarded blank, semantic/wall/auxiliary/velocity planes,
alpha/support, Local/Grains, and repeated-off framebuffers remain exact.
The signed response is frozen as well: core/surface and the right detail pocket
remain negative, while the left detail key remains positive. A separate 4×
child-requested/parent-disabled pair is exact in Smooth, Local, Grains,
semantic/state, and protected-region evidence, so E74 cannot revive E05.

Requested-on true 8× now prepares and displays the populated four-material
powder atlas rather than testing only blank startup. E74/E05/HDR remain inactive
at exact 4896×3072, but dense/detail/fine/wet/wall material controls are visibly
present and the authored hole/guarded blank remain empty. Its post-fixture frame
completed a real `gpu-fence` within the one 30-second deadline (`5.2138 s` in
the latest accepted 4× route) with zero browser errors.

The canonical composed matrix explicitly requests E74. Concrete's pre-E74 4×
luma deviation / microcontrast / chromatic contrast / macro range / total
range `5.49/4.78/2.19/11/31` becomes `7.99/6.76/2.69/13/46`. The complete
1×/2×/4× sequence is `7.55/7.68/7.99`, `6.24/6.95/6.76`,
`3.23/3.04/2.69`, `17/14/13`, and `44/45/46`. Coverage remains `.942`, all
`2318` support pixels are recalled in one component, and dark, pinned, and
clipped fractions stay zero.

### E75 — accepted lifecycle-grounded native-tree PLNT canopy orientation

E75 is the accepted normal-WebGL-only strict E71 child, independently
selectable with `?plantCanopyLifecycleVfx=0|1`. It styles exactly two active,
authoritative native present+tree PLNT owners and reuses the existing E20 canopy
carriers with their exact packed present/tree/active state plus phase, direction,
and hydration bits to orient the canopy response. It adds no noise octave,
sample, texture, field, resource, pass, target, upload, allocation, clock,
alpha/support, silhouette, topology, ownership, state, or physics decision.
Inherited palette application remains its established later owner.

The successful deterministic normal-WebGL 1×/2×/4× off→on→off matrix preserves
exact packed lifecycle state, semantics, alpha, support, and protected controls.
The whole-body Green owner response is about `2.77` RGB RMS, peak `16–17`, and
coverage `.788–.792`; the Cyan owner is about `4.46` RGB RMS, peak `25`, and
coverage `.783–.784`. The bounded response is cross-scale stable. Zero-state,
presence-only, non-tree, inactive-tree, and SEED PLNT; holes, fine branches,
contacts, walls, and Canvas remain exact controls. Requested-on populated true
8× promotes exact `4896×3072` while E75 is inactive, then completes a real
`gpu-fence` in about `5.10 s`.

The post-E75 composed 1×/2×/4× matrix explicitly requests and proves E75 active
at every normal scale. The showcase `organicPlant` body deliberately remains a
zero-payload E71 control, so its unchanged `67.566/71.608/72.916` score is not
a reason to add another unguided PLNT octave. The next eligible ranked defect
is Water/Metal contact chromatic separation at `87.058/91.216/91.667`, with a
canonical component score of `.675`.

### E76 — accepted bilateral Water/Metal fit-view separation

E76 is the accepted normal-WebGL-only strict E56/E37 child, independently
selectable with `?waterMetalSeparationVfx=0|1`. It reuses E56's exact Water-side
band/crown/pocket and E37's exact Metal-side signed seam tone: Water receives a
restrained cool key and blue-preserving pocket response while Metal receives a
small opposing warm reflection. The two declaration-free branches add no
sample, texture, field, resource, pass, target, upload, allocation, clock,
alpha/support, silhouette, topology, ownership, state, or physics decision.

The frozen 1×/2×/4× off→on→off matrix measures horizontal Water RGB RMS
`1.71/1.68/1.70`, vertical Water `1.64/.82/.93`, horizontal Metal
`2.35/1.90/1.91`, and vertical Metal `1.51/.82/.93`, with peaks `2–5` and a
maximum cross-scale/orientation response ratio `2.3171`. Semantics, alpha,
support, backing geometry, repeated-off frames, Water/Glass, Oil/Glass,
Acid/Brick, Oil/Metal, deep cores, gaps, walls, traits, emission, holes,
channels, sparse liquid, powder, gas, blank space, and Canvas remain controls.
The only bounded neighbour responses are the authored WATR/METL strips and the
existing mixed-contact capsule. Requested-on true 8× stays inactive at exact
`4896×3072` and completes through a real `gpu-fence` in about `5.14 s`.

In the composed matrix E76 improves the weakest fit-view 1× Water/Metal score
from `87.058` to `88.756`, raising chromatic separation from `.6500` to `.7000`
while keeping support recall `1`, coverage `.947`, macro range `45`, and zero
clipping. Canonical 2× and 4× remain stable at `91.216/91.667`, so this closes
the visible low-resolution regression without manufacturing a wider boundary.

### E77 — accepted Noble Gas billow/core relief

E77 closes the post-E76 exact-Noble billow-depth deficit as a
normal-WebGL-only strict E31 child (and therefore E25/E04 descendant),
independently switchable with `?nobleGasCoreReliefVfx=0|1`. It is nested inside
exact style-7 `noblePrismSupport` and expands the accepted E31 composite around
the live `gasBase` albedo. Existing optical depth, atmosphere density,
cardinal-neighbour support, gas crown/pocket, and directional relief provide
all geometry. It adds no repeated wave-C prism mix, generic Noble tint, sample,
wave/noise octave, texture, field, pass, target, upload, allocation, clock,
alpha/support, silhouette, ownership, topology, state, or physics decision.

The calibrated 1×/2×/4× off→on→off matrix measures crown RGB RMS
`2.06/2.08/2.07`, signed luma `1.59/1.61/1.60`, and coverage
`.467/.483/.472`. The recessed pocket measures RGB RMS `2.73/2.67/2.67`,
signed luma `-2.06/-2.01/-2.01`, and coverage `.943/.914/.886`; response
microcontrast remains `.25–.33`. Repeated-off framebuffers are byte exact.
Authored voids and channels, sparse carriers/gaps, isolated Smoke/Oxygen/
Hydrogen/FOG/CFLM, Water/Metal contacts, walls, fields, alpha/support, and
semantic hashes remain exact. The adjacent Noble/FOG seam keeps exact raw
ownership and permits only its measured HDR-composed footprint (Noble peak
`4`, foreign FOG peak `2` bytes). Run
`npm run audit:vfx:noble-gas-core-relief`.
Requested-on true 8× promotes exact `4896×3072`, exposes E77 inactive with
reason `scale-8`, and completes through `gpu-fence` in about `5.16 s`.

The explicit composed A/B is the visual acceptance authority. E77 raises Noble
Gas quality from `95.351/95.463/95.463` to `100/100/100` at 1×/2×/4×, luma
deviation from `3.51/3.52/3.52` to `4.11/4.11/4.12`, and macro luma range from
`15` to `18`; coverage stays `.965` and clipping stays zero. Pure
curvature/directional arithmetic was inert in the saturated core. A rejected
uniform absorption candidate instead reduced the score to roughly
`92.5–92.8` by compressing the accepted luma structure. Keep the final
contrast-expansion approach: it deepens E31's existing low-frequency composite
without inventing a new carrier or particle texture. The canonical composed
route now explicitly requests E77 active; its CLI switch remains available for
the recorded attribution A/B.

### E78 — accepted Water/Metal Fresnel-spectrum separation

E78 is the accepted normal-WebGL-only strict E76 child, independently
selectable with `?waterMetalFresnelSpectrumVfx=0|1`. It applies opposing signed
RGB rotations only inside E76's already-proven exact Water/Metal contact:
Water moves toward a cool blue Fresnel shoulder and Metal toward a restrained
warm return. Both vectors are Rec.709-neutral to rounding. The declaration-free
branches reuse only E56/E76's band/crown/pocket/Fresnel carriers and E37/E76's
signed Metal seam tone; they add no band, coordinate pattern, sample, texture,
field, resource, pass, target, upload, allocation, clock, alpha/support,
silhouette, topology, ownership, state, or physics decision. Canvas and compact
true 8× retain their established E76-control presentations byte-for-byte.

`npm run audit:vfx:water-metal-fresnel-spectrum` runs exact off→on→off
horizontal and vertical cards at 1×/2×/4×. The final-backing proof records a
1× paired-seam chroma energy of `2.6574/2.7727` across the two orientations.
At 2×, Water's cool-lobe mean is `.8819/.9053` and Metal's warm-lobe mean is
`2.1690/2.0303`; at 4× they are `.8536/.9025` and `2.1505/1.8968`.
Water/Metal peaks remain `2/4` bytes, absolute luma means remain below `.032`
byte, the resolved 2×/4× seam is one world cell wide, and every repeated-off
backing is exact. The 1× categorical pair is two cells wide; cross-scale paired
chroma ratios remain at or below `1.9811`, and orientation ratios at or below
`1.0732`. Water/Glass, Oil/Glass, Acid/Brick, Oil/Metal, deep cores, gaps,
walls, traits, emission, holes/channels, powder, gas, and blank controls remain
exact. The only accepted final-page neighbour footprint is the named
`mixedTripleSolid` probe at one display byte; its raw ownership remains exact.

The canonical 2× composed A/B is the visual acceptance authority: Water/Metal
chromatic separation rises from `.6750` to `.6875` and contact quality from
`91.216` to `91.667`, while support recall stays `1`, coverage `.947`, luma SD
`10.55`, macro range `45`, dominant component `1`, clipping `0`, and E77 Noble
Gas quality `100`. A `1.75×` stronger candidate produced no further composed
gain and was rejected rather than accumulating invisible backing intensity.
The accepted amplitude is now explicit in the composed product stack.
Requested-on true 8× reports E78/HDR inactive with reason `scale-8`, presents exact
`4896×3072`, and completes through a real GPU fence in about `5.30 s`.

Fit-view audit lesson: a DPR-1 CSS screenshot cannot always resolve two opposing
subcell lobes at a one-cell interface. Use it for visible seam width, topology,
and the composed score; prove exact Water/Metal owner direction from the final
WebGL backing at 2×/4×. At 1×, report an honest paired seam instead of claiming
owner-resolved subcells. Do not add another Water/Metal colour layer after this
four-level chain. Select the next experiment from a fresh fit-view diagnosis of
powder, liquid, gas, or emission volume rather than chasing the remaining broad
contact-ranker quantisation.

### E79 — accepted Distilled Water/Diesel body optics

E79 closes the fit-view deficit where Distilled Water and Diesel inherited
E03's common liquid absorption and an identity accent but lacked their own
body-scale optical read. It is a normal-WebGL-only strict E03 child,
independently selectable with `?distilledDieselBodyVfx=0|1`. Exact DSTW `34`
with Aqueous optics and exact DESL `35` with Oily optics are the only owners;
both are ordinary liquid-category materials with neutral render profile `0`.
The branch reuses E03's existing column depth, broad sheen, caustic wave, macro
relief, Fresnel contour, and reflected environment. DSTW gains coherent cool
transmission/reflection lobes while DESL gains a warmer fuel crown and opposing
blue-forward absorption. It changes RGB only and adds no sample, texture,
field, pass, target, upload, allocation, clock, alpha/support, silhouette,
ownership, topology, state, or physics decision. Established liquid identity
remains a later layer; Canvas and compact true 8× remain unchanged.

`npm run audit:vfx:distilled-diesel-body` holds identity styling active and
varies only E79 through exact off→on→off navigations at 1×/2×/4×. DSTW surface
RGB RMS is `3.3181/3.3495/3.3123`, with core
`1.1587/1.0844/1.1667`; DESL surface is
`2.1157/2.1647/2.1536`, with core `1.1426/1.1222/1.1746`. Repeated-off RGB is
byte-exact, topology and alpha/support are invariant, cross-scale response is
stable, and cavities, open chimneys, strands, isolated droplets, native walls,
Water/Oil sibling seams, Metal, and blank space remain protected. The 2×
off/on captures show broad rather than particle-scale response. Requested-on
true 8× promotes exact `4896×3072`, reports E79 inactive, produces exact zero
response for both materials, and records zero browser errors.

Fixture attribution matters here. The earlier audit toggled established liquid
identity together with the new body candidate and therefore assigned an old
strand response to E79. Keep parent/identity layers fixed when measuring a
nested child. Likewise, a remote liquid-owner interior is a valid body target,
not a seam control; sample the actual interface for semantics/alpha and place
the foreign-owner RGB no-op probe safely inside the foreign block so bounded
HDR spill cannot masquerade as ownership leakage.

E80 closes the shared dark-backdrop deep-body leg without reopening E78/E79;
E81 closes the exact native PHOT-over-Metal lighting leg; E82 closes the first
authoritative-temperature exact-owner blackbody-relief leg. Pause the
detail-first ladder here and improve the framework that composes, selects, and
visually compares subsequent experiments.

### E80 — accepted dense-body ambient floor

E80 is the final bounded normal-WebGL floor for deep ordinary bodies. It runs
after the established liquid, solid, and identity stack, brightening only deep
exact family-2 liquid and thick non-granular, non-translucent family-0 solid
support with a hue-preserving RGB multiplier capped at five framebuffer bytes.
It adds no sample, texture, field, pass, target, upload, allocation, clock,
alpha/support, silhouette, ownership, topology, state, or physics decision.
Canvas keeps its semantic presentation, while compact true 8× deliberately has
no E80 branch or uniform.

`npm run audit:dense-body-ambient` runs DPR-1 canonical WebGL A/B/A at
1×/2×/4× through the existing source-target and liquid-identity fixtures. Deep
Water mean/peak response is `1.9028/3`, `1.8611/3`, and `1.8750/3`; deep Metal
is `.7083/1`, `.7083/1`, and `.6944/1`. Response is positive and full-coverage,
normalized-chroma peak stays at or below `.0036`, alpha/support and repeated-off
pixels are exact, and Water shore, Grains Sand, O₂, PHOT, thin structure,
native-wall coexistence, unlike-liquid seam, and isolated-liquid controls are
exact. The route also writes the canonical 2× A/B captures.

`npm run audit:dense-body-ambient:8x` proves exact `4896×3072`, a signalled GPU
fence (`gpu-fence`, about `5.27 s` on the accepted SwiftShader run), inactive
selector, and byte-identical requested-on no-op over a hydrated fixture. It
additionally holds the public presentation-refresh sequence fixed
across both setter calls and four later animation frames, protecting 8× from an
otherwise-wasted 15-million-fragment redraw. The earlier three-CDP-readback
form falsely attributed an unrelated queued Sand presentation to E80; keep the
atomic framebuffer proof and the later-refresh proof separate.

The first E81 preflight rejected settled-Powder "self-valley curvature" without
an implementation change: `occupancyShape` assigns `contourCurvature` only for
family-0 Solid, so family-4 Powder receives exact zero. E05's live signed
powder slope is directional relief, not genuine concavity; do not rename it or
add an unbudgeted neighbour sample merely to rescue the idea.

### E81 — accepted native PHOT spectral irradiance over Metal

E81 is a normal-WebGL-only exact-owner response, independently selectable with
`?photonMetalIrradianceVfx=0|1`. It styles an authoritative native PHOT spectrum
only where it is independently present over deep Metal, reusing the existing
decoded photon spectrum/peak and Metal `solidInterior`/optical-depth state. The
compact constant-gain expression is `0.068`; it is not generic photon glow.
E81 adds no sample, texture, field, pass, target, upload, allocation, clock,
alpha/support, silhouette, ownership, topology, or physics decision. Canvas
retains its semantic fallback.

Keep the normal path's exact-owner/depth eligibility compact. On SwiftShader,
redundant granular/translucent/contact guards and an attempted coefficient
extension with `solidKey`/`solidFresnel` made the response inert. Retain the
compact exact-owner/depth branch instead. Direct compact true 8× intentionally
excludes E81: no E81 branch, uniform, sampler, or resource belongs there.

`npm run audit:vfx:photon-metal-irradiance` freezes a DPR-1 WebGL compositor
screenshot A/B/A matrix at 1×/2×/4×. It proves red/green/blue/violet native
spectral ordering; exact holes, channels, thin/isolated/absent state, Water,
Glass, native-wall, blank, topology/contact/foreign-owner controls; byte-exact
repeated-off restoration; and at most `0.08` cross-scale RGB-RMS spread.
`npm run audit:vfx:photon-metal-irradiance:8x` proves requested-on compact true
8× is an exact no-op at `4896×3072` through a completed GPU fence (about
`5.77 s` on the accepted SwiftShader run), with an exact repeated-off
framebuffer, no later presentation refresh, and zero browser errors. Do not
claim photon velocity or directional streaks: no authoritative photon velocity
is projected.

### E82 — accepted native-temperature Ceramic blackbody relief

E82 is a bounded normal-WebGL exact-Ceramic response driven by the existing
authoritative temperature byte. It is a strict child of E19 and HDR, and packs
its selector into E19's existing `uCeramicGlazeVfx` scalar (`0` parent off, `1`
E19, `2` E19+E82) rather than adding another uniform to the pressure-sensitive
normal fragment. Inside E19's proven deep-owner guard it reuses Ceramic depth,
crown, pocket, and the established blackbody colour/radiance helpers. It
changes RGB only and adds no sampler, texture, field, pass, target, upload,
allocation, clock, opacity/support, ownership, topology, state, or physics
decision. Canvas and compact true 8× remain unchanged.

The deterministic five-card atlas uses native decikelvin values `2952`, `8192`,
`12288`, `15360`, and `23040`. A visual A/B/A at 1×/2×/4× keeps ambient/onset
exact and produces a monotonic warm/orange/bright core response of roughly
`0.34`, `1.38`, and `2.49…2.50` RGB RMS. Holes, notches, one-cell and isolated
owners, native walls, Water contact, hot Brick/Metal, blank space, semantic
hashes, and repeated-off frames remain exact. Requested-on true 8× reports
inactive `scale-8` at exact `4896×3072`, completes a real GPU fence in about
`5.31 s`, and records zero browser errors.

## Immediate direction — rendering experiment framework

The primary objective is framework leverage, not another isolated material
detail. The established reusable **normal-WebGL Visual Lab** is built at the
HDR-composition seam. It owns one immutable typed state and one fixed shader
`vec4` (`domain`, `variant`, `target`, `gain`), exposes a same-page off/A/B
browser control, and reports its resolved state through stable canvas dataset
fields. Classic, Canvas, unsupported HDR, and true 8× must resolve to an inert
state. With variant `0`, the default framebuffer must remain unchanged.

The HDR lab reuses textures already maintained by the presenter and values
already proved by the compositor. Its bounded domains are atmosphere-owned gas,
the shared emission volume, and exact connected air-facing Water/Oil/Acid
surfaces. It may compose those existing signals after the semantic HDR scene
without adding a simulation field, texture resource, render target, pass,
scheduler stage, or time-varying topology. Lab treatments are RGB-only; scene
alpha remains the sole silhouette owner. This deliberately moves rapid
aesthetic experiments out of the pressure-sensitive semantic fragment while
retaining the current compact true-8× path unchanged.

The reusable capture harness around that seam prepares a named deterministic
fixture, switches the fixed selector in the same page, writes
off/A/B PNGs and a compact JSON report, and enforces only WebGL/HDR activation,
browser-error freedom, and semantic/alpha/support invariance by default.
Subjective colour, light, and texture choices are accepted from visual evidence
and checkpointed early; they do not require another cloned verifier route or a
broad unit-test matrix. Optional adapters may add experiment-specific regions
or tighter topology checks when the candidate can affect a protected contract.

E62, E69, and E65 prove that the framework can absorb accepted leaf treatments
while deleting selector/plumbing and cloned verifier code. The typed domain
facade, executable capability profiles, exact 0/7/7 read budgets, declarative
fixtures, protocol-owned URL/dataset requirements, bounded Chrome lifecycle,
named recipes, content-addressed results, deterministic batch index, and static
contact sheet are complete and deployed at revision
`e06d11398a37dcf1558411a350af631452c4953e` by workflow run `31283340387`.
Operational CI review, accepted-baseline comparison, candidate-scoped promotion,
recipe sets, and gated deployment are now complete. The current milestone is a
single reusable portable verifier plus a same-run upload/download CI round trip,
so the downloadable review object proves itself without a workspace-only check
or another browser/build. After that proof, prioritize a typed generic fixture
preparation bridge, then an optional additive review brief; neither may widen
the frozen v1 records. Defer E66 and Powder until
their extra samples or source-stage stability proof fit the existing budgeted
facade without creating a second experiment framework.

### Visual Lab framework checkpoint

The framework seam is integrated on `main_codex`; later experiment branches use
it as shared infrastructure rather than cloning compositor or verifier paths.
`visual-lab.ts` resolves and packs the fixed `domain/variant/target/gain` state;
the browser audit API can switch off/A/B in place; and canvas datasets expose
the live resolved state. The ordinary HDR compositor remains a separate
five-sampler shader and binds no lab resources. Only an explicit Visual Lab URL
uses the eight-sampler permutation, reusing the existing atmosphere,
atmosphere-style, and emission textures. Gas wildcard targeting requires a
nonzero propagated style, preventing atmosphere overlapping Water/Solid from
being restyled. True 8× remains structurally outside the HDR pipeline.

`scripts/visual-lab-audit.mjs` is the reusable comparison harness. Prefer its
built-bundle path, which avoids flaky CDP navigation through an old dev server:

`npm run audit:visual-lab -- --candidate=gas-showcase`

It writes `off.png`, `a.png`, `b.png`, and `report.json`, and clears its own
Chrome process group/profile even on failure. The accepted framework proof ran
the Smoke-style gas domain at canonical 2× with exact `1224×768` backing and the
emission wildcard domain at 1×. Both reported WebGL/HDR active, zero browser
errors, distinct A/B images, and exact semantic, authoritative-field alpha, and
framebuffer alpha/support invariance. The gas A/B looks are comparison samples,
not accepted release styling.

The liquid extension reuses the completed E08 surface-transport proof and its
already-computed transmitted/reflected radiance. It adds no sampler, texture
read, field, target, pass, upload, allocation, clock, alpha, support, ownership,
or topology decision. Its canonical Water run is:

`npm run audit:visual-lab -- --candidate=water-motion`

That production-bundle run completed at exact `1224×768` WebGL/HDR with distinct
A/B captures, zero browser errors, and exact semantic, liquid-field alpha, and
framebuffer alpha/support invariance. The harness now selects its exact page
target, bounds target discovery, and tears down the detached Chrome process
group and temporary profile on ordinary exit, failure, SIGINT, or SIGTERM.

The framework lifecycle is now promotion-safe. `MaterialRenderer` retains the
latest same-page variant while the bounded Canvas startup is active and seeds it
without submitting an unhydrated WebGL frame. Every generic audit stages variant
B while the backend still reports `webgl-starting`, then proves that state after
promotion before running off/A/B. The domain capability table is renderer-owned;
reserved Powder resolves fully disabled instead of compiling and binding an
eight-sampler compositor that has no Powder implementation.

### Deployed checkpoint — named recipes, results, and batch index

This checkpoint is infrastructure, not a new look. The frozen recipe catalog
owns `domain/target/fixture/gain/renderScale`; `--candidate=<name>` rejects every
explicit recipe-owned flag, while base URL, bundle, output directory, Chrome,
and GPU remain composable environment options. The initial catalog is
`gas-showcase`, `oxygen-showcase`, `oil-motion`, and `water-motion`.

Build and capture a named request with:

`npm run audit:visual-lab -- --candidate=water-motion`

Reuse an existing production bundle with:

`npm run audit:visual-lab:capture -- --candidate=water-motion`

Every report retains full capability/protocol evidence and adds
`anifor.visual-lab.result/v1`: candidate name, normalized request, ordered
off/A/B hashes, and a deterministic `sha256:` identity over that exact record.
The batch runner resolves a selected set in frozen catalog order, launches one
fresh browser per candidate against one existing production build, independently
validates the actual PNG/report bytes, and publishes
`anifor.visual-lab.batch/v1` plus a static relative-path contact sheet. A failed
candidate retains its logs and failure tombstone but forces `complete: false`.
The reusable gate is focused catalog/result/batch tests, a production build, one
real named WebGL/HDR batch with invariant alpha/support, bounded Chrome cleanup,
CI success, Pages asset closure, and exact live revision. It adds no renderer
selector or CDP domain branch.

E62 Oxygen volume folding is the first migrated accepted treatment. Its
established exact-Oxygen arithmetic remains inside the E15 body proof, preserving
ordinary realistic output, while the dedicated resolver, float uniform, query,
dataset telemetry, and reload-based verifier are removed. Its maintained route is
now the generic command:

`npm run audit:visual-lab:oxygen`

The legacy `audit:vfx:oxygen-volume-fold` name aliases that framework command.
The target-4 production run passed at exact `1224×768` with a pre-promotion
selection, distinct A/B frames, exact semantic/atmosphere/framebuffer
alpha-support invariance, and zero browser errors. The migration removes roughly
300 lines of special-case audit/plumbing and adds no texture, sample, field,
pass, target, upload, allocation, or clock.

E69 Oil surface motion is the second migrated accepted treatment. Its exact-Oil
arithmetic is always present inside E08, while its resolver, uniform, query,
dataset telemetry, and bespoke moving/reversed verifier path are removed. The
maintained comparison route is:

`npm run audit:visual-lab:oil-motion`

That command runs a narrow structural check and the generic production-bundle
Visual Lab with the app-owned moving-Oil fixture and liquid target `8`. The
fixture is prepared during temporary Canvas startup and survives WebGL
promotion; canonical 2× off/A/B captures are distinct while semantic,
liquid-field, framebuffer-alpha, and support state stay exact. The migration
removes more than 800 lines of special-case verifier/plumbing and adds no
sample, texture, field, target, pass, upload, allocation, or clock. The parent
E08 browser gate now settles WebGL evidence on completed renderer frames rather
than exact whole-page PNG repetition, avoiding compositor-only page churn while
retaining exact control assertions and the real true-8× fence.
Its off/on/off sequence owns one post-fence PNG per independent navigation. At
normal 4× only, the caller permits a bounded 45-second compositor/CDP transfer
after the unchanged 30-second GPU-health fence; all other capture defaults stay
at 30 seconds.

E65 Water surface motion is the third migrated accepted treatment. Exact-Water
velocity/refraction and whitecap arithmetic is always present inside E08; the
resolver, uniform, query, dataset telemetry, and approximately 600 lines of
standalone browser-verifier plumbing are removed. Its retained app-owned fixture
is declared by the frozen adapter catalog and prepared without a harness branch:

`npm run audit:visual-lab:water-motion`

The legacy `audit:vfx:liquid-motion` name aliases that command. The canonical
2× production-bundle run staged the moving-Water fixture during Canvas startup,
promoted it to WebGL/HDR, produced distinct off/A/B captures at target `2`, kept
semantic/liquid-field/framebuffer-alpha/support hashes exact, and reported zero
browser errors. The lab hook reuses owner-selected E08 motion and flow-facing
locals for both Water and Oil while remaining texture-free; Acid receives no
motion cue. No sample, texture, field, target, pass, upload, allocation, clock,
alpha, support, ownership, or compact-8× branch was added.

The migration was checkpointed as
`c85e3cfdd1deb16dd4994a51db29929c01df76a3`; the later recipe/result framework
checkpoint is deployed at `70d33d8383e75dfb3f071b8e405be2f910d735fa` by
workflow run `31279274149`; the later batch/index checkpoint was deployed at
`e06d11398a37dcf1558411a350af631452c4953e`; and the opt-in full-catalog review
gate is deployed at `34c8a3db2dbcf0d497524aac15f0055984faf999` by workflow
run `31284862276`. Treat E65, the framework facade, local batch aggregation, and
CI deployment gating as complete.

The hook runs after bloom extraction. Emission experiments can reshape final
radiance but cannot seed new bloom until a deliberately budgeted pre-extract
hook exists. `scripts/visual-lab-fixtures.mjs` supplies declarative domain and
named-fixture catalogs; `scripts/visual-lab-recipes.mjs` adds validated named
requests without duplicating capability metadata; and
`scripts/visual-lab-result.mjs` gives every capture a canonical content identity.
The catalogs derive CLI validation/help, fixed URL flags, report target kinds,
field-alpha readers, bootstrap scenes, and optional app-method/argument
preparation. The serialized startup transaction observes
the mounted scene and Canvas `webgl-starting` state before any mutation, then
prepares and stages variant B synchronously; missing or throwing preparers return
immediate structured failures rather than consuming the 60-second readiness
budget. The focused Visual Lab tooling suite covers capability/fixture
catalogs, recipe validation, result identities, startup ordering, fail-fast CLI
ownership, URL construction, and compatibility aliases; the detached-process
lifecycle tests remain alongside them in `npm test`. The named Water candidate
passes at canonical 2× with exact topology/alpha invariants, distinct off/A/B
images, zero browser errors, and a deterministic content-addressed result.
The CI review and accepted-baseline route are proven by full deploy run
`31286841909`; all four candidates compared encoded-identical before exact live
asset closure. `visual-baselines/accepted-v1` pins the accepted result without
hashing run metadata. Candidate-scoped promotion closes the manual review loop
and is deployed at `aff67f50c6d75d1cf8ccca5e6b2cf2bf1d0c67a7` by run
`31288597052`; it validates the exact comparison and emits a full baseline
proposal plus a separate decision identity without auto-promoting or mutating
version control. The separately versioned recipe-set input and normalized
sidecar are deployed at `294f8e09226c39fc09b56c8270c9b8a6a3edfc59` by run
`31290360459`, so recurring cohorts no longer depend on copied CLI strings or
workflow dispatch history. The active extension is the read-only portable
batch/comparison verifier and exact same-run artifact round trip described
above. Defer a bounded PNG decoder and RGB metrics to v2, and extend the shared
verifier rather than cloning it or the workflow. Defer E66 and
Powder until the fixed HDR
seam can receive their stability/body proof without a second experiment
framework.

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
- **Foam, spray & meniscus:** E65 supplies a bounded exact-Water whitecap/refraction response from packed native velocity on already-connected E08 surfaces. E66 adds an independent optical curvature finish for resting convex crests and concave inlets; it does not smooth geometric alpha. E69 closes the first exact-Oil non-Water treatment with a velocity-oriented reflective slick and cool absorptive wake over the established E22/E38 body finish. E79 now gives static dense Distilled Water and Diesel distinct body optics without changing topology. Detached spray support, divergence-aware foam persistence, and Acid/Nitro motion-family treatments remain open and must retain exact topology controls.
- **Steam condensate volume:** E70 adds broad static pearly lobes and a cool recessed pocket only to exact propagated WTRV style `2`, reusing E04's connected atmosphere evidence without changing support or adding a field/resource. All other gas identities, sparse topology, Canvas, and compact true 8× remain controls. Advected vapour detail and light shafts remain separate future experiments.
- **Gases as participating media:** extend your density/colour field with a **noise-animated volume** — FBM curl noise advected by the velocity field, modulated by density, lit by the dynamic lights (light shafts through smoke are extremely high-impact). Approximate with 2–3 octave noise at half res, upsampled.
- **Fire:** E67 now adds an exact-owner temperature-stratified body and velocity-shaped tongue on the normal HDR path. Its procedural flow remains subordinate to authentic temperature/velocity state, sparse Fire stays discrete, and compact true 8× keeps the established generic Energy presentation. Persistent advected flame volume, ember/spray support, and dynamic light transport remain separate future experiments.

## Phase 3 — Material delicacy

**Goal:** each optical class gets a signature response instead of a shared treatment.

- **Botanical foliage hierarchy:** E71 consolidates the existing PLNT hierarchy into broader overlapping leaf masses while retaining its established fine grain and exact lifecycle/topology contract. Future work should couple visible canopy depth to real branch/growth structure rather than add another procedural octave.

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
