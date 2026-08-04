# Visual experiments

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
