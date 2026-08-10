# Visual experiments

## Reconstructed atmosphere body finish

The shared material-body finish now gives a reconstructed gas body the same
bounded sooty/clean optical family as its exact semantic carriers. The
atmosphere field already propagates a nearest gas identity style byte; a
validated generated GLSL bridge maps that closed style set to the existing
`SootyGas` or `CleanGas` optics classes. A mixed, missing, or suppressed style
falls back to the established generic gas response.

This is deliberately not a second atmosphere representation. It adds no
sampler, texture, field, upload, target, pass, or material-ID reconstruction.
The normal compositor reads the existing style only in a gas-volume branch; the
compact true-8× path uses the same existing style sample only where its gas
body finish is already eligible. The bridge feeds RGB-only shared body finish
and volume-lobe parameters. Atmosphere density remains the sole owner of
coverage and alpha, and atmosphere RGB remains the sole owner of cloud colour.

Evidence:

- `npx vitest run src/renderer/reconstructed-volume-optics.test.ts
  src/renderer/pixi-field-presenter.test.ts` proves the closed style mapping,
  shader-source integration, and normal/compact call-site budget.
- `npm run audit:gas-identity:8x` exercises the real compact true-8× path with
  its bounded renderer fence and browser-error checks.
- `npm run visual-lab:review -- --cohort=atmosphere` remains the normal
  current-only human/agent review loop; its package hashes authenticate only
  that review package and do not pin an earlier visual baseline.

## Reconstructed liquid body finish

Liquids need an exact local optical family for their finish even where the
connected liquid field supplies the smooth coverage. That information cannot
share the existing auxiliary R8 bytes: their compact-path interpretations are
already reserved for powder projection/stability and semantic contact data.
The presentation layer therefore carries one nearest-filtered liquid optics
plane alongside the established liquid density field. CPU reconstruction still
selects a unique supported species, but writes only its canonical `RenderOptics`
class. The plane is cleared on every field refresh and read only by an eligible
liquid body finish, so neither WebGL path needs a dependent palette lookup.

The plane does not change material/family ownership, optical-depth generation,
support, silhouette, contacts, or alpha. Both normal WebGL and compact true-8×
derive their RGB-only finish from the pre-existing connected interior; exact
semantic cells additionally retain vertical depth. The new class is solely the
optical-family selection input. This deliberately bounded new resource is
preferable to overloading a byte whose different compact interpretation could
corrupt a projected powder exterior.

Evidence:

- `npx vitest run src/renderer/liquid-density-field.test.ts
  src/renderer/render-field-set.test.ts src/renderer/pixi-field-presenter.test.ts`
  checks allocation, clear/tie behaviour, field propagation, and shader
  ownership boundaries.
- `npm run audit:distilled-diesel-liquid:8x` exercises the direct compact
  liquid path at true 8× while checking its production bundle and WebGL
  lifecycle.
- `npm run visual-lab:review -- --cohort=liquid-motion` remains the normal
  current-only review loop for visual preference.

## Settled earth powder bodies

The canonical normal WebGL compositor now treats a packed, temporally settled
Smooth body of Sand, Stone, Clay, or Concrete as continuous material rather
than independently coloured simulation cells. It retains a bounded mineral
trace, then restores the existing broad mesostrata and body-light layers.

The treatment is RGB-only and uses only already-decoded semantic contact and
stability values. It does not add a texture, field, pass, allocation, or
output-scale resource. Local, Grains, other powder families, alpha, semantic
ownership, authored holes, thin/single-grain controls, and the separate direct
8x shader remain outside the treatment.

Evidence:

- `npm run audit:powder-mesostrata` exercises dense Sand/Stone/Clay/Concrete,
  holes, columns, isolated grains, liquid contact, walls, and Local/Grains
  controls.
- `node scripts/verify-browser-input.mjs --powder-mesostrata-graphics-only
  --webgl-only --production-bundle --screenshot=/tmp/powder.png` captures the
  final styled audit fixture for visual comparison.
- `node scripts/verify-browser-input.mjs --eight-powder-only
  --production-bundle` retains a bounded true-8x startup/timing/powder check;
  the complete `--scale-eight-only` suite remains the publication gate.

## Saturated sponge volume at true 8x

The direct 8x compositor now restores the normal renderer's absorbed-light
read for genuinely soaked SPNG cores. It layers a small monotonic deep-wet
darkening only after exact SPNG ownership and the native packed hydration flag
are decoded. Low and mid hydration retain the porous surface response, while
high and saturated states gain a darker, denser internal body. The term is
RGB-only arithmetic: it adds no sampler, field, pass, allocation, alpha,
support, or topology decision.

Evidence:

- `npm run audit:spng:8x` starts an independent true 4896x3072 WebGL context,
  proves completed GPU timing, then checks exact dry/low/mid/high/saturated
  SPNG state topology, owner/material controls, off/on/off determinism, and
  strictly monotonic hydration response.

## Release-gate observation

The focused true-8x powder gate has completed at the required 4896x3072 backing
with a GPU-fence result, no browser errors, distinct Smooth/Local/Grains output,
and preserved high-zoom input. The verifier now bounds every 8x completed-frame
poll and the compositor screenshots it owns, so an unhealthy frame cannot leave
Chrome or the test process waiting behind an unbounded CDP request.

An exhaustive single-session `--scale-eight-only` run cleared the broad visual
atlas, deep zoom, liquid identity, and the dedicated earthen-powder fixture, but
eventually exhausted its 30-second live-frame watchdog when it reached a later
stateful fixture after more than forty minutes of forced 15-million-fragment
captures. A clean SPNG state audit passes in both backends. The release verifier
now runs that independent retained-state/recovery tail in a fresh promoted 8x
context, while asserting unchanged CSS geometry and true 4896x3072 backing at
the seam. Its screenshot hand-off also has its own short compositor bound after
the mandatory 30-second GPU-fence deadline has signalled. The focused 8x powder
gate has passed with this policy. Do not publish from this observation alone—the
batched complete gate must still be green.
